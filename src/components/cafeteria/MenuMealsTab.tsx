import { motion } from "framer-motion";
import {
  Utensils,
  Flame,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { GlowCard } from "@/components/dashboard/GlowCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import type { CafeteriaMenuItem } from "@/lib/types";

interface MenuMealsTabProps {
  items: CafeteriaMenuItem[];
  onToggleStatus: (menuItemId: string, nextStatus: "active" | "inactive") => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string; border: string }> = {
  breakfast: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20", label: "Breakfast" },
  lunch: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20", label: "Lunch" },
  dinner: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20", label: "Dinner" },
  snack: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", label: "Snack" },
  beverage: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/20", label: "Beverage" },
};

const DIETARY_BADGES: Record<string, { label: string; color: string }> = {
  vegan: { label: "🌱 Vegan", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  vegetarian: { label: "🥦 Vegetarian", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  halal: { label: "☪️ Halal", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  gluten_free: { label: "🌾 Gluten-Free", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  kosher: { label: "✡️ Kosher", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  diabetic: { label: "🩸 Diabetic-Friendly", color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  low_sodium: { label: "💧 Low Sodium", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
};

export function MenuMealsTab({ items, onToggleStatus }: MenuMealsTabProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Utensils}
        title="No Menu Items Found"
        description="There are currently no meals matching your filter criteria. Create a new item to populate the cafeteria menu."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {items.map((meal) => {
        const catStyle = CATEGORY_STYLES[meal.category] || CATEGORY_STYLES.lunch;
        const isActive = meal.status === "active";

        return (
          <GlowCard
            key={meal.menu_item_id}
            accent={isActive ? "primary" : "none"}
            className="p-5 flex flex-col justify-between h-full bg-card border border-border/80 rounded-2xl shadow-clinical-xs transition-all hover:border-primary/40"
          >
            {/* Header: Category Badge + Status Toggle */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                  {catStyle.label}
                </span>

                {/* Available for badge */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/50">
                  <Users className="h-3 w-3" />
                  <span className="capitalize">{meal.available_for === "both" ? "Patient & Staff" : `${meal.available_for} only`}</span>
                </span>
              </div>

              {/* Status pill & toggle */}
              <button
                type="button"
                onClick={() => onToggleStatus(meal.menu_item_id, isActive ? "inactive" : "active")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold transition-all cursor-pointer border ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border/60 hover:bg-muted/80"
                }`}
                title="Click to toggle availability"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                <span>{isActive ? "Active" : "Inactive"}</span>
              </button>
            </div>

            {/* Meal Title & Description */}
            <div className="my-3.5 flex-1">
              <h4 className="text-sm font-black text-foreground tracking-tight line-clamp-1">
                {meal.name}
              </h4>
              {meal.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {meal.description}
                </p>
              )}

              {/* Dietary Tags list */}
              {meal.dietary_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {meal.dietary_tags.map((tag) => {
                    const badge = DIETARY_BADGES[tag] || { label: `#${tag}`, color: "bg-primary/10 text-primary border-primary/20" };
                    return (
                      <span
                        key={tag}
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Nutrition & Price Footer */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-bold text-foreground">{meal.calories}</span>
                  <span className="text-[10px]">kcal</span>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-extrabold text-foreground">${meal.price.toFixed(2)}</span>
                </div>
              </div>

              <span className="text-[10px] text-muted-foreground font-mono">
                #{meal.menu_item_id.slice(-6)}
              </span>
            </div>
          </GlowCard>
        );
      })}
    </div>
  );
}
