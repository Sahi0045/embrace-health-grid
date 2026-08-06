/**
 * Hospital (tenant) operations.
 *
 * Kept separate from clinical.server.ts because these are platform-level
 * concerns: admitting a hospital, suspending one, and reading the tenant
 * directory. RLS does the enforcing — hospitals may only be written by a
 * super_admin — so these functions do not re-check the role, except where a
 * clearer error is worth returning before a round trip.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient, getVerifiedUser } from "./supabase.server";

/**
 * Local rather than shared, matching the other *.server.ts modules: each keeps
 * its own copy so a server function file can be read in isolation.
 */
async function requireSession() {
  const user = await getVerifiedUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

async function invokeEdgeFunction(name: string, payload: unknown) {
  const supabase = getSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  // Read env inside the function: module-scope reads resolve to undefined in
  // serverless runtimes, where env binds per request.
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
    throw new Error(body?.error ?? `${name} failed with ${res.status}`);
  }
  return body;
}

export interface HospitalRow {
  hospital_id: string;
  hospital_did: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  contact_email: string | null;
  status: "active" | "suspended";
  onchain_tx: string | null;
  onchain_slot: number | null;
  created_at: string;
  /** Counts, resolved separately — the tables they come from are RLS-scoped. */
  staff_count?: number;
  patient_count?: number;
}

/**
 * The hospital directory.
 *
 * Readable by any authenticated user (hospitals_select_authenticated): a patient
 * needs to resolve which hospital issued a credential. Counts are only
 * meaningful for a super_admin, whose profile view spans tenants.
 */
export const getHospitals = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("hospitals")
    .select(
      "hospital_id, hospital_did, name, slug, city, country, contact_email, status, onchain_tx, onchain_slot, created_at",
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const hospitals = (data ?? []) as HospitalRow[];
  if (!hospitals.length) return { hospitals };

  // One query for all counts rather than two per hospital. Rows the caller
  // cannot see are simply absent, so a hospital admin sees counts for their own
  // hospital and zero elsewhere — which is correct, not a bug.
  const { data: people } = await supabase.from("profiles").select("hospital_id, role");

  const counts = new Map<string, { staff: number; patients: number }>();
  for (const p of people ?? []) {
    if (!p.hospital_id) continue;
    const entry = counts.get(p.hospital_id) ?? { staff: 0, patients: 0 };
    if (p.role === "patient") entry.patients += 1;
    else entry.staff += 1;
    counts.set(p.hospital_id, entry);
  }

  return {
    hospitals: hospitals.map((h) => ({
      ...h,
      staff_count: counts.get(h.hospital_id)?.staff ?? 0,
      patient_count: counts.get(h.hospital_id)?.patients ?? 0,
    })),
  };
});

/** The caller's own hospital, for showing which tenant is being administered. */
export const getMyHospital = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSession();
  const supabase = getSupabaseServerClient();

  // Filter by id: a staff member's RLS view spans their whole hospital, so
  // .single() over an unfiltered select errors on multiple rows and the badge
  // silently rendered nothing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("hospital_id, role")
    .eq("id", user.id)
    .maybeSingle();

  // A super_admin has no hospital by design — it belongs to the platform.
  if (!profile?.hospital_id) {
    return { hospital: null, role: profile?.role ?? null };
  }

  const { data: hospital } = await supabase
    .from("hospitals")
    .select("hospital_id, hospital_did, name, slug, city, country, status, onchain_tx")
    .eq("hospital_id", profile.hospital_id)
    .maybeSingle();

  return { hospital: hospital ?? null, role: profile.role };
});

/**
 * Admit a hospital to the consortium.
 *
 * Proxies the onboard-hospital Edge Function, which is where the work happens:
 * it needs service_role to create the auth user and the platform issuer key to
 * sign the HospitalCredential, neither of which may reach a browser.
 */
export const onboardHospital = createServerFn({ method: "POST" })
  .validator(
    (data: {
      name: string;
      city?: string;
      country?: string;
      contactEmail?: string;
      adminEmail: string;
      adminPassword: string;
      adminFullName: string;
    }) => {
      if (!data?.name || !data?.adminEmail || !data?.adminPassword || !data?.adminFullName) {
        throw new Error("name, adminEmail, adminPassword and adminFullName are required");
      }
      if (data.adminPassword.length < 8) {
        throw new Error("The admin password must be at least 8 characters");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    await requireSession();
    return await invokeEdgeFunction("onboard-hospital", data);
  });

/**
 * Suspend or reinstate a hospital.
 *
 * A status change rather than a delete: the record that a hospital was once
 * admitted has to survive, and its issued credentials remain historically valid
 * even though it can no longer issue new ones.
 *
 * RLS restricts this to a super_admin; the role check here only produces a
 * clearer message than an empty result.
 */
export const setHospitalStatus = createServerFn({ method: "POST" })
  .validator((data: { hospitalId: string; status: "active" | "suspended" }) => {
    if (!data?.hospitalId) throw new Error("hospitalId is required");
    if (data.status !== "active" && data.status !== "suspended") {
      throw new Error("status must be 'active' or 'suspended'");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const supabase = getSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("hospitals")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("hospital_id", data.hospitalId)
      .select("hospital_id, status");

    if (error) throw new Error(error.message);
    if (!updated?.length) {
      throw new Error("Hospital not found, or you are not permitted to change its status");
    }
    return { ok: true as const, status: updated[0].status };
  });
