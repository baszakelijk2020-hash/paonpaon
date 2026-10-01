import { redirect } from "next/navigation";

export default async function DigitalFittingRoomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  const params = await searchParams;
  const paramString = new URLSearchParams();

  // Forward all incoming params prefixed with fittingRoom_
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith("fittingRoom_")) {
      const strValue = Array.isArray(value) ? value[0] : value;
      if (strValue) paramString.set(key, strValue);
    } else if (key !== "step" && key !== "tab" && value !== undefined) {
      const strValue = Array.isArray(value) ? value[0] : value;
      if (strValue) {
        paramString.set(`fittingRoom_${key}`, strValue);
      }
    }
  }

  const query = paramString.toString();
  redirect(`/wardrobe${query ? `?${query}` : ""}#fitting-room`);
}
