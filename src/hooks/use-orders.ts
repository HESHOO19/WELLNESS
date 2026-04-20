import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/types";

interface PlaceOrderParams {
  items: CartItem[];
  paymentMethod: "online" | "cod";
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPhone: string;
  notes?: string;
}

export const placeOrder = async (params: PlaceOrderParams) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to place an order");

  const { data: order, error } = await supabase.rpc("place_order", {
    items: params.items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    })),
    payment_method: params.paymentMethod,
    delivery_address: params.deliveryAddress,
    delivery_city: params.deliveryCity,
    delivery_phone: params.deliveryPhone,
    notes: params.notes || null,
  });

  if (error) {
    const message = error.message ?? "Order failed";
    const normalized = message.toLowerCase();
    if (normalized.includes("insufficient stock")) {
      throw new Error("Some items are out of stock for the requested quantity.");
    }
    if (normalized.includes("minimum order quantity")) {
      throw new Error("Minimum order quantity not met for one or more items.");
    }
    if (normalized.includes("invalid quantity")) {
      throw new Error("Please enter valid quantities for all items.");
    }
    if (normalized.includes("invalid or inactive")) {
      throw new Error("Some items are no longer available.");
    }
    if (normalized.includes("not authenticated")) {
      throw new Error("Please sign in to place an order.");
    }
    throw new Error(message);
  }

  return order;
};
