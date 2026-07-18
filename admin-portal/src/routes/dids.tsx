import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useDIDs } from "@/hooks/use-api";
import { createDID } from "@/lib/api";
import { Plus, Upload, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Type definition for DID records
type DIDRecord = {
  did: string;
  subject: string;
  type: "patient" | "doctor" | "nurse" | "admin";
  issuedAt: string;
  status: "active" | "revoked";
};

export const Route = createFileRoute("/dids")({
  head: () => ({ meta: [{ title: "Admin · DID Management — Embrace Health Grid" }] }),
  component: DIDManagement,
});

function DIDManagement() {
  const { data: didsData, refetch } = useDIDs();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "patient",
    // Patient specific fields:
    mrn: "",
    age: "",
    gender: "M",
    bloodGroup: "O+",
    phone: "",
    address: "",
    // Staff/Clinician specific fields:
    employeeId: "",
    department: "General Medicine",
    specialty: "General Medicine",
    shift: "morning",
  });

  const liveDids: DIDRecord[] = (didsData?.dids || []).map((d: any) => ({
    did: d.did || d.id || "",
    subject: d.ownerName || d.owner || d.subject || "Unknown",
    type: (d.role || d.ownerType || d.type || "patient") as DIDRecord["type"],
    issuedAt: d.createdAt?.slice(0, 10) || d.issuedAt || new Date().toISOString().slice(0, 10),
    status: (d.status || "active") as DIDRecord["status"],
  }));

  const list = liveDids;
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | DIDRecord["type"]>("all");

  const filtered = list.filter((d) => {
    if (type !== "all" && d.type !== type) return false;
    return [d.did, d.subject].some((f) => f.toLowerCase().includes(q.toLowerCase()));
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, role, ...rest } = formData;
    if (!name || !email) {
      toast.error("Name and Email are required");
      return;
    }

    let extraFields: any = {};
    if (role === "patient") {
      extraFields = {
        mrn: rest.mrn,
        age: rest.age,
        gender: rest.gender,
        bloodGroup: rest.bloodGroup,
        phone: rest.phone,
        address: rest.address,
      };
    } else {
      extraFields = {
        employeeId: rest.employeeId,
        department: rest.department,
        specialty: rest.specialty,
        shift: rest.shift,
        phone: rest.phone,
      };
    }

    try {
      const res = await createDID(name, role, undefined, email, extraFields);
      toast.success("DID issued successfully on blockchain", { description: res.did });
      setIsModalOpen(false);
      // Reset form
      setFormData({
        name: "",
        email: "",
        role: "patient",
        mrn: "",
        age: "",
        gender: "M",
        bloodGroup: "O+",
        phone: "",
        address: "",
        employeeId: "",
        department: "General Medicine",
        specialty: "General Medicine",
        shift: "morning",
      });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue DID on blockchain");
    }
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
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-clinical hover:bg-primary/90 cursor-pointer"
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
                  type === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No DIDs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[550px] border border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Issue New Decentralized Identifier (DID)
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Anchor a new identity onto the secure registry. Specify custom role attributes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Subject Name</label>
                <input
                  required
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Dr. Ravi Menon"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Subject Email</label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="e.g. ravi@apollohospitals.in"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Identity Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="e.g. +91 9876543210"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Dynamic Role-specific details */}
            {formData.role === "patient" && (
              <div className="space-y-4 border-t border-border/50 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Patient Medical Profile
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Patient ID (MRN)
                    </label>
                    <input
                      type="text"
                      name="mrn"
                      value={formData.mrn}
                      onChange={handleInputChange}
                      placeholder="e.g. MRN-204871 (optional)"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleInputChange}
                      placeholder="35"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Blood Group
                    </label>
                    <select
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="123 Health Street, Mumbai"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {formData.role !== "patient" && (
              <div className="space-y-4 border-t border-border/50 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Clinician / Staff Directory details
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleInputChange}
                      placeholder="e.g. EMP-9982"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Department
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      placeholder="e.g. Cardiology"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Specialty / Subspecialty
                    </label>
                    <input
                      type="text"
                      name="specialty"
                      value={formData.specialty}
                      onChange={handleInputChange}
                      placeholder="e.g. Pediatric Cardiology"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">
                      Active Work Shift
                    </label>
                    <select
                      name="shift"
                      value={formData.shift}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    >
                      <option value="morning">Morning Shift</option>
                      <option value="afternoon">Afternoon Shift</option>
                      <option value="night">Night Shift</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" className="cursor-pointer">
                Issue Blockchain DID
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
