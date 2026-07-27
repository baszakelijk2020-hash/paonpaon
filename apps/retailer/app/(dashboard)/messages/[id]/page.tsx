import { redirect } from "next/navigation";

/** The inbox is now the single 3-pane `/messages` page (list + thread +
 * customer context) selected via `?c=<conversationId>`, not a separate
 * page per conversation — this keeps old links/bookmarks working. */
export default async function ConversationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/messages?c=${id}`);
}
