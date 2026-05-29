import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { accessHistory } from "@/lib/mock-data";
import { Download, Search } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Admin · Audit Logs — DID Hospital" }] }),
  component: AuditLogs,
});

const extended = [
  ...accessHistory,
  { id: "a6", actor: "Admin Sandeep", actorRole: "Super admin", resource: "User role: nurse → senior nurse", action: "updated" as const, at: "2026-05-29 08:01" },
  { id: "a7", actor: "System", actorRole: "Auto-job", resource: "Daily compliance report", action: "exported" as const, at: "2026-05-29 06:00" },
  { id: "a8", actor: "Dr. Aanya Verma", actorRole: "Radiologist", resource: "DICOM study DICOM-2284", action: "viewed" as const, at: "2026-05-28 21:55" },
];

function AuditLogs() {
  const [q, setQ] = useState("");
  const filtered = extended.filter((e) =>
    [e.actor, e.actorRole, e.resource, e.action].some((f) => f.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="Audit logs"
        description="Tamper-evident log of every access, signature, and admin action."
        actions={
          <button className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="p-8">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-clinical">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by actor, resource, or action…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-clinical">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{e.at}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{e.actor}</div>
                    <div className="text-xs text-muted-foreground">{e.actorRole}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{e.resource}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    0x{e.id.padEnd(4, "0")}…{Math.random().toString(16).slice(2, 6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
