---
name: daily-expenses-design-system
description: >-
  Use when building, styling, or restyling ANY UI, page, or React component in
  the Daily Expenses app — any front-end or visual work. Triggers on
  requests like "style this page", "build the <X> component", "make the
  dashboard match the design", "apply the design system", "restyle this", "add
  the entry-form UI", or any task touching layout, colors, typography, Tailwind
  classes, spacing, animation, or component look-and-feel. Encodes the Daily Expenses
  visual language — a warm gold-and-green Gulf finance aesthetic — as design
  tokens, mobile-first layout rules, motion, accessibility, and component
  patterns, plus how to wire them into this Next.js 14 + Tailwind v3 stack.
version: 0.1.0
---

# UI design system

Apply this whenever you produce or change UI in this project. The full,
authoritative spec is **`docs/design-system.md`** — read it for anything not
covered here (it is the source of truth; this file is the working distillation).
Note: `docs/design-system.md` §11 references a `preview.html` that does **not yet
exist** in the repo — do not rely on it; treat the doc + tokens below as canonical.

## The five principles (tie-breakers)

When two choices compete, the one that better serves these wins:

1. **Mobile first, always** — design the phone layout first, enhance upward.
2. **Calm, not loud** — it's a money tool; trustworthy and unhurried.
3. **Fast to act** — "add an entry" is never more than one tap away, never blocked.
4. **Clarity over decoration** — the number the user came for is the most prominent thing.
5. **Distinctly itself** — warm, sunlit gold-and-green; never a generic template.

## Stack reality (read before coding)

- **Next.js 14 App Router + plain Tailwind v3.** shadcn/ui is deliberately NOT
  used — build with hand-written Tailwind utility classes.
- Tokens are **not yet wired**: `tailwind.config.ts` has an empty `theme.extend`,
  `src/app/globals.css` has only the three `@tailwind` directives, and no fonts
  are loaded. Existing components use generic `slate / emerald / red` utilities —
  migrate them to the tokens below.
- **Never put raw hex in components.** Define tokens once (CSS custom properties +
  Tailwind mapping), then use semantic classes (`bg-paper`, `text-ink`,
  `font-display`, `rounded-lg`, `shadow-sm`). This keeps the planned dark theme a
  token swap only.

## Tokens

```css
/* Color — src/app/globals.css :root */
--paper:#f4f1e8; --card:#fffefa; --sand:#e8e3d4;          /* surfaces */
--green:#1f5c45; --green-soft:#d9e7df; --gold:#b8862f;     /* brand + accent */
--ink:#14201c;   --muted:#7c8079;                          /* text */
--amber-bg:#fbeccb; --amber-ink:#8a5a10;                   /* near-limit */
--red-bg:#f6d9d3;   --red-ink:#97331f;                     /* over-limit */
--positive:#1f5c45;                                        /* income / gains */

/* Spacing (px): 4 8 12 16 24 32 48 64  (use the scale, no arbitrary values) */
--radius-sm:9px; --radius-md:12px; --radius-lg:18px; --radius-pill:999px;
--shadow-sm:0 1px 2px rgba(20,32,28,.04);
--shadow-md:0 4px 16px rgba(20,32,28,.06);
--shadow-lg:0 12px 32px rgba(20,32,28,.10);

/* Motion */
--ease-out:cubic-bezier(.2,.8,.2,1); --ease-in-out:cubic-bezier(.4,0,.2,1);
--dur-fast:150ms; --dur-base:250ms; --dur-slow:400ms;
```

**Typography** — display serif for headings AND money figures, sans for the rest:
`--font-display:'Fraunces',Georgia,serif`, `--font-body:'Spline Sans',system-ui,sans-serif`.
Scale (mobile → desktop): display 28→34, h1 22→26, h2 18→20, body 15→16, small 13,
label 11. Labels are UPPERCASE, ~0.08em tracking, `--muted`. Body never < 13px on
mobile. Line-height 1.5 body, ~1.1 for big display numbers.

**Color usage:** one strong green moment per view (primary action/brand); gold is a
single highlight only — never large fills or body text; amber/red only for budget
warnings and errors. Income = green with a `+`; expense = ink with a `−` — never
color alone (see Accessibility).

## Wiring it into this stack (do this once, then use the classes)

1. **Fonts** in `src/app/layout.tsx` via `next/font/google` (both are Google fonts):
   ```tsx
   import { Fraunces, Spline_Sans } from "next/font/google";
   const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
   const body = Spline_Sans({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-body", display: "swap" });
   // <html className={`${display.variable} ${body.variable}`}> ... <body className="font-body bg-paper text-ink">
   ```
2. **Tokens** in `src/app/globals.css` under `:root` (the block above) + the
   reduced-motion guard from the Accessibility section.
3. **Map tokens** in `tailwind.config.ts` `theme.extend` so utilities exist:
   ```ts
   extend: {
     colors: {
       paper: "var(--paper)", card: "var(--card)", sand: "var(--sand)",
       green: { DEFAULT: "var(--green)", soft: "var(--green-soft)" },
       gold: "var(--gold)", ink: "var(--ink)", muted: "var(--muted)",
       "amber-bg": "var(--amber-bg)", "amber-ink": "var(--amber-ink)",
       "red-bg": "var(--red-bg)", "red-ink": "var(--red-ink)",
     },
     fontFamily: {
       display: ["var(--font-display)", "Georgia", "serif"],
       body: ["var(--font-body)", "system-ui", "sans-serif"],
     },
     borderRadius: { sm: "9px", md: "12px", lg: "18px", pill: "999px" },
     boxShadow: {
       sm: "0 1px 2px rgba(20,32,28,.04)",
       md: "0 4px 16px rgba(20,32,28,.06)",
       lg: "0 12px 32px rgba(20,32,28,.10)",
     },
   }
   ```
   Caveat: mapping `green` replaces Tailwind's default green scale — intended, the
   app should use brand tokens, not the generic palette. Apply money figures with
   `font-display`, headings with `font-display`, everything else inherits `font-body`.

## Core components (each responsive, token-based)

- **Stat card** — uppercase `label` + large `font-display` figure on `bg-card`,
  1px `border-sand`, `shadow-sm`, `rounded-md`. Balance card is the one emphasized
  variant (filled `bg-green` / light text). Reveals with the staggered load.
- **Entry form** — type toggle (expense/income), amount, payment method, note,
  category; full-width on mobile; AI category suggestion shown inline under note
  (Phase 3). Numeric keypad for amount (`inputMode="decimal"`).
- **Category bar** — label + amount + progress bar vs budget; fill color reflects
  status green → gold → red, animated width.
- **Warning banner** — slim `rounded-md` banner, `--amber-*` (near) or `--red-*`
  (over), short message, slides in from top, dismissible.
- **Transaction row** — name/sub-label + signed amount; income green `+`, expense
  ink `−`.
- **Toast** — pill sliding up from the bottom (thumb-reachable) to confirm an action.
- **Button** — primary (filled `bg-green` white text), secondary (outlined), quiet
  (text only); all ≥44px touch target; scale to ~0.97 on press.

## Mobile-first & responsive (primary platform)

- Base CSS targets the phone; enhance up with `min-width` queries
  (`sm 480 / md 768 / lg 1024`). Never write desktop-first and claw back.
- Phone: single column; stat cards stack or scroll-row; entry form full-width; the
  primary **Add** action stays in thumb reach (lower half / fixed bottom bar).
- Tablet `md`: 2-up where it helps. Desktop `lg`: two-column dashboard, 5 stat
  cards in a row, content capped ~1080px and centered.
- Touch targets ≥ 44×44px, ≥ 8px apart. Right mobile keyboard per input. No
  hover-only behavior — everything works on touch.

## Motion (purposeful, restrained)

- Animate **only `transform` and `opacity`** (cheap/smooth on phones); never
  layout properties. Prefer CSS transitions/keyframes; reserve JS for number
  tweening and orchestrated sequences. Durations/easings from the tokens.
- Signature moments (keep few, well-executed): staggered stat-card reveal on load
  (~60ms apart); a total tweens + pulses once when it changes; submit → slide-up
  toast + new row animates in + affected category bar fills; budget bar shifts
  color on crossing a threshold + banner slides in; buttons/cards scale on press.
- Nothing essential is hidden behind animation; content is usable the instant it
  appears.

## Accessibility (part of the design)

- WCAG AA contrast (ink-on-paper, white-on-green pass).
- **Never color alone** for income/expense or budget status — also use a sign,
  label, or icon.
- Visible focus ring (`--green-soft` outline) on every interactive element; never
  remove outlines.
- Honor reduced motion — add to `globals.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
  ```
- Real headings, `<label>`s tied to inputs, correct roles. Layout tolerates larger
  system font sizes.

## Pre-ship checklist

- [ ] Leads with the number the user came to see; money figures in `font-display`.
- [ ] Exactly one strong green moment; gold used for at most one highlight.
- [ ] Only tokens used — no raw hex, no `slate/emerald/blue/purple/grey` leftovers.
- [ ] No cold blue-grey or purple gradients; shadows soft and warm, never black.
- [ ] Built phone-first; verified at a narrow viewport; touch targets ≥ 44px.
- [ ] Status/income/expense conveyed by sign or label, not color alone; focus rings present.
- [ ] Motion is transform/opacity only and respects `prefers-reduced-motion`.
- [ ] Anything unclear → reconciled against `docs/design-system.md`.
