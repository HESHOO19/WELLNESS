import { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const { addToCart } = useCart();
  const { toast } = useToast();

  const handleAdd = () => {
    addToCart(product, product.min_order);
    toast({
      title: "Added to cart",
      description: `${product.name} × ${product.min_order} ${product.unit}s`,
    });
  };

  const categoryLabel = product.category
    ? product.category.charAt(0).toUpperCase() + product.category.slice(1)
    : "General";

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden hover:shadow-elevated transition-all duration-300 animate-fade-in group"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex gap-4 p-4">
        <div className="w-28 h-28 bg-secondary rounded-xl overflow-hidden flex-shrink-0">
          {product.image_url ? (
            <img
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              src={product.image_url}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">💊</div>
          )}
        </div>

        <div className="flex flex-col justify-between flex-grow py-0.5 min-w-0">
          <div>
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-heading font-bold text-sm leading-tight truncate">{product.name}</h3>
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                {categoryLabel}
              </span>
            </div>
            <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{product.description}</p>
          </div>

          <div className="flex items-end justify-between mt-2">
            <div>
              <span className="text-lg font-extrabold font-heading text-foreground">
                EGP {product.price.toLocaleString()}
              </span>
              <span className="text-muted-foreground text-[10px] block">
                Min. {product.min_order} {product.unit}s
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              className="rounded-full gradient-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Stock indicator */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1.5 text-[10px]">
          <Package className="h-3 w-3 text-success" />
          <span className="text-success font-medium">{product.stock} in stock</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
