import { useState } from "react";
import Header from "@/components/Header";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { useCategories } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";

const Shop = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const { data: categories } = useCategories();

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={setSearchTerm} onCartOpen={() => setCartOpen(true)} />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-extrabold">Product Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse our full range of pharmaceutical products</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          <Button
            size="sm"
            variant={activeCategory === "all" ? "default" : "outline"}
            className="rounded-full shrink-0"
            onClick={() => setActiveCategory("all")}
          >
            All Products
          </Button>
          {(categories ?? []).map(cat => (
            <Button
              key={cat.id}
              size="sm"
              variant={activeCategory === cat.slug ? "default" : "outline"}
              className="rounded-full shrink-0"
              onClick={() => setActiveCategory(cat.slug)}
            >
              {cat.icon} {cat.name}
            </Button>
          ))}
        </div>

        <ProductGrid
          categoryFilter={activeCategory}
          searchFilter={searchTerm}
          title="All Products"
          pageSize={12}
        />
      </main>

      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
};

export default Shop;
