import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  Package,
  Save,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductGrid from "@/components/ProductGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  getProductMetrics,
  toProductCardModel,
  useFavoriteProducts,
  useFavoriteToggle,
  useProductById,
  useRelatedProducts,
  useSupplierOrders,
  useSupplierSubscriptionToggle,
  useSupplierSubscriptions,
} from "@/hooks/use-marketplace";
import { supabase } from "@/integrations/supabase/client";

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, accountType } = useAuth();
  const { addToCart } = useCart();
  const { t, formatNumber } = useLanguage();
  const { toast } = useToast();
  const isBuyer = accountType === "buyer";
  const isSupplier = accountType === "supplier";

  const { data: product, isLoading } = useProductById(productId);
  const { data: relatedProducts = [] } = useRelatedProducts(product);
  const { data: favoriteProducts = [] } = useFavoriteProducts(user?.id, !!user && isBuyer);
  const { data: subscriptions = [] } = useSupplierSubscriptions(user?.id, !!user && isBuyer);
  const { data: supplierOrders = [] } = useSupplierOrders(
    user?.id,
    !!user && isSupplier && product?.supplier_id === user?.id,
  );

  const favoriteToggle = useFavoriteToggle(user?.id);
  const subscriptionToggle = useSupplierSubscriptionToggle(user?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(String(product.price));
    setStock(String(product.stock));
    setUnit(product.unit);
    setMinOrder(String(product.min_order));
    const normalizedImages =
      (product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : []).filter(Boolean);
    setImageUrls(normalizedImages);
    setImageUrl(normalizedImages[0] ?? product.image_url ?? "");
    setActiveImageIndex(0);
  }, [product]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({
          name,
          description,
          price: Number(price),
          stock: Number(stock),
          unit,
          min_order: Number(minOrder),
          image_url: imageUrls[0] ?? imageUrl ?? null,
          image_urls: imageUrls.filter((url) => !!url.trim()),
        })
        .eq("id", productId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product", productId] }),
        queryClient.invalidateQueries({ queryKey: ["supplier-products", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
      toast({ title: t("Product updated"), description: t("Your product changes are live.") });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to update product.";
      toast({ title: t("Update failed"), description: message, variant: "destructive" });
    },
  });

  const isFavorite = favoriteProducts.some((favorite) => favorite.product_id === product?.id);
  const isSubscribed = subscriptions.some((subscription) => subscription.supplier_id === product?.supplier_id);
  const productMetrics = useMemo(
    () => (product ? getProductMetrics(supplierOrders, product.id) : null),
    [product, supplierOrders],
  );

  const productOrders = useMemo(() => {
    if (!product) return [];
    return supplierOrders.filter((order) =>
      order.order_items.some((item) => item.product_id === product.id),
    );
  }, [product, supplierOrders]);

  if (isLoading) {
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

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
          <h1 className="font-heading text-3xl font-extrabold">{t("Product not found")}</h1>
          <p className="text-muted-foreground mt-3">
            {t("The product you tried to open is no longer available.")}
          </p>
          <Button className="rounded-full mt-6" onClick={() => navigate(-1)}>
            {t("Go Back")}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const isSupplierOwner = isSupplier && product.supplier_id === user?.id;

  if (isSupplier && !isSupplierOwner) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-20 text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="font-heading text-3xl font-extrabold">{t("Suppliers only manage their own products")}</h1>
          <p className="text-muted-foreground mt-3">
            {t("Open your product catalog to review insights for your own listings.")}
          </p>
          <Button className="rounded-full mt-6" onClick={() => navigate("/supplier?tab=products")}>
            {t("Open My Products")}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const cardProduct = toProductCardModel(product);
  const galleryImages =
    (product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : []).filter(Boolean);
  const activeImage = galleryImages[activeImageIndex] ?? cardProduct.image_url;

  const handleAddToCart = () => {
    addToCart(cardProduct, cardProduct.min_order);
    toast({
      title: t("Added to cart"),
      description: `${cardProduct.name} x ${cardProduct.min_order} ${cardProduct.unit}s`,
    });
  };

  const requireBuyer = () => {
    if (user && isBuyer) return true;
    toast({
      title: t("Buyer account required"),
      description: t("Sign in with a buyer account to use this action."),
      variant: "destructive",
    });
    navigate("/auth");
    return false;
  };

  const handleFavoriteToggle = async () => {
    if (!requireBuyer()) return;
    const result = await favoriteToggle.mutateAsync(product.id);
    toast({
      title: result.active ? t("Added to favorites") : t("Removed from favorites"),
      description: result.active
        ? t("You can come back to this product anytime.")
        : t("This product is no longer in your favorites."),
    });
  };

  const handleSubscriptionToggle = async () => {
    if (!requireBuyer() || !product.supplier_id) return;
    const result = await subscriptionToggle.mutateAsync(product.supplier_id);
    toast({
      title: result.active ? t("Supplier subscribed") : t("Subscription removed"),
      description: result.active
        ? t("New arrivals from this supplier will show up in your feed.")
        : t("Their new arrivals will no longer be highlighted for you."),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("Back")}
        </Button>

        <div className="grid lg:grid-cols-[1.25fr_0.95fr] gap-8 items-start">
          <section className="glass-card-elevated rounded-3xl p-6 md:p-8">
            <div className="grid md:grid-cols-[280px_1fr] gap-6">
              <div className="rounded-3xl overflow-hidden bg-secondary min-h-[280px]">
                {activeImage ? (
                  <div className="relative w-full h-full min-h-[280px]">
                    <img src={activeImage} alt={product.name} className="w-full h-full object-cover" />
                    {galleryImages.length > 1 && (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                          onClick={() => setActiveImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                          onClick={() => setActiveImageIndex((prev) => (prev + 1) % galleryImages.length)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full min-h-[280px] flex items-center justify-center text-6xl text-muted-foreground/40">
                    Rx
                  </div>
                )}

                {galleryImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-2 bg-background/80">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`h-14 w-14 rounded-lg overflow-hidden border shrink-0 ${idx === activeImageIndex ? "border-primary" : "border-border"}`}
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
                      {isSupplierOwner ? t("Supplier Insights") : t("Product Detail")}
                    </p>
                    <h1 className="font-heading text-3xl md:text-4xl font-extrabold mt-2">{product.name}</h1>
                    <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{product.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{t("Price")}</p>
                    <p className="font-heading text-3xl font-extrabold mt-1">EGP {formatNumber(Number(product.price))}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-6">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Category")}</p>
                    <p className="font-semibold mt-2">{product.categories?.name ?? t("General")}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Available Quantity")}</p>
                    <p className="font-semibold mt-2">{product.stock} {product.unit}s {t("left")}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Minimum Order")}</p>
                    <p className="font-semibold mt-2">{product.min_order} {product.unit}s</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Supplier")}</p>
                    <p className="font-semibold mt-2">{product.supplier?.business_name ?? product.supplier?.email ?? t("Wellness Supplier")}</p>
                  </div>
                </div>

                {!isSupplierOwner && (
                  <div className="flex flex-wrap gap-3 mt-6">
                    <Button className="rounded-full gradient-primary text-primary-foreground" onClick={handleAddToCart}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {t("Add to Cart")}
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={handleFavoriteToggle}>
                      <Heart className={`h-4 w-4 mr-2 ${isFavorite ? "fill-current text-primary" : ""}`} />
                      {isFavorite ? t("Saved") : t("Add to Favorites")}
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={handleSubscriptionToggle}>
                      <Users className="h-4 w-4 mr-2" />
                      {isSubscribed ? t("Subscribed") : t("Subscribe to Supplier")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {isSupplierOwner ? (
            <aside className="space-y-4">
              <div className="glass-card-elevated rounded-3xl p-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-xl font-bold">{t("Product Insights")}</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Units Sold")}</p>
                    <p className="font-heading text-2xl font-extrabold mt-2">{productMetrics?.unitsSold ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Revenue")}</p>
                    <p className="font-heading text-2xl font-extrabold mt-2">EGP {formatNumber(productMetrics?.revenue ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Orders")}</p>
                    <p className="font-heading text-2xl font-extrabold mt-2">{productMetrics?.orderCount ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Latest Order")}</p>
                    <p className="font-semibold mt-2">
                      {productMetrics?.latestOrderAt
                        ? new Date(productMetrics.latestOrderAt).toLocaleDateString()
                        : t("No orders yet")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card-elevated rounded-3xl p-6">
                <h2 className="font-heading text-xl font-bold">{t("Edit Product")}</h2>
                <div className="space-y-4 mt-5">
                  <div>
                    <Label htmlFor="product-name">{t("Product Name")}</Label>
                    <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="product-description">{t("Description")}</Label>
                    <Textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[110px]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="product-price">{t("Price")}</Label>
                      <Input id="product-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="product-stock">{t("Stock")}</Label>
                      <Input id="product-stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="product-unit">{t("Unit")}</Label>
                      <Input id="product-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="product-min-order">{t("Minimum Order")}</Label>
                      <Input id="product-min-order" type="number" min="1" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="product-image">{t("Image URL")}</Label>
                    <Input
                      id="product-image"
                      value={imageUrl}
                      onChange={(e) => {
                        const next = e.target.value;
                        setImageUrl(next);
                        setImageUrls((prev) => {
                          if (prev.length === 0) return next ? [next] : [];
                          const updated = [...prev];
                          updated[0] = next;
                          return updated.filter((url) => !!url.trim());
                        });
                      }}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    className="w-full rounded-full gradient-primary text-primary-foreground"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t("Save Changes")}
                  </Button>
                </div>
              </div>
            </aside>
          ) : (
            <aside className="space-y-4">
              <div className="glass-card-elevated rounded-3xl p-6">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-xl font-bold">{t("Supplier Snapshot")}</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  {product.supplier?.business_name ?? t("This supplier")} {t("offers this product with wholesale-friendly minimums and live stock visibility.")}
                </p>
                <div className="space-y-3 mt-5">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Business")}</p>
                    <p className="font-semibold mt-2">{product.supplier?.business_name ?? t("Wellness Supplier")}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Contact")}</p>
                    <p className="font-semibold mt-2">{product.supplier?.email ?? t("Available after sign in")}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Why it matters")}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {t("Subscribe to this supplier to surface their fresh listings in your new-arrivals feed.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card-elevated rounded-3xl p-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="font-heading text-xl font-bold">{t("Buyer Checklist")}</h2>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li>{t("Review the description and minimum order before adding this listing to your cart.")}</li>
                  <li>{t("Save it to favorites if you want to compare it with similar products later.")}</li>
                  <li>{t("Subscribe to this supplier to keep their newest posts in your buyer dashboard feed.")}</li>
                </ul>
              </div>
            </aside>
          )}
        </div>

        {isSupplierOwner ? (
          <section className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-2xl font-bold">{t("Orders for This Product")}</h2>
            </div>

            {productOrders.length === 0 ? (
              <div className="glass-card rounded-3xl p-8 text-muted-foreground">
                {t("No orders have been placed for this product yet.")}
              </div>
            ) : (
              <div className="grid gap-3">
                {productOrders.map((order) => {
                  const orderItem = order.order_items.find((item) => item.product_id === product.id);
                  return (
                    <div key={order.id} className="glass-card-elevated rounded-3xl p-5">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-bold text-sm">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(order.created_at).toLocaleDateString()} · {order.payment_method === "cod" ? t("Cash on Delivery") : t("Online Payment")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold capitalize">{order.status}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t("Qty")} {orderItem?.quantity ?? 0}
                          </p>
                        </div>
                      </div>
                      {order.delivery_address && (
                        <p className="text-sm text-muted-foreground mt-3">
                          {t("Delivery")} {order.delivery_address}, {order.delivery_city} · {order.delivery_phone}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="mt-10">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <span className="text-[10px] font-bold text-accent tracking-widest uppercase">{t("Similar Products")}</span>
                <h2 className="font-heading text-2xl font-bold mt-1">{t("You may also want to compare")}</h2>
              </div>
            </div>

            <ProductGrid
              products={relatedProducts.map(toProductCardModel)}
              title={t("Similar Products")}
              pageSize={3}
              role="buyer"
              emptyTitle={t("No similar products yet")}
              emptyDescription={t("We will show alternatives from the same category here as more products arrive.")}
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;
