import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Store } from "lucide-react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import NewsletterSection from "@/components/NewsletterSection";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProducts } from "@/hooks/use-products";
import {
  toProductCardModel,
  useSupplierProducts,
  useSupplierSubscriptions,
} from "@/hooks/use-marketplace";

const Index = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const navigate = useNavigate();
  const { user, accountType } = useAuth();
  const { t } = useLanguage();
  const isSupplier = accountType === "supplier";
  const isBuyer = accountType === "buyer";

  const { data: products = [] } = useProducts();
  const { data: subscriptions = [] } = useSupplierSubscriptions(user?.id, !!user && isBuyer);
  const { data: supplierProducts = [] } = useSupplierProducts(user?.id, !!user && isSupplier);

  const handleCategoryClick = (catId: string) => {
    setActiveCategory(activeCategory === catId ? undefined : catId);
  };

  const subscribedSupplierIds = subscriptions.map((subscription) => subscription.supplier_id);

  const newArrivalProducts = useMemo(() => {
    return products
      .filter((product) => subscribedSupplierIds.includes(product.supplier_id ?? ""))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6)
      .map(toProductCardModel);
  }, [products, subscribedSupplierIds]);

  const supplierProductCards = useMemo(
    () => supplierProducts.map(toProductCardModel),
    [supplierProducts],
  );

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={setSearchTerm} onCartOpen={() => setCartOpen(true)} />

      <main className="pb-8">
        <HeroSection />

        {isBuyer && (
          <>
            {newArrivalProducts.length > 0 ? (
              <ProductGrid
                products={newArrivalProducts}
                searchFilter={searchTerm}
                title={t("New Arrivals From Your Suppliers")}
                pageSize={3}
                role="buyer"
                emptyTitle={t("No new arrivals yet")}
                emptyDescription={t("Your subscribed suppliers have not published anything new in the last few days.")}
              />
            ) : user ? (
              <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10">
                <div className="glass-card-elevated rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{t("New Arrivals")}</p>
                    <h2 className="font-heading text-2xl font-extrabold mt-2">{t("Subscribe to suppliers to tailor your feed")}</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                      {t("Follow the suppliers you trust and we will surface their newest listings here first.")}
                    </p>
                  </div>
                  <Button onClick={() => navigate("/suppliers")} className="rounded-full gradient-primary text-primary-foreground">
                    {t("Discover Suppliers")}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </section>
            ) : null}

            <CategoryGrid onCategoryClick={handleCategoryClick} activeCategory={activeCategory} />
          </>
        )}

        {isSupplier ? (
          <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div>
                <span className="text-[10px] font-bold text-accent tracking-widest uppercase">{t("Supplier View")}</span>
                <h2 className="font-heading text-2xl font-bold mt-1">{t("My Products")}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("This view is tailored to supplier activity, not buyer shopping.")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => navigate("/supplier?tab=products")}>
                  {t("My Products")}
                </Button>
                <Button className="rounded-full gradient-primary text-primary-foreground" onClick={() => navigate("/supplier?tab=orders")}>
                  {t("My Orders")}
                </Button>
              </div>
            </div>

            <ProductGrid
              products={supplierProductCards}
              searchFilter={searchTerm}
              title={t("Latest Listings")}
              pageSize={6}
              role="supplier"
              emptyTitle={t("No listed products yet")}
              emptyDescription={t("Add your first product to start appearing across the platform.")}
            />
          </section>
        ) : (
          <ProductGrid
            categoryFilter={activeCategory}
            searchFilter={searchTerm}
            pageSize={6}
            role={isBuyer ? "buyer" : "guest"}
          />
        )}

        <NewsletterSection />
      </main>

      <Footer />
      {!isSupplier && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />}
    </div>
  );
};

export default Index;
