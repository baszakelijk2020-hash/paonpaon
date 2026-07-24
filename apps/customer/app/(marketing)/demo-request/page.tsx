import { CommercialPage } from "../commercial-page";

export default async function DemoRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  return (
    <CommercialPage inquiryType="personalized_demo" requestedPlanKey={plan} />
  );
}
