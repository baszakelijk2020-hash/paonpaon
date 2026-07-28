import { PrivateDemo } from "./private-demo";

import { env } from "@/lib/env";

export default async function PrivateDemoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <PrivateDemo publicToken={token} retailerAppUrl={env.retailerAppUrl} />
  );
}
