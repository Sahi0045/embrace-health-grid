/**
 * Super Admin server functions — Embrace Health Grid
 *
 * Platform-level operations that only a super_admin may perform:
 *   - getHospitalAdmins()   — list all admin-role profiles across every hospital
 *   - createHospitalAdmin() — create a new admin account via the onboard-user Edge Function
 *   - getSystemStats()      — cross-hospital aggregate metrics for the platform dashboard
 *
 * Security model
 * --------------
 * Every function starts with requireSuperAdmin(), which reads the role from
 * Postgres via the httpOnly session cookie — the same source RLS uses. A client
 * cannot elevate themselves by passing a different role in the request body
 * because these functions never read role from the request.
 *
 * The underlying data is also guarded by RLS:
 *   - profiles are visible to super_admin via private.is_super_admin()
 *   - hospitals are visible to all authenticated users (directory, not PHI)
 *
 * createHospitalAdmin proxies onboard-user, which re-checks the caller's role
 * in the Edge Function before writing. Double enforcement: once here, once in
 * the function.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireSuperAdmin() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, hospital_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "super_admin") {
    throw new Error("Super admin access required");
  }

  return { user, profile };
}

async function invokeEdgeFunction(name: string, payload: unknown, token: string) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `${name} failed with status ${res.status}`);
  }
  return body;
}

// ─── getHospitalAdmins ───────────────────────────────────────────────────────

/**
 * All profiles with role='admin' across every hospital.
 *
 * Super admin only. A hospital admin may only see their own profile (RLS
 * profiles_select_own), so calling this as a non-super-admin would return at
 * most one row even without the role check — but we enforce it explicitly so
 * the intent is auditable.
 */
export const getHospitalAdmins = createServerFn({ method: "GET" }).handler(async () => {
  await requireSuperAdmin();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, hospital_id, created_at",
    )
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  // Attach hospital names in one query
  const hospitalIds = [...new Set((data ?? []).map((p) => p.hospital_id).filter(Boolean))] as string[];
  const nameMap = new Map<string, string>();

  if (hospitalIds.length) {
    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("hospital_id, name")
      .in("hospital_id", hospitalIds);

    for (const h of hospitals ?? []) {
      nameMap.set(h.hospital_id, h.name);
    }
  }

  const admins = (data ?? []).map((p) => ({
    ...p,
    hospital_name: p.hospital_id ? (nameMap.get(p.hospital_id) ?? null) : null,
  }));

  return { admins };
});

// ─── createHospitalAdmin ─────────────────────────────────────────────────────

/**
 * Create a new hospital administrator account.
 *
 * Delegates to the onboard-user Edge Function, which:
 *   1. Creates auth.users row (requires service_role)
 *   2. Inserts a profiles row with role='admin', hospital_id=hospitalId
 *   3. Creates a DID for the admin account
 *   4. Issues a signed ProfessionalVC from the hospital's DID
 *
 * The hospital_id is passed explicitly here because the caller is a super_admin
 * with no hospital affiliation of their own — the Edge Function accepts an
 * explicit hospitalId when the caller is super_admin.
 *
 * Security: role checked here AND inside the Edge Function. A rogue request
 * that bypasses this server function still hits the Edge Function's own check.
 */
export const createHospitalAdmin = createServerFn({ method: "POST" })
  .validator((data: {
    fullName: string;
    email: string;
    password: string;
    hospitalId: string;
  }) => {
    if (!data?.fullName?.trim()) throw new Error("Full name is required");
    if (!data?.email?.trim()) throw new Error("Email is required");
    if (!data?.password || data.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (!data?.hospitalId) throw new Error("Hospital must be selected");
    return data;
  })
  .handler(async ({ data }) => {
    const { user } = await requireSuperAdmin();
    const supabase = getSupabaseServerClient();

    // Verify the target hospital is active before creating an admin for it
    const { data: hospital, error: hospErr } = await supabase
      .from("hospitals")
      .select("hospital_id, name, status")
      .eq("hospital_id", data.hospitalId)
      .maybeSingle();

    if (hospErr || !hospital) throw new Error("Hospital not found");
    if (hospital.status !== "active") {
      throw new Error(`Cannot create an admin for a suspended hospital (${hospital.name})`);
    }

    // Get caller's session token to forward to the Edge Function
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    // onboard-user Edge Function handles the rest. The super_admin role in the
    // caller's session is what allows passing an explicit hospitalId.
    const result = await invokeEdgeFunction(
      "onboard-user",
      {
        email: data.email.trim(),
        password: data.password,
        fullName: data.fullName.trim(),
        role: "admin",
        hospitalId: data.hospitalId, // accepted because caller is super_admin
      },
      token,
    );

    return {
      ok: true as const,
      userId: result.userId,
      email: result.email,
      did: result.did,
      hospitalId: data.hospitalId,
      hospitalName: hospital.name,
    };
  });

// ─── getSystemStats ──────────────────────────────────────────────────────────

/**
 * Cross-hospital aggregate statistics for the platform dashboard.
 *
 * Returns counts for the super admin overview tiles. These numbers are
 * RLS-scoped: super_admin sees all rows, so the counts are true platform-wide
 * figures.
 */
export const getSystemStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireSuperAdmin();
  const supabase = getSupabaseServerClient();

  const countFrom = async (table: string, filter?: { column: string; value: string }) => {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) query = (query as any).eq(filter.column, filter.value);
    const { count, error } = await query;
    return error ? 0 : (count ?? 0);
  };

  const [
    totalHospitals,
    activeHospitals,
    totalAdmins,
    totalDoctors,
    totalStaff,
    totalPatients,
    totalDids,
    totalAppointments,
    pendingAppointments,
    activeAdmissions,
  ] = await Promise.all([
    countFrom("hospitals"),
    countFrom("hospitals", { column: "status", value: "active" }),
    countFrom("profiles", { column: "role", value: "admin" }),
    countFrom("profiles", { column: "role", value: "doctor" }),
    countFrom("profiles", { column: "role", value: "staff" }),
    countFrom("profiles", { column: "role", value: "patient" }),
    countFrom("dids"),
    countFrom("appointments"),
    countFrom("appointments", { column: "status", value: "pending" }),
    countFrom("admissions", { column: "status", value: "admitted" }),
  ]);

  // Per-hospital breakdown for the hospitals table
  const { data: hospitalBreakdown } = await supabase
    .from("profiles")
    .select("hospital_id, role")
    .in("role", ["admin", "doctor", "staff", "patient"]);

  const perHospital = new Map<string, { admins: number; doctors: number; staff: number; patients: number }>();
  for (const p of hospitalBreakdown ?? []) {
    if (!p.hospital_id) continue;
    const entry = perHospital.get(p.hospital_id) ?? { admins: 0, doctors: 0, staff: 0, patients: 0 };
    if (p.role === "admin")   entry.admins   += 1;
    if (p.role === "doctor")  entry.doctors  += 1;
    if (p.role === "staff")   entry.staff    += 1;
    if (p.role === "patient") entry.patients += 1;
    perHospital.set(p.hospital_id, entry);
  }

  return {
    platform: {
      totalHospitals,
      activeHospitals,
      suspendedHospitals: totalHospitals - activeHospitals,
      totalDids,
    },
    users: {
      totalAdmins,
      totalDoctors,
      totalStaff,
      totalPatients,
      total: totalAdmins + totalDoctors + totalStaff + totalPatients,
    },
    operations: {
      totalAppointments,
      pendingAppointments,
      activeAdmissions,
    },
    perHospital: Object.fromEntries(perHospital),
  };
});

// ─── getHospitalDetail ───────────────────────────────────────────────────────

/**
 * Full detail for a single hospital — used by the super admin hospital view.
 *
 * Returns the hospital record plus all users assigned to it, grouped by role.
 */
export const getHospitalDetail = createServerFn({ method: "GET" })
  .validator((data: { hospitalId: string }) => {
    if (!data?.hospitalId) throw new Error("hospitalId is required");
    return data;
  })
  .handler(async ({ data }) => {
    await requireSuperAdmin();
    const supabase = getSupabaseServerClient();

    const { data: hospital, error: hErr } = await supabase
      .from("hospitals")
      .select("*")
      .eq("hospital_id", data.hospitalId)
      .maybeSingle();

    if (hErr) throw new Error(hErr.message);
    if (!hospital) throw new Error("Hospital not found");

    const { data: users, error: uErr } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .eq("hospital_id", data.hospitalId)
      .order("role")
      .order("full_name");

    if (uErr) throw new Error(uErr.message);

    const byRole: Record<string, typeof users> = {};
    for (const u of users ?? []) {
      if (!byRole[u.role]) byRole[u.role] = [];
      byRole[u.role]!.push(u);
    }

    return { hospital, users: users ?? [], byRole };
  });
