import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Product } from "@/types";

export const getSupabaseErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof err.message === "string") parts.push(err.message);
    if (typeof err.details === "string") parts.push(err.details);
    if (typeof err.hint === "string") parts.push(err.hint);
    if (typeof err.code === "string") parts.push(`(${err.code})`);
    return parts.filter(Boolean).join(" — ") || "An unexpected Supabase error occurred.";
  }
  return "An unexpected Supabase error occurred.";
};

export const logSupabaseError = (error: unknown) => {
  console.error("[Wellness] Supabase error:", error);
};

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type FavoriteRow = Database["public"]["Tables"]["favorite_products"]["Row"];
type NewsletterRow = Database["public"]["Tables"]["newsletter_subscriptions"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SupplierSubscriptionRow = Database["public"]["Tables"]["supplier_subscriptions"]["Row"];

export type SupplierProfile = Pick<
  ProfileRow,
  "id" | "business_name" | "email" | "phone" | "created_at" | "account_type"
>;

export type ProductWithCategory = ProductRow & {
  categories: Pick<CategoryRow, "name" | "slug"> | null;
};

export type ProductWithSupplier = ProductWithCategory & {
  supplier: SupplierProfile | null;
};

export type OrderItemWithProduct = OrderItemRow & {
  products: Pick<ProductRow, "id" | "name" | "image_url"> | null;
};

export type SupplierOrderWithItems = OrderRow & {
  order_items: OrderItemWithProduct[];
};

const supplierFields = "id, business_name, email, phone, created_at, account_type";

const toSupplierMap = (suppliers: SupplierProfile[]) =>
  new Map(suppliers.map((supplier) => [supplier.id, supplier]));

export const toProductCardModel = (product: ProductWithSupplier | ProductWithCategory): Product => {
  const supplier = "supplier" in product ? product.supplier : null;
  const imageUrls = (product.image_urls ?? []).filter(Boolean);
  const primaryImage = imageUrls[0] ?? product.image_url ?? null;
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    price: Number(product.price),
    category: product.categories?.slug ?? "",
    category_name: product.categories?.name ?? null,
    image_url: primaryImage,
    image_urls: imageUrls.length ? imageUrls : primaryImage ? [primaryImage] : [],
    stock: product.stock,
    unit: product.unit,
    min_order: product.min_order,
    supplier_id: product.supplier_id,
    supplier_name:
      (supplier?.business_name?.trim() || supplier?.email || ("supplier_name" in product ? product.supplier_name : null)) as string | null,
    created_at: product.created_at,
  };
};

export const getProductMetrics = (orders: SupplierOrderWithItems[], productId: string) => {
  const relevantItems = orders.flatMap((order) =>
    order.order_items
      .filter((item) => item.product_id === productId)
      .map((item) => ({ item, order })),
  );

  const unitsSold = relevantItems.reduce((sum, entry) => sum + entry.item.quantity, 0);
  const revenue = relevantItems.reduce(
    (sum, entry) => sum + Number(entry.item.unit_price) * entry.item.quantity,
    0,
  );
  const orderCount = new Set(relevantItems.map((entry) => entry.order.id)).size;
  const latestOrderAt = relevantItems
    .map((entry) => entry.order.created_at)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    unitsSold,
    revenue,
    orderCount,
    latestOrderAt,
  };
};

export const useSupplierDirectory = (enabled = true) =>
  useQuery<SupplierProfile[]>({
    queryKey: ["supplier-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(supplierFields)
        .eq("account_type", "supplier")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupplierProfile[];
    },
    enabled,
  });

export const useProductById = (productId?: string) =>
  useQuery<ProductWithSupplier | null>({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("id", productId!)
        .eq("is_active", true)
        .single();
      // PGRST116 = row not found — treat as a normal "not found" state.
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      const product = data as ProductWithCategory | null;
      if (!product) return null;

      let supplier: SupplierProfile | null = null;
      if (product.supplier_id) {
        const { data: supplierData, error: supplierError } = await supabase
          .from("profiles")
          .select(supplierFields)
          .eq("id", product.supplier_id)
          .single();
        if (!supplierError || supplierError.code === "PGRST116") {
          supplier = (supplierData as SupplierProfile | null) ?? null;
        }
      }

      return { ...product, supplier };
    },
    enabled: !!productId,
  });

export const useRelatedProducts = (product?: ProductWithSupplier | null, limit = 3) =>
  useQuery<ProductWithSupplier[]>({
    queryKey: ["related-products", product?.id, product?.category_id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("is_active", true)
        .eq("category_id", product!.category_id)
        .neq("id", product!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = ((data ?? []) as ProductWithCategory[]).slice(0, limit);
      const supplierIds = Array.from(
        new Set(rows.map((row) => row.supplier_id).filter(Boolean)),
      ) as string[];

      if (!supplierIds.length) return rows.map((row) => ({ ...row, supplier: null }));

      const { data: supplierData, error: supplierError } = await supabase
        .from("profiles")
        .select(supplierFields)
        .in("id", supplierIds)
        .eq("account_type", "supplier");
      if (supplierError) {
        return rows.map((row) => ({ ...row, supplier: null }));
      }

      const supplierMap = toSupplierMap((supplierData ?? []) as SupplierProfile[]);
      return rows.map((row) => ({
        ...row,
        supplier: row.supplier_id ? supplierMap.get(row.supplier_id) ?? null : null,
      }));
    },
    enabled: !!product?.id && !!product.category_id,
  });

export const useSupplierProducts = (supplierId?: string, enabled = true) =>
  useQuery<ProductWithCategory[]>({
    queryKey: ["supplier-products", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductWithCategory[];
    },
    enabled: !!supplierId && enabled,
  });

export const useSupplierOrders = (supplierId?: string, enabled = true) =>
  useQuery<SupplierOrderWithItems[]>({
    queryKey: ["supplier-orders", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(id, name, image_url))")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierOrderWithItems[];
    },
    enabled: !!supplierId && enabled,
  });

export const useFavoriteProducts = (userId?: string, enabled = true) =>
  useQuery<FavoriteRow[]>({
    queryKey: ["favorite-products", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_products")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FavoriteRow[];
    },
    enabled: !!userId && enabled,
  });

export const useSupplierSubscriptions = (userId?: string, enabled = true) =>
  useQuery<SupplierSubscriptionRow[]>({
    queryKey: ["supplier-subscriptions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_subscriptions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierSubscriptionRow[];
    },
    enabled: !!userId && enabled,
  });

export const useSupplierDirectoryWithStats = (products: ProductWithCategory[], enabled = true) => {
  const supplierQuery = useSupplierDirectory(enabled);

  const suppliers = useMemo(() => {
    const grouped = products.reduce<Record<string, ProductWithCategory[]>>((acc, product) => {
      if (!product.supplier_id) return acc;
      acc[product.supplier_id] = [...(acc[product.supplier_id] ?? []), product];
      return acc;
    }, {});

    return (supplierQuery.data ?? []).map((supplier) => {
      const supplierProducts = grouped[supplier.id] ?? [];
      const newestProduct = supplierProducts
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
      const categoryCount = new Set(
        supplierProducts.map((product) => product.categories?.name).filter(Boolean),
      ).size;

      return {
        ...supplier,
        productCount: supplierProducts.length,
        newestProduct,
        categoryCount,
      };
    });
  }, [products, supplierQuery.data]);

  return {
    ...supplierQuery,
    data: suppliers,
  };
};

export const useFavoriteToggle = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { data: existing, error: existingError } = await supabase
        .from("favorite_products")
        .select("id")
        .eq("user_id", userId!)
        .eq("product_id", productId);
      if (existingError) throw existingError;

      if ((existing ?? []).length > 0) {
        const { error } = await supabase
          .from("favorite_products")
          .delete()
          .eq("id", existing[0].id);
        if (error) throw error;
        return { active: false };
      }

      const { error } = await supabase.from("favorite_products").insert({
        user_id: userId!,
        product_id: productId,
      });
      if (error) throw error;
      return { active: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-products", userId] });
    },
  });
};

export const useSupplierSubscriptionToggle = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplierId: string) => {
      const { data: existing, error: existingError } = await supabase
        .from("supplier_subscriptions")
        .select("id")
        .eq("user_id", userId!)
        .eq("supplier_id", supplierId);
      if (existingError) throw existingError;

      if ((existing ?? []).length > 0) {
        const { error } = await supabase
          .from("supplier_subscriptions")
          .delete()
          .eq("id", existing[0].id);
        if (error) throw error;
        return { active: false };
      }

      const { error } = await supabase.from("supplier_subscriptions").insert({
        user_id: userId!,
        supplier_id: supplierId,
      });
      if (error) throw error;
      return { active: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-subscriptions", userId] });
    },
  });
};

export const useNewsletterSubscription = () => {
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      userId?: string | null;
      source?: string;
      preferences?: NewsletterRow["preferences"];
    }) => {
      const { error } = await supabase.from("newsletter_subscriptions").upsert(
        {
          email: payload.email.trim().toLowerCase(),
          user_id: payload.userId ?? null,
          source: payload.source ?? "stay-informed",
          preferences: payload.preferences ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );
      if (error) throw error;
    },
  });
};
