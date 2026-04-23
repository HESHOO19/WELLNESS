import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Package, Loader2, ShoppingBag, Truck, CheckCircle2, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

type BuyerOrderItem = OrderItemRow & {
  products: Pick<ProductRow, "name" | "image_url"> | null;
};

type BuyerOrder = OrderRow & {
  order_items: BuyerOrderItem[];
};

const statusMeta: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  pending: { label: "Pending", icon: Clock, cls: "bg-yellow-500/10 text-yellow-600" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, cls: "bg-blue-500/10 text-blue-600" },
  shipped: { label: "Shipped", icon: Truck, cls: "bg-purple-500/10 text-purple-600" },
  delivered: { label: "Delivered", icon: CheckCircle2, cls: "bg-green-500/10 text-green-600" },
  cancelled: { label: "Cancelled", icon: Clock, cls: "bg-destructive/10 text-destructive" },
};

const BuyerOrders = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery<BuyerOrder[]>({
    queryKey: ["buyer-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(name, image_url))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BuyerOrder[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  if (!user) return null;

  const totalSpent = (orders ?? []).reduce((sum, o) => sum + Number(o.total), 0);
  const pendingOrders = (orders ?? []).filter((order) => order.status === "pending");
  const confirmedOrders = (orders ?? []).filter((order) =>
    ["confirmed", "shipped", "delivered"].includes(order.status),
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-extrabold">Buyer Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Track confirmations, spending, and delivery progress</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total Orders</p>
            <p className="font-heading text-2xl font-extrabold mt-1">{orders?.length ?? 0}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total Spent</p>
            <p className="font-heading text-2xl font-extrabold mt-1">EGP {totalSpent.toLocaleString()}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Pending Confirmations</p>
            <p className="font-heading text-2xl font-extrabold mt-1">{pendingOrders.length}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Confirmed Suppliers</p>
            <p className="font-heading text-2xl font-extrabold mt-1">{confirmedOrders.length}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !orders?.length ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-heading font-bold text-lg mb-1">No orders yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Start browsing the catalog to place your first order.</p>
            <Button onClick={() => navigate("/shop")} variant="hero" className="rounded-full">Browse Catalog</Button>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-yellow-600" />
                <h2 className="font-heading font-bold text-lg">Pending Confirmations</h2>
              </div>
              {pendingOrders.length ? (
                <div className="space-y-3">
                  {pendingOrders.map((order) => {
                    const pendingNames = order.supplier_orders
                      .filter((supplierOrder) => supplierOrder.status === "pending")
                      .map((supplierOrder) => supplierOrder.supplier_name);
                    return (
                      <div key={order.id} className="glass-card-elevated rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">Order #{order.id.slice(0, 8)}</span>
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-600">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs mt-1">
                              Waiting for {formatSupplierNames(pendingNames)} to confirm
                            </p>
                          </div>
                          <p className="font-heading font-extrabold">EGP {Number(order.total).toLocaleString()}</p>
                        </div>
                        <p className="text-muted-foreground text-xs mt-2">
                          {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
                  No pending confirmations right now.
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <h2 className="font-heading font-bold text-lg">Confirmed By Suppliers</h2>
              </div>
              {confirmedSuppliers.length ? (
                <div className="space-y-3">
                  {confirmedSuppliers.map((supplierOrder) => {
                    const order = ordersById.get(supplierOrder.order_id);
                    const meta = statusMeta[supplierOrder.status] ?? statusMeta.confirmed;
                    const Icon = meta.icon;
                    return (
                      <div key={supplierOrder.id} className="glass-card-elevated rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">Order #{supplierOrder.order_id.slice(0, 8)}</span>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 ${meta.cls}`}>
                                <Icon className="h-3 w-3" /> {meta.label}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs mt-1">
                              Confirmed by {supplierOrder.supplier_name}
                            </p>
                          </div>
                          <p className="font-heading font-extrabold">EGP {Number(order?.total ?? 0).toLocaleString()}</p>
                        </div>
                        <p className="text-muted-foreground text-xs mt-2">
                          {new Date(supplierOrder.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
                  No confirmed supplier updates yet.
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h2 className="font-heading font-bold text-lg">All Orders</h2>
              </div>
              <div className="space-y-3">
                {orders.map((order) => {
                  const meta = statusMeta[order.status] ?? statusMeta.pending;
                  const Icon = meta.icon;
                  const supplierNames = order.supplier_orders?.map((supplierOrder) => supplierOrder.supplier_name) ?? [];
                  return (
                    <div key={order.id} className="glass-card-elevated rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">Order #{order.id.slice(0, 8)}</span>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1 ${meta.cls}`}>
                              <Icon className="h-3 w-3" /> {meta.label}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-xs mt-1">
                            {new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                            {" · "}
                            {order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}
                          </p>
                          {supplierNames.length > 0 && (
                            <p className="text-muted-foreground text-xs mt-1">
                              Suppliers: {formatSupplierNames(supplierNames)}
                            </p>
                          )}
                        </div>
                        <p className="font-heading font-extrabold">EGP {Number(order.total).toLocaleString()}</p>
                      </div>
                      <div className="space-y-2 border-t border-border pt-3">
                        {order.order_items.map((oi) => (
                          <div key={oi.id} className="flex items-center gap-3 text-sm">
                            <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                              {oi.products?.image_url ? (
                                <img src={oi.products.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                              )}
                            </div>
                            <span className="flex-grow truncate">{oi.products?.name ?? "Product"} × {oi.quantity}</span>
                            <span className="font-bold text-xs">EGP {(Number(oi.unit_price) * oi.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      {order.delivery_address && (
                        <p className="text-muted-foreground text-xs mt-3 pt-3 border-t border-border">
                          📍 {order.delivery_address}, {order.delivery_city}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BuyerOrders;
