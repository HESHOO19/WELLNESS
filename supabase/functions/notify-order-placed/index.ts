import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "no-reply@yourdomain.com";

const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error: ${response.status} ${body}`);
  }
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase credentials", { status: 500 });
  }

  if (!RESEND_API_KEY) {
    return new Response("Missing RESEND_API_KEY", { status: 500 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { orderId?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const orderId = payload.orderId;
  if (!orderId) {
    return new Response("Missing orderId", { status: 400 });
  }

  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("id, user_id, total, created_at, payment_method, delivery_city")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return new Response("Order not found", { status: 404 });
  }

  if (order.user_id !== authData.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: buyerProfile } = await adminClient
    .from("profiles")
    .select("email, business_name")
    .eq("id", order.user_id)
    .single();

  const { data: supplierOrders } = await adminClient
    .from("supplier_orders")
    .select("supplier_id, supplier_name")
    .eq("order_id", order.id);

  const supplierIds = Array.from(
    new Set((supplierOrders ?? []).map((supplierOrder) => supplierOrder.supplier_id)),
  );

  const { data: supplierProfiles } = await adminClient
    .from("profiles")
    .select("id, email, business_name")
    .in("id", supplierIds);

  const { data: orderItems } = await adminClient
    .from("order_items")
    .select("quantity, unit_price, products(name, supplier_id)")
    .eq("order_id", order.id);

  const itemsBySupplier = new Map<string, Array<{ name: string; quantity: number; unit_price: number }>>();
  (orderItems ?? []).forEach((item) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const supplierId = product?.supplier_id;
    if (!supplierId || !product?.name) return;
    const items = itemsBySupplier.get(supplierId) ?? [];
    items.push({
      name: product.name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
    });
    itemsBySupplier.set(supplierId, items);
  });

  const buyerEmail = buyerProfile?.email ?? authData.user.email ?? "";
  const buyerName = buyerProfile?.business_name ?? "Buyer";
  const orderShortId = order.id.slice(0, 8);
  const supplierNames = (supplierOrders ?? []).map((supplierOrder) => supplierOrder.supplier_name);

  if (buyerEmail) {
    const buyerHtml = `
      <h2>Order placed: #${orderShortId}</h2>
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p>Hi ${buyerName}, your order has been placed successfully.</p>
      <p><strong>Total:</strong> EGP ${Number(order.total).toLocaleString()}</p>
      <p><strong>Suppliers:</strong> ${supplierNames.join(", ") || "Pending"}</p>
      <p>Status: Pending confirmation from suppliers.</p>
    `;
    await sendEmail(buyerEmail, `Order placed #${orderShortId}`, buyerHtml);
  }

  const supplierEmails = new Map<string, string>();
  (supplierProfiles ?? []).forEach((profile) => {
    if (profile.email) supplierEmails.set(profile.id, profile.email);
  });

  for (const supplierOrder of supplierOrders ?? []) {
    const email = supplierEmails.get(supplierOrder.supplier_id);
    if (!email) continue;
    const items = itemsBySupplier.get(supplierOrder.supplier_id) ?? [];
    const lines = items
      .map((item) => `<li>${item.name} x ${item.quantity} (EGP ${item.unit_price.toLocaleString()})</li>`)
      .join("");

    const supplierHtml = `
      <h2>New order request: #${orderShortId}</h2>
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p>Buyer: ${buyerName}</p>
      <p><strong>Items:</strong></p>
      <ul>${lines || "<li>Items pending</li>"}</ul>
      <p>Please confirm the order in your dashboard.</p>
    `;
    await sendEmail(email, `New order request #${orderShortId}`, supplierHtml);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      sentToBuyer: !!buyerEmail,
      sentToSuppliers: supplierEmails.size,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
