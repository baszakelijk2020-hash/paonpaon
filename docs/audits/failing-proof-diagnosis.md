# Failing Proof Diagnosis

**Task:** t9b-failing-proof-diagnosis
**SHA (current HEAD):** `15e2e17`
**Date:** 2026-08-15
**Tier:** LIGHT (static reading + DB schema analysis only — no Playwright run)

---

## Failure 1 — Mission Control Decision Feed (17.2)

### Failing assertion

**Spec:** `apps/retailer/e2e/mission-control.spec.ts`
**Line 582:**

```
await expect(
  decisionFeed.getByRole("heading", { name: "What's next" }),
).toBeVisible();
```

### Corresponding app source

**Page:** `apps/retailer/app/(dashboard)/mission-control/page.tsx`
**Line 342-344:**

```tsx
{decisionFeedEntries.length > 0 ? (
  <Card
    id="mission-control-decision-feed"
    ...
  >
    <h2>What&rsquo;s next</h2>
```

The `Card#mission-control-decision-feed` HTML element exists in the source but is only rendered when `decisionFeedEntries.length > 0`.

### Suspected precondition

`composeDecisionFeed` (`packages/database/src/repositories/decision-feed-repository.ts`) returns an empty array. The test seeds a draft clienteling opportunity and a today-appointment 30 min in the future — both conditions that should pass the filter in `composeDecisionFeed`. The `isToday` helper (lines 147-153) compares UTC dates:

```ts
function isToday(isoDate: string, now: Date): boolean {
  return (
    target.getUTCFullYear() === now.getUTCFullYear() &&
    target.getUTCMonth() === now.getUTCMonth() &&
    target.getUTCDate() === now.getUTCDate()
  );
}
```

**Most likely cause (timezone boundary):** The appointment created 30 min from now uses `new Date(startsAt.getTime()).toISOString()` for storage. If the test runs near UTC midnight (local evening in many timezones), `startsAt.toISOString()` may fall on a different UTC date than `now` — making `isToday` return `false` and dropping the only appointment entry, leaving only the opportunity. One entry (`length === 1`) still satisfies `decisionFeedEntries.length > 0`, but the second assertion `await expect(feedItems).toHaveCount(2)` would also fail.

**Alternative (RLS visibility):** `composeDecisionFeed` uses the `supabase` server client (logged-in session from SSR, not service_role). If any of the five parallel data source queries returns empty due to RLS restricting the seeded records, the feed is truncated. However, other page queries against the same client (`findByRetailer` for appointments) work for the first test in the same spec, making this less likely for the appointment source — but `listForRetailer` for clienteling opportunities is a different query path, and RLS could affect it differently.

**Cause not fully established without a live run** to inspect the exact return value of `composeDecisionFeed` and which entries (if any) it produces at the actual test timestamp.

---

## Failure 2 — Channel Contact (17.9)

### Failing assertion

**Spec:** `apps/retailer/e2e/channel-contact.spec.ts`
The brief states: "the run reported 3 passed yet the artifact recorded failed."

The test file has two tests, not three — both set module-level flags (`customerCardProofPassed`, `sharedThreadProofPassed`). The `afterAll` writes status based on `customerCardProofPassed && sharedThreadProofPassed`.

### Corresponding app source

**Line 13-16:**

```ts
let customerCardProofPassed = false;
let sharedThreadProofPassed = false;
```

**Line 18-23 (`afterAll`):**

```ts
test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status:
      customerCardProofPassed && sharedThreadProofPassed ? "passed" : "failed",
  });
});
```

Unlike `mission-control.spec.ts` which wraps its tests in `test.describe.serial(...)` to prevent parallel worker splitting, **`channel-contact.spec.ts` has no `test.describe.serial()` wrapper**. The two tests are registered at the top level.

### Suspected precondition

**Parallel worker race (same pattern the mission-control spec already documents and fixed).** Under Playwright's default `fullyParallel: true` (or the config's default parallel execution), the two tests may run in separate worker processes with separate module instances. Each worker's `afterAll` sees only the flag from the test that ran in that worker:

- Worker 1 runs test 1 → `customerCardProofPassed = true`, `sharedThreadProofPassed` is still `false` in this module instance → `afterAll` writes `"failed"`.
- Worker 2 runs test 2 → `sharedThreadProofPassed = true`, `customerCardProofPassed` is still `false` in this module instance → `afterAll` writes `"failed"`.

Both assertions individually pass. The proof artifact records `failed` because no single worker sees both flags as `true`.

The "3 passed" in the reported run likely includes a Playwright retry (third execution) that also passed individually but could not combine the flags.

This is the identical bug that the mission-control spec fixed by using `test.describe.serial`. See the comment in `mission-control.spec.ts` lines 62-72 which explains the exact same mechanism.

---

## Failure 3 — Prospect AI Conversation (17.14)

### Failing assertion

**Spec:** `apps/retailer/e2e/prospect-ai-conversation.spec.ts`
**Line 336-339:**

```ts
const widget = page.locator("#gilda-chat-widget");
await page.getByRole("button", { name: "Ask us anything" }).click();
await expect(widget).toBeVisible();
```

`#gilda-chat-widget` never becomes visible after clicking the "Ask us anything" button.

### Corresponding app source

The toggle button is at `apps/customer/app/r/[slug]/table-service-widget.tsx` **line 780-785:**

```tsx
<button
  type="button"
  onClick={() => setOpen((value) => !value)}
  aria-expanded={open}
  aria-label="Contact us"
  className="rounded-[var(--radius-md)] ..."
>
  {open ? "Close" : "Ask us anything"}
</button>
```

The `#gilda-chat-widget` container is rendered at line 444 only when `open === true` (line 442: `{open ? (`).

### Suspected precondition

**Accessible name mismatch due to `aria-label`.** The button's **visible text** is `"Ask us anything"`, but the button has `aria-label="Contact us"`. In the Accessibility Tree, `aria-label` overrides child text content for the computed accessible name. Playwright's `getByRole("button", { name: "Ask us anything" })` matches against the **computed accessible name**, which is `"Contact us"` — not `"Ask us anything"`.

The locator `page.getByRole("button", { name: "Ask us anything" })` fails to find the toggle button. The click never lands on the button (or times out searching), `setOpen(true)` is never called, `#gilda-chat-widget` remains unmounted, and the `await expect(widget).toBeVisible()` assertion times out.

**Fix required:** Change the locator to match `aria-label="Contact us"` — e.g., `page.getByRole("button", { name: "Contact us" })` — or remove the `aria-label` so the accessible name falls back to the visible text `"Ask us anything"`.

---

## Summary

| #   | PHASE | Spec                             | Failing line   | Root cause                                                                                                                                                                             |
| --- | ----- | -------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 17.2  | mission-control.spec.ts          | 582            | `composeDecisionFeed` returns empty — suspected UTC midnight boundary on `isToday` or RLS filtering seeded data differently via server client. Not fully established without live run. |
| 2   | 17.9  | channel-contact.spec.ts          | n/a (afterAll) | Module-level proof flags in parallel workers — missing `test.describe.serial` wrapper. Same pattern as the mission-control fix.                                                        |
| 3   | 17.14 | prospect-ai-conversation.spec.ts | 336            | `aria-label="Contact us"` overrides visible text in accessible name. `getByRole("button", { name: "Ask us anything" })` cannot locate the toggle button. Widget never opens.           |

No spec or app files were modified as part of this diagnosis.
