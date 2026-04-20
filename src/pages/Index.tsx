import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import NewsletterSection from "@/components/NewsletterSection";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

const Index = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const navigate = useNavigate();

  const handleCategoryClick = (catId: string) => {
    setActiveCategory(activeCategory === catId ? undefined : catId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearch={setSearchTerm} onCartOpen={() => setCartOpen(true)} />

      <main className="pb-8">
        <HeroSection onShopNow={() => navigate("/shop")} />
        <CategoryGrid onCategoryClick={handleCategoryClick} activeCategory={activeCategory} />
        <ProductGrid
          categoryFilter={activeCategory}
          searchFilter={searchTerm}
          pageSize={6}
        />
        <NewsletterSection />
      </main>

      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
};

export default Index;
