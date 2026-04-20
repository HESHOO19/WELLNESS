import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import type { Database } from "@/integrations/supabase/types";

/**
 * Full end-to-end test for the Wellness app.
 *
 * Strategy: stub the Supabase client BEFORE any module that imports it is
 * evaluated. The stub returns:
 *  - no auth session (anonymous user)
 *  - a small set of products + categories from `from(...).select(...)`
 *
 * Then we render <App />, which boots the real router, providers, header,
 * hero, category grid, product grid, cart drawer and pages — and we drive
 * the UI through the same interactions a user would perform.
 */

// ---------- Fixtures ----------
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type ProductFixture = Pick<
  ProductRow,
  "id" | "name" | "description" | "price" | "stock" | "unit" | "min_order" | "image_url" | "is_active" | "created_at"
> & {
  category_id: string | null;
  categories: { slug: string; name: string };
};

type CategoryFixture = Pick<CategoryRow, "id" | "slug" | "name">;
type ProfileFixture = Pick<ProfileRow, "id">;

type FixtureRow = ProductFixture | CategoryFixture | ProfileFixture;

type QueryResult<T> = { data: T; error: null };
type QueryBuilder<T> = {
  select: () => QueryBuilder<T>;
  eq: () => QueryBuilder<T>;
  order: () => QueryBuilder<T>;
  single: () => Promise<QueryResult<T | null>>;
  then: <R>(resolve: (v: QueryResult<T[]>) => R, reject?: (e: unknown) => unknown) => Promise<R>;
};

const productsFixture: ProductFixture[] = [
  {
    id: "p-vit-d",
    name: "Vitamin D3 5000IU",
    description: "Immunity & bone health support.",
    price: 245,
    stock: 500,
    unit: "bottle",
    min_order: 2,
    category_id: "c1",
    image_url: "https://example.com/vit-d.jpg",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    categories: { slug: "vitamins", name: "Vitamins" },
  },
  {
    id: "p-protein",
    name: "Whey Protein Isolate",
    description: "Premium 25g protein per scoop.",
    price: 1450,
    stock: 150,
    unit: "tub",
    min_order: 1,
    category_id: "c2",
    image_url: "https://example.com/protein.jpg",
    is_active: true,
    created_at: "2026-01-02T00:00:00Z",
    categories: { slug: "fitness", name: "Fitness" },
  },
  {
    id: "p-paracetamol",
    name: "Paracetamol 500mg",
    description: "Fever & pain relief tablets.",
    price: 35,
    stock: 2000,
    unit: "pack",
    min_order: 5,
    category_id: "c3",
    image_url: "https://example.com/para.jpg",
    is_active: true,
    created_at: "2026-01-03T00:00:00Z",
    categories: { slug: "vitals", name: "Vitals" },
  },
];

const categoriesFixture: CategoryFixture[] = [
  { id: "c1", slug: "vitamins", name: "Vitamins" },
  { id: "c2", slug: "fitness", name: "Fitness" },
  { id: "c3", slug: "vitals", name: "Vitals" },
];

// ---------- Supabase mock ----------
// Builder that resolves to { data, error } — also thenable directly so
// `await supabase.from(...).select(...).eq(...)` works (no .order needed).
function makeQueryBuilder(table: string) {
  let rows: FixtureRow[] = [];
  if (table === "products") rows = [...productsFixture];
  if (table === "categories") rows = [...categoriesFixture];
  if (table === "profiles") rows = [] as ProfileFixture[];

  const result: QueryResult<FixtureRow[]> = { data: rows, error: null };

  const builder = {} as QueryBuilder<FixtureRow>;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null }));
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => {
  const authListeners: Array<(event: string, session: unknown) => void> = [];
  return {
    supabase: {
      from: vi.fn((table: string) => makeQueryBuilder(table)),
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
          authListeners.push(cb);
          return {
            data: { subscription: { unsubscribe: vi.fn() } },
          };
        }),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
        signInWithPassword: vi.fn(() =>
          Promise.resolve({ data: { user: null, session: null }, error: null })
        ),
        signUp: vi.fn(() =>
          Promise.resolve({ data: { user: null, session: null }, error: null })
        ),
        signInWithOAuth: vi.fn(() =>
          Promise.resolve({ data: { url: "https://oauth" }, error: null })
        ),
      },
    },
  };
});

// Avoid noisy "not implemented: scrollTo" + matchMedia is already in setup.ts
beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  // Reset the URL between tests so each starts at "/"
  window.history.pushState({}, "", "/");
});

// Import App AFTER the mock is registered.
import App from "@/App";

function getHeader(): HTMLElement {
  const header = document.querySelector("header");
  if (!header) throw new Error("Header not yet rendered");
  return header as HTMLElement;
}

describe("Wellness app — full end-to-end flow", () => {
  it("loads the home page with header, hero and product grid", async () => {
    render(<App />);

    // Header logo (scoped to header — the hero also has a WELLNESS image)
    await waitFor(() => {
      expect(within(getHeader()).getByAltText(/wellness/i)).toBeInTheDocument();
    });

    // Sign in CTA shown for anonymous user
    expect(within(getHeader()).getByRole("link", { name: /sign in/i })).toBeInTheDocument();

    // Products from the mocked Supabase load and render
    expect(await screen.findByText("Vitamin D3 5000IU")).toBeInTheDocument();
    expect(screen.getByText("Whey Protein Isolate")).toBeInTheDocument();
    expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
  });

  it("filters products via header search", async () => {
    render(<App />);

    await screen.findByText("Vitamin D3 5000IU");

    const searchInput = within(getHeader()).getByPlaceholderText(/search medicines/i);
    fireEvent.change(searchInput, { target: { value: "protein" } });

    await waitFor(() => {
      expect(screen.queryByText("Vitamin D3 5000IU")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Whey Protein Isolate")).toBeInTheDocument();

    // Clear search → all products return
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(await screen.findByText("Vitamin D3 5000IU")).toBeInTheDocument();
  });

  it("adds a product to cart, opens the drawer and updates quantity", async () => {
    render(<App />);

    // Wait for the protein card and add it.
    const proteinHeading = await screen.findByText("Whey Protein Isolate");
    const card = proteinHeading.closest("div.glass-card") as HTMLElement;
    expect(card).toBeTruthy();

    const addBtn = within(card).getByRole("button", { name: /add/i });
    fireEvent.click(addBtn);

    // Header cart badge should now show "1" (min_order = 1 for protein)
    await waitFor(() => {
      expect(within(getHeader()).getByText("1")).toBeInTheDocument();
    });

    // Open the cart drawer via the cart icon button (the one in the header)
    const cartButtons = within(getHeader()).getAllByRole("button");
    const cartBtn = cartButtons.find((b) => b.textContent?.includes("1"))!;
    fireEvent.click(cartBtn);

    // Drawer opens — title shows "Cart (1)"
    expect(await screen.findByText(/Cart \(1\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeInTheDocument();

    // Subtotal in the drawer = 1450 (scope to dialog)
    const dialogEarly = screen.getByRole("dialog");
    expect(within(dialogEarly).getAllByText(/EGP 1,450/).length).toBeGreaterThan(0);

    // Increment quantity → subtotal doubles
    const dialog = screen.getByRole("dialog");
    const plusButtons = within(dialog).getAllByRole("button").filter((b) =>
      b.querySelector("svg.lucide-plus")
    );
    fireEvent.click(plusButtons[0]);

    await waitFor(() => {
      expect(within(dialog).getByText(/EGP 2,900/)).toBeInTheDocument();
    });

    // Header badge updates to 2
    await waitFor(() => {
      expect(within(getHeader()).getByText("2")).toBeInTheDocument();
    });
  });

  it("navigates to /auth when clicking Sign in", async () => {
    render(<App />);

    const signIn = await within(getHeader()).findByRole("link", { name: /sign in/i });
    fireEvent.click(signIn);

    // Auth page renders email field
    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth");
    });
    expect(
      await screen.findByPlaceholderText(/you@business\.eg/i)
    ).toBeInTheDocument();
  });

  it("renders 404 page for unknown routes", async () => {
    window.history.pushState({}, "", "/this-route-does-not-exist");
    render(<App />);

    expect(await screen.findByText(/404/)).toBeInTheDocument();
  });
});
