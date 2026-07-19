import { redirect } from "next/navigation";

export default async function RetailerStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/r/${slug}/products`);
}
