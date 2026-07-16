import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { BookLock, Search, Plus, Pencil, Archive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useEffect } from "react";
import { getPolicies, createPolicy, updatePolicy } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/policies")({
  head: () => ({ meta: [{ title: "Admin · Policies — Embrace Health Grid" }] }),
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
  const [list, setList] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category>("All");

  const fetchPolicies = () => {
    setLoading(true);
    getPolicies()
      .then((res) => {
        setList(res.policies || []);
      })
      .catch((err) => console.error("Error loading policies:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const filtered = list.filter((p) => {
    const matchesCat = cat === "All" || p.category === cat;
    const matchesQ = [p.name, p.description].some((f) => f.toLowerCase().includes(q.toLowerCase()));
    return matchesCat && matchesQ;
  });

  const toggleArchive = async (id: string) => {
    const policy = list.find(p => p.id === id);
    if (!policy) return;
    const newStatus = policy.status === "archived" ? "active" : "archived";
    try {
      await updatePolicy(id, { status: newStatus });
      toast.success(`Policy updated to ${newStatus}`);
      fetchPolicies();
      import("@/lib/api").then(({ logAuditEvent }) => {
        logAuditEvent("admin", `policy:${id}`, `toggle_policy_archive_${newStatus}`, "success", "info");
      });
    } catch (err: any) {
      toast.error(`Failed to update policy: ${err.message}`);
    }
  };

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Policy["category"]>("Consent");
  const [newDescription, setNewDescription] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleCreateOpen = () => {
    setNewName("");
    setNewCategory("Consent");
    setNewDescription("");
    setIsCreateOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDescription) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const res = await createPolicy({
        name: newName,
        description: newDescription,
        category: newCategory,
        status: "draft",
      });
      toast.success("Policy created in Draft status");
      setIsCreateOpen(false);
      fetchPolicies();
      import("@/lib/api").then(({ logAuditEvent }) => {
        logAuditEvent("admin", `policy:${res.policy?.id || "new"}`, "create_policy", "success", "info");
      });
    } catch (err: any) {
      toast.error(`Failed to create policy: ${err.message}`);
    }
  };

  const handleEditOpen = (policy: Policy) => {
    setEditingPolicy(policy);
    setEditDescription(policy.description);
    setIsEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;
    if (!editDescription) {
      toast.error("Description cannot be empty");
      return;
    }

    try {
      await updatePolicy(editingPolicy.id, { description: editDescription });
      toast.success("Policy description updated");
      setIsEditOpen(false);
      fetchPolicies();
      import("@/lib/api").then(({ logAuditEvent }) => {
        logAuditEvent("admin", `policy:${editingPolicy.id}`, "edit_policy_description", "success", "info");
      });
    } catch (err: any) {
      toast.error(`Failed to edit policy: ${err.message}`);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Policy management"
        description="Define and audit the rules that govern identity, consent, and data access across the hospital."
        actions={
          <button
            onClick={handleCreateOpen}
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
                      <button
                        onClick={() => handleEditOpen(p)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 font-medium text-foreground hover:bg-muted"
                      >
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

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Create New Policy</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">Policy Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Patient MFA Enforcement"
                required
                className="bg-background border border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-semibold">Category</Label>
              <Select
                value={newCategory}
                onValueChange={(v) => setNewCategory(v as Policy["category"])}
              >
                <SelectTrigger id="category" className="bg-background border border-border">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border text-foreground">
                  <SelectItem value="Consent">Consent</SelectItem>
                  <SelectItem value="Access control">Access control</SelectItem>
                  <SelectItem value="Retention">Retention</SelectItem>
                  <SelectItem value="Audit">Audit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detailed description of the governance rules..."
                rows={3}
                required
                className="bg-background border border-border"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="border-border">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">Create Policy</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Edit Policy Description</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Policy:
              </Label>
              <div className="text-sm font-semibold text-foreground">{editingPolicy?.name}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc" className="text-sm font-semibold">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                required
                className="bg-background border border-border"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="border-border">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
