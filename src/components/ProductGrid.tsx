import { useEffect, useMemo, useState } from "react";
import { useProducts } from "@/hooks/use-products";
import ProductCard from "./ProductCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { Product } from "@/types";

interface ProductGridProps {
  categoryFilter?: string;
  searchFilter?: string;
  title?: string;
  pageSize?: number;
  products?: Product[];
  role?: "buyer" | "supplier" | "guest";
  emptyTitle?: string;
  emptyDescription?: string;
}

const ProductGrid = ({
  categoryFilter,
  searchFilter,
  title = "Shop Products",
  pageSize = 6,
  products: providedProducts,
  role = "guest",
  emptyTitle = "No products found",
  emptyDescription = "Try adjusting your search or category filter.",
}: ProductGridProps) => {
  const [page, setPage] = useState(0);
  const { data: products, isLoading } = useProducts();

  const filtered = useMemo(() => {
    const source = providedProducts ?? (products ?? []).map((product) => ({
      ...product,
      description: product.description ?? "",
      price: Number(product.price),
      category: product.categories?.slug ?? "",
      category_name: product.categories?.name ?? null,
      image_url: product.image_url,
      stock: product.stock,
      unit: product.unit,
      min_order: product.min_order,
      supplier_id: product.supplier_id,
      supplier_name: null,
      created_at: product.created_at,
    }));

    let result = source;
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((product) => product.category === categoryFilter);
    }
    if (searchFilter) {
      const term = searchFilter.toLowerCase();
      result = result.filter((product) =>
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term) ||
        (product.supplier_name ?? "").toLowerCase().includes(term)
      );
    }
    return result;
  }, [providedProducts, products, categoryFilter, searchFilter]);

  const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    setPage(0);
  }, [categoryFilter, searchFilter, providedProducts]);

  if (!providedProducts && isLoading) {
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
          <p className="text-lg font-heading font-bold">{emptyTitle}</p>
          <p className="text-sm mt-1">{emptyDescription}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} role={role} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductGrid;
