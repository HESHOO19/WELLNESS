import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  Package,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  useFavoriteProducts,
  useSupplierSubscriptions,
} from "@/hooks/use-marketplace";
import { dashboardRangeOptions, filterByDashboardRange, type DashboardRange } from "@/lib/dashboard-range";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

type BuyerOrderItem = OrderItemRow & {
  products: Pick<ProductRow, "id" | "name" | "image_url"> | null;
};

type BuyerOrder = OrderRow & {
  order_items: BuyerOrderItem[];
};

const statusMeta = {
  pending: { label: "Pending", icon: Clock, cls: "bg-yellow-500/10 text-yellow-600" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, cls: "bg-blue-500/10 text-blue-600" },
  shipped: { label: "Shipped", icon: Truck, cls: "bg-purple-500/10 text-purple-600" },
  delivered: { label: "Delivered", icon: CheckCircle2, cls: "bg-green-500/10 text-green-600" },
  cancelled: { label: "Cancelled", icon: Clock, cls: "bg-destructive/10 text-destructive" },
} as const;

const BuyerOrders = () => {
  const { user, loading, accountType } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>("14d");
  const { data: favorites = [] } = useFavoriteProducts(user?.id, !!user && accountType === "buyer");
  const { data: subscriptions = [] } = useSupplierSubscriptions(user?.id, !!user && accountType === "buyer");

  const { data: orders = [], isLoading } = useQuery<BuyerOrder[]>({
    queryKey: ["buyer-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(id, name, image_url))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BuyerOrder[];
    },
    enabled: !!user,
  });

  const favoriteProductIds = useMemo(() => new Set(favorites.map((favorite) => favorite.product_id)), [favorites]);
  const visibleOrders = useMemo(() => filterByDashboardRange(orders, range), [orders, range]);
  const favoriteProducts = useMemo(
    () =>
      visibleOrders
        .flatMap((order) => order.order_items.map((item) => item.products).filter(Boolean))
        .filter((product, index, all) => {
          if (!product) return false;
          if (!favoriteProductIds.has(product.id)) return false;
          return all.findIndex((candidate) => candidate?.id === product.id) === index;
        }),
    [favoriteProductIds, visibleOrders],
  );

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, navigate, user]);

  if (!user) return null;

  const totalSpent = visibleOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const pendingOrders = visibleOrders.filter((order) => order.status === "pending");
  const activeOrders = visibleOrders.filter((order) => ["confirmed", "shipped", "delivered"].includes(order.status));

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Buyer Workspace</p>
              <h1 className="font-heading text-3xl font-extrabold mt-2">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-2">
                Track orders, watch supplier confirmations, and keep your subscriptions and favorites close by.
              </p>
            </div>
            <div className="min-w-[190px]">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Time Range</p>
              <Select value={range} onValueChange={(value) => setRange(value as DashboardRange)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {dashboardRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total Orders</p>
            <p className="font-heading text-2xl font-extrabold mt-1">{visibleOrders.length}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total Spent</p>
            <p className="font-heading text-2xl font-extrabold mt-1">EGP {totalSpent.toLocaleString()}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Subscriptions</p>
            <p className="font-heading text-2xl font-extrabold mt-1">{subscriptions.length}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Favorites</p>
            <p className="font-heading text-2xl font-extrabold mt-1">{favorites.length}</p>
          </div>
        </div>

        <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-6 mb-8">
          <section className="glass-card-elevated rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-xl font-bold">Supplier Subscriptions</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Follow suppliers to tailor your new-arrivals feed around the catalogs you care about most.
            </p>
            <div className="space-y-3 mt-5">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Active subscriptions</p>
                <p className="font-heading text-3xl font-extrabold mt-2">{subscriptions.length}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pending orders</p>
                <p className="font-heading text-3xl font-extrabold mt-2">{pendingOrders.length}</p>
              </div>
            </div>
            <Button className="rounded-full mt-5" onClick={() => navigate("/suppliers")}>
              <Store className="h-4 w-4 mr-2" />
              Browse Suppliers
            </Button>
          </section>

          <section className="glass-card-elevated rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-xl font-bold">Favorites</h2>
            </div>
            {favoriteProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-muted-foreground mt-5">
                Favorite products from product detail pages to keep quick access to them here.
              </div>
            ) : (
              <div className="space-y-3 mt-5">
                {favoriteProducts.slice(0, 4).map((product) => (
                  <button
                    key={product!.id}
                    type="button"
                    onClick={() => navigate(`/products/${product!.id}`)}
                    className="w-full text-left rounded-2xl border border-border px-4 py-3 hover:border-primary/40 transition-colors"
                  >
                    <p className="font-medium">{product!.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">Open product details</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-heading font-bold text-lg mb-1">No orders in this range</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try a wider range or place new orders to see dashboard activity here.
            </p>
            <Button onClick={() => navigate("/shop")} variant="hero" className="rounded-full">
              Browse Catalog
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-yellow-600" />
                <h2 className="font-heading font-bold text-lg">Pending Supplier Confirmations</h2>
              </div>
              {pendingOrders.length ? (
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <div key={order.id} className="glass-card-elevated rounded-3xl p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-sm">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Waiting for {order.supplier_name ?? "supplier"} to confirm
                          </p>
                        </div>
                        <p className="font-heading font-extrabold">EGP {Number(order.total).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
                  No pending confirmations right now.
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <h2 className="font-heading font-bold text-lg">Active Orders</h2>
              </div>
              {activeOrders.length ? (
                <div className="space-y-3">
                  {activeOrders.map((order) => {
                    const meta = statusMeta[order.status as keyof typeof statusMeta] ?? statusMeta.confirmed;
                    const Icon = meta.icon;
                    return (
                      <div key={order.id} className="glass-card-elevated rounded-3xl p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">Order #{order.id.slice(0, 8)}</span>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 ${meta.cls}`}>
                                <Icon className="h-3 w-3" /> {meta.label}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Supplier: {order.supplier_name ?? "Wellness supplier"}
                            </p>
                          </div>
                          <p className="font-heading font-extrabold">EGP {Number(order.total).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
                  Confirmed supplier updates will appear here.
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h2 className="font-heading font-bold text-lg">All Orders</h2>
              </div>
              <div className="space-y-3">
                {visibleOrders.map((order) => {
                  const meta = statusMeta[order.status as keyof typeof statusMeta] ?? statusMeta.pending;
                  const Icon = meta.icon;
                  return (
                    <div key={order.id} className="glass-card-elevated rounded-3xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">Order #{order.id.slice(0, 8)}</span>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 ${meta.cls}`}>
                              <Icon className="h-3 w-3" /> {meta.label}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(order.created_at).toLocaleDateString()} · {order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Supplier: {order.supplier_name ?? "Wellness supplier"}
                          </p>
                        </div>
                        <p className="font-heading font-extrabold">EGP {Number(order.total).toLocaleString()}</p>
                      </div>

                      <div className="space-y-2 border-t border-border pt-3">
                        {order.order_items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => item.products?.id && navigate(`/products/${item.products.id}`)}
                            className="w-full text-left flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-secondary/60 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden shrink-0">
                              {item.products?.image_url ? (
                                <img src={item.products.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <span className="flex-grow truncate">{item.products?.name ?? "Product"} x {item.quantity}</span>
                            <span className="font-bold text-xs">EGP {(Number(item.unit_price) * item.quantity).toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BuyerOrders;
