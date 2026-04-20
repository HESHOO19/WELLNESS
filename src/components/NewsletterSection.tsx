import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: "Subscribed!", description: "You'll receive our weekly wellness updates." });
    setEmail("");
  };

  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 mt-14">
      <div className="gradient-primary p-8 md:p-10 rounded-3xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary-foreground/10 rounded-full blur-2xl" />

        <div className="relative z-10">
          <h2 className="font-heading text-xl md:text-2xl font-bold text-primary-foreground mb-2">
            Stay Informed
          </h2>
          <p className="text-primary-foreground/80 text-sm mb-6 max-w-md">
            Weekly pharmaceutical insights, new product alerts, and exclusive B2B pricing for registered pharmacies.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
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
              size="icon"
              className="rounded-full bg-card text-primary hover:bg-card/90 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
