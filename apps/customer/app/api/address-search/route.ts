import { NextResponse } from "next/server";

import { allowRequest, clientAddress } from "@/lib/rate-limit";

interface NominatimPlace {
  display_name: string;
  address?: {
    city?: string;
    house_number?: string;
    municipality?: string;
    postcode?: string;
    road?: string;
    suburb?: string;
    town?: string;
    village?: string;
  };
}

export async function GET(request: Request) {
  // Public (the guest address preview uses it) and forwarded to Nominatim,
  // whose policy is one request a second from this server.
  if (!allowRequest(`address-search:${clientAddress(request)}`, 30, 60_000)) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 3 || query.length > 200) {
    return NextResponse.json({ results: [] });
  }

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("countrycodes", "nl");
  endpoint.searchParams.set("limit", "5");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "PAON address search",
      },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const places = (await response.json()) as NominatimPlace[];
    const results = places.flatMap((place) => {
      const address = place.address;
      const street = [address?.road, address?.house_number]
        .filter(Boolean)
        .join(" ");
      const city =
        address?.city ??
        address?.town ??
        address?.village ??
        address?.municipality ??
        address?.suburb;

      if (!street || !address?.postcode || !city) return [];

      return [
        {
          city,
          displayName: place.display_name,
          line1: street,
          postalCode: address.postcode,
        },
      ];
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
