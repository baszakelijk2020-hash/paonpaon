/**
 * Customer segmentation and rankings (ADV-106 / PHASE 17.6).
 *
 * Every ranking and segment is a plain, published formula over real
 * order data — no new customer ledger, per this item's own non-goal,
 * and no black-box score. `categoryCounts` is omitted entirely (never
 * zero-filled) when no real product-metadata garment-type data exists
 * for a customer's orders, so `suit_focused`/`casual_focused` are only
 * ever claimed with something real behind them.
 */

export const CUSTOMER_BUYER_SEGMENTS = [
  "one_time",
  "repeat",
  "seasonal",
  "dormant",
  "suit_focused",
  "casual_focused",
] as const;
export type CustomerBuyerSegment = (typeof CUSTOMER_BUYER_SEGMENTS)[number];

export interface CustomerOrderSummary {
  readonly customerId: string;
  readonly customerName: string;
  readonly totalSpendMinorUnits: number;
  readonly currency: string;
  readonly orderCount: number;
  /** One entry per order, 1–12. */
  readonly orderMonths: readonly number[];
  readonly mostRecentOrderAt?: string;
  /** Garment-type concept slug -> order-line count. */
  readonly categoryCounts?: Readonly<Record<string, number>>;
}

export interface CustomerRanking extends CustomerOrderSummary {
  readonly rank: number;
  readonly segments: readonly CustomerBuyerSegment[];
}

const DORMANT_THRESHOLD_DAYS = 180;
const SUIT_GARMENT_TYPE_SLUGS = new Set([
  "suit",
  "jacket",
  "trousers",
  "waistcoat",
  "formalwear",
  "overcoat",
  "coat",
]);
const CASUAL_GARMENT_TYPE_SLUGS = new Set([
  "denim",
  "knitwear",
  "casual-shirt",
  "polo",
]);
const FOCUS_THRESHOLD = 0.5;

/**
 * A customer's own segments, each independently true or false — a
 * customer can be both `repeat` and `dormant` (used to buy often, hasn't
 * lately), which is real information a single exclusive label would
 * hide.
 */
export function classifyBuyerSegments(args: {
  readonly summary: CustomerOrderSummary;
  readonly asOf: Date;
}): readonly CustomerBuyerSegment[] {
  const { summary } = args;
  const segments: CustomerBuyerSegment[] = [];

  if (summary.orderCount === 1) segments.push("one_time");
  if (summary.orderCount >= 2) segments.push("repeat");

  const distinctMonths = new Set(summary.orderMonths);
  if (summary.orderCount >= 2 && distinctMonths.size <= 2) {
    segments.push("seasonal");
  }

  if (summary.mostRecentOrderAt) {
    const daysSinceLastOrder =
      (args.asOf.getTime() - Date.parse(summary.mostRecentOrderAt)) /
      (1000 * 60 * 60 * 24);
    if (daysSinceLastOrder > DORMANT_THRESHOLD_DAYS) {
      segments.push("dormant");
    }
  }

  if (summary.categoryCounts) {
    const totalLines = Object.values(summary.categoryCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (totalLines > 0) {
      const suitLines = Object.entries(summary.categoryCounts)
        .filter(([slug]) => SUIT_GARMENT_TYPE_SLUGS.has(slug))
        .reduce((sum, [, count]) => sum + count, 0);
      const casualLines = Object.entries(summary.categoryCounts)
        .filter(([slug]) => CASUAL_GARMENT_TYPE_SLUGS.has(slug))
        .reduce((sum, [, count]) => sum + count, 0);
      if (suitLines / totalLines >= FOCUS_THRESHOLD) {
        segments.push("suit_focused");
      }
      if (casualLines / totalLines >= FOCUS_THRESHOLD) {
        segments.push("casual_focused");
      }
    }
  }

  return segments;
}

/** Best-customer ranking: a plain sort by real total spend. Rank 1 is
 * the highest spender — never a weighted/hidden loyalty score. */
export function rankCustomersBySpend(
  summaries: readonly CustomerOrderSummary[],
  asOf: Date,
): readonly CustomerRanking[] {
  return [...summaries]
    .sort((a, b) => b.totalSpendMinorUnits - a.totalSpendMinorUnits)
    .map((summary, index) => ({
      ...summary,
      rank: index + 1,
      segments: classifyBuyerSegments({ summary, asOf }),
    }));
}
