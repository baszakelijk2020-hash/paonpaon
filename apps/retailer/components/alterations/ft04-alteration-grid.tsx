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
  canRevise,
  canDispatch,
}: {
  alterationId: string;
  operations: Operation[];
  snapshots: Snapshot[];
  canEdit: boolean;
  canRevise: boolean;
  canDispatch: boolean;
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(operations.map((o) => [o.id, 0])),
  );
  const [comments, setComments] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [isRevising, setIsRevising] = useState(false);
  const [isWorkOrderOpen, setIsWorkOrderOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string>();
  const current = snapshot ?? snapshots[0] ?? null;
  const shown =
    snapshot && !isRevising
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
    const selectedOperationIds = [...selected];
    const result = await dispatchAlterationGridSnapshot({
      alterationId,
      snapshotId: current.id,
      selectedOperationIds,
      comments,
    });
    setDispatching(false);
    if (result.error) setError(result.error);
    else window.location.reload();
  }
  function beginRevision() {
    if (!current) return;
    setValues(
      Object.fromEntries(
        current.values.map((value) => [value.operationId, value.value]),
      ),
    );
    setComments(current.comments ?? "");
    setIsRevising(true);
    setSnapshot(null);
  }
  const selectable = operations.filter(
    (operation) => (shown[operation.id] ?? 0) !== 0,
  );
  const selectedOperations = selectable.filter((operation) =>
    selected.has(operation.id),
  );
  const selectedHasUnavailablePrice = selectedOperations.some(
    (operation) => operation.price === undefined,
  );
  const selectedTotal = selectedOperations.reduce(
    (total, operation) => total + (operation.price ?? 0),
    0,
  );
  const selectedCurrency = selectedOperations.find(
    (operation) => operation.currency,
  )?.currency;
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Locked version {current.version}
            </span>
            {canRevise ? (
              <Button type="button" variant="secondary" onClick={beginRevision}>
                Unlock and revise
              </Button>
            ) : null}
          </div>
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
                disabled={!canEdit || (Boolean(snapshot) && !isRevising)}
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
                disabled={!canEdit || (Boolean(snapshot) && !isRevising)}
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
      {(!snapshot || isRevising) && canEdit ? (
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
        <Button
          className="mt-4"
          onClick={() => {
            setSelected(new Set());
            setIsWorkOrderOpen(true);
          }}
          disabled={selectable.length === 0}
        >
          Create selective work order
        </Button>
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
      {isWorkOrderOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Selective alteration work order"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-[var(--radius-lg)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium">Selective work order</h3>
                <p className="text-sm text-[var(--color-stone-500)]">
                  Choose the non-zero alterations to send to the workshop queue.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close work order"
                onClick={() => setIsWorkOrderOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {selectable.map((operation) => {
                const value = shown[operation.id] ?? 0;
                const checked = selected.has(operation.id);
                return (
                  <label
                    key={operation.id}
                    className={
                      checked
                        ? "flex cursor-pointer items-center justify-between rounded border border-[var(--color-stone-900)] bg-[var(--color-stone-100)] p-3"
                        : "flex cursor-pointer items-center justify-between rounded border p-3"
                    }
                  >
                    <span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelected((existing) => {
                            const next = new Set(existing);
                            if (next.has(operation.id))
                              next.delete(operation.id);
                            else next.add(operation.id);
                            return next;
                          })
                        }
                      />{" "}
                      <strong className="ml-2">{operation.name}</strong>{" "}
                      <span className="ml-2">
                        {value > 0 ? `+${value}` : value}
                      </span>
                    </span>
                    <span>
                      {operation.price !== undefined
                        ? `${(operation.price / 100).toFixed(2)} ${operation.currency ?? ""}`
                        : "Price unavailable"}
                    </span>
                  </label>
                );
              })}
            </div>
            <textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              className="mt-4 w-full rounded border p-2 text-sm"
              placeholder="Order number, workshop comments, and photo references"
            />
            <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-stone-100)] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">Fixed-price total</span>
                <output className="text-lg font-semibold" aria-live="polite">
                  {selectedHasUnavailablePrice
                    ? "Unavailable"
                    : `${(selectedTotal / 100).toFixed(2)} ${selectedCurrency ?? ""}`}
                </output>
              </div>
              {selectedHasUnavailablePrice ? (
                <p className="mt-2 text-sm text-red-700">
                  A selected alteration has no current fixed price and cannot be
                  dispatched.
                </p>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsWorkOrderOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={dispatch}
                disabled={
                  dispatching ||
                  selected.size === 0 ||
                  selectedHasUnavailablePrice
                }
              >
                {dispatching
                  ? "Dispatching…"
                  : `Dispatch ${selected.size} alteration${selected.size === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
