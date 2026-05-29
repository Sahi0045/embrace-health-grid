import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { staffPatients } from "@/lib/mock-data";
import { Search } from "lucide-react";

export const Route = createFileRoute("/staff/patients")({
  head: () => ({ meta: [{ title: "Staff · Patients — DID Hospital" }] }),
  component: Patients,
});

function Patients() {
  const [q, setQ] = useState("");
  const filtered = staffPatients.filter((p) =>
    [p.name, p.mrn, p.did, p.phone].some((f) => f.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        eyebrow="Patients"
        title="My active patients"
        description="Search by name, MRN, DID, or phone."
      />
      <div className="p-8">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-clinical">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patients…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-clinical">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">MRN</th>
                <th className="px-4 py-3 font-medium">DID</th>
                <th className="px-4 py-3 font-medium">Blood</th>
                <th className="px-4 py-3 font-medium">Allergies</th>
                <th className="px-4 py-3 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.age} · {p.gender}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.mrn}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.did}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{p.bloodGroup}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.allergies.length ? p.allergies.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.phone}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No patients match "{q}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
