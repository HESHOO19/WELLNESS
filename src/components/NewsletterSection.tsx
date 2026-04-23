import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  useNewsletterSubscription,
  useSupplierSubscriptions,
} from "@/hooks/use-marketplace";

const NewsletterSection = () => {
  const { user, accountType } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email ?? "");
  const newsletterMutation = useNewsletterSubscription();
  const { data: subscriptions = [] } = useSupplierSubscriptions(
    user?.id,
    !!user && accountType === "buyer",
  );

  const title =
    accountType === "supplier" ? "Stay Informed on Supplier Demand" : "Stay Informed";
  const description =
    accountType === "supplier"
      ? "Receive product-performance prompts, inventory reminders, and operational updates tailored to your supplier workflow."
      : "Get new product alerts, supplier updates, and curated B2B wellness insights that match your marketplace activity.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await newsletterMutation.mutateAsync({
        email,
        userId: user?.id ?? null,
        source: "stay-informed",
        preferences: {
          account_type: accountType ?? "guest",
          supplier_subscriptions: subscriptions.length,
        },
      });

      toast({
        title: "You are subscribed",
        description:
          accountType === "supplier"
            ? "We will send supplier-focused updates to your inbox."
            : "We will keep you posted with relevant supplier and product updates.",
      });
      if (!user) setEmail("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to subscribe right now.";
      toast({ title: "Subscription failed", description: message, variant: "destructive" });
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 mt-14">
      <div className="gradient-primary p-8 md:p-10 rounded-3xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary-foreground/10 rounded-full blur-2xl" />

        <div className="relative z-10">
          <h2 className="font-heading text-xl md:text-2xl font-bold text-primary-foreground mb-2">
            {title}
          </h2>
          <p className="text-primary-foreground/80 text-sm mb-6 max-w-2xl">
            {description}
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2 max-w-lg">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="rounded-full bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/60 focus-visible:ring-primary-foreground/50"
              required
            />
            <Button
              type="submit"
              disabled={newsletterMutation.isPending}
              className="rounded-full bg-card text-primary hover:bg-card/90 shrink-0"
            >
              <Send className="h-4 w-4 mr-2" />
              {newsletterMutation.isPending ? "Saving..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
