import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Store, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
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

  const handleToggle = async (supplierId: string) => {
    if (!user || !isBuyer) {
      toast({
        title: "Buyer account required",
        description: "Sign in with a buyer account to subscribe to suppliers.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    const result = await toggleSubscription.mutateAsync(supplierId);
    toast({
      title: result.active ? "Supplier subscribed" : "Subscription removed",
      description: result.active
        ? "Their new arrivals will now be featured for you."
        : "Their new products will stop appearing in your tailored feed.",
    });
  };

  if (accountType === "supplier") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="font-heading text-3xl font-extrabold">Supplier directory is built for buyers</h1>
          <p className="text-muted-foreground mt-3">
            Suppliers manage their own listings and orders instead of subscribing to other suppliers.
          </p>
          <Button className="rounded-full mt-6" onClick={() => navigate("/supplier")}>
            Open Supplier Dashboard
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Buyer Subscriptions</p>
            <h1 className="font-heading text-3xl font-extrabold mt-2">Supplier Directory</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Browse all suppliers on Wellness, subscribe to the ones you trust, and bring their newest products into your new-arrivals feed.
            </p>
          </div>
          <div className="glass-card rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Subscriptions</p>
            <p className="font-heading text-3xl font-extrabold mt-1">{subscriptions.length}</p>
          </div>
        </div>

        {!user && (
          <div className="glass-card-elevated rounded-3xl p-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold">Sign in to personalize supplier subscriptions</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Buyers can follow suppliers and unlock a tailored new-arrivals feed.
              </p>
            </div>
            <Button className="rounded-full gradient-primary text-primary-foreground" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        )}

        {directoryQuery.isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="font-heading text-2xl font-bold">No suppliers matched your search</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Try a broader search to discover more supplier partners.
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
                      <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Supplier</p>
                      <h2 className="font-heading text-xl font-extrabold mt-2">
                        {supplier.business_name ?? supplier.email ?? "Wellness Supplier"}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-2">{supplier.email ?? "Verified supplier profile"}</p>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {supplier.productCount} products
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="rounded-2xl border border-border p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Categories</p>
                      <p className="font-semibold mt-2">{supplier.categoryCount}</p>
                    </div>
                    <div className="rounded-2xl border border-border p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Newest Listing</p>
                      <p className="font-semibold mt-2">
                        {supplier.newestProduct
                          ? new Date(supplier.newestProduct.created_at).toLocaleDateString()
                          : "No products yet"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border p-4 mt-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Latest Product</p>
                    <p className="font-semibold mt-2">
                      {supplier.newestProduct?.name ?? "Supplier has not listed products yet"}
                    </p>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <Button
                      className={`rounded-full flex-1 ${isSubscribed ? "bg-secondary text-foreground hover:bg-secondary/80" : "gradient-primary text-primary-foreground"}`}
                      onClick={() => handleToggle(supplier.id)}
                      disabled={toggleSubscription.isPending}
                    >
                      {isSubscribed ? "Subscribed" : "Subscribe"}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => navigate(`/shop?supplier=${encodeURIComponent(supplier.id)}`)}
                    >
                      View All Products
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
