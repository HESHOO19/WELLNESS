import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Boxes,
  DollarSign,
  Loader2,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImageUpload from "@/components/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCategories } from "@/hooks/use-products";
import {
  getProductMetrics,
  useSupplierOrders,
  useSupplierProducts,
} from "@/hooks/use-marketplace";
import { dashboardRangeOptions, filterByDashboardRange, type DashboardRange } from "@/lib/dashboard-range";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
const statusOptions: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const statusCls = (status: OrderStatus) =>
  status === "pending"
    ? "bg-yellow-500/10 text-yellow-600"
    : status === "confirmed"
      ? "bg-blue-500/10 text-blue-600"
      : status === "shipped"
        ? "bg-purple-500/10 text-purple-600"
        : status === "delivered"
          ? "bg-green-500/10 text-green-600"
          : "bg-destructive/10 text-destructive";

const SupplierDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, accountType, loading } = useAuth();
  const { t, formatNumber } = useLanguage();
  const { data: categories = [] } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [range, setRange] = useState<DashboardRange>("14d");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("piece");
  const [minOrder, setMinOrder] = useState("1");

  const tab = searchParams.get("tab") ?? "dashboard";
  const searchQuery = (searchParams.get("q") ?? "").trim().toLowerCase();
  const isSupplier = accountType === "supplier";

  if (loading && user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-6xl mx-auto px-4 md:px-6 py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  const { data: myProducts = [], isLoading: productsLoading } = useSupplierProducts(user?.id, !!user && isSupplier);
  const { data: myOrders = [], isLoading: ordersLoading } = useSupplierOrders(user?.id, !!user && isSupplier);
  const filteredOrders = useMemo(() => filterByDashboardRange(myOrders, range), [myOrders, range]);

  const metricsByProduct = useMemo(() => {
    return new Map(
      myProducts.map((product) => [product.id, getProductMetrics(filteredOrders, product.id)]),
    );
  }, [filteredOrders, myProducts]);

  const revenue = filteredOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const lowStockCount = myProducts.filter((product) => product.stock < 10).length;
  const activeProducts = myProducts.filter((product) => product.is_active).length;
  const visibleProducts = useMemo(() => {
    if (!searchQuery) return myProducts;
    return myProducts.filter((product) => {
      const haystack = [
        product.name,
        product.description ?? "",
        product.categories?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }, [myProducts, searchQuery]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategoryId("");
    setImageUrls([]);
    setStock("");
    setUnit("piece");
    setMinOrder("1");
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) {
      const err = error as Record<string, unknown>;
      if (typeof err.message === "string") return err.message;
      if (typeof err.error === "string") return err.error;
    }
    return t("Unable to save product.");
  };

  const normalizedImageUrls = imageUrls.map((url) => url.trim()).filter(Boolean);
  const parsedPrice = Number(price.trim().replace(/,/g, "."));
  const parsedStock = Number(stock.trim() || "0");
  const parsedMinOrder = Number(minOrder.trim() || "1");
  const isProductFormValid =
    name.trim().length > 0 &&
    price.trim().length > 0 &&
    Number.isFinite(parsedPrice) &&
    parsedPrice >= 0 &&
    Number.isFinite(parsedStock) &&
    parsedStock >= 0 &&
    Number.isInteger(parsedStock) &&
    Number.isFinite(parsedMinOrder) &&
    parsedMinOrder >= 1 &&
    Number.isInteger(parsedMinOrder);

  const startEdit = (product: (typeof myProducts)[number]) => {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(String(product.price));
    setCategoryId(product.category_id ?? "");
    setImageUrls(
      (product.image_urls?.length ? product.image_urls : (product.image_url ? [product.image_url] : []))
        .filter(Boolean),
    );
    setStock(String(product.stock));
    setUnit(product.unit);
    setMinOrder(String(product.min_order));
    setShowForm(true);
    setSearchParams({ tab: "products" });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!isProductFormValid) {
        throw new Error(t("Please complete all required fields with valid values."));
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        category_id: categoryId || null,
        image_url: normalizedImageUrls[0] ?? null,
        image_urls: normalizedImageUrls,
        stock: parsedStock,
        unit: unit.trim() || "piece",
        min_order: parsedMinOrder,
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supplier-products", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
      toast({ title: editingId ? t("Product updated") : t("Product added") });
      resetForm();
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error);
      toast({ title: t("Save failed"), description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supplier-products", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
      toast({ title: "Product deleted" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to delete product.";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: async (_value, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["supplier-orders", user?.id] });
      toast({ title: "Order status updated" });
      if (["confirmed", "shipped", "delivered"].includes(variables.status)) {
        supabase.functions
          .invoke("notify-order-status", {
            body: { orderId: variables.orderId, status: variables.status },
          })
          .catch(() => undefined);
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to update order status.";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    },
  });

  if (!isSupplier) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-3xl mx-auto px-4 md:px-6 py-20 text-center">
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="font-heading text-3xl font-extrabold">Supplier access only</h1>
          <p className="text-muted-foreground mt-3">
            This area is reserved for supplier accounts managing listings and fulfilment.
          </p>
          <Button className="rounded-full mt-6" onClick={() => navigate("/")}>
            Go Home
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const renderProductForm = () =>
    showForm && (
      <div className="glass-card-elevated rounded-3xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-xl font-bold">{editingId ? "Edit Product" : "Add Product"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Keep your listing sharp so buyers understand the stock, pricing, and terms immediately.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={resetForm}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="mb-2 block">Product Images</Label>
            <div className="space-y-3">
              {imageUrls.map((url, idx) => (
                <div key={`${url}-${idx}`} className="flex items-start gap-3">
                  <ImageUpload
                    value={url}
                    onChange={(nextUrl) => {
                      setImageUrls((prev) => prev.map((item, i) => (i === idx ? nextUrl : item)));
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setImageUrls((prev) => [...prev, ""])}
              >
                Add Another Image
              </Button>
            </div>
          </div>
          <div>
            <Label>Product Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>{t("Description")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("Price")}</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" min="0" step="0.01" />
          </div>
          <div>
            <Label>{t("Stock")}</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1" min="0" />
          </div>
          <div>
            <Label>{t("Unit")}</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>{t("Minimum Order")}</Label>
            <Input type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="mt-1" min="1" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" className="rounded-full" onClick={resetForm}>
            {t("Cancel")}
          </Button>
          <Button
            className="rounded-full gradient-primary text-primary-foreground"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isProductFormValid}
          >
            {saveMutation.isPending ? t("Saving...") : editingId ? t("Update Product") : t("Add Product")}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap w-full">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Supplier Workspace</p>
              <h1 className="font-heading text-3xl font-extrabold mt-2">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Track demand, update listings, and manage every order requested from your catalog.
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

          <div className="flex gap-2 flex-wrap">
            <Button variant={tab === "dashboard" ? "default" : "outline"} className="rounded-full" onClick={() => setSearchParams({ tab: "dashboard" })}>
              Dashboard
            </Button>
            <Button variant={tab === "products" ? "default" : "outline"} className="rounded-full" onClick={() => setSearchParams({ tab: "products" })}>
              My Products
            </Button>
            <Button variant={tab === "orders" ? "default" : "outline"} className="rounded-full" onClick={() => setSearchParams({ tab: "orders" })}>
              My Orders
            </Button>
            {!showForm && (
              <Button className="rounded-full gradient-primary text-primary-foreground" onClick={() => {
                if (imageUrls.length === 0) setImageUrls([""]);
                setShowForm(true);
                setSearchParams({ tab: "products" });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Revenue</p>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-2xl font-extrabold mt-2">EGP {revenue.toLocaleString()}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Orders</p>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-2xl font-extrabold mt-2">{filteredOrders.length}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Active Products</p>
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-2xl font-extrabold mt-2">{activeProducts}</p>
          </div>
          <div className="glass-card-elevated rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Low Stock</p>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </div>
            <p className="font-heading text-2xl font-extrabold mt-2">{lowStockCount}</p>
          </div>
        </div>

        {tab === "products" && renderProductForm()}

        {tab === "dashboard" && (
          <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <section className="glass-card-elevated rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-xl font-bold">Top Product Insights</h2>
              </div>

              {productsLoading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : myProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-muted-foreground">
                  Add your first product to start measuring demand and profit.
                </div>
              ) : (
                <div className="space-y-3">
                  {myProducts.slice(0, 4).map((product) => {
                    const metrics = metricsByProduct.get(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="w-full text-left glass-card rounded-2xl p-4 hover:shadow-elevated transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{product.name}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {product.stock} in stock · EGP {Number(product.price).toLocaleString()}
                            </p>
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                            Insights
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Demand</p>
                            <p className="font-semibold mt-1">{metrics?.unitsSold ?? 0} units</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Profit</p>
                            <p className="font-semibold mt-1">EGP {(metrics?.revenue ?? 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Orders</p>
                            <p className="font-semibold mt-1">{metrics?.orderCount ?? 0}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="glass-card-elevated rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <h2 className="font-heading text-xl font-bold">Latest Orders</h2>
              </div>

              {ordersLoading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-muted-foreground">
                  Orders from buyers in the selected range will appear here as soon as they come in.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.slice(0, 4).map((order) => (
                    <div key={order.id} className="glass-card rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-sm">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(order.created_at).toLocaleDateString()} · {order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusCls(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-3">
                        <span className="text-muted-foreground">{order.order_items.length} line items</span>
                        <span className="font-semibold">EGP {Number(order.total).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "products" && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-2xl font-bold">My Products</h2>
            </div>

            {productsLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-muted-foreground">
                {searchQuery
                  ? "No products match your search."
                  : "You have not listed any products yet. Add one to start tracking demand and profit."}
              </div>
            ) : (
              <div className="grid gap-3">
                {visibleProducts.map((product) => {
                  const metrics = metricsByProduct.get(product.id);
                  return (
                    <div key={product.id} className="glass-card-elevated rounded-3xl p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden shrink-0">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">Rx</div>
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => navigate(`/products/${product.id}`)}
                              className="font-heading text-lg font-bold hover:text-primary transition-colors text-left"
                            >
                              {product.name}
                            </button>
                            <p className="text-sm text-muted-foreground mt-1">
                              {product.categories?.name ?? "Uncategorized"} · {product.stock} in stock · EGP {Number(product.price).toLocaleString()}
                            </p>
                            <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
                              <div>
                                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Demand</p>
                                <p className="font-semibold mt-1">{metrics?.unitsSold ?? 0} units sold</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Profit</p>
                                <p className="font-semibold mt-1">EGP {(metrics?.revenue ?? 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Orders</p>
                                <p className="font-semibold mt-1">{metrics?.orderCount ?? 0}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" className="rounded-full" onClick={() => startEdit(product)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-full text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(product.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "orders" && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-2xl font-bold">My Orders</h2>
            </div>

            {ordersLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="glass-card rounded-3xl p-10 text-muted-foreground">
                No buyer orders in the selected range yet. Once pharmacies place requests from your listings, they will appear here with payment and status details.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="glass-card-elevated rounded-3xl p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-sm">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(order.created_at).toLocaleDateString()} · {order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusCls(order.status)}`}>
                          {order.status}
                        </span>
                        <Select
                          value={order.status}
                          onValueChange={(value) =>
                            updateStatusMutation.mutate({ orderId: order.id, status: value as OrderStatus })
                          }
                        >
                          <SelectTrigger className="h-9 w-[150px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status} className="capitalize text-xs">
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      {order.order_items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.products?.id && navigate(`/products/${item.products.id}`)}
                          className="w-full text-left flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 hover:border-primary/40 transition-colors"
                        >
                          <div>
                            <p className="font-medium">{item.products?.name ?? "Product"}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Qty {item.quantity}
                            </p>
                          </div>
                          <span className="font-semibold">EGP {(Number(item.unit_price) * item.quantity).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>

                    {order.delivery_address && (
                      <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
                        Delivery to {order.delivery_address}, {order.delivery_city} · {order.delivery_phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SupplierDashboard;
