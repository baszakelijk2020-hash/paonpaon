"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { updateCartLine } from "./actions";

interface CartItem {
  line: {
    id: string;
    productVariantId: string;
    quantity: number;
    unitPriceAmountMinorUnits: number;
    unitPriceCurrency: string;
  };
  variant: {
    id: string;
    sku: string;
    size?: string;
    color?: string;
    productId: string;
  };
  product: {
    id: string;
    name: string;
    slug: string;
    primaryImageUrl?: string;
  };
}

interface CartClientProps {
  slug: string;
  order: {
    id: string;
    retailerId: string;
    customerId: string;
  };
  items: CartItem[];
}

export function CartClient({ slug, items }: CartClientProps) {
  const router = useRouter();
  const [localItems, setLocalItems] = useState<CartItem[]>(items);
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null);

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const handleQuantityChange = async (lineId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    
    setUpdatingLineId(lineId);
    
    const formData = new FormData();
    formData.append("lineId", lineId);
    formData.append("quantity", newQuantity.toString());
    
    const result = await updateCartLine(slug, {}, formData);
    
    if (result.formError) {
      console.error("Cart update failed:", result.formError);
      // Revert to original quantity on error
      router.refresh();
    } else {
      // Update local state optimistically
      setLocalItems(prev =>
        prev.map(item =>
          item.line.id === lineId
            ? { ...item, line: { ...item.line, quantity: newQuantity } }
            : item
        )
      );
    }
    
    setUpdatingLineId(null);
  };

  const subtotal = localItems.reduce((sum, item) => {
    return sum + (item.line.unitPriceAmountMinorUnits * item.line.quantity);
  }, 0);

  const shipping = subtotal > 10000 ? 0 : 500; // Free shipping over $100
  const total = subtotal + shipping;

  return (
    <div className="space-y-6">
      {/* Cart Items */}
      <div className="space-y-4">
        {localItems.map((item) => (
          <Card key={item.line.id} className="p-4">
            <div className="flex gap-4">
              {/* Product Image Placeholder */}
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" />
              
              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {item.product.name}
                </h3>
                <p className="text-sm text-gray-500 truncate">
                  {item.variant.sku}
                  {item.variant.size && ` • Size: ${item.variant.size}`}
                  {item.variant.color && ` • Color: ${item.variant.color}`}
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {formatPrice(item.line.unitPriceAmountMinorUnits, item.line.unitPriceCurrency)}
                </p>
              </div>
              
              {/* Quantity Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(item.line.id, item.line.quantity - 1)}
                  disabled={updatingLineId === item.line.id}
                >
                  -
                </Button>
                <span className="w-8 text-center font-medium">
                  {item.line.quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(item.line.id, item.line.quantity + 1)}
                  disabled={updatingLineId === item.line.id}
                >
                  +
                </Button>
              </div>
              
              {/* Line Total */}
              <div className="text-right">
                <p className="font-medium">
                  {formatPrice(item.line.unitPriceAmountMinorUnits * item.line.quantity, item.line.unitPriceCurrency)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Order Summary */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal, "USD")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : formatPrice(shipping, "USD")}</span>
          </div>
          {shipping === 0 && (
            <p className="text-xs text-green-600">
              Free shipping on orders over $100
            </p>
          )}
        </div>
        
        <div className="border-t pt-4">
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(total, "USD")}</span>
          </div>
        </div>
        
        <div className="mt-6">
          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push(`/r/${slug}/cart/checkout`)}
            disabled={localItems.length === 0}
          >
            Proceed to Checkout
          </Button>
        </div>
      </Card>
    </div>
  );
}
