import { ForbiddenError } from "@paon/auth";
import { AlterationTaskRepository } from "@paon/database";
import { retailerRoleHasAlterationsPermission } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";
import Link from "next/link";

import { TaskMove } from "./task-move";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const metadata = { title: "Workbench" };

const COLUMNS = [
  {
    key: "todo",
    title: "To do",
    statuses: ["approved", "assigned"],
    next: "in_progress",
  },
  {
    key: "doing",
    title: "In progress",
    statuses: ["in_progress"],
    next: "review_ready",
  },
  {
    key: "review",
    title: "Ready for review",
    statuses: ["review_ready"],
    next: null,
  },
] as const;

/**
 * The workshop's own screen: every open task the signed-in person may work,
 * by stage, with one tap to start it or hand it to review. Workers see only
 * their assigned tasks and no prices (the worker views); managers see the
 * whole floor.
 */
export default async function WorkbenchPage() {
  const session = await requireModuleSession("garment_service_operations");
  const mayWork = (
    ["oversight", "manage_assigned_workshop", "work_assigned_tasks"] as const
  ).some((permission) =>
    retailerRoleHasAlterationsPermission(session.retailerRole, permission),
  );
  if (!mayWork) throw new ForbiddenError();

  const tasks = await new AlterationTaskRepository(
    await getSupabaseServerClient(),
  ).findOpenForBench({ worker: session.retailerRole === "worker" });

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-7 text-white sm:p-10">
        <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-white/60">
          Workshop floor
        </p>
        <h1 className="font-display mt-4 text-3xl leading-none sm:text-4xl">
          Workbench
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/70">
          {tasks.length === 0
            ? "Nothing open on the bench."
            : `${tasks.length} open task${tasks.length === 1 ? "" : "s"}. Start one, then hand it to review when it is done.`}
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const items = tasks.filter((task) =>
            (column.statuses as readonly string[]).includes(task.status),
          );
          return (
            <section
              key={column.key}
              aria-labelledby={`bench-${column.key}`}
              className="flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between">
                <p
                  id={`bench-${column.key}`}
                  className="font-accent text-[11px] uppercase tracking-[0.14em] text-[var(--color-stone-500)]"
                >
                  {column.title}
                </p>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-200)] p-5 text-sm text-[var(--color-stone-500)]">
                  Nothing here.
                </p>
              ) : (
                items.map((task) => (
                  <Card
                    key={task.id}
                    data-pe-card
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-medium">{task.title}</h2>
                        <p className="mt-1 text-xs text-[var(--color-stone-500)]">
                          {[task.workOrderNumber, task.garment]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {task.dueDate ? (
                        <span className="shrink-0 text-xs text-[var(--color-stone-500)]">
                          Due {formatDate(task.dueDate, "en-US")}
                        </span>
                      ) : null}
                    </div>
                    {task.instructions ? (
                      <p className="whitespace-pre-line text-sm text-[var(--color-stone-600)]">
                        {task.instructions}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      {column.next ? (
                        <TaskMove
                          taskId={task.id}
                          alterationId={task.alterationId}
                          next={column.next}
                        />
                      ) : (
                        <span className="text-xs text-[var(--color-stone-500)]">
                          Waiting for review
                        </span>
                      )}
                      <Link
                        href={`/alterations/${task.alterationId}`}
                        className="text-sm underline underline-offset-4"
                      >
                        Open work order
                      </Link>
                    </div>
                  </Card>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
