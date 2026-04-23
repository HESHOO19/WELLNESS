import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSupplierSubscriptions } from "@/hooks/use-marketplace";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/wellness_logo.svg";

interface HeaderProps {
  onSearch?: (term: string) => void;
  onCartOpen?: () => void;
}

type NotificationOrder = {
  id: string;
  status: string;
  supplier_name: string | null;
  created_at: string;
  total: number;
};

type NotificationProduct = {
  id: string;
  name: string;
  price: number;
  created_at: string;
};

const Header = ({ onSearch, onCartOpen }: HeaderProps) => {
  const { totalItems } = useCart();
  const { user, signOut, accountType } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const isBuyer = accountType === "buyer";
  const isSupplier = accountType === "supplier";
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: subscriptions = [] } = useSupplierSubscriptions(user?.id, !!user && isBuyer);
  const subscribedSupplierIds = subscriptions.map((subscription) => subscription.supplier_id);

  const { data: buyerPendingOrders = [] } = useQuery<NotificationOrder[]>({
    queryKey: ["header", "buyer-pending-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, supplier_name, created_at, total")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as NotificationOrder[];
    },
    enabled: !!user && isBuyer,
  });

  const { data: buyerActiveOrders = [] } = useQuery<NotificationOrder[]>({
    queryKey: ["header", "buyer-active-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, supplier_name, created_at, total")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "shipped", "delivered"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as NotificationOrder[];
    },
    enabled: !!user && isBuyer,
  });

  const { data: supplierPendingOrders = [] } = useQuery<NotificationOrder[]>({
    queryKey: ["header", "supplier-pending-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, supplier_name, created_at, total")
        .eq("supplier_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as NotificationOrder[];
    },
    enabled: !!user && isSupplier,
  });

  const { data: newArrivalNotifications = [] } = useQuery<NotificationProduct[]>({
    queryKey: ["header", "buyer-new-arrivals", subscribedSupplierIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, created_at")
        .in("supplier_id", subscribedSupplierIds)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as NotificationProduct[];
    },
    enabled: !!user && isBuyer && subscribedSupplierIds.length > 0,
  });

  const notificationCount = isBuyer
    ? buyerPendingOrders.length + buyerActiveOrders.length + newArrivalNotifications.length
    : isSupplier
      ? supplierPendingOrders.length
      : 0;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const dashboardHref = isSupplier ? "/supplier" : "/orders";
  const searchPlaceholder = isSupplier ? "Search your products..." : "Search medicines, vitamins...";

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="WELLNESS" className="h-8" />
        </Link>

        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 rounded-full bg-secondary border-0 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen((open) => !open)}>
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {user && (
            <Link to={dashboardHref} className="hidden sm:block">
              <Button variant="outline" size="sm" className="rounded-full">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          )}

          {!isSupplier && (
            <Button variant="ghost" size="icon" onClick={onCartOpen} className="relative">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Button>
          )}

          {user && (isBuyer || isSupplier) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {isBuyer ? (
                  <div className="space-y-2">
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">Pending Orders</div>
                    {buyerPendingOrders.length ? (
                      buyerPendingOrders.map((order) => (
                        <DropdownMenuItem key={order.id} onSelect={() => navigate("/orders")}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">Order #{order.id.slice(0, 8)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Waiting for {order.supplier_name ?? "supplier"}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">No pending orders.</div>
                    )}

                    <DropdownMenuSeparator />
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">Supplier Updates</div>
                    {buyerActiveOrders.length ? (
                      buyerActiveOrders.map((order) => (
                        <DropdownMenuItem key={order.id} onSelect={() => navigate("/orders")}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">Order #{order.id.slice(0, 8)}</span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {order.supplier_name ?? "Supplier"} · {order.status}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">No supplier updates yet.</div>
                    )}

                    <DropdownMenuSeparator />
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">New Arrivals</div>
                    {newArrivalNotifications.length ? (
                      newArrivalNotifications.map((product) => (
                        <DropdownMenuItem key={product.id} onSelect={() => navigate(`/products/${product.id}`)}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">{product.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              EGP {Number(product.price).toLocaleString()} · {new Date(product.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">
                        Subscribe to suppliers to see tailored new arrivals.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">New Order Requests</div>
                    {supplierPendingOrders.length ? (
                      supplierPendingOrders.map((order) => (
                        <DropdownMenuItem key={order.id} onSelect={() => navigate("/supplier?tab=orders")}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">Order #{order.id.slice(0, 8)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Review payment and fulfilment details
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">No new order requests.</div>
                    )}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-muted-foreground cursor-default">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs text-muted-foreground cursor-default capitalize">
                  <span className="flex items-center gap-1">
                    {isSupplier ? <Store className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                    {accountType ?? "buyer"} account
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {isSupplier ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/supplier")}>
                      <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/supplier?tab=products")}>
                      <Store className="h-4 w-4 mr-2" /> My Products
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/supplier?tab=orders")}>
                      <ShoppingBag className="h-4 w-4 mr-2" /> My Orders
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/orders")}>
                      <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/suppliers")}>
                      <Users className="h-4 w-4 mr-2" /> Suppliers
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/shop")}>
                      <ShoppingBag className="h-4 w-4 mr-2" /> Browse Products
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="rounded-full font-bold">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="md:hidden px-4 pb-3 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 rounded-full bg-secondary border-0"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
