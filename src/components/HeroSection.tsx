import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

interface HeroSectionProps {
  onShopNow: () => void;
}

const HeroSection = ({ onShopNow }: HeroSectionProps) => {
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
          <span className="text-[11px] font-bold tracking-wider text-primary uppercase">Trusted B2B Platform</span>
        </div>

        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-4">
          Egypt's 1st B2B Online<br />
          <span className="text-gradient">Pharmaceutical Platform</span>
        </h1>

        <p className="text-muted-foreground max-w-lg leading-relaxed text-sm md:text-base mb-8">
          Wholesale pharmaceutical solutions with competitive pricing, verified products, 
          and seamless ordering for pharmacies across Egypt.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button variant="hero" size="lg" onClick={onShopNow}>
            Browse Catalog
          </Button>
          <Button variant="hero-outline" size="lg">
            View Deals
          </Button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-6 mt-10 text-muted-foreground text-xs font-medium">
          {[
            { icon: "🔒", label: "Secure Payments" },
            { icon: "📦", label: "Fast Delivery" },
            { icon: "✅", label: "Verified Products" },
            { icon: "💼", label: "B2B Pricing" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1.5">
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
