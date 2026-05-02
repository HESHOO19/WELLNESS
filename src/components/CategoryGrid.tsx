import { useCategories } from "@/hooks/use-products";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CategoryGridProps {
  onCategoryClick: (categorySlug: string) => void;
  activeCategory?: string;
}

const CategoryGrid = ({ onCategoryClick, activeCategory }: CategoryGridProps) => {
  const { data: categories, isLoading } = useCategories();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10 flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </section>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-heading font-bold">{t("No categories available")}</p>
          <p className="text-sm mt-1">{t("Check back soon as new suppliers join the marketplace.")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10">
      <div className="mb-5">
        <span className="text-[10px] font-bold text-accent tracking-widest uppercase">{t("Categories")}</span>
        <h2 className="font-heading text-xl font-bold mt-0.5">{t("Health Ecosystem")}</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => onCategoryClick(cat.slug)}
            className={`group p-4 rounded-2xl border transition-all duration-200 text-left animate-fade-in hover:shadow-glow ${
              activeCategory === cat.slug
                ? "gradient-primary text-primary-foreground border-transparent"
                : "glass-card border-border/50 hover:border-primary/30"
            }`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-2xl mb-2 block">{cat.icon}</span>
            <h3 className="font-heading font-bold text-sm leading-tight">{cat.name}</h3>
            <p className={`text-[11px] mt-1 leading-snug ${
              activeCategory === cat.slug ? "text-primary-foreground/80" : "text-muted-foreground"
            }`}>
              {cat.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CategoryGrid;
