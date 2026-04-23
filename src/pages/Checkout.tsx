import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { placeOrder } from "@/hooks/use-orders";
import { CreditCard, Truck, ArrowLeft, ShoppingBag } from "lucide-react";

const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const { user, accountType } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Please sign in", description: "You need to be logged in to place an order.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (accountType === "supplier") {
      toast({
        title: "Supplier accounts cannot place buyer orders",
        description: "Switch to a buyer account to check out products.",
        variant: "destructive",
      });
      navigate("/supplier");
      return;
    }

    setLoading(true);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      const order = await placeOrder({
        items,
        paymentMethod,
        deliveryAddress: formData.get("address") as string,
        deliveryCity: formData.get("city") as string,
        deliveryPhone: formData.get("phone") as string,
        notes: (formData.get("notes") as string) || undefined,
      });

      toast({
        title: "Order placed successfully! 🎉",
        description: `Order #${order.id.slice(0, 8)} is pending supplier confirmation. We'll notify you as suppliers confirm.`,
      });
      clearCart();
      navigate("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Order failed.";
      toast({ title: "Order failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-20 w-20 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Add products before checking out.</p>
          <Button onClick={() => navigate("/shop")} variant="hero">Browse Catalog</Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="font-heading text-3xl font-extrabold mb-8">Checkout</h1>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-5 gap-8">
          <div className="md:col-span-3 space-y-6">
            <div className="glass-card-elevated rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg mb-4">Delivery Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="name">Business Name</Label>
                  <Input id="name" name="name" placeholder="Pharmacy name" required className="mt-1" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" type="tel" placeholder="+20 XXX XXX XXXX" required className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Delivery Address</Label>
                  <Input id="address" name="address" placeholder="Full address" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" placeholder="Cairo" required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="zip">Postal Code</Label>
                  <Input id="zip" name="zip" placeholder="11511" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Order Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="notes" name="notes" placeholder="Special delivery instructions..." className="mt-1" />
                </div>
              </div>
            </div>

            <div className="glass-card-elevated rounded-2xl p-6">
              <h2 className="font-heading font-bold text-lg mb-4">Payment Method</h2>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "online" | "cod")} className="space-y-3">
                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "online" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <RadioGroupItem value="online" id="online" />
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-bold text-sm">Pay Online</p>
                    <p className="text-muted-foreground text-xs">Secure card payment</p>
                    <p className="text-muted-foreground text-[11px]">Demo mode — no real charge yet</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <RadioGroupItem value="cod" id="cod" />
                  <Truck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-bold text-sm">Cash on Delivery</p>
                    <p className="text-muted-foreground text-xs">Pay when your order arrives</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="glass-card-elevated rounded-2xl p-6 sticky top-24">
              <h2 className="font-heading font-bold text-lg mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {items.map(item => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[60%]">{item.product.name} × {item.quantity}</span>
                    <span className="font-bold">EGP {(item.product.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>EGP {totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="text-success font-medium">Free</span>
                </div>
                <div className="flex justify-between text-lg font-extrabold font-heading pt-2 border-t border-border">
                  <span>Total</span>
                  <span>EGP {totalPrice.toLocaleString()}</span>
                </div>
              </div>
              <Button type="submit" className="w-full rounded-full gradient-primary text-primary-foreground font-bold mt-6" size="lg" disabled={loading}>
                {loading ? "Processing..." : paymentMethod === "cod" ? "Place Order" : "Pay Now"}
              </Button>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
