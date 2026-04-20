import { useMemo, useState } from "react";
import { useProducts } from "@/hooks/use-products";
import ProductCard from "./ProductCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface ProductGridProps {
  categoryFilter?: string;
  searchFilter?: string;
  title?: string;
  pageSize?: number;
}

const ProductGrid = ({ categoryFilter, searchFilter, title = "Shop Products", pageSize = 6 }: ProductGridProps) => {
  const [page, setPage] = useState(0);
  const { data: products, isLoading } = useProducts();

  const filtered = useMemo(() => {
    let result = products ?? [];
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter(p => p.categories?.slug === categoryFilter);
    }
    if (searchFilter) {
      const term = searchFilter.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) || (p.description ?? "").toLowerCase().includes(term)
      );
    }
    return result;
  }, [products, categoryFilter, searchFilter]);

  const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10 flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10">
      <div className="flex items-end justify-between mb-5">
        <div>
          <span className="text-[10px] font-bold text-accent tracking-widest uppercase">Curated</span>
          <h2 className="font-heading text-xl font-bold mt-0.5">{title}</h2>
        </div>
        {maxPage > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page <= 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" className="h-8 w-8 rounded-full gradient-primary text-primary-foreground" onClick={() => setPage(p => Math.min(maxPage, p + 1))} disabled={page >= maxPage}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-heading font-bold">No products found</p>
          <p className="text-sm mt-1">Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((product, i) => (
            <ProductCard key={product.id} product={{ ...product, price: Number(product.price), category: product.categories?.slug ?? "" }} index={i} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductGrid;
