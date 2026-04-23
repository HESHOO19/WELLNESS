import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewsletterSection from "@/components/NewsletterSection";

type AccountType = "buyer" | "supplier" | null;

const mutateAsync = vi.fn();
const toast = vi.fn();

let authState: { user: { id: string; email: string } | null; accountType: AccountType } = {
  user: null,
  accountType: null,
};

let subscriptions: Array<{ supplier_id: string }> = [];

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/use-marketplace", () => ({
  useNewsletterSubscription: () => ({
    mutateAsync,
    isPending: false,
  }),
  useSupplierSubscriptions: () => ({
    data: subscriptions,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

describe("NewsletterSection", () => {
  beforeEach(() => {
    authState = { user: null, accountType: null };
    subscriptions = [];
    mutateAsync.mockReset();
    toast.mockReset();
    mutateAsync.mockResolvedValue(undefined);
  });

  it("submits buyer-aware stay informed preferences", async () => {
    authState = {
      user: { id: "buyer-1", email: "buyer@wellness-demo.com" },
      accountType: "buyer",
    };
    subscriptions = [{ supplier_id: "supplier-1" }, { supplier_id: "supplier-2" }];

    render(<NewsletterSection />);

    expect(screen.getByText("Stay Informed")).toBeInTheDocument();
    expect(screen.getByDisplayValue("buyer@wellness-demo.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        email: "buyer@wellness-demo.com",
        userId: "buyer-1",
        source: "stay-informed",
        preferences: {
          account_type: "buyer",
          supplier_subscriptions: 2,
        },
      });
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "You are subscribed",
      }),
    );
  });

  it("renders supplier-specific copy", () => {
    authState = {
      user: { id: "supplier-1", email: "supplier@wellness-demo.com" },
      accountType: "supplier",
    };

    render(<NewsletterSection />);

    expect(screen.getByText("Stay Informed on Supplier Demand")).toBeInTheDocument();
    expect(
      screen.getByText(/Receive product-performance prompts, inventory reminders, and operational updates/i),
    ).toBeInTheDocument();
  });
});
