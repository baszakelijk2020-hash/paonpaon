import { NextResponse } from "next/server";

/**
 * Live driving time — the road network WITH current traffic — for the
 * overview's commute reading.
 *
 * TomTom's routing API is used when a key is configured (`TOMTOM_API_KEY`,
 * server-side only, never sent to the browser). Without one this answers
 * 204 and the tile falls back to a traffic-free OSRM road route in the
 * browser, so the reading never disappears for want of a key.
 */

/** "lat,lon" — nothing else is forwarded upstream. */
const COORD = /^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;

export async function GET(request: Request) {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return new NextResponse(null, { status: 204 });

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!COORD.test(from) || !COORD.test(to)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `https://api.tomtom.com/routing/1/calculateRoute/${from}:${to}/json` +
        `?key=${encodeURIComponent(key)}&traffic=true&travelMode=car&routeType=fastest&departAt=now`,
      { cache: "no-store" },
    );
    if (!upstream.ok) return new NextResponse(null, { status: 204 });
    const data = (await upstream.json()) as {
      routes?: {
        summary?: {
          travelTimeInSeconds?: number;
          lengthInMeters?: number;
          trafficDelayInSeconds?: number;
        };
      }[];
    };
    const summary = data.routes?.[0]?.summary;
    if (!summary?.travelTimeInSeconds)
      return new NextResponse(null, { status: 204 });
    return NextResponse.json(
      {
        minutes: Math.max(1, Math.round(summary.travelTimeInSeconds / 60)),
        km: Math.round((summary.lengthInMeters ?? 0) / 100) / 10,
        delayMinutes: Math.round((summary.trafficDelayInSeconds ?? 0) / 60),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
