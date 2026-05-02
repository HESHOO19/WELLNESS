import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import Checkout from "./pages/Checkout";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import SupplierDashboard from "./pages/SupplierDashboard";
import BuyerOrders from "./pages/BuyerOrders";
import ProductDetail from "./pages/ProductDetail";
import SupplierDirectory from "./pages/SupplierDirectory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/products/:productId" element={<ProductDetail />} />
                <Route path="/suppliers" element={<SupplierDirectory />} />
                <Route path="/supplier" element={<SupplierDashboard />} />
                <Route path="/orders" element={<BuyerOrders />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
