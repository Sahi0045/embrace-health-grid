import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Utensils, Flame, DollarSign, Tag, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createMenuItem } from "@/lib/api";
import type { MealCategory, MealAvailability } from "@/lib/types";

interface CreateMenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const AVAILABLE_TAGS = [
  { id: "vegan", label: "🌱 Vegan" },
  { id: "vegetarian", label: "🥦 Vegetarian" },
  { id: "halal", label: "☪️ Halal" },
  { id: "gluten_free", label: "🌾 Gluten-Free" },
  { id: "kosher", label: "✡️ Kosher" },
  { id: "diabetic", label: "🩸 Diabetic-Friendly" },
  { id: "low_sodium", label: "💧 Low Sodium" },
];

export function CreateMenuItemDialog({ open, onOpenChange, onSuccess }: CreateMenuItemDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MealCategory>("lunch");
  const [availableFor, setAvailableFor] = useState<MealAvailability>("both");
  const [price, setPrice] = useState("8.50");
  const [calories, setCalories] = useState("450");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["vegetarian"]);
  const [allergensText, setAllergensText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a meal name");
      return;
    }

    setSubmitting(true);
    try {
      const parsedPrice = parseFloat(price) || 0;
      const parsedCalories = parseInt(calories, 10) || 0;
      const allergens = allergensText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      await createMenuItem({
        name: name.trim(),
        category,
        availableFor,
        price: parsedPrice,
        calories: parsedCalories,
        description: description.trim(),
        dietaryTags: selectedTags,
        allergens,
      });

      toast.success("Menu item created successfully", {
        description: `${name} has been added to the ${category} catalog.`,
      });

      // Reset form
      setName("");
      setDescription("");
      setAllergensText("");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to create menu item", { description: err.message });
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
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">
                  Add Cafeteria Menu Item
                </h3>
                <p className="text-xs text-muted-foreground">
                  Register a new meal in the nutritional system
                </p>
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

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Meal Name */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Meal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Steamed Salmon with Quinoa & Asparagus"
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Category & Availability */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MealCategory)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                  <option value="beverage">Beverage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Availability
                </label>
                <select
                  value={availableFor}
                  onChange={(e) => setAvailableFor(e.target.value as MealAvailability)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="both">Patient & Staff</option>
                  <option value="patient">Patient Only</option>
                  <option value="staff">Staff Only</option>
                </select>
              </div>
            </div>

            {/* Price & Calories */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Price ($ USD)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="8.50"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Calories (kcal)
                </label>
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="450"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Dietary Tags Selector */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Dietary Certifications & Tags
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/40 border border-border/60">
                {AVAILABLE_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background text-muted-foreground border-border/60 hover:text-foreground"
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Description & Recipe Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="High protein, low glycemic index meal prepared fresh daily..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border/80 font-medium text-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Allergens */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Allergen Warnings (comma separated)
              </label>
              <input
                type="text"
                value={allergensText}
                onChange={(e) => setAllergensText(e.target.value)}
                placeholder="e.g. Soy, Peanuts, Shellfish"
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
                {submitting ? "Saving..." : "Create Menu Item"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
