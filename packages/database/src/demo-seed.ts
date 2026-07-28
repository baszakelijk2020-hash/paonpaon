/**
 * Idempotent demo data seed, shared by the CLI script
 * (`scripts/seed-demo.ts`, for a developer running it by hand) and
 * PAON Admin's "Demo mode" toggle (`apps/admin` Server Action, for the
 * founder populating the live deployment without a terminal). Safe to
 * re-run — everything is looked up by natural key (slug, email) before
 * creating.
 */
import type {
  CurrencyCode,
  CustomerId,
  OrderId,
  ProductId,
  RetailerBrandTheme,
  RetailerId,
  StaffId,
  UserId,
} from "@paon/domain";

import {
  AlterationRepository,
  AlterationTaskRepository,
  AlterationUpdateRepository,
  AlterationWorkflowRepository,
  AppointmentRepository,
  AvailabilityWindowRepository,
  ClientelingRepository,
  CollectionRepository,
  CustomerRepository,
  EventRepository,
  LoyaltyRepository,
  MessagingRepository,
  OrderRepository,
  PlatformStaffRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  RetailerStaffRepository,
  WeddingPartyRepository,
  WorkshopRepository,
  createSupabaseAdminClient,
  createSupabaseDirectClient,
} from "./index";

export interface DemoLogin {
  role: string;
  email: string;
  password: string;
}

export interface DemoPersonaLogin {
  app: "admin" | "retailer" | "customer";
  retailer?: string;
  persona: string;
  email: string;
}

export const DEMO_PASSWORD = "Demo-PAON-2026!";

interface RetailerSpec {
  slug: string;
  displayName: string;
  legalName: string;
  currency: CurrencyCode;
  products: {
    name: string;
    slug: string;
    sku: string;
    priceMinor: number;
    size?: string;
    /** Path under nebelspiegel.com/images/ — real product photography
     * from the founder's own reference design, not a placeholder. */
    imagePath: string;
    /** A distinct fabric/texture close-up — the founder's own real
     * img/detailImg pairing for this exact photo, looked up directly in
     * his source file, not derived by guessing a naming convention. */
    swatchImagePath: string;
  }[];
  collectionName: string;
  collectionSlug: string;
  customers: {
    name: string;
    email: string;
    portal: boolean;
    lifecycle: "prospect" | "first_purchase" | "returning" | "vip" | "lapsed";
  }[];
}

/**
 * Lived-in client-book stories for Maison Dubois. Catalog photography is
 * already strong; a prospect walkthrough fails when every client has the
 * same single order and only Isabelle has notes/appointments.
 */
type ClientHistoryStory = {
  productSlugs: string[];
  notes?: { body: string; pinned: boolean }[];
  appointments?: {
    marker: string;
    offsetHours: number;
    type:
      | "styling_consultation"
      | "fitting"
      | "alteration_fitting"
      | "personal_shopping";
    status: "requested" | "confirmed" | "completed" | "canceled" | "no_show";
    notes: string;
  }[];
};

const MAISON_CLIENT_HISTORIES: Record<string, ClientHistoryStory> = {
  "contact+isabelle@nebelspiegel.com": {
    productSlugs: [
      "midnight-blue-s130-natural-bi-stretch-wool-solaro-herringbone-6088",
      "traveller-midnight-navy-high-twist-wool-plain-weave-6085",
    ],
    notes: [
      {
        body: "Prefers a quiet fitting room and appointments after 16:00. Usually travels the following morning.",
        pinned: true,
      },
      {
        body: "Strong preference for soft-shouldered jackets, charcoal and midnight navy. Avoid high-contrast linings.",
        pinned: true,
      },
      {
        body: "Anniversary in October. Mention the private outerwear preview when confirming the next fitting.",
        pinned: false,
      },
    ],
    appointments: [
      {
        marker: "Demo: final fitting today",
        offsetHours: 2,
        type: "fitting",
        status: "confirmed",
        notes:
          "Demo: final fitting today — compare charcoal overcoat and confirm sleeve break.",
      },
      {
        marker: "Demo: wardrobe consultation tomorrow",
        offsetHours: 26,
        type: "styling_consultation",
        status: "requested",
        notes:
          "Demo: wardrobe consultation tomorrow — business travel capsule for Paris and Milan.",
      },
      {
        marker: "Demo: completed collection handover",
        offsetHours: -72,
        type: "personal_shopping",
        status: "completed",
        notes:
          "Demo: completed collection handover — client loved the softer shoulder and asked to retain the pattern.",
      },
    ],
  },
  "contact+marc@nebelspiegel.com": {
    productSlugs: [
      "rust-brown-s130-natural-bi-stretch-wool-solaro-herringbone-6071",
      "paon-broek-2-broek2",
    ],
    notes: [
      {
        body: "Buys for work travel — prefers high-twist cloths that pack without crease. Avoid linen for his board-week trips.",
        pinned: true,
      },
    ],
    appointments: [
      {
        marker: "Demo: Marc travel fitting",
        offsetHours: 50,
        type: "fitting",
        status: "confirmed",
        notes:
          "Demo: Marc travel fitting — confirm Traveller navy and rust Solaro trousers.",
      },
    ],
  },
  "contact+sophie@nebelspiegel.com": {
    productSlugs: ["beige-stretch-wool-blend-lightweight-twill-6065"],
    notes: [
      {
        body: "First commission after a referral from Isabelle. Soft beige twill for a May wedding in Bordeaux.",
        pinned: true,
      },
    ],
  },
  "contact+julien@nebelspiegel.com": {
    productSlugs: [
      "summertime-midnight-blue-wool-silk-linen-tropical-weave-6078",
      "jersely-midnight-blue-m-lange-stretch-wool-silk-linen-basketweave-9203",
      "knit-1-trui1",
    ],
    notes: [
      {
        body: "VIP — private-client evenings preferred. Strong on midnight blues; owns three soft-shoulder jackets already.",
        pinned: true,
      },
      {
        body: "Introduce the basketweave knit when the tropical weave suit is delivered.",
        pinned: false,
      },
    ],
    appointments: [
      {
        marker: "Demo: Julien VIP styling",
        offsetHours: -48,
        type: "styling_consultation",
        status: "completed",
        notes:
          "Demo: Julien VIP styling — selected midnight tropical weave and basketweave knit.",
      },
      {
        marker: "Demo: Julien delivery fitting",
        offsetHours: 74,
        type: "fitting",
        status: "requested",
        notes:
          "Demo: Julien delivery fitting — final check on tropical weave before Florence trip.",
      },
    ],
  },
  "contact+camille@nebelspiegel.com": {
    productSlugs: [
      "smoke-grey-m-lange-s130-merino-wool-twill-6089",
      "knit-2-trui2",
    ],
    notes: [
      {
        body: "Prefers muted greys and soft knits. Dislikes high-contrast windowpanes.",
        pinned: true,
      },
    ],
    appointments: [
      {
        marker: "Demo: Camille wardrobe review",
        offsetHours: 98,
        type: "personal_shopping",
        status: "confirmed",
        notes:
          "Demo: Camille wardrobe review — add a knit to the smoke-grey twill rotation.",
      },
    ],
  },
  "contact+antoine@nebelspiegel.com": {
    productSlugs: [
      "traveller-black-high-twist-wool-plain-weave-6087",
      "paon-broek-3-broek3",
    ],
    notes: [
      {
        body: "Returning client — black Traveller for evening events. Keep the shoulder soft; he dislikes structure.",
        pinned: true,
      },
    ],
  },
  "contact+nathalie@nebelspiegel.com": {
    productSlugs: [
      "summertime-light-grey-m-lange-wool-silk-linen-tropical-weave-6066",
    ],
    notes: [
      {
        body: "First purchase — light grey tropical for summer meetings. Offer a second cloth after delivery.",
        pinned: true,
      },
    ],
  },
  "contact+thomas@nebelspiegel.com": {
    productSlugs: ["paon-broek-1-broek1"],
    notes: [
      {
        body: "First trousers only. Upsell a matching jacket once fit is confirmed.",
        pinned: false,
      },
    ],
  },
  "contact+frederic@nebelspiegel.com": {
    productSlugs: ["jersely-ivory-stretch-wool-silk-linen-twill-6054"],
    notes: [
      {
        body: "Lapsed — last order over a year ago. Ivory Jersely for a christening; invite back for autumn outerwear.",
        pinned: true,
      },
    ],
  },
  "contact+veronique@nebelspiegel.com": {
    productSlugs: [
      "linen-way-denim-blue-m-lange-linen-wool-silk-sharkskin-6082",
    ],
    notes: [
      {
        body: "Lapsed — denim-blue linen blend. Follow up before spring trunk show.",
        pinned: false,
      },
    ],
  },
};

const RETAILERS: RetailerSpec[] = [
  {
    slug: "maison-dubois",
    displayName: "Maison Dubois",
    legalName: "Maison Dubois SARL",
    currency: "EUR",
    collectionName: "Signature Tailoring",
    collectionSlug: "signature-tailoring",
    products: [
      {
        name: "Powder Blue Cotton Trousers",
        slug: "paon-broek-1-broek1",
        sku: "MD-PANT-001",
        priceMinor: 90000,
        size: "50",
        imagePath: "broeken-webp/broek1.webp",
        swatchImagePath: "broeken-webp/broek1-1.webp",
      },
      {
        name: "Sage Side-Adjuster Trousers",
        slug: "paon-broek-2-broek2",
        sku: "MD-PANT-002",
        priceMinor: 90000,
        size: "50",
        imagePath: "broeken-webp/broek2.webp",
        swatchImagePath: "broeken-webp/broek2-2.webp",
      },
      {
        name: "Navy Cotton Twill Trousers",
        slug: "paon-broek-3-broek3",
        sku: "MD-PANT-003",
        priceMinor: 90000,
        size: "50",
        imagePath: "broeken-webp/broek3.webp",
        swatchImagePath: "broeken-webp/broek3-3.webp",
      },
      {
        name: "Cream Cotton Trousers",
        slug: "paon-broek-4-broek4",
        sku: "MD-PANT-004",
        priceMinor: 90000,
        size: "50",
        imagePath: "broeken-webp/broek4.webp",
        swatchImagePath: "broeken-webp/broek4-4.webp",
      },
      {
        name: "Chocolate Brown Side-Adjuster Trousers",
        slug: "paon-broek-5-broek5",
        sku: "MD-PANT-005",
        priceMinor: 90000,
        size: "50",
        imagePath: "broeken-webp/broek5.webp",
        swatchImagePath: "broeken-webp/broek5-5.webp",
      },
      {
        name: "Khaki Cotton Trousers",
        slug: "paon-broek-6-broek6",
        sku: "MD-PANT-006",
        priceMinor: 90000,
        size: "50",
        imagePath: "broeken-webp/broek6.webp",
        swatchImagePath: "broeken-webp/broek6-6.webp",
      },
      {
        name: "Beige Stretch Wool Blend Lightweight Twill",
        slug: "beige-stretch-wool-blend-lightweight-twill-6065",
        sku: "MD-SUIT-001",
        priceMinor: 99000,
        size: "50",
        imagePath: "smaller/6065.webp",
        swatchImagePath: "smaller/6065_1.webp",
      },
      {
        name: "Midnight Blue S130 Natural Bi-Stretch Wool Solaro Herringbone",
        slug: "midnight-blue-s130-natural-bi-stretch-wool-solaro-herringbone-6088",
        sku: "MD-SUIT-002",
        priceMinor: 104000,
        size: "50",
        imagePath: "smaller/6088.webp",
        swatchImagePath: "smaller/6088_1.webp",
      },
      {
        name: "Rust Brown S130 Natural Bi-Stretch Wool Solaro Herringbone",
        slug: "rust-brown-s130-natural-bi-stretch-wool-solaro-herringbone-6071",
        sku: "MD-SUIT-003",
        priceMinor: 104000,
        size: "50",
        imagePath: "smaller/6071.webp",
        swatchImagePath: "smaller/6071_1.webp",
      },
      {
        name: "Jersely Ivory Stretch Wool, Silk & Linen Twill",
        slug: "jersely-ivory-stretch-wool-silk-linen-twill-6054",
        sku: "MD-SUIT-004",
        priceMinor: 134000,
        size: "50",
        imagePath: "smaller/6054.webp",
        swatchImagePath: "smaller/6054_1.webp",
      },
      {
        name: "Summertime Midnight Blue Wool, Silk & Linen Tropical Weave",
        slug: "summertime-midnight-blue-wool-silk-linen-tropical-weave-6078",
        sku: "MD-SUIT-005",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6078.webp",
        swatchImagePath: "smaller/6078_1.webp",
      },
      {
        name: "Summertime Light Grey Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-light-grey-m-lange-wool-silk-linen-tropical-weave-6066",
        sku: "MD-SUIT-006",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6066.webp",
        swatchImagePath: "smaller/6066_1.webp",
      },
      {
        name: "Linen Way Denim Blue Mélange Linen, Wool & Silk Sharkskin",
        slug: "linen-way-denim-blue-m-lange-linen-wool-silk-sharkskin-6082",
        sku: "MD-SUIT-007",
        priceMinor: 124000,
        size: "50",
        imagePath: "smaller/6082.webp",
        swatchImagePath: "smaller/6082_1.webp",
      },
      {
        name: "Summertime Greige Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-greige-m-lange-wool-silk-linen-tropical-weave-6059",
        sku: "MD-SUIT-008",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6059.webp",
        swatchImagePath: "smaller/6059_1.webp",
      },
      {
        name: "Summertime Rust Pink Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-rust-pink-m-lange-wool-silk-linen-tropical-weave-6073",
        sku: "MD-SUIT-009",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6073.webp",
        swatchImagePath: "smaller/6073_1.webp",
      },
      {
        name: "Smoke Grey Mélange S130 Merino Wool Twill",
        slug: "smoke-grey-m-lange-s130-merino-wool-twill-6089",
        sku: "MD-SUIT-010",
        priceMinor: 99000,
        size: "50",
        imagePath: "smaller/6089.webp",
        swatchImagePath: "smaller/6089_1.webp",
      },
      {
        name: "Summertime Light Taupe Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-light-taupe-m-lange-wool-silk-linen-tropical-weave-6055",
        sku: "MD-SUIT-011",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6055.webp",
        swatchImagePath: "smaller/6055_1.webp",
      },
      {
        name: "Summertime Light Brown & Sand Wool, Silk & Linen Glencheck Tropical Weave",
        slug: "summertime-light-brown-sand-wool-silk-linen-glencheck-tropical-weave-6067",
        sku: "MD-SUIT-012",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6067.webp",
        swatchImagePath: "smaller/6067_1.webp",
      },
      {
        name: "Traveller Midnight Navy High-Twist Wool Plain Weave",
        slug: "traveller-midnight-navy-high-twist-wool-plain-weave-6085",
        sku: "MD-SUIT-013",
        priceMinor: 104000,
        size: "50",
        imagePath: "smaller/6085.webp",
        swatchImagePath: "smaller/6085_1.webp",
      },
      {
        name: "Summertime Taupe Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-taupe-m-lange-wool-silk-linen-tropical-weave-6060",
        sku: "MD-SUIT-014",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6060.webp",
        swatchImagePath: "smaller/6060_1.webp",
      },
      {
        name: "Summertime Ice Blue Wool, Silk & Linen Tropical Weave",
        slug: "summertime-ice-blue-wool-silk-linen-tropical-weave-6075",
        sku: "MD-SUIT-015",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6075.webp",
        swatchImagePath: "smaller/6075_1.webp",
      },
      {
        name: "Summertime Teal Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-teal-m-lange-wool-silk-linen-tropical-weave-6081",
        sku: "MD-SUIT-016",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6081.webp",
        swatchImagePath: "smaller/6081_1.webp",
      },
      {
        name: "Jersely Silver Grey Stretch Tropical Wool Plain Weave",
        slug: "jersely-silver-grey-stretch-tropical-wool-plain-weave-6063",
        sku: "MD-SUIT-017",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6063.webp",
        swatchImagePath: "smaller/6063_1.webp",
      },
      {
        name: "Traveller Black High-Twist Wool Plain Weave",
        slug: "traveller-black-high-twist-wool-plain-weave-6087",
        sku: "MD-SUIT-018",
        priceMinor: 104000,
        size: "50",
        imagePath: "smaller/6087.webp",
        swatchImagePath: "smaller/6087_1.webp",
      },
      {
        name: "Summertime Pearl Grey Wool, Silk & Linen Glencheck Tropical Weave",
        slug: "summertime-pearl-grey-wool-silk-linen-glencheck-tropical-weave-6057",
        sku: "MD-SUIT-019",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6057.webp",
        swatchImagePath: "smaller/6057_1.webp",
      },
      {
        name: "Summertime Brown Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-brown-m-lange-wool-silk-linen-tropical-weave-6070",
        sku: "MD-SUIT-020",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6070.webp",
        swatchImagePath: "smaller/6070_1.webp",
      },
      {
        name: "Summertime Light Sage Wool, Silk & Linen Tropical Weave",
        slug: "summertime-light-sage-wool-silk-linen-tropical-weave-6079",
        sku: "MD-SUIT-021",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6079.webp",
        swatchImagePath: "smaller/6079_1.webp",
      },
      {
        name: "Jersely Mocha Stretch Tropical Wool Plain Weave",
        slug: "jersely-mocha-stretch-tropical-wool-plain-weave-6061",
        sku: "MD-SUIT-022",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6061.webp",
        swatchImagePath: "smaller/6061_1.webp",
      },
      {
        name: "Summertime Sage Green Wool, Silk & Linen Tropical Weave",
        slug: "summertime-sage-green-wool-silk-linen-tropical-weave-6080",
        sku: "MD-SUIT-023",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6080.webp",
        swatchImagePath: "smaller/6080_1.webp",
      },
      {
        name: "Summertime Dusty Rose Wool, Silk & Linen Tropical Weave",
        slug: "summertime-dusty-rose-wool-silk-linen-tropical-weave-6074",
        sku: "MD-SUIT-024",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6074.webp",
        swatchImagePath: "smaller/6074_1.webp",
      },
      {
        name: "Summertime Light Grey Mélange Wool, Silk & Linen Tropical Weave",
        slug: "summertime-light-grey-m-lange-wool-silk-linen-tropical-weave-6062",
        sku: "MD-SUIT-025",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6062.webp",
        swatchImagePath: "smaller/6062_1.webp",
      },
      {
        name: "Traveller Dark Navy High-Twist Wool Plain Weave",
        slug: "traveller-dark-navy-high-twist-wool-plain-weave-6086",
        sku: "MD-SUIT-026",
        priceMinor: 104000,
        size: "50",
        imagePath: "smaller/6086.webp",
        swatchImagePath: "smaller/6086_1.webp",
      },
      {
        name: "Summertime Light Grey Wool, Silk & Linen Tropical Weave",
        slug: "summertime-light-grey-wool-silk-linen-tropical-weave-6058",
        sku: "MD-SUIT-027",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6058.webp",
        swatchImagePath: "smaller/6058_1.webp",
      },
      {
        name: "Summertime Pale Aqua Wool, Silk & Linen Tropical Weave",
        slug: "summertime-pale-aqua-wool-silk-linen-tropical-weave-6064",
        sku: "MD-SUIT-028",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6064.webp",
        swatchImagePath: "smaller/6064_1.webp",
      },
      {
        name: "Summertime Chocolate Brown Wool, Silk & Linen Tropical Weave",
        slug: "summertime-chocolate-brown-wool-silk-linen-tropical-weave-6069",
        sku: "MD-SUIT-029",
        priceMinor: 114000,
        size: "50",
        imagePath: "smaller/6069.webp",
        swatchImagePath: "smaller/6069_1.webp",
      },
      {
        name: "Off-White & Ecru Linen, Silk, Wool & Cotton Herringbone",
        slug: "off-white-ecru-linen-silk-wool-cotton-herringbone-9177",
        sku: "MD-JACKET-001",
        priceMinor: 104000,
        size: "50",
        imagePath: "smaller/9177.webp",
        swatchImagePath: "smaller/9177_1.webp",
      },
      {
        name: "Ivory & Ecru Wool, Silk & Linen Houndstooth",
        slug: "ivory-ecru-wool-silk-linen-houndstooth-9178",
        sku: "MD-JACKET-002",
        priceMinor: 79000,
        size: "50",
        imagePath: "smaller/9178.webp",
        swatchImagePath: "smaller/9178_1.webp",
      },
      {
        name: "Ivory & Cream Wool, Silk & Linen Glencheck",
        slug: "ivory-cream-wool-silk-linen-glencheck-9179",
        sku: "MD-JACKET-003",
        priceMinor: 79000,
        size: "50",
        imagePath: "smaller/9179.webp",
        swatchImagePath: "smaller/9179_1.webp",
      },
      {
        name: "Natural Beige Linen, Silk, Wool & Cotton Herringbone",
        slug: "natural-beige-linen-silk-wool-cotton-herringbone-9180",
        sku: "MD-JACKET-004",
        priceMinor: 104000,
        size: "50",
        imagePath: "smaller/9180.webp",
        swatchImagePath: "smaller/9180_1.webp",
      },
      {
        name: "Summertime Light Sage Wool, Silk & Linen Sharkskin",
        slug: "summertime-light-sage-wool-silk-linen-sharkskin-9181",
        sku: "MD-JACKET-005",
        priceMinor: 89000,
        size: "50",
        imagePath: "smaller/9181.webp",
        swatchImagePath: "smaller/9181_1.webp",
      },
      {
        name: "Teal Mélange Wool, Silk & Linen Twill",
        slug: "teal-m-lange-wool-silk-linen-twill-9182",
        sku: "MD-JACKET-006",
        priceMinor: 74000,
        size: "50",
        imagePath: "smaller/9182.webp",
        swatchImagePath: "smaller/9182_1.webp",
      },
      {
        name: "Cross Ply Light Green Mélange Stretch Linen, Wool & Silk Twill",
        slug: "cross-ply-light-green-m-lange-stretch-linen-wool-silk-twill-9183",
        sku: "MD-JACKET-007",
        priceMinor: 109000,
        size: "50",
        imagePath: "smaller/9183.webp",
        swatchImagePath: "smaller/9183_1.webp",
      },
      {
        name: "Summertime Taupe & Oatmeal Wool, Silk & Linen Sharkskin with Copper & Cobalt Glencheck",
        slug: "summertime-taupe-oatmeal-wool-silk-linen-sharkskin-with-copper-cobalt-glencheck-9184",
        sku: "MD-JACKET-008",
        priceMinor: 89000,
        size: "50",
        imagePath: "smaller/9184.webp",
        swatchImagePath: "smaller/9184_1.webp",
      },
      {
        name: "Dark Ginger Mélange Wool, Silk & Linen Twill",
        slug: "dark-ginger-m-lange-wool-silk-linen-twill-9185",
        sku: "MD-JACKET-009",
        priceMinor: 74000,
        size: "50",
        imagePath: "smaller/9185.webp",
        swatchImagePath: "smaller/9185_1.webp",
      },
      {
        name: "Ivory & Beige Pure Silk Houndstooth",
        slug: "ivory-beige-pure-silk-houndstooth-9187",
        sku: "MD-JACKET-010",
        priceMinor: 69000,
        size: "50",
        imagePath: "smaller/9187.webp",
        swatchImagePath: "smaller/9187_1.webp",
      },
      {
        name: "Softime Tan & Ivory Wool, Cotton, Silk & Linen Glencheck and Storm Grey Windowpane",
        slug: "softime-tan-ivory-wool-cotton-silk-linen-glencheck-and-storm-grey-windowpane-9188",
        sku: "MD-JACKET-011",
        priceMinor: 89000,
        size: "50",
        imagePath: "smaller/9188.webp",
        swatchImagePath: "smaller/9188_1.webp",
      },
      {
        name: "Dusty Red Mélange Wool, Silk & Linen Twill",
        slug: "dusty-red-m-lange-wool-silk-linen-twill-9189",
        sku: "MD-JACKET-012",
        priceMinor: 74000,
        size: "50",
        imagePath: "smaller/9189.webp",
        swatchImagePath: "smaller/9189_1.webp",
      },
      {
        name: "Burnt Orange Mélange Wool, Silk & Linen Twill",
        slug: "burnt-orange-m-lange-wool-silk-linen-twill-9190",
        sku: "MD-JACKET-013",
        priceMinor: 74000,
        size: "50",
        imagePath: "smaller/9190.webp",
        swatchImagePath: "smaller/9190_1.webp",
      },
      {
        name: "Softime Light Pink & Ivory Wool, Cotton, Silk & Linen Glencheck and Storm Grey Windowpane",
        slug: "softime-light-pink-ivory-wool-cotton-silk-linen-glencheck-and-storm-grey-windowpane-9191",
        sku: "MD-JACKET-014",
        priceMinor: 89000,
        size: "50",
        imagePath: "smaller/9191.webp",
        swatchImagePath: "smaller/9191_1.webp",
      },
      {
        name: "Teal Mélange Wool, Silk & Linen Twill",
        slug: "teal-m-lange-wool-silk-linen-twill-9193",
        sku: "MD-JACKET-015",
        priceMinor: 74000,
        size: "50",
        imagePath: "smaller/9193.webp",
        swatchImagePath: "smaller/9193_1.webp",
      },
      {
        name: "Softime Bottle Green & Off-White Wool, Cotton, Silk & Linen Glencheck and Green Windowpane",
        slug: "softime-bottle-green-off-white-wool-cotton-silk-linen-glencheck-and-green-windowpane-9194",
        sku: "MD-JACKET-016",
        priceMinor: 89000,
        size: "50",
        imagePath: "smaller/9194.webp",
        swatchImagePath: "smaller/9194_1.webp",
      },
      {
        name: "Mixed Green Wool, Silk & Linen Glencheck",
        slug: "mixed-green-wool-silk-linen-glencheck-9195",
        sku: "MD-JACKET-017",
        priceMinor: 79000,
        size: "50",
        imagePath: "smaller/9195.webp",
        swatchImagePath: "smaller/9195_1.webp",
      },
      {
        name: "Cross Ply Light Taupe Mélange Stretch Linen, Wool & Silk Twill",
        slug: "cross-ply-light-taupe-m-lange-stretch-linen-wool-silk-twill-9196",
        sku: "MD-JACKET-018",
        priceMinor: 109000,
        size: "50",
        imagePath: "smaller/9196.webp",
        swatchImagePath: "smaller/9196_1.webp",
      },
      {
        name: "Neapolitan Blue Mélange Wool, Silk & Linen Twill",
        slug: "neapolitan-blue-m-lange-wool-silk-linen-twill-9197",
        sku: "MD-JACKET-019",
        priceMinor: 74000,
        size: "50",
        imagePath: "smaller/9197.webp",
        swatchImagePath: "smaller/9197_1.webp",
      },
      {
        name: "Cross Ply Dark Blue Mélange Stretch Linen, Wool & Silk Twill",
        slug: "cross-ply-dark-blue-m-lange-stretch-linen-wool-silk-twill-9201",
        sku: "MD-JACKET-020",
        priceMinor: 109000,
        size: "50",
        imagePath: "smaller/9201.webp",
        swatchImagePath: "smaller/9201_1.webp",
      },
      {
        name: "Jersely Midnight Blue Mélange Stretch Wool, Silk & Linen Basketweave",
        slug: "jersely-midnight-blue-m-lange-stretch-wool-silk-linen-basketweave-9203",
        sku: "MD-JACKET-021",
        priceMinor: 89000,
        size: "50",
        imagePath: "smaller/9203.webp",
        swatchImagePath: "smaller/9203_1.webp",
      },
      {
        name: "Jersely Camel Mélange Stretch Wool, Silk & Linen Basketweave",
        slug: "jersely-camel-m-lange-stretch-wool-silk-linen-basketweave-9206",
        sku: "MD-JACKET-022",
        priceMinor: 94000,
        size: "50",
        imagePath: "smaller/9206.webp",
        swatchImagePath: "smaller/9206_1.webp",
      },
      {
        name: "Mauve & Pink Pure Silk Houndstooth",
        slug: "mauve-pink-pure-silk-houndstooth-9207",
        sku: "MD-JACKET-023",
        priceMinor: 69000,
        size: "50",
        imagePath: "smaller/9207.webp",
        swatchImagePath: "smaller/9207_1.webp",
      },
      {
        name: "Jersely Ocean Blue Mélange Stretch Wool, Silk & Linen Basketweave",
        slug: "jersely-ocean-blue-m-lange-stretch-wool-silk-linen-basketweave-9208",
        sku: "MD-JACKET-024",
        priceMinor: 94000,
        size: "50",
        imagePath: "smaller/9208.webp",
        swatchImagePath: "smaller/9208_1.webp",
      },
      {
        name: "Taupe Suede Penny Loafer",
        slug: "shoes-01-schoen1",
        sku: "MD-SHOE-001",
        priceMinor: 70000,
        size: "43",
        imagePath: "schoen03_converted.webp",
        swatchImagePath: "schoen1-1.jpg",
      },
      {
        name: "Navy Knit Lifestyle Sneaker",
        slug: "shoes-02-schoen2",
        sku: "MD-SHOE-002",
        priceMinor: 70000,
        size: "43",
        imagePath: "schoen02_converted.webp",
        swatchImagePath: "schoen2-2.jpg",
      },
      {
        name: "Espresso Suede Loafer",
        slug: "shoes-03-schoen3",
        sku: "MD-SHOE-003",
        priceMinor: 70000,
        size: "43",
        imagePath: "schoen01_converted.webp",
        swatchImagePath: "schoen3-3.jpg",
      },
      {
        name: "Black Suede Loafer",
        slug: "shoes-04-schoen4",
        sku: "MD-SHOE-004",
        priceMinor: 70000,
        size: "43",
        imagePath: "schoen04_converted.webp",
        swatchImagePath: "schoen4-4.jpg",
      },
      {
        name: "Tobacco Button Knit Polo",
        slug: "knit-1-trui1",
        sku: "MD-KNIT-001",
        priceMinor: 90000,
        imagePath: "trui1_converted.webp",
        swatchImagePath: "trui1-1.png",
      },
      {
        name: "Oatmeal Cable Quarter-Zip",
        slug: "knit-2-trui2",
        sku: "MD-KNIT-002",
        priceMinor: 90000,
        imagePath: "trui2_converted.webp",
        swatchImagePath: "trui2-2.png",
      },
      {
        name: "Charcoal Full-Zip Knit",
        slug: "knit-3-trui3",
        sku: "MD-KNIT-003",
        priceMinor: 90000,
        imagePath: "trui3_converted.webp",
        swatchImagePath: "trui3-3.png",
      },
      {
        name: "Dusty Blue Cable Turtleneck",
        slug: "knit-4-trui4",
        sku: "MD-KNIT-004",
        priceMinor: 90000,
        imagePath: "trui4_converted.webp",
        swatchImagePath: "trui4-4.png",
      },
      {
        name: "Light Blue Short-Sleeve Crew",
        slug: "knit-06-trui6",
        sku: "MD-KNIT-005",
        priceMinor: 90000,
        imagePath: "trui6.png",
        swatchImagePath: "trui6-6.png",
      },
    ],
    customers: [
      {
        name: "Isabelle Laurent",
        email: "contact+isabelle@nebelspiegel.com",
        portal: true,
        lifecycle: "vip",
      },
      {
        name: "Marc Fontaine",
        email: "contact+marc@nebelspiegel.com",
        portal: true,
        lifecycle: "returning",
      },
      {
        name: "Sophie Renard",
        email: "contact+sophie@nebelspiegel.com",
        portal: false,
        lifecycle: "first_purchase",
      },
      {
        name: "Julien Moreau",
        email: "contact+julien@nebelspiegel.com",
        portal: true,
        lifecycle: "vip",
      },
      {
        name: "Camille Dupont",
        email: "contact+camille@nebelspiegel.com",
        portal: true,
        lifecycle: "returning",
      },
      {
        name: "Antoine Bernard",
        email: "contact+antoine@nebelspiegel.com",
        portal: false,
        lifecycle: "returning",
      },
      {
        name: "Nathalie Girard",
        email: "contact+nathalie@nebelspiegel.com",
        portal: true,
        lifecycle: "first_purchase",
      },
      {
        name: "Thomas Lambert",
        email: "contact+thomas@nebelspiegel.com",
        portal: true,
        lifecycle: "first_purchase",
      },
      {
        name: "Olivier Lefebvre",
        email: "contact+olivier@nebelspiegel.com",
        portal: false,
        lifecycle: "prospect",
      },
      {
        name: "Claire Rousseau",
        email: "contact+claire@nebelspiegel.com",
        portal: false,
        lifecycle: "prospect",
      },
      {
        name: "Frederic Mercier",
        email: "contact+frederic@nebelspiegel.com",
        portal: false,
        lifecycle: "lapsed",
      },
      {
        name: "Veronique Petit",
        email: "contact+veronique@nebelspiegel.com",
        portal: false,
        lifecycle: "lapsed",
      },
    ],
  },
  {
    slug: "casa-marchetti",
    displayName: "Casa Marchetti",
    legalName: "Casa Marchetti S.r.l.",
    currency: "EUR",
    collectionName: "Atelier Leather",
    collectionSlug: "atelier-leather",
    products: [
      {
        name: "Hand-Stitched Leather Briefcase",
        slug: "leather-briefcase",
        sku: "CM-BAG-001",
        priceMinor: 195000,
        imagePath: "smaller/6060.webp",
        swatchImagePath: "smaller/6060_1.webp",
      },
      {
        name: "Made-to-Measure Blazer",
        slug: "made-to-measure-blazer",
        sku: "CM-JKT-002",
        priceMinor: 310000,
        size: "48",
        imagePath: "smaller/6061.webp",
        swatchImagePath: "smaller/6061_1.webp",
      },
      {
        name: "Calfskin Belt",
        slug: "calfskin-belt",
        sku: "CM-ACC-003",
        priceMinor: 12500,
        imagePath: "smaller/6062.webp",
        swatchImagePath: "smaller/6062_1.webp",
      },
      {
        name: "Tailored Dress Trousers",
        slug: "tailored-dress-trousers",
        sku: "CM-TRS-004",
        priceMinor: 72000,
        size: "48",
        imagePath: "broeken-webp/broek1.webp",
        swatchImagePath: "broeken-webp/broek1-1.webp",
      },
      {
        name: "Handmade Derby Shoe",
        slug: "handmade-derby-shoe",
        sku: "CM-SHOE-005",
        priceMinor: 95000,
        size: "43",
        imagePath: "schoen02_converted.webp",
        swatchImagePath: "schoen2-2.jpg",
      },
      {
        name: "Formal Evening Trousers",
        slug: "formal-evening-trousers",
        sku: "CM-TRS-006",
        priceMinor: 79000,
        size: "48",
        imagePath: "broeken-webp/broek2.webp",
        swatchImagePath: "broeken-webp/broek2-2.webp",
      },
    ],
    customers: [
      {
        name: "Giulia Romano",
        email: "contact+giulia@nebelspiegel.com",
        portal: true,
        lifecycle: "vip",
      },
      {
        name: "Luca Bianchi",
        email: "contact+luca@nebelspiegel.com",
        portal: true,
        lifecycle: "returning",
      },
      {
        name: "Elena Conti",
        email: "contact+elena@nebelspiegel.com",
        portal: false,
        lifecycle: "prospect",
      },
    ],
  },
];

const STAFF_ROLES: {
  role:
    | "owner"
    | "manager"
    | "sales_associate"
    | "production_staff"
    | "workshop_manager"
    | "worker";
  label: string;
}[] = [
  { role: "owner", label: "owner" },
  { role: "manager", label: "manager" },
  { role: "sales_associate", label: "sales" },
  { role: "production_staff", label: "operations" },
  { role: "workshop_manager", label: "workshop" },
  { role: "worker", label: "alteration-worker" },
];

export const DEMO_PERSONA_LOGINS: DemoPersonaLogin[] = [
  {
    app: "admin",
    persona: "Platform administrator",
    email: "contact@nebelspiegel.com",
  },
  ...RETAILERS.flatMap((retailer) => [
    ...STAFF_ROLES.map(({ role, label }) => ({
      app: "retailer" as const,
      retailer: retailer.displayName,
      persona:
        role === "sales_associate"
          ? "Sales advisor"
          : role === "production_staff"
            ? "Production / operations"
            : role === "workshop_manager"
              ? "Workshop manager"
              : role === "worker"
                ? "Alteration worker"
                : role === "owner"
                  ? "Retailer owner"
                  : "Retailer manager",
      email: `contact+${retailer.slug}-${label}@nebelspiegel.com`,
    })),
    ...retailer.customers
      .filter((customer) => customer.portal)
      .map((customer) => ({
        app: "customer" as const,
        retailer: retailer.displayName,
        persona: `Customer — ${customer.name}`,
        email: customer.email,
      })),
  ]),
];

export async function seedDemoData(params: {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}): Promise<DemoLogin[]> {
  return seedRetailerSpecs({
    ...params,
    specs: RETAILERS,
    includePlatformAdmin: true,
  });
}

/**
 * Demo Studio generation path: create one real retailer tenant for a
 * named prospect, seeded with the same proven Maison Dubois catalogue
 * shape. Idempotent on slug — regenerate reuses the tenant.
 */
export async function seedProspectDemoRetailer(params: {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  displayName: string;
  slug: string;
  brandTheme: RetailerBrandTheme;
}): Promise<{ retailerId: RetailerId; slug: string; logins: DemoLogin[] }> {
  const template = RETAILERS[0]!;
  const spec: RetailerSpec = {
    ...template,
    slug: params.slug,
    displayName: params.displayName,
    legalName: `${params.displayName} Demo SARL`,
    collectionName: `${params.displayName} Collection`,
    collectionSlug: "signature-tailoring",
  };
  const logins = await seedRetailerSpecs({
    supabaseUrl: params.supabaseUrl,
    anonKey: params.anonKey,
    serviceRoleKey: params.serviceRoleKey,
    specs: [spec],
    includePlatformAdmin: false,
  });
  const admin = createSupabaseAdminClient(
    params.supabaseUrl,
    params.serviceRoleKey,
  );
  const retailerRepo = new RetailerRepository(admin);
  const retailer = await retailerRepo.findBySlug(params.slug);
  if (!retailer) {
    throw new Error(`Prospect demo retailer "${params.slug}" was not created`);
  }
  // Always re-apply on regenerate so Studio colour/logo edits land on the
  // live tenant without a teardown. Service role is authorised by the RPC.
  await retailerRepo.saveBrandTheme(
    retailer.id as RetailerId,
    stripEmptyBrandUrls(params.brandTheme),
    "Demo Studio prospect branding",
  );
  return {
    retailerId: retailer.id as RetailerId,
    slug: params.slug,
    logins,
  };
}

/** Postgres rejects non-https logo/favicon/hero URLs; omit blanks. */
function stripEmptyBrandUrls(theme: RetailerBrandTheme): RetailerBrandTheme {
  return {
    accentColor: theme.accentColor,
    surfaceColor: theme.surfaceColor,
    inkColor: theme.inkColor,
    displayFont: theme.displayFont,
    bodyFont: theme.bodyFont,
    cornerStyle: theme.cornerStyle,
    ...(theme.logoUrl?.startsWith("https://")
      ? { logoUrl: theme.logoUrl }
      : {}),
    ...(theme.faviconUrl?.startsWith("https://")
      ? { faviconUrl: theme.faviconUrl }
      : {}),
    ...(theme.heroImageUrl?.startsWith("https://")
      ? { heroImageUrl: theme.heroImageUrl }
      : {}),
  };
}

async function seedRetailerSpecs(params: {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  specs: RetailerSpec[];
  includePlatformAdmin: boolean;
}): Promise<DemoLogin[]> {
  const { supabaseUrl, anonKey, serviceRoleKey, specs, includePlatformAdmin } =
    params;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const logins: DemoLogin[] = [];

  async function ensureUser(email: string, fullName: string): Promise<UserId> {
    const { data: existing, error: listError } =
      await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const found = existing.users.find((u) => u.email === email);
    if (found) return found.id as UserId;

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      throw new Error(
        `Failed to create user ${email}: ${error?.message ?? "unknown"}`,
      );
    }
    return data.user.id as UserId;
  }

  async function signedInClient(email: string) {
    const client = createSupabaseDirectClient(supabaseUrl, anonKey);
    const { error } = await client.auth.signInWithPassword({
      email,
      password: DEMO_PASSWORD,
    });
    if (error) throw error;
    return client;
  }

  async function seedPlatformAdmin() {
    const email = "contact@nebelspiegel.com";
    const userId = await ensureUser(email, "Founder");
    const repo = new PlatformStaffRepository(admin);
    let staff = await repo.findByUserId(userId);
    staff ??= await repo.create({
      userId,
      fullName: "Founder",
      role: "platform_owner",
    });
    if (!staff.acceptedAt) {
      await admin
        .from("platform_staff_members")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", staff.id);
    }
    logins.push({
      role: "Platform admin (PAON Admin)",
      email,
      password: DEMO_PASSWORD,
    });
  }

  async function seedRetailer(spec: RetailerSpec) {
    const retailerRepo = new RetailerRepository(admin);
    const staffRepo = new RetailerStaffRepository(admin);
    const collectionRepo = new CollectionRepository(admin);
    const productRepo = new ProductRepository(admin);
    const variantRepo = new ProductVariantRepository(admin);
    const customerRepo = new CustomerRepository(admin);

    let retailer = await retailerRepo.findBySlug(spec.slug);
    retailer ??= await retailerRepo.create({
      legalName: spec.legalName,
      displayName: spec.displayName,
      slug: spec.slug,
      tier: "house",
      defaultCurrency: spec.currency,
      defaultLocale: "en-US",
      billingAddress: {
        line1: "1 Demo Street",
        city: "Demo City",
        postalCode: "00000",
        countryCode: "FR",
      },
    });
    if (retailer.status !== "active") {
      await admin
        .from("retailers")
        .update({ status: "active" })
        .eq("id", retailer.id);
    }
    const retailerId = retailer.id as RetailerId;

    // Workshop ("alteration partner") — created before staff since
    // workshop_manager/worker roles require a workshop_id at insert time
    // (retailer_staff_workshop_role_check).
    const workshopRepo = new WorkshopRepository(admin);
    let workshop = (await workshopRepo.findByRetailer(retailerId)).find(
      (w) => w.name === `${spec.displayName} Workshop Partner`,
    );
    workshop ??= await workshopRepo.create({
      retailerId,
      name: `${spec.displayName} Workshop Partner`,
      email: `contact+${spec.slug}-workshop-partner@nebelspiegel.com`,
    });

    // Staff
    const staffIds: Record<string, StaffId> = {};
    for (const { role, label } of STAFF_ROLES) {
      const email = `contact+${spec.slug}-${label}@nebelspiegel.com`;
      const fullName = `${spec.displayName} ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
      const userId = await ensureUser(email, fullName);
      let staff = await staffRepo.findByUserId(userId);
      staff ??= await staffRepo.create({
        retailerId,
        userId,
        fullName,
        email,
        role,
        ...(["workshop_manager", "worker"].includes(role)
          ? { workshopId: workshop.id }
          : {}),
      });
      if (!staff.acceptedAt) {
        await admin
          .from("retailer_staff_members")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", staff.id);
      }
      staffIds[role] = staff.id;
      logins.push({
        role: `${spec.displayName} — ${label}`,
        email,
        password: DEMO_PASSWORD,
      });
    }

    // Collection
    let collection = (await collectionRepo.findByRetailer(retailerId)).find(
      (c) => c.slug === spec.collectionSlug,
    );
    collection ??= await collectionRepo.create({
      retailerId,
      name: spec.collectionName,
      slug: spec.collectionSlug,
    });

    // Products + variants
    const productIds: ProductId[] = [];
    for (const p of spec.products) {
      let product = await productRepo.findBySlug(retailerId, p.slug);
      const primaryImageUrl = `https://www.nebelspiegel.com/images/${p.imagePath}`;
      const swatchImageUrl = `https://www.nebelspiegel.com/images/${p.swatchImagePath}`;
      const description = `${p.name}. Cut and finished for ${spec.displayName}.`;
      product ??= await productRepo.create({
        retailerId,
        name: p.name,
        slug: p.slug,
        description,
        status: "active",
        isMadeToOrder: false,
        isAlterable: true,
      });
      if (
        !product.collectionIds.includes(collection.id) ||
        product.primaryImageUrl !== primaryImageUrl ||
        product.swatchImageUrl !== swatchImageUrl ||
        product.name !== p.name ||
        product.description !== description
      ) {
        // Not `productRepo.update()` (`update_product_catalogue`,
        // security definer) — that RPC requires a real staff JWT
        // (`current_retailer_role()`), which the admin/service-role
        // client used throughout this seed never has. A direct
        // service-role table write bypasses RLS the same way every
        // other admin.from(...).update(...) call in this file does.
        await admin
          .from("products")
          .update({
            name: p.name,
            description,
            primary_image_url: primaryImageUrl,
            swatch_image_url: swatchImageUrl,
          })
          .eq("id", product.id);
        await admin
          .from("product_collections")
          .delete()
          .eq("product_id", product.id);
        await admin
          .from("product_collections")
          .insert({ product_id: product.id, collection_id: collection.id });
      }
      const variants = await variantRepo.findByProduct(product.id);
      if (variants.length === 0) {
        await variantRepo.create({
          productId: product.id,
          sku: p.sku,
          ...(p.size ? { size: p.size } : {}),
          price: { amountMinorUnits: p.priceMinor, currency: spec.currency },
          inventoryQuantity: 25,
        });
      }
      productIds.push(product.id);
    }

    // Loyalty program — must be enabled before orders are delivered for
    // accrue_loyalty_on_delivered_order() to do anything (it no-ops
    // silently when no enabled program row exists for the retailer).
    const loyaltyRepoEarly = new LoyaltyRepository(admin);
    await loyaltyRepoEarly.saveProgram(retailerId, {
      name: `${spec.displayName} Rewards`,
      enabled: true,
      pointsPerCurrencyUnit: 1,
      referralPoints: 100,
    });

    // Customers
    const customerIds: CustomerId[] = [];
    for (const c of spec.customers) {
      const existing = (await customerRepo.findByRetailer(retailerId)).find(
        (x) => x.email === c.email,
      );
      let customer = existing;
      customer ??= await customerRepo.create({
        retailerId,
        fullName: c.name,
        email: c.email,
        lifecycleStage: c.lifecycle,
      });
      customerIds.push(customer.id);

      if (c.portal) {
        await ensureUser(c.email, c.name);
        const portalClient = await signedInClient(c.email);
        await new CustomerRepository(portalClient).linkMyAccounts();
        logins.push({
          role: `${spec.displayName} customer — ${c.name}`,
          email: c.email,
          password: DEMO_PASSWORD,
        });
      }
    }
    const portalCustomers = spec.customers.filter((c) => c.portal);
    const productIdBySlug = new Map(
      spec.products.map((product, index) => [product.slug, productIds[index]!]),
    );
    const histories =
      spec.slug === "maison-dubois" ? MAISON_CLIENT_HISTORIES : {};

    // Durable clienteling context across the book — not Isabelle-only.
    const clientelingRepo = new ClientelingRepository(admin);
    const salesStaffId = staffIds["sales_associate"]!;
    for (let i = 0; i < spec.customers.length; i++) {
      const customerSpec = spec.customers[i]!;
      const customerId = customerIds[i]!;
      const story = histories[customerSpec.email];
      if (!story?.notes?.length) continue;
      const existingNotes = await clientelingRepo.findByCustomer(customerId);
      for (const note of story.notes) {
        if (existingNotes.some((existing) => existing.body === note.body)) {
          continue;
        }
        await clientelingRepo.create({
          retailerId,
          customerId,
          authorStaffId: salesStaffId,
          ...note,
        });
      }
    }

    // One realistic advisor conversation, including an unread customer reply.
    // Each side uses its own authenticated projection so demo data exercises
    // the same RLS and notification path as the product.
    const firstPortalCustomer = portalCustomers[0];
    if (firstPortalCustomer && customerIds[0]) {
      const ownerEmail = `contact+${spec.slug}-owner@nebelspiegel.com`;
      const staffMessaging = new MessagingRepository(
        await signedInClient(ownerEmail),
      );
      const customerMessaging = new MessagingRepository(
        await signedInClient(firstPortalCustomer.email),
      );
      const conversationId = await staffMessaging.getOrCreateForStaff(
        customerIds[0],
      );
      const existingMessages =
        await staffMessaging.findMessages(conversationId);
      if (existingMessages.length === 0) {
        await staffMessaging.send(
          conversationId,
          `Your ${spec.products[0]!.name.toLowerCase()} is ready for its final fitting. Would tomorrow at 16:30 suit you?`,
        );
        await customerMessaging.send(
          conversationId,
          "16:30 would be perfect. Could you also have the charcoal overcoat ready for me to compare?",
        );
      }
    }

    // Orders: per-customer product stories. Non-portal clients who need
    // history get a linked auth user for place_order only (not demo logins).
    const orderRepo = new OrderRepository(admin);
    const variantIdByProductId = new Map<string, string>();
    async function variantIdForProduct(
      productId: ProductId,
    ): Promise<string | null> {
      const cached = variantIdByProductId.get(productId);
      if (cached) return cached;
      const variants = await variantRepo.findByProduct(productId);
      const first = variants[0];
      if (!first) return null;
      variantIdByProductId.set(productId, first.id);
      return first.id;
    }

    async function deliverOrder(orderId: OrderId) {
      await orderRepo.updateStatus(orderId, "placed");
      await orderRepo.updateStatus(orderId, "in_production");
      await orderRepo.updateStatus(orderId, "ready_for_fulfillment");
      await orderRepo.updateStatus(orderId, "shipped");
      await orderRepo.updateStatus(orderId, "delivered");
    }

    for (let i = 0; i < spec.customers.length; i++) {
      const customerSpec = spec.customers[i]!;
      const customerId = customerIds[i]!;
      const story = histories[customerSpec.email];
      const slugs =
        story?.productSlugs ??
        (customerSpec.portal && spec.products[0]
          ? [spec.products[0].slug]
          : []);
      if (slugs.length === 0) continue;

      const { data: ownedLines, error: ownedError } = await admin
        .from("order_lines")
        .select(
          "product_variant_id, orders!inner(customer_id, status, deleted_at)",
        )
        .eq("orders.customer_id", customerId)
        .neq("orders.status", "draft")
        .is("orders.deleted_at", null);
      if (ownedError) throw ownedError;
      const ownedVariantIds = new Set(
        (ownedLines ?? []).map((line) => line.product_variant_id),
      );

      const missingSlugs: string[] = [];
      for (const slug of slugs) {
        const productId = productIdBySlug.get(slug);
        if (!productId) {
          throw new Error(
            `Demo history references unknown product slug ${slug} for ${customerSpec.email}`,
          );
        }
        const variantId = await variantIdForProduct(productId);
        if (!variantId) continue;
        if (!ownedVariantIds.has(variantId)) {
          missingSlugs.push(slug);
        }
      }
      if (missingSlugs.length === 0) continue;

      if (!customerSpec.portal) {
        await ensureUser(customerSpec.email, customerSpec.name);
        const linkClient = await signedInClient(customerSpec.email);
        await new CustomerRepository(linkClient).linkMyAccounts();
      }

      const portalClient = await signedInClient(customerSpec.email);
      const custOrderRepo = new OrderRepository(portalClient);
      for (const slug of missingSlugs) {
        const productId = productIdBySlug.get(slug)!;
        const variantId = (await variantIdForProduct(productId))!;
        const orderId = await custOrderRepo.placeOrder({
          retailerId,
          productVariantId: variantId,
          quantity: 1,
        });
        await deliverOrder(orderId);
      }
    }

    // Fixup: re-fire the delivery trigger for any already-delivered
    // order that predates the loyalty program above (accrual is a
    // no-op without an enabled program row, and it only runs on a
    // status *transition*, not on read).
    const deliveredWithoutAccrual = await admin
      .from("orders")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("status", "delivered");
    for (const row of deliveredWithoutAccrual.data ?? []) {
      const { data: ledgerRows } = await admin
        .from("loyalty_ledger_entries")
        .select("id")
        .eq("related_order_id", row.id)
        .eq("type", "earn_purchase");
      if (!ledgerRows || ledgerRows.length === 0) {
        await admin
          .from("orders")
          .update({ status: "shipped" })
          .eq("id", row.id);
        await admin
          .from("orders")
          .update({ status: "delivered" })
          .eq("id", row.id);
      }
    }

    // Appointment + availability
    const availabilityRepo = new AvailabilityWindowRepository(admin);
    const appointmentRepo = new AppointmentRepository(admin);
    const ownerStaffId = staffIds["owner"]!;
    const existingWindows = await availabilityRepo.findByStaff(ownerStaffId);
    if (existingWindows.length === 0) {
      await availabilityRepo.create({
        staffId: ownerStaffId,
        retailerId,
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "17:00",
      });
    }
    const existingAppointments =
      await appointmentRepo.findByRetailer(retailerId);
    for (let i = 0; i < spec.customers.length; i++) {
      const customerSpec = spec.customers[i]!;
      const customerId = customerIds[i]!;
      const story = histories[customerSpec.email];
      if (!story?.appointments?.length) continue;
      for (const appointmentStory of story.appointments) {
        if (
          existingAppointments.some((appointment) =>
            appointment.notes?.startsWith(appointmentStory.marker),
          )
        ) {
          continue;
        }
        const start = new Date(
          Date.now() + appointmentStory.offsetHours * 60 * 60 * 1000,
        );
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const appointment = await appointmentRepo.create({
          retailerId,
          customerId,
          staffId: ownerStaffId,
          type: appointmentStory.type,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          notes: appointmentStory.notes,
        });
        if (appointmentStory.status !== "requested") {
          await appointmentRepo.update(appointment.id, {
            status: appointmentStory.status,
          });
        }
      }
    }

    // Alteration referencing the workshop created above.
    if (customerIds[0]) {
      const alterationRepo = new AlterationRepository(admin);
      const alterationTaskRepo = new AlterationTaskRepository(admin);
      const alterationUpdateRepo = new AlterationUpdateRepository(admin);
      const alterationWorkflowRepo = new AlterationWorkflowRepository(admin);

      const existingAlterations = (
        await alterationRepo.findByRetailer(retailerId)
      ).filter((w) => w.customerId === customerIds[0]);
      let alteration = existingAlterations[0] ?? null;
      if (!alteration) {
        const alterationId = await alterationRepo.createIntake({
          customerId: customerIds[0],
          sourceKind: "external",
          categoryCode: "jacket",
          garmentType: "Wool jacket",
          description: "Demo garment intake",
          labelMetadata: {},
          intakeCondition: "Good condition",
          observations: [
            {
              area: "Sleeve",
              observation: "One inch long",
              classification: "work_now",
            },
          ],
          tasks: [
            { title: "Shorten sleeve by one inch", classification: "work_now" },
          ],
        });
        alteration = await alterationRepo.findById(alterationId);
      }
      if (alteration) {
        let status = alteration.status;
        if (status === "intake") {
          await alterationUpdateRepo.transition({
            alterationId: alteration.id,
            toStatus: "quoted",
            customerVisible: true,
          });
          status = "quoted";
        }
        if (status === "quoted") {
          await alterationUpdateRepo.transition({
            alterationId: alteration.id,
            toStatus: "approved",
            customerVisible: true,
          });
          status = "approved";
        }
        if (status === "approved") {
          await alterationWorkflowRepo.assign({
            alterationId: alteration.id,
            workshopId: workshop.id,
          });
          status = "assigned";
        }
        await alterationWorkflowRepo.updateWorkshopAssignment({
          alterationId: alteration.id,
          workerId: staffIds["worker"]!,
          targetCompletionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
        });
        if (status === "assigned") {
          const tasks = await alterationTaskRepo.findByAlteration(
            alteration.id,
          );
          for (const task of tasks.filter(
            (t) => t.classification === "work_now",
          )) {
            if (task.status === "assigned")
              await alterationTaskRepo.updateStatus(task.id, "in_progress");
          }
        }
      }
    }

    // Loyalty reward
    const loyaltyRepo = new LoyaltyRepository(admin);
    const existingRewards = await loyaltyRepo.findRewards(retailerId);
    if (existingRewards.length === 0) {
      await loyaltyRepo.createReward(retailerId, {
        name: "10% Off Next Purchase",
        type: "discount_percent",
        pointsCost: 500,
      });
    }

    // Retailer event
    const eventRepo = new EventRepository(admin);
    const existingEvents = await admin
      .from("retailer_events")
      .select("id, status")
      .eq("retailer_id", retailerId)
      .limit(1);
    let eventId = existingEvents.data?.[0]?.id;
    if (!existingEvents.data || existingEvents.data.length === 0) {
      const start = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
      const event = await eventRepo.create(retailerId, {
        name: `${spec.displayName} Trunk Show`,
        description: "An evening preview of the new collection.",
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        venueName: `${spec.displayName} Atelier`,
        visibility: "public",
        capacity: 40,
      });
      eventId = event.id;
    }
    if (
      eventId &&
      (!existingEvents.data?.[0] ||
        existingEvents.data[0].status !== "published")
    ) {
      await eventRepo.updateStatus(eventId as never, "published");
    }

    // A coordinated wedding party gives both retailer and customer personas
    // a complete group-service workspace to explore — including schedule,
    // fitting location, roster photos and prep sizes for the orbit.
    if (customerIds[0]) {
      const weddingRepo = new WeddingPartyRepository(admin);
      const customerRepo = new CustomerRepository(admin);
      const existingParties = await weddingRepo.findByRetailer(retailerId);
      let party = existingParties.find(
        (candidate) => candidate.venueName === "Villa Aurelia",
      );
      const weddingDate = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
      const fittingLocation = `${spec.displayName} Atelier`;
      if (!party) {
        party = await weddingRepo.create({
          retailerId,
          organizerCustomerId: customerIds[0],
          eventDate: weddingDate.toISOString().slice(0, 10),
          eventTime: "15:30",
          venueName: "Villa Aurelia",
          fittingLocation,
          notes:
            "Black tie garden ceremony. Four attendants, fittings to be completed six weeks before travel.",
        });
      } else {
        await weddingRepo.updateSchedule(party.id, {
          ...(party.eventTime ? {} : { eventTime: "15:30" }),
          ...(party.fittingLocation ? {} : { fittingLocation }),
        });
      }
      if (!party.coverPhotoUrl) {
        await weddingRepo.setCoverPhotoUrl(
          party.id,
          "https://www.nebelspiegel.com/images/wed2027-poster.jpg",
        );
      }

      const organizer = await customerRepo.findById(customerIds[0]);
      let members = await weddingRepo.findMembers(party.id);
      if (
        organizer?.email &&
        !members.some((member) => member.customerId === organizer.id)
      ) {
        await weddingRepo.addMember({
          weddingPartyId: party.id,
          name: organizer.fullName,
          email: organizer.email,
          role: "groom",
        });
      }
      const attendants = [
        {
          name: "Julien Moreau",
          email: `contact+${spec.slug}-wedding-julien@nebelspiegel.com`,
          role: "best_man" as const,
        },
        {
          name: "Thomas Leroy",
          email: `contact+${spec.slug}-wedding-thomas@nebelspiegel.com`,
          role: "groomsman" as const,
        },
      ];
      for (const person of attendants) {
        members = await weddingRepo.findMembers(party.id);
        if (!members.some((member) => member.name === person.name)) {
          await weddingRepo.addMember({
            weddingPartyId: party.id,
            name: person.name,
            email: person.email,
            role: person.role,
          });
        }
      }

      members = await weddingRepo.findMembers(party.id);
      const avatarByRole: Record<string, string> = {
        groom: "https://www.nebelspiegel.com/images/ava1.png",
        best_man: "https://www.nebelspiegel.com/images/ava2.png",
        groomsman: "https://www.nebelspiegel.com/images/ava3.png",
      };
      const prepByRole: Record<string, { heightCm: number; weightKg: number }> =
        {
          groom: { heightCm: 184, weightKg: 78 },
          best_man: { heightCm: 181, weightKg: 76 },
          groomsman: { heightCm: 178, weightKg: 74 },
        };
      for (const member of members) {
        const photoUrl = avatarByRole[member.role];
        const prep = prepByRole[member.role];
        if (
          (!member.photoUrl && photoUrl) ||
          (prep && (member.heightCm == null || member.weightKg == null))
        ) {
          await weddingRepo.updateMemberPrep(member.id, {
            ...(!member.photoUrl && photoUrl ? { photoUrl } : {}),
            ...(prep && member.heightCm == null
              ? { heightCm: prep.heightCm }
              : {}),
            ...(prep && member.weightKg == null
              ? { weightKg: prep.weightKg }
              : {}),
          });
        }
      }
    }
  }

  if (includePlatformAdmin) {
    await seedPlatformAdmin();
  }
  for (const spec of specs) {
    await seedRetailer(spec);
  }

  return logins;
}
