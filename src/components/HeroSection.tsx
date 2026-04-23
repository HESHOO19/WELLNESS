import { useNavigate } from "react-router-dom";
import { LayoutDashboard, PackageSearch, ShoppingBag, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  const navigate = useNavigate();
  const { user, accountType } = useAuth();
  const isSupplier = accountType === "supplier";
  const isBuyer = accountType === "buyer";

  const title = isSupplier
    ? "Run Your Supplier Operation From One Screen"
    : "Egypt's 1st B2B Online Pharmaceutical Platform";
  const description = isSupplier
    ? "Track demand, inspect product performance, manage orders, and update your listings without leaving your workflow."
    : "Wholesale pharmaceutical solutions with competitive pricing, verified products, and seamless ordering for pharmacies across Egypt.";

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          alt="Pharmaceutical products"
          className="w-full h-full object-cover opacity-15"
          src={heroBg}
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-14 md:pt-16 md:pb-20">
        <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full mb-5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-primary uppercase">
            {isSupplier ? "Supplier Operations" : "Trusted B2B Platform"}
          </span>
        </div>

        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-4">
          {title}
        </h1>

        <p className="text-muted-foreground max-w-2xl leading-relaxed text-sm md:text-base mb-8">
          {description}
        </p>

        <div className="flex flex-wrap gap-3">
          {user && (
            <Button variant="hero" size="lg" onClick={() => navigate(isSupplier ? "/supplier" : "/orders")}>
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          )}

          {isSupplier ? (
            <>
              <Button variant="hero-outline" size="lg" onClick={() => navigate("/supplier?tab=products")}>
                <PackageSearch className="h-4 w-4 mr-2" />
                My Products
              </Button>
              <Button variant="hero-outline" size="lg" onClick={() => navigate("/supplier?tab=orders")}>
                <ShoppingBag className="h-4 w-4 mr-2" />
                My Orders
              </Button>
            </>
          ) : (
            <>
              <Button variant={user ? "hero-outline" : "hero"} size="lg" onClick={() => navigate("/shop")}>
                <Store className="h-4 w-4 mr-2" />
                Browse Catalog
              </Button>
              <Button variant="hero-outline" size="lg" onClick={() => navigate(isBuyer ? "/suppliers" : "/auth")}>
                <Users className="h-4 w-4 mr-2" />
                {isBuyer ? "Suppliers" : "Join Wellness"}
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-6 mt-10 text-muted-foreground text-xs font-medium">
          {[
            { icon: "Secure", label: "Protected ordering" },
            { icon: "Live", label: "Live stock visibility" },
            { icon: "Fast", label: "Supplier-first fulfilment" },
            { icon: "Insight", label: "Actionable demand signals" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-[10px] font-bold uppercase">
                {badge.icon}
              </span>
              <span>{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
