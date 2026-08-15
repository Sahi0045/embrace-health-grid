import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Building2, Phone, Mail, MapPin, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createCafeteriaVendor } from "@/lib/api";

interface CreateVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CATEGORY_OPTIONS = [
  "Fresh Produce",
  "Dairy & Eggs",
  "Poultry & Meat",
  "Bakery & Bread",
  "Dry Goods & Grains",
  "Beverages",
  "Organic Supplies",
];

export function CreateVendorDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateVendorDialogProps) {
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contractExpiry, setContractExpiry] = useState("2027-12-31");
  const [address, setAddress] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Fresh Produce"]);
  const [submitting, setSubmitting] = useState(false);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a vendor company name");
      return;
    }

    setSubmitting(true);
    try {
      await createCafeteriaVendor({
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contractExpiry: contractExpiry || undefined,
        address: address.trim() || undefined,
        suppliedCategories: selectedCategories,
      });

      toast.success("Vendor registered successfully", {
        description: `${name} has been added to the food procurement directory.`,
      });

      // Reset
      setName("");
      setContactPerson("");
      setContactEmail("");
      setContactPhone("");
      setAddress("");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to register vendor", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 0.999, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-clinical-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">Register Food Vendor</h3>
                <p className="text-xs text-muted-foreground">Add food & beverage suppliers to procurement</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Vendor Name */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Vendor / Supplier Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Agri-Foods & Dairy Corp"
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Contact Person & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Marcus Sterling"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Contact Phone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1 (555) 432-8899"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Email & Contract Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="orders@apexagri.com"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Contract Expiry Date</label>
                <input
                  type="date"
                  value={contractExpiry}
                  onChange={(e) => setContractExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Supplied Categories selector */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Supplied Product Categories
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/40 border border-border/60">
                {CATEGORY_OPTIONS.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background text-muted-foreground border-border/60 hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Facility / Warehouse Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="458 Industrial Parkway, Building 2"
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                {submitting ? "Registering..." : "Register Vendor"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
