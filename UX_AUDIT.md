# Tidy Day — UX & Accessibility Audit

Method: Playwright against the live deploy (Azure SWA), desktop 1280x800 and mobile 375x667, guest mode. Automated checks (contrast, target size, labels, landmarks, focus order) plus manual flow review. Screenshots were captured during the run.
Not covered: logged-in sync flows, the Expenses and Dashboard screens with data, screen-reader testing, light theme.

## What works well (lead with these in the demo)
- Clear information architecture. Sidebar on desktop, bottom tab bar plus FAB on mobile; no horizontal scroll at 375px.
- Guest mode ("Continue without an account") lowers the barrier to entry, and the "Local only" badge is honest about it.
- Natural-language task entry (`!high due:tomorrow #tag`) with visible shortcut chips. This is a strong power-user feature and is discoverable.
- Good empty state: illustration, plain explanation, and a primary CTA.
- Esc closes the add picker. Modal opens with the title field focused. Lang attribute and viewport meta are set. `autocomplete` attributes are correct on auth fields.
- Dark theme looks cohesive; the focus ring is a visible 2px solid outline.

## Findings (priority order)

### High
1. **Form inputs have no programmatic labels.** Visible "NAME / EMAIL / PASSWORD" text exists, but `input.labels` is empty on every auth field and every task-form field (selects, date, time). Screen readers announce the placeholder or nothing. Fix: `htmlFor`/`id`, or wrap the input in the `<label>`.
2. **Modals aren't real dialogs and don't trap focus.** There is no `role="dialog"` / `aria-modal`. Tabbing from the New Task form leaves the dialog and walks into the page behind it (Cancel → sidebar → Add → Today…). Fix: dialog semantics, focus trap, and restoring focus to the trigger on close.
3. **Empty submit gives no feedback.** In the task form, Ctrl+Enter with an empty title does nothing, and "Add Task" is only dimmed. On signup, native `required` validation is the only signal. Fix: inline error message with `aria-describedby`, and say why the button is disabled.
4. **Low-contrast text.**
   - Guest disclaimer on signup: 2.56:1 at 11.5px (needs 4.5:1).
   - Primary button text on the accent colour (Add / New / + Add a task): 2.98:1 (white on light indigo).
   - Link-colour text ("Log in", "Create one"): ~4.3:1.
   - The "Q" logo mark: 4.47:1.
   Fix: darken the accent button background, and raise the muted-text token.

### Medium
5. **Hint says "Press Enter to save", but the form is multi-field and the real shortcut appears to be Ctrl/⌘+Enter.** The hint should match behaviour, or the platform-specific shortcut should be shown.
6. **Deep links don't work.** Opening `/app/expenses` directly lands on Today, so the URL doesn't reflect the view. This breaks refresh, back/forward, and sharing. Fix: route each view.
7. **Touch targets under 44px.**
   - Sidebar items: 203x36.
   - Icon buttons in the top bar: 34x34.
   - Auth CTAs: ~34–36px tall.
   - Inline links such as "Create one" / "Log in": 18px tall.
   Mobile bottom-nav targets (63x59) are fine. Fix: larger hit areas, e.g. padding or `min-height: 44px`.
8. **Icon-only buttons.** Bell, theme toggle and account have no visible text, and the snapshot reports them as generic "BUTTON". Add `aria-label`s, and `aria-pressed` on the theme toggle.
9. **No landmarks or h1 on auth pages.** Both `/login` and `/signup` have 0 `main`/`nav`/`header` elements. The signup page also briefly showed the h1 "Welcome back" while the URL was `/signup`, a flash of the wrong route.
10. **Install-PWA banner on mobile** sits above the content on the first visit and pushes the empty state down. Defer it until the user has done something (e.g. added a task).

### Low
11. Smallest text is 11px (shortcut chips, uppercase field labels, badges). Consider a 12px minimum.
12. Notification bell shows an unread-style dot on a brand-new account with nothing to notify. This is misleading.
13. "Remind me: 30 min before" is preselected when no due date is set, so the default is meaningless and confusing.
14. Task form shows 6 fields at once. Progressive disclosure (title first, "More options" for the rest) would reduce visual load on mobile.
15. Date input uses the browser locale (dd/mm/yyyy here). Fine, but there are no quick chips such as Today / Tomorrow, which the natural-language entry already supports.

## Suggested quick wins for the demo (~1 hour)
Findings 1, 2, 3, 4 and 8. These are small code changes with large accessibility impact, and a before/after Lighthouse or axe score shows the improvement well.

## How to present this
Frame it as: audit method → what already works → top 4 issues with evidence → fix one live → re-run the audit to show the delta.
