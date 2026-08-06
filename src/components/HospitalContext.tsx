import { useEffect, useState } from "react";
import { Hospital, Globe } from "lucide-react";
import { getMyHospital } from "@/lib/hospitals.server";

interface MyHospital {
  hospital_id: string;
  hospital_did: string;
  name: string;
  slug: string;
  city: string | null;
  status: string;
  onchain_tx: string | null;
}

/**
 * Shows which hospital the signed-in user is administering.
 *
 * Worth its own component because every admin page is now tenant-scoped: an
 * admin seeing an empty list needs to know whether that means "no data" or
 * "wrong hospital". A super_admin has no hospital, so it renders the platform
 * scope instead of nothing — the absence is meaningful, not a loading state.
 */
export function HospitalContext() {
  const [hospital, setHospital] = useState<MyHospital | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await getMyHospital()) as unknown as {
          hospital: MyHospital | null;
          role: string | null;
        };
        if (cancelled) return;
        setHospital(res.hospital);
        setRole(res.role);
      } catch {
        // A failed lookup should not block the page it labels.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  if (role === "super_admin") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
        <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="font-semibold text-foreground">Platform scope</span>
        <span className="text-muted-foreground">— all hospitals</span>
      </div>
    );
  }

  if (!hospital) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      <Hospital className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="font-semibold text-foreground">{hospital.name}</span>
      {hospital.city && <span className="text-muted-foreground">· {hospital.city}</span>}
      <span className="truncate font-mono text-[10px] text-muted-foreground">
        {hospital.hospital_did}
      </span>
      {hospital.status !== "active" && (
        <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
          {hospital.status}
        </span>
      )}
    </div>
  );
}
