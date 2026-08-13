"use client";

import { Button } from "@paon/ui/components/Button";
import { useState } from "react";

import {
  dispatchAlterationGridSnapshot,
  saveAlterationGridSnapshot,
} from "@/app/(dashboard)/alterations/[id]/actions";

type Operation = {
  id: string;
  name: string;
  price?: number;
  currency?: string;
};
type Snapshot = {
  id: string;
  version: number;
  values: Array<{ operationId: string; value: number }>;
  comments?: string;
  createdAt: string;
};
const positive = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const negative = [0, -0.5, -1, -1.5, -2, -2.5, -3, -3.5, -4, -4.5, -5];

export function Ft04AlterationGrid({
  alterationId,
  operations,
  snapshots,
  canEdit,
  canDispatch,
}: {
  alterationId: string;
  operations: Operation[];
  snapshots: Snapshot[];
  canEdit: boolean;
  canDispatch: boolean;
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(operations.map((o) => [o.id, 0])),
  );
  const [comments, setComments] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string>();
  const current = snapshot ?? snapshots[0] ?? null;
  const shown = snapshot
    ? Object.fromEntries(snapshot.values.map((v) => [v.operationId, v.value]))
    : values;
  async function save() {
    setError(undefined);
    const result = await saveAlterationGridSnapshot({
      alterationId,
      values: operations.map((o) => ({
        operationId: o.id,
        value: values[o.id] ?? 0,
      })),
      comments,
    });
    if (result.error) setError(result.error);
    else window.location.reload();
  }
  async function dispatch() {
    if (!current) return;
    setDispatching(true);
    const selected = operations
      .filter((o) => (shown[o.id] ?? 0) !== 0)
      .map((o) => o.id);
    const result = await dispatchAlterationGridSnapshot({
      alterationId,
      snapshotId: current.id,
      selectedOperationIds: selected,
      comments,
    });
    setDispatching(false);
    if (result.error) setError(result.error);
    else window.location.reload();
  }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-stone-200)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">First-fitting alteration grid</h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            Saved versions are immutable. Revisions require alterations
            management.
          </p>
        </div>
        {current ? (
          <span className="text-sm font-medium">
            Locked version {current.version}
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2">
        {operations.map((op) => {
          const value = shown[op.id] ?? 0;
          return (
            <div
              key={op.id}
              className="grid grid-cols-[1fr_7rem_7rem] items-center gap-2 border-b border-[var(--color-stone-100)] py-2"
            >
              <span className="text-sm font-medium">{op.name}</span>
              <select
                aria-label={`${op.name} positive`}
                disabled={!canEdit || Boolean(snapshot)}
                value={value > 0 ? value : 0}
                onChange={(e) =>
                  setValues({ ...values, [op.id]: Number(e.target.value) })
                }
                className={
                  value > 0
                    ? "rounded border border-emerald-500 px-2 py-1 font-medium"
                    : "rounded border px-2 py-1 text-stone-400"
                }
              >
                {positive.map((n) => (
                  <option key={n} value={n}>
                    {n ? `+${n.toFixed(1)}` : "0"}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${op.name} negative`}
                disabled={!canEdit || Boolean(snapshot)}
                value={value < 0 ? value : 0}
                onChange={(e) =>
                  setValues({ ...values, [op.id]: Number(e.target.value) })
                }
                className={
                  value < 0
                    ? "rounded border border-amber-500 px-2 py-1 font-medium"
                    : "rounded border px-2 py-1 text-stone-400"
                }
              >
                {negative.map((n) => (
                  <option key={n} value={n}>
                    {n ? n.toFixed(1) : "0"}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {!snapshot && canEdit ? (
        <>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="mt-4 w-full rounded border p-2 text-sm"
            placeholder="Fitting notes (optional)"
          />
          <Button className="mt-3" onClick={save}>
            Save immutable snapshot
          </Button>
        </>
      ) : null}
      {current && canDispatch ? (
        <div className="mt-4 rounded bg-black p-4 text-white">
          <p className="text-sm">
            Selective work-order flow: only non-zero values will be dispatched
            at their current fixed price.
          </p>
          <Button
            className="mt-3"
            onClick={dispatch}
            disabled={dispatching || operations.every((o) => !shown[o.id])}
          >
            {dispatching ? "Dispatching…" : "Dispatch selected alterations"}
          </Button>
        </div>
      ) : null}
      {snapshots.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {snapshots.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSnapshot(item)}
              className="rounded border px-3 py-2 text-left text-sm"
            >
              Version {item.version}
              <br />
              <span className="text-xs text-stone-500">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
