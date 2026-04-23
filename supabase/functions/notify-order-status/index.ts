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

  let payload: { supplierOrderId?: string; status?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const supplierOrderId = payload.supplierOrderId;
  if (!supplierOrderId) {
    return new Response("Missing supplierOrderId", { status: 400 });
  }

  const { data: supplierOrder, error: supplierOrderError } = await adminClient
    .from("supplier_orders")
    .select("id, order_id, supplier_id, supplier_name, status")
    .eq("id", supplierOrderId)
    .single();

  if (supplierOrderError || !supplierOrder) {
    return new Response("Supplier order not found", { status: 404 });
  }

  if (supplierOrder.supplier_id !== authData.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: order } = await adminClient
    .from("orders")
    .select("id, user_id, total, created_at")
    .eq("id", supplierOrder.order_id)
    .single();

  if (!order) {
    return new Response("Order not found", { status: 404 });
  }

  const { data: buyerProfile } = await adminClient
    .from("profiles")
    .select("email, business_name")
    .eq("id", order.user_id)
    .single();

  const buyerEmail = buyerProfile?.email ?? "";
  const buyerName = buyerProfile?.business_name ?? "Buyer";
  const orderShortId = order.id.slice(0, 8);
  const statusLabel = payload.status ?? supplierOrder.status;

  const allowedStatuses = new Set(["confirmed", "shipped", "delivered"]);
  if (!allowedStatuses.has(statusLabel)) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (buyerEmail) {
    const buyerHtml = `
      <h2>Order update: #${orderShortId}</h2>
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p>Hi ${buyerName},</p>
      <p>${supplierOrder.supplier_name} updated your order to <strong>${statusLabel}</strong>.</p>
      <p><strong>Total:</strong> EGP ${Number(order.total).toLocaleString()}</p>
    `;
    await sendEmail(buyerEmail, `Order update #${orderShortId}`, buyerHtml);
  }

  return new Response(
    JSON.stringify({ ok: true, sentToBuyer: !!buyerEmail }),
    { headers: { "Content-Type": "application/json" } },
  );
});
