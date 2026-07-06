import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useSimulatedLoading } from "@/hooks/use-simulated-loading";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { BookLock, Search, Plus, Pencil, Archive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/policies")({
  head: () => ({ meta: [{ title: "Admin · Policies — DID Hospital" }] }),
  component: PoliciesPage,
});

// Local type definition for Policy
type Policy = {
  id: string;
  name: string;
  category: "Consent" | "Retention" | "Access control" | "Audit";
  status: "active" | "draft" | "archived";
  updatedAt: string;
  description: string;
};

const categories = ["All", "Consent", "Access control", "Retention", "Audit"] as const;
type Category = (typeof categories)[number];

const statusTone: Record<Policy["status"], string> = {
  active: "bg-success/15 text-success",
  draft: "bg-warning/20 text-warning-foreground",
  archived: "bg-muted text-muted-foreground",
};

function PoliciesPage() {
  const loading = useSimulatedLoading(450);
  const [list, setList] = useState<Policy[]>(() => {
    const saved = localStorage.getItem("did_hospital_policies");
    return saved ? JSON.parse(saved) : [];
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category>("All");

  const saveList = (newList: Policy[]) => {
    setList(newList);
    localStorage.setItem("did_hospital_policies", JSON.stringify(newList));
  };

  const filtered = list.filter((p) => {
    const matchesCat = cat === "All" || p.category === cat;
    const matchesQ = [p.name, p.description].some((f) => f.toLowerCase().includes(q.toLowerCase()));
    return matchesCat && matchesQ;
  });

  const toggleArchive = (id: string) => {
    const updated = list.map((p) =>
      p.id === id
        ? {
            ...p,
            status: (p.status === "archived" ? "active" : "archived") as Policy["status"],
            updatedAt: new Date().toISOString().slice(0, 10),
          }
        : p,
    );
    saveList(updated);
    toast("Policy updated");

    import("@/lib/api").then(({ logAuditEvent }) => {
      logAuditEvent("admin", `policy:${id}`, "toggle_policy_archive", "success", "info");
    });
  };

  const handleCreate = () => {
    const name = prompt("Policy name?");
    if (!name) return;
    const description = prompt("Policy description?");
    if (!description) return;
    const categoryInput = prompt(
      "Category? (Consent / Access control / Retention / Audit)",
      "Consent",
    );
    if (!categoryInput) return;

    const newPol: Policy = {
      id: `p_${Date.now()}`,
      name,
      category: categoryInput as Policy["category"],
      status: "draft",
      updatedAt: new Date().toISOString().slice(0, 10),
      description,
    };

    saveList([newPol, ...list]);
    toast.success("Policy created in Draft status");

    import("@/lib/api").then(({ logAuditEvent }) => {
      logAuditEvent("admin", `policy:${newPol.id}`, "create_policy", "success", "info");
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Policy management"
        description="Define and audit the rules that govern identity, consent, and data access across the hospital."
        actions={
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New policy
          </button>
        }
      />

      <div className="space-y-5 p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-clinical min-w-[260px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search policies…"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={[
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  cat === c
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookLock}
            title="No matching policies"
            description="Try a different search term or filter."
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div layout className="grid gap-4 lg:grid-cols-2">
              {filtered.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-xl border border-border bg-card p-5 shadow-clinical"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {p.category}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">{p.name}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusTone[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                    <span className="text-muted-foreground">Updated {p.updatedAt}</span>
                    <div className="flex gap-2">
                      <button className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 font-medium text-foreground hover:bg-muted">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => toggleArchive(p.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 font-medium text-foreground hover:bg-muted"
                      >
                        <Archive className="h-3 w-3" />{" "}
                        {p.status === "archived" ? "Restore" : "Archive"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}
