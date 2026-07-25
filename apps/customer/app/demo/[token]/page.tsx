import { PrivateDemo } from "./private-demo";

export default async function PrivateDemoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PrivateDemo publicToken={token} />;
}
