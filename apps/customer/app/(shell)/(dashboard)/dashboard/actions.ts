"use server";

import {
  AIGenerationRepository,
  AnalyticsRepository,
  ProductRepository,
  RetailerRepository,
} from "@paon/database";
import { asId } from "@paon/domain";

import { getAIProvider } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getWeather } from "@/lib/weather";

export interface TodaysPickState {
  result?: {
    productId: string;
    productName: string;
    productSlug: string;
    productImageUrl?: string;
    rationale: string;
    weather?: { temperatureCelsius: number; description: string; city: string };
  };
  formError?: string;
}

const MAX_CANDIDATES = 8;

/**
 * "Today's Pick" (ADR-035, MorningRoutine-inspired) — one curated
 * recommendation from the retailer's currently active catalog, picked
 * against the customer's own recent behavioral events. User-initiated
 * (a button, like the retailer's "Suggest next action") rather than an
 * automatic daily push — no scheduler/cron credential exists for that,
 * and a fabricated "sent every morning" claim would violate the
 * project's non-faking convention.
 */
export async function generateTodaysPick(
  retailerId: string,
  customerId: string,
  retailerName: string,
  customerName: string,
  _prevState: TodaysPickState,
): Promise<TodaysPickState> {
  await requireSession();

  const provider = getAIProvider();
  if (!provider) {
    return {
      formError: "Personalised picks are not configured on this deployment.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  const cId = asId<"CustomerId">(customerId);

  const [recentEvents, products, retailer] = await Promise.all([
    new AnalyticsRepository(supabase).findRecentByCustomer(rId, cId, 20),
    new ProductRepository(supabase).findByRetailer(rId),
    new RetailerRepository(supabase).findById(rId),
  ]);
  const city = retailer?.billingAddress.city;
  const weather = city ? await getWeather(city) : null;
  const candidates = products
    .filter((product) => product.status === "active")
    .slice(0, MAX_CANDIDATES)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      description: product.description || product.name,
    }));

  if (candidates.length === 0) {
    return { formError: "Nothing available to recommend yet." };
  }

  const generationRepo = new AIGenerationRepository(supabase);
  const inputSummary = `customer=${cId} events=${recentEvents.length} candidates=${candidates.length}`;
  const start = Date.now();

  try {
    const recommendation = await provider.generateProductRecommendation({
      retailerName,
      customerName,
      recentEventNames: recentEvents.map((event) => event.name),
      candidates,
      ...(weather
        ? {
            weather: {
              temperatureCelsius: weather.temperatureCelsius,
              description: weather.description,
            },
          }
        : {}),
    });
    const picked = products.find((p) => p.id === recommendation.productId);
    if (!picked) throw new Error("Recommended product not found");

    await generationRepo.recordAsCustomer({
      retailerId: rId,
      status: "succeeded",
      model: provider.model,
      inputSummary,
      output: { productId: picked.id, rationale: recommendation.rationale },
      latencyMs: Date.now() - start,
    });

    return {
      result: {
        productId: picked.id,
        productName: picked.name,
        productSlug: picked.slug,
        ...(picked.primaryImageUrl
          ? { productImageUrl: picked.primaryImageUrl }
          : {}),
        rationale: recommendation.rationale,
        ...(weather && city
          ? {
              weather: {
                temperatureCelsius: weather.temperatureCelsius,
                description: weather.description,
                city,
              },
            }
          : {}),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await generationRepo.recordAsCustomer({
      retailerId: rId,
      status: "failed",
      model: provider.model,
      inputSummary,
      errorMessage: message,
      latencyMs: Date.now() - start,
    });
    return {
      formError: "Couldn't put together a pick right now — try again shortly.",
    };
  }
}
