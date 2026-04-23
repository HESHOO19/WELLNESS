import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import logo from "@/assets/wellness_logo.svg";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Bell, Search, ShoppingCart, User, X, LogOut, Store, ShoppingBag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onSearch?: (term: string) => void;
  onCartOpen?: () => void;
}

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type SupplierOrderRow = Database["public"]["Tables"]["supplier_orders"]["Row"];

type BuyerSupplierNotification = Pick<SupplierOrderRow, "id" | "status" | "supplier_name" | "created_at" | "order_id"> & {
  orders: Pick<OrderRow, "id" | "created_at" | "total"> | null;
};
type ProductNotification = Pick<ProductRow, "id" | "name" | "price" | "created_at">;
type SupplierOrderNotification = Pick<SupplierOrderRow, "id" | "status" | "created_at" | "order_id" | "supplier_name">;

const Header = ({ onSearch, onCartOpen }: HeaderProps) => {
  const { totalItems } = useCart();
  const { user, signOut, accountType } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const isBuyer = accountType === "buyer";
  const isSupplier = accountType === "supplier";
  const showNotifications = !!user && (isBuyer || isSupplier);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pendingConfirmations = [], isLoading: pendingConfirmationsLoading } = useQuery<BuyerSupplierNotification[]>({
    queryKey: ["notifications", "buyer-pending-confirmations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_orders")
        .select("id, status, supplier_name, created_at, order_id, orders!inner(id, created_at, total, user_id)")
        .eq("status", "pending")
        .eq("orders.user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as BuyerSupplierNotification[];
    },
    enabled: !!user && isBuyer,
  });

  const { data: confirmedSuppliers = [], isLoading: confirmedSuppliersLoading } = useQuery<BuyerSupplierNotification[]>({
    queryKey: ["notifications", "buyer-confirmed-suppliers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_orders")
        .select("id, status, supplier_name, created_at, order_id, orders!inner(id, created_at, total, user_id)")
        .in("status", ["confirmed", "shipped", "delivered"])
        .eq("orders.user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as BuyerSupplierNotification[];
    },
    enabled: !!user && isBuyer,
  });

  const { data: newProducts = [], isLoading: newProductsLoading } = useQuery<ProductNotification[]>({
    queryKey: ["notifications", "buyer-new-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, created_at")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as ProductNotification[];
    },
    enabled: isBuyer,
  });

  const { data: pendingOrders = [], isLoading: pendingLoading } = useQuery<SupplierOrderNotification[]>({
    queryKey: ["notifications", "supplier-pending-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_orders")
        .select("id, status, created_at, order_id, supplier_name")
        .eq("supplier_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as SupplierOrderNotification[];
    },
    enabled: !!user && isSupplier,
  });

  const notificationCount = isBuyer
    ? pendingConfirmations.length + confirmedSuppliers.length + newProducts.length
    : isSupplier
      ? pendingOrders.length
      : 0;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="WELLNESS" className="h-8" />
        </Link>

        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search medicines, vitamins..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 rounded-full bg-secondary border-0 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(!searchOpen)}>
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={onCartOpen} className="relative">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Button>

          {showNotifications && (
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
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">Pending Confirmations</div>
                    {pendingConfirmationsLoading ? (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">Loading pending confirmations...</div>
                    ) : pendingConfirmations.length ? (
                      pendingConfirmations.map((supplierOrder) => (
                        <DropdownMenuItem key={supplierOrder.id} onSelect={() => navigate("/orders")}> 
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">Order #{supplierOrder.order_id.slice(0, 8)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Waiting for {supplierOrder.supplier_name}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">No pending confirmations.</div>
                    )}

                    <DropdownMenuSeparator />
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">Confirmed Suppliers</div>
                    {confirmedSuppliersLoading ? (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">Loading confirmations...</div>
                    ) : confirmedSuppliers.length ? (
                      confirmedSuppliers.map((supplierOrder) => (
                        <DropdownMenuItem key={supplierOrder.id} onSelect={() => navigate("/orders")}> 
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">Order #{supplierOrder.order_id.slice(0, 8)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {supplierOrder.supplier_name} · {supplierOrder.status}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">No supplier confirmations yet.</div>
                    )}

                    <DropdownMenuItem onSelect={() => navigate("/orders")} className="text-xs text-primary">
                      Open buyer dashboard
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">New Products (last 7 days)</div>
                    {newProductsLoading ? (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">Loading new products...</div>
                    ) : newProducts.length ? (
                      newProducts.map((product) => (
                        <DropdownMenuItem key={product.id} onSelect={() => navigate("/shop")}> 
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">{product.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              EGP {Number(product.price).toLocaleString()} · {new Date(product.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">No new products this week.</div>
                    )}

                    <DropdownMenuItem onSelect={() => navigate("/shop")} className="text-xs text-primary">
                      Browse the catalog
                    </DropdownMenuItem>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="px-2 pt-1 text-[11px] font-semibold text-muted-foreground">New Order Requests</div>
                    {pendingLoading ? (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">Loading incoming orders...</div>
                    ) : pendingOrders.length ? (
                      pendingOrders.map((order) => {
                        return (
                          <DropdownMenuItem key={order.id} onSelect={() => navigate("/supplier")}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium">Order #{order.order_id.slice(0, 8)}</span>
                              <span className="text-[10px] text-muted-foreground">Waiting for your confirmation</span>
                            </div>
                          </DropdownMenuItem>
                        );
                      })
                    ) : (
                      <div className="px-2 pb-1 text-xs text-muted-foreground">No new order requests.</div>
                    )}

                    <DropdownMenuItem onSelect={() => navigate("/supplier")} className="text-xs text-primary">
                      Open supplier dashboard
                    </DropdownMenuItem>
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
                    {accountType === "supplier" ? <Store className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                    {accountType ?? "buyer"} account
                  </span>
                </DropdownMenuItem>
                {accountType === "supplier" ? (
                  <DropdownMenuItem onClick={() => navigate("/supplier")}>
                    <Store className="h-4 w-4 mr-2" /> Supplier Dashboard
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
                    <ShoppingBag className="h-4 w-4 mr-2" /> My Orders
                  </DropdownMenuItem>
                )}
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
              placeholder="Search medicines, vitamins..."
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
