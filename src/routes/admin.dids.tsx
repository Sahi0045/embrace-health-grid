import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { dids as initial, type DIDRecord } from "@/lib/mock-data";
import { Plus, Upload, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/dids")({
  head: () => ({ meta: [{ title: "Admin · DID Management — DID Hospital" }] }),
  component: DIDManagement,
});

function DIDManagement() {
  const [list, setList] = useState<DIDRecord[]>(initial);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | DIDRecord["type"]>("all");

  const filtered = list.filter((d) => {
    if (type !== "all" && d.type !== type) return false;
    return [d.did, d.subject].some((f) => f.toLowerCase().includes(q.toLowerCase()));
  });

  const issueNew = () => {
    const name = prompt("Subject name?");
    if (!name) return;
    const newDid: DIDRecord = {
      did: `did:hosp:0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
      subject: name,
      type: "patient",
      issuedAt: new Date().toISOString().slice(0, 10),
      status: "active",
    };
    setList([newDid, ...list]);
    toast.success("DID issued", { description: newDid.did });
  };

  return (
    <>
      <PageHeader
        eyebrow="Identity"
        title="DID management"
        description="Issue, revoke, and audit decentralized identifiers across the hospital."
        actions={
          <>
            <button className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              <Upload className="h-4 w-4" /> Bulk CSV
            </button>
            <button
              onClick={issueNew}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Issue DID
            </button>
          </>
        }
      />

      <div className="p-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-clinical">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search DIDs or subjects…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["all", "patient", "doctor", "nurse", "admin"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={[
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-clinical">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">DID</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Issued</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.did} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.did}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{d.subject}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{d.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.issuedAt}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        d.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/10 text-destructive",
                      ].join(" ")}
                    >
                      {d.status}
                    </span>
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
