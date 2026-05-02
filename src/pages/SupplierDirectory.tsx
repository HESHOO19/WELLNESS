import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Store, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useProducts } from "@/hooks/use-products";
import {
  useSupplierDirectoryWithStats,
  useSupplierSubscriptions,
  useSupplierSubscriptionToggle,
} from "@/hooks/use-marketplace";

const SupplierDirectory = () => {
  const navigate = useNavigate();
  const { user, accountType } = useAuth();
  const { toast } = useToast();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { t } = useLanguage();
  const isBuyer = accountType === "buyer";

  const { data: products = [] } = useProducts();
  const { data: subscriptions = [] } = useSupplierSubscriptions(user?.id, !!user && isBuyer);
  const directoryQuery = useSupplierDirectoryWithStats(products, true);
  const toggleSubscription = useSupplierSubscriptionToggle(user?.id);

  const subscribedSupplierIds = new Set(subscriptions.map((subscription) => subscription.supplier_id));

  const suppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return (directoryQuery.data ?? []).filter((supplier) => {
      if (!term) return true;
      const haystack = [
        supplier.business_name,
        supplier.email,
        supplier.newestProduct?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [directoryQuery.data, searchTerm]);

  const subscribedSuppliers = useMemo(
    () => suppliers.filter((supplier) => subscribedSupplierIds.has(supplier.id)),
    [suppliers, subscribedSupplierIds],
  );

  const supplierProductsBySupplier = useMemo(() => {
    return products.reduce<Record<string, typeof products[number][]>>((acc, product) => {
      if (!product.supplier_id) return acc;
      if (!acc[product.supplier_id]) acc[product.supplier_id] = [];
      acc[product.supplier_id].push(product);
      return acc;
    }, {});
  }, [products]);

  const handleToggle = async (supplierId: string) => {
    if (!user || !isBuyer) {
        toast({
          title: t("Buyer account required"),
          description: t("Sign in with a buyer account to subscribe to suppliers."),
          variant: "destructive",
        });
      navigate("/auth");
      return;
    }

    const result = await toggleSubscription.mutateAsync(supplierId);
    toast({
      title: result.active ? t("Supplier subscribed") : t("Subscription removed"),
      description: result.active
        ? t("Their new arrivals will now be featured for you.")
        : t("Their new products will stop appearing in your tailored feed."),
    });
  };

  if (accountType === "supplier") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="font-heading text-3xl font-extrabold">{t("Supplier directory is built for buyers")}</h1>
          <p className="text-muted-foreground mt-3">
            {t("Suppliers manage their own listings and orders instead of subscribing to other suppliers.")}
          </p>
          <Button className="rounded-full mt-6" onClick={() => navigate("/supplier")}>
            {t("Open Supplier Dashboard")}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={setSearchTerm} onCartOpen={() => setCartOpen(true)} />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{t("Buyer Subscriptions")}</p>
            <h1 className="font-heading text-3xl font-extrabold mt-2">{t("Supplier Directory")}</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              {t("Browse all suppliers on Wellness, subscribe to the ones you trust, and bring their newest products into your new-arrivals feed.")}
            </p>
          </div>
          <div className="glass-card rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Subscriptions")}</p>
            <p className="font-heading text-3xl font-extrabold mt-1">{subscriptions.length}</p>
          </div>
        </div>

        {!user && (
          <div className="glass-card-elevated rounded-3xl p-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold">{t("Sign in to personalize supplier subscriptions")}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {t("Buyers can follow suppliers and unlock a tailored new-arrivals feed.")}
              </p>
            </div>
            <Button className="rounded-full gradient-primary text-primary-foreground" onClick={() => navigate("/auth")}>{t("Sign In")}</Button>
          </div>
        )}

        {subscribedSuppliers.length > 0 && (
          <section className="glass-card rounded-3xl p-6 mb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{t("Subscribed Suppliers")}</p>
                <h2 className="font-heading text-2xl font-extrabold mt-2">{t("Your followed suppliers")}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("These suppliers are in your subscription list and their latest products will appear in your personalized feed.")}
                </p>
              </div>
              <div className="glass-card rounded-2xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Following")}</p>
                <p className="font-heading text-3xl font-extrabold mt-1">{subscribedSuppliers.length}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
              {subscribedSuppliers.map((supplier) => (
                <article key={supplier.id} className="glass-card-elevated rounded-3xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-primary">{t("Supplier")}</p>
                      <h3 className="font-heading text-lg font-extrabold mt-2">
                        {supplier.business_name ?? supplier.email ?? "Wellness Supplier"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2">{supplier.email ?? t("Verified supplier profile")}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleToggle(supplier.id)}
                      disabled={toggleSubscription.isPending}
                    >
                      {t("Subscribed")}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {directoryQuery.isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="font-heading text-2xl font-bold">{t("No suppliers matched your search")}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t("Try a broader search to discover more supplier partners.")}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suppliers.map((supplier) => {
              const isSubscribed = subscribedSupplierIds.has(supplier.id);
              return (
                <article key={supplier.id} className="glass-card-elevated rounded-3xl p-6 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-primary">{t("Supplier")}</p>
                      <h2 className="font-heading text-xl font-extrabold mt-2">
                        {supplier.business_name ?? supplier.email ?? "Wellness Supplier"}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2">{supplier.email ?? "Verified supplier profile"}</p>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {supplier.productCount} {t("products")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="rounded-2xl border border-border p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Categories")}</p>
                      <p className="font-semibold mt-2">{supplier.categoryCount}</p>
                    </div>
                    <div className="rounded-2xl border border-border p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Newest Listing")}</p>
                      <p className="font-semibold mt-2">
                        {supplier.newestProduct
                          ? new Date(supplier.newestProduct.created_at).toLocaleDateString()
                          : t("No products yet")}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border p-4 mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Latest Product")}</p>
                        <p className="font-semibold mt-2">
                          {supplier.newestProduct?.name ?? t("Supplier has not listed products yet")}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {supplier.productCount} {t("products")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("All Products")}</p>
                    <div className="grid gap-2 mt-3">
                      {(supplierProductsBySupplier[supplier.id] ?? []).slice(0, 3).map((product) => (
                        <div key={product.id} className="rounded-2xl border border-border p-3 bg-background">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {product.categories?.name ?? t("Uncategorized")}
                          </p>
                        </div>
                      ))}
                      {(supplierProductsBySupplier[supplier.id] ?? []).length === 0 && (
                        <p className="text-sm text-muted-foreground mt-1">{t("This supplier has not listed products yet.")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <Button
                      className={`rounded-full flex-1 ${isSubscribed ? "bg-secondary text-foreground hover:bg-secondary/80" : "gradient-primary text-primary-foreground"}`}
                      onClick={() => handleToggle(supplier.id)}
                      disabled={toggleSubscription.isPending}
                    >
                      {isSubscribed ? t("Subscribed") : t("Subscribe")}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => navigate(`/shop?supplier=${encodeURIComponent(supplier.id)}`)}
                    >
                      {t("View All Products")}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
};

export default SupplierDirectory;
