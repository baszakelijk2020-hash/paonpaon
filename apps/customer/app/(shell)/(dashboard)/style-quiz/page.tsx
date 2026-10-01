import { redirect } from "next/navigation";

export default async function StyleQuizPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  const params = await searchParams;
  const paramString = new URLSearchParams();

  // Forward all incoming params prefixed with styleQuiz_
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      const strValue = Array.isArray(value) ? value[0] : value;
      if (strValue) {
        paramString.set(`styleQuiz_${key}`, strValue);
      }
    }
  }

  paramString.set("tab", "style-quiz");
  redirect(`/wardrobe?${paramString.toString()}`);
}
