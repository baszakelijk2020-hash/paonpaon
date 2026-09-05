import { redirect } from "next/navigation";

/**
 * Kept only so existing links and already-sent invite emails still land
 * somewhere useful. The Manager, Employee and Customer portals now share the
 * single sign-in at /login, which reads the account's own claims and routes it
 * to the right portal — see app/login/actions.ts. This page used to ask the
 * person to know in advance which of three front doors applied to them.
 */
export default async function ManagerLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  redirect(error ? `/login?error=${encodeURIComponent(error)}` : "/login");
}
