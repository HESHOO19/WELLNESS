import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import Header from "@/components/Header";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/use-products";
import { toProductCardModel, useSupplierProducts } from "@/hooks/use-marketplace";

const Shop = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { user, accountType } = useAuth();
  const isSupplier = accountType === "supplier";
  const { data: supplierProducts = [] } = useSupplierProducts(user?.id, !!user && isSupplier);

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={setSearchTerm} onCartOpen={() => setCartOpen(true)} />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl font-extrabold">
              {isSupplier ? "My Product Catalog" : "Product Catalog"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isSupplier
                ? "Suppliers only see and manage their own listings here."
                : "Browse our full range of pharmaceutical products."}
            </p>
          </div>

          {isSupplier && (
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => navigate("/supplier")}>
                Dashboard
              </Button>
              <Button className="rounded-full gradient-primary text-primary-foreground" onClick={() => navigate("/supplier?tab=orders")}>
                My Orders
              </Button>
            </div>
          )}
        </div>

        {!isSupplier && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            <Button
              size="sm"
              variant={activeCategory === "all" ? "default" : "outline"}
              className="rounded-full shrink-0"
              onClick={() => setActiveCategory("all")}
            >
              All Products
            </Button>
            {(categories ?? []).map((cat) => (
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
        )}

        {isSupplier ? (
          <>
            {supplierProducts.length === 0 && (
              <div className="glass-card-elevated rounded-3xl p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Supplier Workflow</p>
                  <h2 className="font-heading text-2xl font-extrabold mt-2">Add products, then inspect demand in one place</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    As a supplier, this area is dedicated to your own catalog and performance.
                  </p>
                </div>
                <Button onClick={() => navigate("/supplier?tab=products")} className="rounded-full gradient-primary text-primary-foreground">
                  <PackageSearch className="h-4 w-4 mr-2" />
                  Open My Products
                </Button>
              </div>
            )}

            <ProductGrid
              products={supplierProducts.map(toProductCardModel)}
              searchFilter={searchTerm}
              title="My Products"
              pageSize={9}
              role="supplier"
              emptyTitle="You have not listed any products yet"
              emptyDescription="Open My Products to add your first listing."
            />
          </>
        ) : (
          <>
            <CategoryGrid
              activeCategory={activeCategory === "all" ? undefined : activeCategory}
              onCategoryClick={(categoryId) =>
                setActiveCategory(activeCategory === categoryId ? "all" : categoryId)
              }
            />
            <ProductGrid
              categoryFilter={activeCategory}
              searchFilter={searchTerm}
              title="All Products"
              pageSize={12}
              role="buyer"
            />
          </>
        )}
      </main>

      <Footer />
      {!isSupplier && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
    </div>
  );
};

export default Shop;
