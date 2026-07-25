import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { checkoutCart } from "@/app/r/[slug]/cart/actions";

interface CheckoutState {
  formError: string;
  isSubmitting: boolean;
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const [state, setState] = useState<CheckoutState>({
    formError: "",
    isSubmitting: false,
  });
  
  const { slug } = params as { slug: string };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState(prev => ({ ...prev, isSubmitting: true }));
    
    const formData = new FormData(event.currentTarget);
    
    try {
      const result = await checkoutCart(slug, {}, formData);
      
      if (result.formError) {
        setState(prev => ({ ...prev, formError: result.formError, isSubmitting: false }));
      }
      // If no formError, the server action will redirect
    } catch (error) {
      // Check if it's a redirect (which is expected on success)
      if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
        // This is a redirect, don't show error
        return;
      }
      setState(prev => ({ ...prev, formError: "Checkout failed", isSubmitting: false }));
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-col md:flex-row">
        {/* Checkout Form */}
        <div className="space-y-6 md:w-1/2">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Shipping Information</h2>
            
            {state.formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                {state.formError}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="text"
                  name="line1"
                  placeholder="Street address"
                  required
                />
              </div>
              
              <div>
                <Input
                  type="text"
                  name="line2"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>
              
              <div>
                <Input
                  type="text"
                  name="city"
                  placeholder="City"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    type="text"
                    name="region"
                    placeholder="State/Province"
                    required
                  />
                </div>
                
                <div>
                  <Input
                    type="text"
                    name="postalCode"
                    placeholder="Postal code"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Input
                  type="text"
                  name="countryCode"
                  placeholder="Country code (US, CA, etc.)"
                  required
                />
              </div>
              
              <div className="mt-6">
                <Button
                  type="submit"
                  size="lg"
                  disabled={state.isSubmitting}
                >
                  {state.isSubmitting ? "Processing..." : "Complete Checkout"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        
        {/* Order Summary */}
        <div className="w-1/2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>$0.00</span>
              </div>
              <div className="border-t pt-2 text-sm">
                <span>Total</span>
                <span>$0.00</span>
              </div>
            </div

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { checkoutCart } from "@/app/r/[slug]/cart/actions";

interface CheckoutState {
  formError: string;
  isSubmitting: boolean;
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const [state, setState] = useState<CheckoutState>({
    formError: "",
    isSubmitting: false,
  });
  
  const { slug } = params as { slug: string };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState(prev => ({ ...prev, isSubmitting: true }));
    
    const formData = new FormData(event.currentTarget);
    
    try {
      const result = await checkoutCart(slug, {}, formData);
      
      if (result.formError) {
        setState(prev => ({ ...prev, formError: result.formError, isSubmitting: false }));
      }
      // If no formError, the server action will redirect
    } catch (error) {
      // Check if it's a redirect (which is expected on success)
      if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
        // This is a redirect, don't show error
        return;
      }
      setState(prev => ({ ...prev, formError: "Checkout failed", isSubmitting: false }));
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-col md:flex-row">
        {/* Checkout Form */}
        <div className="space-y-6 md:w-1/2">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Shipping Information</h2>
            
            {state.formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                {state.formError}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="text"
                  name="line1"
                  placeholder="Street address"
                  required
                />
              </div>
              
              <div>
                <Input
                  type="text"
                  name="line2"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>
              
              <div>
                <Input
                  type="text"
                  name="city"
                  placeholder="City"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    type="text"
                    name="region"
                    placeholder="State/Province"
                    required
                  />
                </div>
                
                <div>
                  <Input
                    type="text"
                    name="postalCode"
                    placeholder="Postal code"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Input
                  type="text"
                  name="countryCode"
                  placeholder="Country code (US, CA, etc.)"
                  required
                />
              </div>
              
              <div className="mt-6">
                <Button
                  type="submit"
                  size="lg"
                  disabled={state.isSubmitting}
                >
                  {state.isSubmitting ? "Processing..." : "Complete Checkout"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        
        {/* Order Summary */}
        <div className="w-1/2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>$0.00</span>
              </div>
              <div className="border-t pt-2 text-sm">
                <span>Total</span>
                <span>$0.00</span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                Your order will be processed and you'll receive a confirmation email shortly.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}