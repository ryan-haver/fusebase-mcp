---
name: app-ui-design
description: "Guidance for visual design, UI and UX in Fusebase-generated apps. Use when building or refining app UIs: pages, components, layouts, forms, feedback states, theming, or accessibility. Ensures consistent, clear, and distinctive interfaces using shadcn/ui."
---

# App UI Design

This skill guides UI/UX in **generated apps** (Fusebase Apps). Use **shadcn/ui** for all UI. Apply a clear design direction and avoid generic AI aesthetics.

---

## Design philosophy

**Clarity over decoration.** Every visual choice supports hierarchy and scannability. Prefer one bold aesthetic direction (minimal, warm, editorial, etc.) and execute it consistently.

- **Purpose first**: What does the screen do? Who uses it?
- **Tone**: Choose one direction (e.g. minimal, warm/SaaS, editorial, utilitarian) and stick to it.
- **Differentiation**: Avoid default "AI" look: no Inter/Roboto-only, no purple gradients on white, no same-as-everyone layouts. Vary fonts, palette, and density per context.

---

## Visual identity

### Tailwind CSS v4

Apps use **Tailwind CSS v4** (via `@tailwindcss/postcss`). Key differences from v3:

- **Import**: Use `@import "tailwindcss"` in `globals.css` (not `@tailwind base/components/utilities`).
- **No `tailwind.config.js`**: Configuration is CSS-first. Use `@theme` in CSS to define custom tokens.
- **Content detection is automatic**: Tailwind v4 scans project files automatically. If needed, use `@source "../path/**/*.tsx"` to add extra directories.

**⚠️ CRITICAL — CSS variables in arbitrary values:**

Do **NOT** define raw `:root` CSS variables and reference them via arbitrary value syntax. This is the most common Tailwind v4 pitfall:

```css
/* ❌ BROKEN — variables are NOT available to Tailwind's arbitrary value resolver */
:root {
  --card: #ffffff;
  --foreground: #0f172a;
}
```
```tsx
// ❌ BROKEN — these classes compile but resolve to empty/broken values
className="bg-[var(--card)] text-[var(--foreground)]"
```

**Instead, use one of these approaches:**

1. **Use shadcn semantic tokens** (default for new apps):
   ```tsx
   // ✅ Works — and follows a FuseBase site theme when the app is embedded
   className="bg-background text-foreground border-border"
   className="bg-primary text-primary-foreground"
   ```
   New apps ship with shadcn/ui. Theme colour this way so a site can restyle the app. A fixed Tailwind palette (`bg-white`, `text-slate-900`) is only for an app that has no shadcn theme.

2. **Register custom tokens via `@theme`** (only if you need custom colors):
   ```css
   @import "tailwindcss";
   @theme {
     --color-brand: #6366f1;
     --color-surface: #ffffff;
   }
   ```
   ```tsx
   // ✅ Works — registered via @theme
   className="bg-surface text-brand"
   ```

3. **Use `@apply` for reusable component classes** (buttons, inputs):
   ```css
   .btn-primary {
     @apply inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl;
     background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
   }
   ```

4. **Use inline `style` only for truly dynamic values** (e.g. colors from API data):
   ```tsx
   // ✅ OK — color is runtime data, can't be a utility class
   style={{ color: product.categoryColor, backgroundColor: `${product.categoryColor}18` }}
   ```

### shadcn/ui (when used)

- shadcn/ui components live in `components/ui/` (copied into the project, not installed as a package). Import from `@/components/ui/...`.
- When shadcn/ui is set up, its CSS variables (`--background`, `--foreground`, etc.) are registered through its own theme system and work with utility classes like `bg-background`, `text-foreground`.
- Prefer **variant** and **size** props on shadcn/ui components (e.g. `<Button variant="outline" size="sm">`) over ad-hoc Tailwind color overrides.
- Use the `cn()` utility (from `@/lib/utils`) to merge Tailwind classes safely: `cn("base-class", conditionalClass)`.

**⚠️ CRITICAL — Do NOT add a global `*` CSS reset:**

Do **NOT** add `* { margin: 0; padding: 0; box-sizing: border-box; }` in `globals.css`. Tailwind v4's Preflight already applies proper resets. A manual `*` reset has equal specificity to Tailwind's utility classes and will override them when it appears later in the cascade, breaking padding (`p-4`, `p-5`, `px-6`, etc.) and margin utilities silently.

```css
/* ❌ BROKEN — overrides Tailwind utilities like p-5, m-4 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

```css
/* ✅ CORRECT — Tailwind v4 Preflight handles resets automatically */
@import "tailwindcss";
/* No manual * reset needed */
```

### General Tailwind usage

- **Typography**: Use Tailwind's typography scale (`text-sm`, `text-base`, `text-lg`, `font-semibold`, etc.) and keep heading/body consistent throughout the app.
- **Radius**: Use consistent rounding from the theme (`rounded-md` for cards and inputs; `rounded-full` for pills/avatars).
- **Colors**: New apps use shadcn semantic tokens (`bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`). That is the default: the same classes follow a FuseBase site theme when the app is embedded, and look correct when it is not. Do not start a new app on `bg-white` / `text-slate-*`.
  - **Without shadcn/ui** (an existing app that was not scaffolded with it): use Tailwind's built-in palette (`bg-white`, `text-slate-900`, `bg-slate-100`, `text-slate-500`, `border-slate-200`).
  - **Never mix**: Don't use `bg-background` in an app without shadcn/ui theming — it won't resolve. Reserve inline `style` for dynamic/computed colors only.

### Hierarchy

Establish clear text hierarchy. New apps use the shadcn column:

| Level | With shadcn/ui | Without shadcn/ui |
|-------|----------------|-------------------|
| **Primary** (main content) | `text-foreground` | `text-slate-900 dark:text-slate-100` |
| **Secondary** (labels, metadata) | `text-muted-foreground` | `text-slate-500 dark:text-slate-400` |
| **Tertiary** (timestamps, hints) | Smaller size + `text-muted-foreground` | Smaller size + `text-slate-400` |

Reserve accent/brand color for CTAs and key UI, not body text.

---

## UX principles

- **Fast input**: Optimize tab order, use presets or shortcuts where it fits, combine related steps (e.g. create + add in one flow).
- **Feedback**: Update UI right after mutations (invalidate queries, toasts for destructive or important actions). Use `disabled` + a spinner on `Button` during submits.
- **Low cognitive load**: Few, clear actions per screen; constrained choices (e.g. fixed categories with icons); avoid wizards when a single form is enough.
- **Empty and loading**: Always handle empty data (centered message + short guidance) and loading (`Skeleton` sized to final content, or a `Loader2` spinner from Lucide).

---

## Layout and spacing

- **Spacing scale**: Use Tailwind spacing consistently (e.g. `gap-2`/`p-2` for inline, `gap-4`/`p-4` for cards/sections, `gap-6`/`py-6` for page rhythm).
- **Responsive**: Use Tailwind breakpoints (`sm:`, `md:`, `lg:`). Single column on mobile; sidebars/panels as toggles or Sheets (`<Sheet>`) on small screens. Use `flex-wrap` and `min-w-0` to avoid overflow.
- **Content width**: Constrain main content (e.g. `max-w-2xl mx-auto`) for readability on wide viewports.

---

## Component patterns

- **shadcn/ui first**: Use shadcn/ui primitives for actions, forms, and feedback: `Button`, `Input`, `Card`, `Dialog`, `DropdownMenu`, `Select`, `Textarea`, `Badge`, `Skeleton`, etc. Do not replace them with raw HTML for interactive elements.
- **Forms**: Use `react-hook-form` with `zod` for validation. Wrap inputs in `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` from `@/components/ui/form`.
- **Toast / notifications**: Use `sonner` (`toast.success(...)`, `toast.error(...)`) or shadcn/ui's `useToast` hook. Prefer `sonner` for simplicity.
- **Composition**: Pass data and callbacks into components (e.g. `onSubmit`, `onClose`), not big config objects.
- **Icons**: Use **Lucide React** (`lucide-react`) consistently throughout the app. Apply `text-muted-foreground` or contextual color classes for icon meaning (e.g. status, category).
- **Loading**: Add `disabled` to the button and show a `<Loader2 className="animate-spin" />` icon inside it while a request is in flight; use `<Skeleton>` for content placeholders.

---

## State and feedback

- **Cursor**: Always add `cursor-pointer` to interactive elements (buttons, links, clickable cards) including shadcn/ui `Button`. For custom `<button>` elements or `<div onClick>` handlers, always include `cursor-pointer` in the Tailwind class list. For disabled states use `cursor-not-allowed` (and remove `cursor-pointer`).
- **Hover/active**: Rely on shadcn/ui component variants and Tailwind `hover:` utilities; avoid overriding styles on interactive elements without a clear reason.
- **Errors**: Show inline validation messages via `<FormMessage>` and a toast or inline alert for API errors. See **handling-authentication-errors** for 401/token expiry.
- **Success**: Toast or brief inline confirmation for saves and destructive actions.

---

## Accessibility

- Use semantic structure: headings, `<label>` for inputs, landmarks where relevant.
- shadcn/ui components are built on Radix UI primitives — keyboard navigation and ARIA attributes are handled automatically; do not override or remove them.
- Use `<FormLabel>` for all form inputs so labels are always associated.
- Keep contrast in mind when picking palettes (CSS variable tokens help ensure consistency).

---

## Dark mode

**New apps (shadcn/ui)**: Dark mode is the `dark` class on `<html>`. Use CSS variable tokens (`bg-background`, `text-foreground`). When a site embeds the app, app-wrapper toggles that class from `colorScheme` — do not add a separate theme toggle that fights it.

**Without shadcn/ui**: Use Tailwind's `dark:` variant with the built-in palette: `bg-white dark:bg-slate-900`, `text-slate-900 dark:text-slate-100`. Do NOT create raw `:root` CSS variables and reference them via `bg-[var(--name)]` — this does not work in Tailwind v4 (see Tailwind CSS v4 section above).

---

## Embedded in a FuseBase site

This is the default theming path for new apps. Colour with shadcn token utilities
(`bg-background`, `text-foreground`, `border-border`, and the table below) and let
spacing and type come from Tailwind utilities that the wrapper can rescale. Fixed
colours (`bg-white`, `text-slate-*`, hex in `style`) ignore a site theme.

An app can be framed by a site built in Web Studio. The site posts `fb:embed:hello`
into the frame — on load, a few times after, and **again whenever the site's theme
or scale changes** (e.g. a theme switcher). A page that applies the first greeting
and ignores the rest sits in the old palette while the site around it moves.

### The greeting

```js
{
  type: 'fb:embed:hello',
  v: 1,                              // stays 1 as fields are added — feature-detect, never bump-check
  theme: { /* colour, type, focus, elevation — see tables */ },
  colorScheme: 'light' | 'dark',
  scale: { /* optional — see Scale */ }
}
```

Check `type` and `v === 1` before reading anything. A missing `scale`, `focus`, or
`shadow*` means the site is older or has no opinion — keep your own defaults.
**Every value is a finished CSS string** (colour, length, font stack, full
`box-shadow`). Assign it; do not parse, convert, or re-derive ramps from a single
step.

**app-wrapper** is the receiver in deployed apps: it validates each theme value,
maps site tokens onto shadcn/Tailwind variables on `<html>`, sets `color-scheme`,
toggles the `dark` class, and applies `scale` when present — **on every greeting**,
not only the first. It also dispatches a `fb:theme` `CustomEvent` with
`{ theme, colorScheme, scale }` so components that need the raw payload (charts,
canvases, pixels not CSS) can react when the site re-greets. The app does **not**
listen for colours/scale or call `setProperty` for them — a second applier races
the wrapper.

### Colour / type: site token → variables

| Site token       | Lands on `<html>` as                                      | Use in the app                         |
| ---------------- | --------------------------------------------------------- | -------------------------------------- |
| `background`     | `--background`                                            | `bg-background`                        |
| `foreground`     | `--foreground`, `--card-foreground`                       | `text-foreground`                      |
| `surface`        | `--card`, `--popover`, `--muted`                          | `bg-card`, `bg-muted`                  |
| `muted`          | `--muted-foreground`                                      | `text-muted-foreground`                |
| `line`           | `--border`, `--input`                                     | `border-border`                        |
| `accent`         | `--primary`, and `--ring` if `focus` is absent            | `bg-primary`                           |
| `accentContrast` | `--primary-foreground`                                    | `text-primary-foreground`              |
| `hover`          | `--accent`                                                | hover/selection fill, **not** brand    |
| `danger`         | `--destructive`                                           | error / destructive                    |
| `radius`         | `--radius`                                                | `rounded-*`                            |
| `fontBody`       | `--font-sans`                                             | body text                              |
| `fontHeading`    | `--font-heading`                                          | headings                               |
| `fontMono`       | `--font-mono`                                             | `font-mono`, code                      |
| `codeSurface`    | `--code-surface`                                          | inline `code` (`bg-code-surface`)      |

### Focus and elevation

_Added after scale. Older sites send neither; keep your own._

| Site token | Lands on `<html>` as | Use in the app |
| ---------- | -------------------- | -------------- |
| `focus`    | `--ring` (overwrites the accent fallback) | `:focus-visible` / `ring-ring` / `outline-ring` |
| `shadow1`  | `--shadow-sm` | raised card — `shadow-sm` |
| `shadow2`  | `--shadow-md` | menu / popover — `shadow-md` |
| `shadow3`  | `--shadow-lg` | dialog — `shadow-lg` |

**`focus` is the ring colour.** It cannot be derived safely from accent alone —
it must hold contrast against the page *and* the accent. A frame that keeps its
own ring looks like leaving the site when you tab.

**`shadow1`–`shadow3` are complete `box-shadow` values**, low to high. Assign
them; do not take them apart. They move with the palette (a black shadow on a
dark page is invisible). Prefer `shadow-sm` / `shadow-md` / `shadow-lg` over
hand-rolled shadows.

Also unset by wrapper: `--popover-foreground`, `--accent-foreground`,
`--secondary-foreground`, `--destructive-foreground`. Prefer `text-foreground` /
`text-primary-foreground`.

Success green and warning amber stay the app's own values. A site's palette is
appearance, not meaning. Use `--destructive` for error and destructive text.

**Register tokens through `@theme inline`** (standard shadcn setup):

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-code-surface: var(--code-surface);
  --font-heading: var(--font-heading);
}
```

`inline` matters. Without it Tailwind resolves the variable once at build time and
a runtime override changes nothing.

**Never hard-code the contrast colour on an accent.** Use `text-primary-foreground`.

**Do not fight `dark` or `color-scheme`.** The wrapper sets both from `colorScheme`.

### Scale (optional)

Sites may send a third field — finished size ramps, not multipliers:

```js
scale: {
  text:  { xs, sm, md, lg, xl, '2xl', '3xl' },   // e.g. md: '18px'
  space: { 1, 2, 3, 4, 5, 6, 7, 8 },             // e.g. 5: '24px'
  measure: '68ch',
}
```

| Group | Use for |
| ----- | ------- |
| `text.md` | Body — paragraphs, list items, table cells |
| `text.sm` | Captions, metadata, dense UI |
| `text.xs` | Footnotes, badge labels |
| `text.lg` → `text.3xl` | h4 → h1 |
| `space.1`–`space.3` | Small gaps — **fixed at every density** (icon-to-label, tight rows) |
| `space.4`–`space.8` | Card padding, block spacing, section rhythm |
| `measure` | `max-width` on prose columns — the one most often skipped and most visible |

**Read the step you need.** Do not derive your own type or spacing ramp from
`text.md` or multiply steps — that drifts from the page the same way re-deriving
the palette from `background` would.

**This is not browser zoom.** Scale type and the space around it. Do not scale
borders, hairlines, or images — the browser's zoom already does that better.

app-wrapper maps `scale` onto Tailwind theme variables on `<html>` on every
greeting when the field is present: `scale.text.*` → `--text-xs` … `--text-3xl`
(and `font-size` from `text.md` for rem-based layouts), `scale.space.*` →
`--spacing-1` … `--spacing-8`, `scale.measure` → `--embed-measure`. Use
`text-sm` / `p-5` / similar utilities (with `@theme inline`) — not hard-coded
pixel classes. For prose width, cap columns with `max-w-[var(--embed-measure)]`
when the variable is set. A missing `scale` field means keep your own defaults;
do not listen for `hello` to re-apply colours or scale — the wrapper owns that.
Listen to `fb:theme` only when you need the raw payload (charts, canvases).

### Specificity: where you set a variable matters

A rule on a component (e.g. `.card { --background: … }`) beats a variable set on
`<html>`, however specific the root rule looks — so wrapper tokens can silently
fail to reach a subtree. Prefer token utilities (`bg-background`) over per-component
`:root`-style overrides. If a component must participate in embed theming, override
at the same specificity in a rule that loads last, or drop the local colour override.

### Surface checklist

Work the whole UI, not the obvious parts: text, lists, tables, cards, inputs,
badges, hover/focus/selection/disabled, scrollbars, sticky chrome, code blocks,
raised surfaces (`shadow-*`). Anything left as `bg-slate-*`, `text-white`, fixed
`text-base` / `p-6`, a private focus colour, or hex in `style=` keeps its own look
while the site changes — unreadable when the site flips dark or dense.

**Do not add a height reporter.** app-wrapper already posts `fbs-iframe-resize` and
`fb:embed:height`. A second height producer is a resize loop.

### Testing it

**Colours:** Frame the app and send a deliberately loud palette — a background and
foreground nothing in your design uses. Anything that keeps its old colour was
missed. A palette close to your defaults proves nothing.

**No theme:** Send nothing (or omit fields) and confirm the page is exactly as
unframed. Absence of a theme is a supported state, not degraded.

**Focus / elevation:** Send a ring colour nothing in your design uses and tab
through — anything that highlights differently is drawing its own. Then send
`shadow2: '0 0 0 4px red'` — every raised surface should gain it; any that does
not has a shadow of its own.

**Scale:** Send `text.md: '24px'` with `space` at defaults — every piece of text
should grow and the layout should not fall apart; anything still at 16px is a
hard-coded size. Then send `space.7: '16px'` with text unchanged — the page should
tighten without type moving. Test text and space separately; changing both at once
hides which a component ignored.

**Theme switch:** Send a second greeting with a different `colorScheme` (and scale /
focus if wired). The app must follow — not stay on the first palette.

---

## References

- **shadcn/ui**: https://ui.shadcn.com — components, theming, and CLI usage.
- **Radix UI**: Underlying primitive library providing accessible behavior for shadcn/ui components.
- **Lucide React**: https://lucide.dev — icon set to use consistently.
- **AGENTS.md**: Use shadcn/ui for app UIs; auth and SDK usage are described there and in **fusebase-dashboards**, **handling-authentication-errors**.
