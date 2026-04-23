import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/use-products";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/ImageUpload";
import { Plus, Package, ShoppingCart, Pencil, Trash2, Loader2, X, DollarSign, TrendingUp } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
const statusOptions: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const statusCls = (s: OrderStatus) =>
  s === "pending" ? "bg-yellow-500/10 text-yellow-600" :
  s === "confirmed" ? "bg-blue-500/10 text-blue-600" :
  s === "shipped" ? "bg-purple-500/10 text-purple-600" :
  s === "delivered" ? "bg-green-500/10 text-green-600" :
  "bg-destructive/10 text-destructive";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

type ProductWithCategory = ProductRow & {
  categories: Pick<CategoryRow, "name" | "slug"> | null;
};

type OrderItemWithProduct = OrderItemRow & {
  products: Pick<ProductRow, "name" | "supplier_id" | "image_url"> | null;
};

type SupplierOrder = OrderRow & {
  order_items: OrderItemWithProduct[];
};

const SupplierDashboard = () => {
  const { user, accountType } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("piece");
  const [minOrder, setMinOrder] = useState("1");

  const isSupplier = accountType === "supplier";

  const { data: myProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["supplier-products", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("supplier_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductWithCategory[];
    },
    enabled: !!user && isSupplier,
  });

  const { data: myOrders, error: ordersError } = useQuery({
    queryKey: ["supplier-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items!inner(*, products!inner(name, supplier_id, image_url))")
        .eq("supplier_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierOrder[];
    },
    enabled: !!user && isSupplier,
  });

  useEffect(() => {
    if (!ordersError) return;
    const message = ordersError instanceof Error ? ordersError.message : "Unable to load orders.";
    toast({ title: "Unable to load orders", description: message, variant: "destructive" });
  }, [ordersError, toast]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        price: parseFloat(price),
        category_id: categoryId || null,
        image_url: imageUrl || null,
        stock: parseInt(stock) || 0,
        unit,
        min_order: parseInt(minOrder) || 1,
        supplier_id: user!.id,
      };
      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: editingId ? "Product updated" : "Product added" });
      resetForm();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unable to save product.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-orders"] });
      toast({ title: "Order status updated" });
      if (["confirmed", "shipped", "delivered"].includes(variables.status)) {
        supabase.functions
          .invoke("notify-order-status", {
            body: { orderId: variables.orderId, status: variables.status },
          })
          .catch(() => {
            // Email failures should not block status updates.
          });
      }
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unable to update status.";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName(""); setDescription(""); setPrice(""); setCategoryId("");
    setImageUrl(""); setStock(""); setUnit("piece"); setMinOrder("1");
  };

  const startEdit = (product: ProductWithCategory) => {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(String(product.price));
    setCategoryId(product.category_id ?? "");
    setImageUrl(product.image_url ?? "");
    setStock(String(product.stock));
    setUnit(product.unit);
    setMinOrder(String(product.min_order));
    setShowForm(true);
  };

  // Stats
  const revenue = (myOrders ?? []).reduce((sum, order) => {
    return sum + order.order_items.reduce((itemSum, item) => itemSum + Number(item.unit_price) * item.quantity, 0);
  }, 0);
  const pendingCount = (myOrders ?? []).filter((order) => order.status === "pending").length;
  const lowStockCount = (myProducts ?? []).filter((product) => product.stock < 10).length;

  if (!isSupplier) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Package className="h-20 w-20 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">Supplier Access Only</h1>
          <p className="text-muted-foreground mb-6">This dashboard is for supplier accounts only.</p>
          <Button onClick={() => navigate("/")} variant="hero">Go Home</Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl font-extrabold">Supplier Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your products and orders</p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="rounded-full gradient-primary text-primary-foreground font-bold">
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Revenue</p>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-2xl font-extrabold">EGP {revenue.toLocaleString()}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Orders</p>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-2xl font-extrabold">{myOrders?.length ?? 0}</p>
            <p className="text-muted-foreground text-[10px] mt-0.5">{pendingCount} pending</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Products</p>
              <Package className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-2xl font-extrabold">{myProducts?.length ?? 0}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Low Stock</p>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </div>
            <p className="font-heading text-2xl font-extrabold">{lowStockCount}</p>
          </div>
        </div>

        {/* Product Form */}
        {showForm && (
          <div className="glass-card-elevated rounded-2xl p-6 mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-lg">{editingId ? "Edit Product" : "Add New Product"}</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="mb-2 block">Product Image</Label>
                <ImageUpload value={imageUrl} onChange={setImageUrl} />
              </div>
              <div>
                <Label>Product Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vitamin D3 5000IU" className="mt-1" required />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief product description" className="mt-1" />
              </div>
              <div>
                <Label>Price (EGP)</Label>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="mt-1" min="0" step="0.01" required />
              </div>
              <div>
                <Label>Stock Quantity</Label>
                <Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="mt-1" min="0" required />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["piece", "box", "bottle", "pack", "tube", "tub"].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min. Order Qty</Label>
                <Input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="1" className="mt-1" min="1" required />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={resetForm} className="rounded-full">Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name || !price} className="rounded-full gradient-primary text-primary-foreground font-bold">
                {saveMutation.isPending ? "Saving..." : editingId ? "Update Product" : "Add Product"}
              </Button>
            </div>
          </div>
        )}

        {/* My Products */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-bold text-lg">My Products ({myProducts?.length ?? 0})</h2>
          </div>

          {productsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !myProducts?.length ? (
            <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No products yet. Click "Add Product" to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {myProducts.map((product) => (
                <div key={product.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm truncate">{product.name}</h3>
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        {product.categories?.name ?? "Uncategorized"}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      EGP {Number(product.price).toLocaleString()} · {product.stock} in stock · Min. {product.min_order} {product.unit}s
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(product)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(product.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Orders */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-bold text-lg">Incoming Orders ({myOrders?.length ?? 0})</h2>
          </div>

          {!myOrders?.length ? (
            <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No orders yet. Orders will appear here when buyers purchase your products.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {myOrders.map((order) => (
                <div key={order.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                    <div>
                      <span className="font-bold text-sm">Order #{order.id.slice(0, 8)}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusCls(order.status)}`}>
                        {order.status}
                      </span>
                      <Select
                        value={order.status}
                        onValueChange={(v) => updateStatusMutation.mutate({ orderId: order.id, status: v as OrderStatus })}
                      >
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1 mb-2">
                    {order.order_items.map((oi) => (
                      <div key={oi.id} className="flex justify-between text-xs text-muted-foreground">
                        <span>{oi.products?.name} × {oi.quantity}</span>
                        <span className="font-medium text-foreground">EGP {(Number(oi.unit_price) * oi.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {order.delivery_address && (
                    <p className="text-muted-foreground text-[11px] pt-2 border-t border-border">
                      📍 {order.delivery_address}, {order.delivery_city} · {order.delivery_phone}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SupplierDashboard;
