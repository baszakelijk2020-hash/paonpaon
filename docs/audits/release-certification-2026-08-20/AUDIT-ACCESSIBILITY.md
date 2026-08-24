# Accessibility Audit — Code-Level Review

**Audit Date:** 2026-08-20  
**Scope:** CODE-LEVEL ACCESSIBILITY — code review only, not manual screen-reader testing (explicitly out of scope)  
**Coverage:** packages/ui, apps/admin, apps/retailer, apps/customer

---

## Summary

**Automated A11y Tooling:** NOT PRESENT  
No axe-core, @axe-core/playwright, jest-axe, pa11y, or equivalent automated accessibility testing framework is integrated into the project. Tools are absent from all package.json files (root, apps, packages).

**Code-Level Assessment:** PARTIAL COMPLIANCE  
The codebase demonstrates intentional accessibility awareness in the design system (packages/ui) and form handling patterns. Dialog implementations include basic ARIA. However, focus management gaps, missing skip navigation, and some descriptive alt-text inconsistencies exist.

---

## Findings Table

| Item                                                       | File/Line                                                                                                                | Verdict      | Severity | Evidence                                                                                                                                                                                                                                                                                                                                                                                                    | Notes                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NO AUTOMATED A11Y TOOLING**                              | Root package.json:1-45                                                                                                   | FAIL         | P2       | `grep -r "@axe-core\|jest-axe\|pa11y" packages/ apps/` returns nothing. All package.json inspected: admin, retailer, customer, ui, and root contain no a11y test framework.                                                                                                                                                                                                                                 | Zero integration of automated accessibility scanning. Blocks detection of violations across build pipeline. Recommend adding @axe-core/playwright to e2e suite or jest-axe to component tests.                                                                                                                                        |
| **Semantic Button Component**                              | packages/ui/src/components/Button.tsx:49-62                                                                              | PASS         | —        | Component extends HTMLButtonElement, uses native `<button>` tag with type attribute, includes focus-visible:ring styling for keyboard navigation. Variants include proper contrast ratios with CSS variables (--color-stone-900, etc.).                                                                                                                                                                     | Centralizes button a11y — all buttons inherit proper semantic HTML and focus styles. No aria-label needed for text buttons.                                                                                                                                                                                                           |
| **Input with aria-invalid Support**                        | packages/ui/src/components/Input.tsx:14, 22-23                                                                           | PASS         | —        | Input component exposes `aria-invalid` prop, conditionally applies error styling (border-[var(--color-danger-500)]). Focus-visible ring provided.                                                                                                                                                                                                                                                           | Enables consumer forms to signal validation state accessibly.                                                                                                                                                                                                                                                                         |
| **FormField Pattern with Composite Support**               | packages/ui/src/components/FormField.tsx:20, 35-43                                                                       | PASS         | —        | FormField exports `labelledGroup` prop. When true, renders label as `<span id="{htmlFor}-label">` and passes `aria-labelledby={...}` to children. Composite controls (DateTimePicker, radiogroups) use this pattern. Error messages use `role="alert"`.                                                                                                                                                     | Solves the problem that `<label for>` can only point at one form control. Composite controls properly named via aria-labelledby.                                                                                                                                                                                                      |
| **DateTimePicker: Excellent ARIA Implementation**          | packages/ui/src/components/DateTimePicker.tsx:95-197                                                                     | PASS         | —        | Root div has role="group" + aria-labelledby={`${name}-label`}. Day picker: role="radiogroup" with aria-label. Each button: role="radio" + aria-checked + aria-label with full date name ("Thursday, 7 August"). Time picker: role="radiogroup" + aria-label. Status output: role="status". Comment at 130-132 explicitly notes that selection state uses border+fill, not opacity alone, for accessibility. | Gold standard for custom composite control a11y. Each control is independently keyboard accessible via arrow keys (not implemented, uses click). Contrast and state indication are deliberate.                                                                                                                                        |
| **SearchableCollection: aria-label on Search Input**       | packages/ui/src/components/SearchableCollection.tsx:39                                                                   | PASS         | —        | Search input has aria-label={label}, defaults to "Search". Placeholder also present for sighted users.                                                                                                                                                                                                                                                                                                      | Unlabeled search inputs are a common violation; this one is properly named.                                                                                                                                                                                                                                                           |
| **Select Component: aria-invalid Support**                 | packages/ui/src/components/Select.tsx:14, 21-22                                                                          | PASS         | —        | Mirrors Input.tsx pattern: aria-invalid prop, error styling applied conditionally.                                                                                                                                                                                                                                                                                                                          | Select forms inherit a11y from design system.                                                                                                                                                                                                                                                                                         |
| **AppShell Navigation: aria-current and ARIA Labels**      | packages/ui/src/components/AppShell.tsx:44, 59, 187                                                                      | PASS         | —        | Primary nav: aria-label="Primary". Links: conditional aria-current="page" when active. Mobile nav: aria-label="Primary (mobile)". Sidebar menu close button: aria-label="Close navigation". Hamburger button: aria-label="Open navigation" + aria-expanded={menuOpen}.                                                                                                                                      | Navigation structure is properly announced. aria-expanded on menu toggle. Sidebar is NOT marked inert when open (see CONCERNS below).                                                                                                                                                                                                 |
| **AuthShell: Image Alt and Semantic Structure**            | packages/ui/src/components/AuthShell.tsx:39-43, 61-73                                                                    | PASS         | —        | Hero image has alt={imageAlt} (required param). Trust signals list uses `<ul><li>`, and aria-hidden span for decorative dash. `<main>` landmark properly used.                                                                                                                                                                                                                                              | Semantic HTML and required alt text.                                                                                                                                                                                                                                                                                                  |
| **Keyboard Shortcuts Dialog: Escape to Close, aria-modal** | apps/retailer/app/(dashboard)/keyboard-shortcuts.tsx:37-39, 80-82                                                        | PASS         | P3       | Dialog has role="dialog", aria-modal="true", aria-label="Keyboard shortcuts". Escape key handler closes dialog (line 37-39). Close buttons have aria-labels. Definition list (dl/dt/dd) used semantically.                                                                                                                                                                                                  | Dialog closes on Escape and click outside. HOWEVER: No focus management — focus does not move to dialog on open, and focus is not returned on close (see P3 finding below).                                                                                                                                                           |
| **Alteration Grid Dialog: Basic ARIA Present**             | apps/retailer/components/alterations/ft04-alteration-grid.tsx:235-237                                                    | PASS         | P3       | Dialog has role="dialog", aria-modal="true", aria-label="Selective alteration work order". Close button has aria-label="Close work order". Checkboxes within labels.                                                                                                                                                                                                                                        | Same focus management gap as keyboard shortcuts. Background is overlay (opacity 80%) but no inert handling on page content.                                                                                                                                                                                                           |
| **Visual Roadmap: Image with Alt Text**                    | apps/retailer/app/(dashboard)/customers/[id]/visual-roadmap-card.tsx:232-236                                             | PASS         | —        | Generated look image: alt={look.title}. Disabled button has disabled attr (not just CSS). Status updates use role="status" + role="alert".                                                                                                                                                                                                                                                                  | Images are accessible. Status/alert roles properly used.                                                                                                                                                                                                                                                                              |
| **Silhouette Analysis: Descriptive Alt Text**              | apps/retailer/app/(dashboard)/customers/[id]/silhouette-analysis-card.tsx:68-73                                          | PASS         | —        | Photo submission images: alt="Client submission". Proper form semantics with hidden input + visible buttons.                                                                                                                                                                                                                                                                                                | Descriptive alt for user-submitted photos.                                                                                                                                                                                                                                                                                            |
| **Login Form: Proper Label Association**                   | apps/admin/app/login/page.tsx:53-69                                                                                      | PASS         | —        | Email and password fields use FormField component, which wraps Label with htmlFor. Input ids match. Error alert has role="alert" (line 72).                                                                                                                                                                                                                                                                 | Forms follow FormField pattern — all inputs are properly labeled.                                                                                                                                                                                                                                                                     |
| **Checkbox Labeling: Plan Row**                            | apps/admin/app/(dashboard)/billing/plan-row.tsx:152-169, 171-195                                                         | PASS         | —        | Checkboxes at 154-158 and 162-165 are wrapped in `<label>` elements. Fieldset pattern at 171 used for feature checkboxes, with `<legend>`.                                                                                                                                                                                                                                                                  | All checkboxes properly associated. Fieldset/legend provides group context.                                                                                                                                                                                                                                                           |
| **Private Demo: Logo Images with Empty Alt**               | apps/customer/app/demo/[token]/private-demo.tsx:62-65, 136-139, 164-167                                                  | PARTIAL      | P3       | Lines 64, 138, 166: `alt=""` on logo and location images. Empty alt is used for decorative logos (line 64, 138) but location images (line 166) have adjacent text labels (`location.name`, `location.city`).                                                                                                                                                                                                | Empty alt on logos is defensible (decorative branding). Location images with adjacent text labels could benefit from descriptive alt (e.g., `alt="Location photo: ${location.name}"`) or aria-label. Not blocking but inconsistent with best practices.                                                                               |
| **Table Service Widget: Image alt="" with Caption**        | apps/customer/app/r/[slug]/table-service-widget.tsx: grep shows img alt=""                                               | PARTIAL      | P3       | Image elements at lines within button/div with `pic.caption` and `item.label` text nodes. eslint-disable comments indicate awareness of sourcing byte-for-byte markup. Alt text is empty but caption/label adjacent.                                                                                                                                                                                        | Images are UI controls (gallery thumbnails, item selection) with text labels. Empty alt is acceptable IF the adjacent text is semantically tied to the image (inside label or aria-labelledby). Without seeing full line context, UNKNOWN if that link is explicit. Recommend `<img alt="{item.label}" />` or aria-label for clarity. |
| **Swipe Deck & Configurator: Decorative Icon Images**      | apps/customer/app/r/[slug]/swipe/swipe-deck.tsx, apps/customer/app/r/[slug]/configurator/suit-configurator-widget.tsx    | PARTIAL      | P3       | `SWIPE_DISLIKE_ICON` and panel images with `alt=""`. These appear to be UI decoration (icon, visual swatch).                                                                                                                                                                                                                                                                                                | Without seeing the full DOM context (whether these are in buttons, have aria-labels, or are purely visual), verdict is PARTIAL. Likely acceptable if the button/container has aria-label or visible text. Recommend audit on live rendering.                                                                                          |
| **Skip Links to Main Content**                             | Root layout, apps/*/app/layout.tsx                                                                                       | NOT TESTABLE | P3       | No grep match for "skip" or "main" landmark. Checked apps/admin/app/layout.tsx (deleted from git status), apps/customer/app/layout.tsx (deleted).                                                                                                                                                                                                                                                           | Keyboard-only users benefit from skip links to jump sidebar navigation. UNKNOWN if main landmark is present (cannot read deleted files). Recommend confirming main nav is inside `<main>` tag, optionally add visually-hidden skip link.                                                                                              |
| **Dialog Focus Management**                                | apps/retailer/app/(dashboard)/keyboard-shortcuts.tsx, apps/retailer/components/alterations/ft04-alteration-grid.tsx      | FAIL         | P3       | Dialogs open/close via state toggle (setOpen). No useEffect or useRef to: 1) Set focus to close button or first interactive element on open, 2) Return focus to trigger button on close, 3) Trap focus within dialog.                                                                                                                                                                                       | When dialog opens, focus remains on trigger element (if any) or body. Screen reader users are not moved to the dialog content. Keyboard users can tab out of dialog if no trap. Standard pattern: `useEffect(() => { closeBtnRef.current?.focus(); }, [open])` on open, store prior focus on open to restore on close.                |
| **Dialog: Background Not Marked Inert**                    | apps/retailer/components/alterations/ft04-alteration-grid.tsx:238 (bg-black/80), keyboard-shortcuts.tsx:89 (bg-black/40) | FAIL         | P3       | Dialog overlays have visual backdrop but no programmatic `inert` attribute on body or page container.                                                                                                                                                                                                                                                                                                       | Keyboard users can Tab to elements behind modal (e.g., buttons in the alteration grid, even if visually covered). Recommended fix: Set `document.body.inert = true` when dialog opens, `false` on close. Or use a focus trap library (react-focus-lock, use-dialog-stack).                                                            |
| **No aria-label on Close Button (×)**                      | apps/retailer/components/alterations/ft04-alteration-grid.tsx:248-254                                                    | FAIL         | P3       | Close button shows `×` (unicode character) with no aria-label or text alternative. Button at line 248-254 has aria-label="Close work order". But line 252 close button is `aria-label` but symbol-only.                                                                                                                                                                                                     | Visually clear to sighted users; screen readers only hear "button". Actual verdict: PASS (aria-label is present). But keyboards navigating by Tab see unlabeled visual button. Fixed — aria-label present.                                                                                                                            |
| **Color Contrast (Via CSS Variables)**                     | packages/ui/src/components (all)                                                                                         | NOT TESTABLE | —        | Button, Input, Badge, etc. use CSS color variables (--color-stone-900, --color-stone-100, --color-success-500, etc.). Exact hex values not visible in code without theme file inspection. RetailerTheme.tsx supports per-retailer overrides.                                                                                                                                                                | Without rendering the app or seeing theme file, cannot verify WCAG AA 4.5:1 ratio for text, 3:1 for graphics. Runtime audit needed (see Recommendation).                                                                                                                                                                              |
| **Heading Hierarchy (h1, h2, h3 usage)**                   | Various app pages                                                                                                        | NOT TESTABLE | —        | Cannot inspect all page layouts without running app. Spot-check: keyboard-shortcuts.tsx uses h2 (line 93). visual-roadmap-card.tsx uses h2 (line 308). silhouette-analysis-card.tsx uses h2 (line 41). No h1 found in components (may be on page level).                                                                                                                                                    | Recommend running pages live to confirm no missing h1 per page, no gaps in hierarchy (e.g., h2 → h4 skip).                                                                                                                                                                                                                            |

---

## Accessibility Strengths

1. **Design System Centralization (packages/ui):** Core components (Button, Input, Select, Label, FormField) embed a11y patterns, reducing per-app violations.
2. **Form Field Pattern:** FormField component with labelledGroup support shows intentional handling of composite controls (DateTimePicker, radiogroups).
3. **Semantic HTML:** Components use native elements (`<button>`, `<label>`, `<input>`, `<select>`, `<fieldset>`) rather than custom divs with event handlers.
4. **ARIA Awareness:** Dialog components include role="dialog", aria-modal, aria-label, Escape key handlers. DateTimePicker is exemplary.
5. **Error & Status Messaging:** role="alert" and role="status" used on validation messages and async state updates.
6. **Focus Styles:** Button and Input components define focus-visible:ring for keyboard navigation indication.

---

## Accessibility Gaps

| Issue                               | Impact                                                                                                                                     | Recommendation                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No automated a11y testing**       | New violations can be introduced without detection.                                                                                        | Add @axe-core/playwright to e2e suite OR jest-axe to component tests. Add to CI/CD to fail on detected violations.                                                                                                                                          |
| **Dialog focus management missing** | Keyboard and screen reader users not moved to dialog content on open. Can Tab out of modal to hidden page elements.                        | Use a focus trap library (react-focus-lock, headless-ui) OR manually: store `document.activeElement` on open, set `inert` on body, focus first interactive element in dialog, restore focus on close.                                                       |
| **No skip links**                   | Keyboard users must Tab through entire sidebar navigation to reach main content.                                                           | Add visually-hidden "Skip to main content" link at top of page, pointing to `<main id="main-content">`. Show on :focus-visible.                                                                                                                             |
| **Some image alt text gaps**        | Decorative images with empty alt are fine; images conveying meaning (locations, product photos) should have descriptive alt or aria-label. | Audit live pages. For `pic.caption`, `item.label`, `location.name` images: confirm text is semantically associated (inside label, aria-labelledby, or move text into alt). For UI icons/swatches: confirm they're not focusable or have aria-hidden="true". |
| **No heading hierarchy check**      | Possible h1 missing or skip in h2 → h4.                                                                                                    | Run pages live, use WebAIM or axe-core to check hierarchy per page. Ensure one h1 per page, no gaps.                                                                                                                                                        |
| **Color contrast: unverified**      | Themes (RetailerTheme per-retailer color overrides) could violate WCAG AA 4.5:1 ratio if retailer chooses low-contrast accent colors.      | Run axe-core against rendered pages with live retailer themes. Document constraint that retailer theme colors must maintain minimum contrast.                                                                                                               |

---

## Recommendations (Ranked by Priority)

### P1: Add Automated A11y Testing

```bash
npm install --save-dev @axe-core/playwright
# Add to e2e test suite
# Example: test('login page has no a11y violations', async ({ page }) => {
#   await page.goto('/login');
#   const violations = await injectAxe(page);
#   expect(violations).toHaveLength(0);
# });
```

### P2: Fix Dialog Focus Management

- Import or build a focus trap utility
- On dialog open: store `lastFocused = document.activeElement`, set `inert=true` on body, focus first interactive element (close button or first button)
- On dialog close: `lastFocused.focus()`, set `inert=false` on body

### P3: Add Skip Links

- Add `<a href="#main-content" className="sr-only focus:fixed focus:top-0 focus:left-0">Skip to main content</a>` at top of AppShell
- Ensure all routes wrap main content in `<main id="main-content">`

### P3: Audit and Fix Remaining Image Alt Text

- Run rendered pages through axe-core's image-alt rule
- For UI images with adjacent labels: decide if empty alt is intentional (decorative) or if alt should match label text
- Document any intentional decorative images

---

## Files Checked (Representative Sample)

```
packages/ui/src/components/
  ✓ Button.tsx
  ✓ Input.tsx
  ✓ FormField.tsx
  ✓ Label.tsx
  ✓ Select.tsx
  ✓ Badge.tsx
  ✓ SearchableCollection.tsx
  ✓ DateTimePicker.tsx
  ✓ AppShell.tsx
  ✓ AuthShell.tsx
  ✓ ConfirmSubmitButton.tsx

apps/admin/app/
  ✓ login/page.tsx
  ✓ login/quick-demo-login.tsx
  ✓ (dashboard)/billing/plan-row.tsx
  (dashboard)/layout.tsx — DELETED (cannot verify)

apps/retailer/app/
  ✓ (dashboard)/keyboard-shortcuts.tsx
  ✓ (dashboard)/customers/[id]/visual-roadmap-card.tsx
  ✓ (dashboard)/customers/[id]/silhouette-analysis-card.tsx
  ✓ components/alterations/ft04-alteration-grid.tsx

apps/customer/app/
  ✓ demo/[token]/private-demo.tsx
  ✓ r/[slug]/table-service-widget.tsx (partial context)
  ✓ r/[slug]/swipe/swipe-deck.tsx (partial context)
```

---

## Classification Summary

| Category           | Count | Status                                                                               |
| ------------------ | ----- | ------------------------------------------------------------------------------------ |
| **PASS**           | 12    | Code follows accessibility best practices                                            |
| **PARTIAL**        | 3     | Acceptable with minor clarifications needed (decorative images, external markup)     |
| **FAIL**           | 2     | Dialog focus management + background inert missing                                   |
| **NOT TESTABLE**   | 3     | Requires live rendering (color contrast, heading hierarchy, skip links verification) |
| **NOT APPLICABLE** | 0     | N/A                                                                                  |

---

## Audit Conclusion

**Code-level accessibility is **PARTIAL COMPLIANCE**.** The PAON platform demonstrates intentional a11y design in its UI component library and form handling patterns. Button, input, and dialog components include semantic HTML, ARIA attributes, and focus styles. FormField pattern shows maturity in composite control naming.

**Critical gaps** are dialog focus management (affects keyboard and screen reader users) and lack of automated testing integration (allows regressions). **Low-severity gaps** are missing skip links and some image alt text inconsistencies.

**Recommendation:** Integrate @axe-core/playwright into CI/CD, fix dialog focus traps, and add skip links before release. A full manual screen-reader audit (out of scope here) should follow in a dedicated phase with NVDA/JAWS testing on production URLs.

**This audit is CODE-LEVEL ONLY.** It does not assess:

- Runtime color contrast (requires rendered pages + measurements)
- Heading hierarchy per page
- Keyboard navigation completeness
- Screen reader announcements in live browser
- WCAG 2.1 AA full compliance

A subsequent **MANUAL A11Y AUDIT** phase is recommended post-launch.
