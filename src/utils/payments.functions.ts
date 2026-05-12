import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    quantity?: number;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (typeof data.returnUrl !== "string" || !/^https?:\/\//.test(data.returnUrl)) {
      throw new Error("Invalid returnUrl");
    }
    if (data.quantity !== undefined && (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 100)) {
      throw new Error("Invalid quantity");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    // Always derive identity from the verified JWT — never trust client input.
    const userId = context.userId;
    const email = typeof context.claims.email === "string" ? context.claims.email : undefined;

    const stripe = createStripeClient(data.environment);

    const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: data.quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      metadata: { userId, managed_payments: "true" },
      ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      allow_promotion_codes: true,
      // Enable Stripe end-to-end compliance handling (tax + fraud + disputes + support)
      managed_payments: { enabled: true },
    } as Stripe.Checkout.SessionCreateParams & { managed_payments: { enabled: boolean } });

    return session.client_secret;
  });
