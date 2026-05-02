# Wellness — Supabase Integration Fixes

## Summary of bugs found and fixed

---

### Bug 1 — Missing `.env.local` (CRITICAL — root cause of all network errors)

**File:** `.env.local` (did not exist)

The `.env.example` had empty values. With no `.env.local`, Vite injected `undefined`
for both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, so every single
Supabase call silently failed with a network error pointing at `undefined/rest/v1/...`.

**Fix:** Created `.env.local` with the correct project URL and anon key.

```
VITE_SUPABASE_URL=https://jlcatgewhtasdzudopyx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

---

### Bug 2 — Supabase client had no env-var guard (CRITICAL)

**File:** `src/integrations/supabase/client.ts`

`createClient(undefined, undefined)` fails silently — the client initializes but
every request 404s or network-errors. There was no check to surface this.

**Fix:** Added a startup guard that throws a descriptive error immediately if either
variable is missing, pointing developers directly to `.env.example`.

---

### Bug 3 — RLS INSERT policy race condition for products (CRITICAL — root cause of "save product" bug)

**File:** `supabase/migrations/20260502120000_fix_product_rls_and_storage.sql`

The original INSERT policy was:
```sql
WITH CHECK (
  public.get_account_type(auth.uid()) = 'supplier'
  AND supplier_id = auth.uid()
)
```

`get_account_type()` reads from `profiles`. For Google OAuth users (and any user whose
profile insert/upsert is slightly delayed), `account_type` may be `buyer` or null at
the exact moment the product insert fires. This caused `permission denied` even for
real supplier accounts.

The `set_product_supplier_id` trigger already enforces `supplier_id = auth.uid()`
BEFORE INSERT, so the secondary check on `account_type` is redundant and harmful.

**Fix:** Simplified INSERT policy to only verify `supplier_id = auth.uid()`. The trigger
acts as the enforcement mechanism. Updated UPDATE and DELETE policies to match.

---

### Bug 4 — `product-images` storage bucket not created (causes image upload failures)

**File:** `supabase/migrations/20260502120000_fix_product_rls_and_storage.sql`

`ImageUpload.tsx` calls `supabase.storage.from("product-images").upload(...)` but
there was no migration creating this bucket. Uploads would fail with a 404 or
"bucket not found" error.

**Fix:** Added `INSERT INTO storage.buckets` with correct public access settings,
5MB limit, and image MIME type restrictions. Added storage RLS policies so users
can only upload/delete from their own `{user_id}/` subfolder, but anyone can read.

---

### Bug 5 — Error messages swallowed silently (makes debugging hard)

**Files:** `src/pages/SupplierDashboard.tsx`, `src/hooks/use-marketplace.ts`

Supabase errors have `message`, `details`, `hint`, and `code` fields. The original
`getErrorMessage()` only checked `message` and `error`, missing `details` and `hint`
which often contain the most useful information (e.g. the exact RLS policy that blocked).

**Fix:** Added `console.error("[Wellness] Supabase error:", error)` so the full
error object is always visible in the browser devtools, and extended `getErrorMessage`
to also surface `details` and `hint`.

---

## How to apply these fixes

### Step 1 — Copy `.env.local` to your project root
The file was generated as part of this fix set. It contains your real credentials.

### Step 2 — Run the new migration on your Supabase project

Option A — Supabase CLI (recommended):
```bash
supabase db push
```

Option B — Supabase Dashboard SQL editor:
Copy the contents of `supabase/migrations/20260502120000_fix_product_rls_and_storage.sql`
and run it in: Supabase Dashboard → SQL Editor → New query → Run.

### Step 3 — Replace modified source files
- `src/integrations/supabase/client.ts`
- `src/pages/SupplierDashboard.tsx`
- `src/hooks/use-marketplace.ts`

### Step 4 — Verify the storage bucket exists
Supabase Dashboard → Storage → You should see `product-images` listed as a public bucket.

---

## Testing checklist after applying fixes

- [ ] `npm run dev` starts without throwing "Missing Supabase environment variables"
- [ ] Can sign up / sign in as a supplier account
- [ ] Can add a new product from the Supplier Dashboard
- [ ] Can upload a product image (check Storage → product-images bucket)
- [ ] Product appears in the shop after saving
- [ ] Can edit an existing product
- [ ] Can delete a product
- [ ] Buyer can place an order
