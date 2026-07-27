import { NotificationRepository } from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { markNotificationRead } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";
export default async function NotificationsPage() {
  const session = await requireSession();
  const items = await new NotificationRepository(
    await getSupabaseServerClient(),
  ).findByUser(session.userId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Updates</h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Customer and operational notifications.
        </p>
      </div>
      <Card className="divide-y overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-[var(--shadow-elevated)]">
        {items.map((item) => (
          <div
            key={item.id}
            className={`px-6 py-4 ${item.readAt ? "opacity-60" : ""}`}
          >
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-[var(--color-stone-600)]">
                  {item.body}
                </p>
                <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                  {formatDate(item.createdAt, "en-US")}
                </p>
              </div>
              <div className="flex gap-2">
                {item.actionHref ? (
                  <Link href={item.actionHref} className="text-sm underline">
                    Open
                  </Link>
                ) : null}
                {!item.readAt ? (
                  <form action={markNotificationRead}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={item.id}
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      Read
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-500)]">
            No updates.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
