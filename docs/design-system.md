# Design System

The visual and interaction design for Dirham. This is the reference for
every screen: the aesthetic direction, the design tokens, motion rules,
and the responsive and accessibility standards. Mobile is the priority
platform — read Section 7 before building any layout.

---

## 1. Design principles

These five principles decide every design choice. When two options
compete, the one that better serves these wins.

1. **Mobile first, always.** The product is used standing in a shop, in
   a taxi, at a client's office — on a phone, one-handed. Every screen
   is designed for a narrow viewport first and enhanced for larger ones.
2. **Calm, not loud.** This is a money tool. It must feel trustworthy
   and unhurried. Motion and color create delight in small, deliberate
   moments, never noise.
3. **Fast to act.** The single most common action is "add an entry."
   That action is never more than one tap away and never blocked.
4. **Clarity over decoration.** A number the user needs is always the
   most prominent thing on the screen. Decoration supports it; it never
   competes with it.
5. **Distinctly itself.** The product has a point of view rooted in its
   place — the warm, sunlit, gold-and-green palette below — so it never
   looks like a generic template.

---

## 2. Aesthetic direction

**Refined, warm, sunlit — a modern Gulf finance feel.**

The look draws from warm paper, deep oasis green, and desert gold. It
avoids the cold blue-grey and purple gradients common to finance apps.
The result reads as premium and regional without resorting to cliché
ornament. Think a well-made ledger in warm light rather than a
spreadsheet on a screen.

- Surfaces are warm off-white, like good paper.
- The primary brand color is a deep, calm green.
- Gold is the accent — used sparingly, for emphasis and highlights.
- Type pairs a characterful serif for headings and numbers with a
  clean, modern sans for everything else.

---

## 3. Color tokens

Defined as CSS custom properties. Use the tokens, never raw hex values,
so theming stays consistent.

```css
:root {
  /* Core surfaces */
  --paper:       #f4f1e8;  /* app background */
  --card:        #fffefa;  /* cards, panels */
  --sand:        #e8e3d4;  /* borders, dividers, tracks */

  /* Brand */
  --green:       #1f5c45;  /* primary actions, brand */
  --green-soft:  #d9e7df;  /* tints, fills, focus rings */
  --gold:        #b8862f;  /* accent, highlights */

  /* Text */
  --ink:         #14201c;  /* primary text */
  --muted:       #7c8079;  /* secondary text, labels */

  /* Feedback */
  --amber-bg:    #fbeccb;  --amber-ink: #8a5a10;  /* near-limit warning */
  --red-bg:      #f6d9d3;  --red-ink:   #97331f;  /* over-limit alert */
  --positive:    #1f5c45;  /* income, gains */
}
```

### Color usage rules

- Green is for primary actions and brand moments. Do not flood screens
  with it; one strong green element per view is usually enough.
- Gold is an accent only. It highlights a single value or a small
  detail. Never use gold for large fills or body text.
- Feedback colors (amber, red) appear only for budget warnings and
  errors, so they retain their meaning.
- Income is shown in green; expense is shown in ink. Never rely on
  color alone to distinguish them — also use a sign or a label (see
  accessibility, Section 9).

### Dark mode

A dark theme is planned but not required for launch. When added, define
a parallel set of tokens under a `[data-theme="dark"]` selector; never
hard-code colors in components, so the switch is a token change only.

---

## 4. Typography

Pair a distinctive display serif with a clean body sans. Headings and
money figures use the serif; everything else uses the sans.

```css
--font-display: 'Fraunces', Georgia, serif;     /* headings, amounts */
--font-body:    'Spline Sans', system-ui, sans-serif; /* everything else */
```

### Type scale

| Token        | Size (mobile) | Size (desktop) | Use                       |
|--------------|---------------|----------------|---------------------------|
| `display`    | 28px          | 34px           | Page title, hero number   |
| `h1`         | 22px          | 26px           | Section heading           |
| `h2`         | 18px          | 20px           | Panel heading             |
| `body`       | 15px          | 16px           | Default text              |
| `small`      | 13px          | 13px           | Secondary text            |
| `label`      | 11px          | 11px           | Uppercase labels          |

### Type rules

- Money figures always use the display serif. They are the most
  important content; the serif gives them weight and character.
- Labels are uppercase with wide letter-spacing (~0.08em) and use the
  muted color.
- Body text never goes below 13px on mobile, for legibility.
- Line height is 1.5 for body, tighter (~1.1) for large display numbers.

---

## 5. Spacing, radius, and elevation

A consistent scale keeps layouts calm.

```css
/* Spacing scale (px) */
--space-1: 4;  --space-2: 8;  --space-3: 12; --space-4: 16;
--space-5: 24; --space-6: 32; --space-7: 48; --space-8: 64;

/* Radius */
--radius-sm: 9px;   /* inputs, small controls */
--radius-md: 12px;  /* stat cards, warnings */
--radius-lg: 18px;  /* panels */
--radius-pill: 999px;

/* Elevation — soft, warm shadows, never harsh black */
--shadow-sm: 0 1px 2px rgba(20,32,28,0.04);
--shadow-md: 0 4px 16px rgba(20,32,28,0.06);
--shadow-lg: 0 12px 32px rgba(20,32,28,0.10);
```

Rules:

- Cards sit on the paper background with a 1px `--sand` border and, at
  most, a soft `--shadow-sm`. Heavy shadows feel cheap here.
- Corner radius is generous (cards at 12–18px) to feel friendly.
- Vertical rhythm uses the spacing scale; avoid arbitrary pixel values.

---

## 6. Motion

Motion is purposeful and restrained. Its job is to make state changes
legible and to add small moments of delight — never to decorate idly.

### Timing and easing

```css
--ease-out:    cubic-bezier(0.2, 0.8, 0.2, 1);  /* entrances */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);     /* movement */
--dur-fast:    150ms;  /* taps, hovers, toggles */
--dur-base:    250ms;  /* most transitions */
--dur-slow:    400ms;  /* entrances, reveals */
```

### Signature interactions

These are the deliberate, memorable moments. Keep them few and well
executed.

- **Dashboard load.** Stat cards reveal in a staggered sequence —
  each fades and rises a few pixels, 60ms apart. One orchestrated
  entrance, not a dozen scattered ones.
- **Number changes.** When a total updates after an entry, the figure
  briefly tweens to its new value and pulses once. This is the core
  "your action mattered" feedback.
- **Adding an entry.** On submit, a confirmation toast slides up from
  the bottom (thumb-reachable) and the new item animates into the
  recent list. The category bar it affects fills with a smooth width
  transition.
- **Budget warning.** When a category crosses its threshold, its bar
  shifts color (green → gold → red) with a transition, and the warning
  banner slides in from the top.
- **Tap feedback.** Buttons and cards scale down slightly (~0.97) on
  press for a tactile feel on touch devices.

### Motion rules

- Prefer CSS transitions and keyframes; reserve JS-driven motion for
  number tweening and orchestrated sequences.
- Animate only `transform` and `opacity` where possible — they are
  cheap and smooth on phones. Avoid animating layout properties.
- Nothing essential is hidden behind animation; content is usable the
  moment it appears.
- Respect reduced motion (see Section 9): when the user prefers reduced
  motion, replace movement with simple fades or none at all.

---

## 7. Mobile-first and responsive

**Mobile is the primary platform.** Design and build every screen for
the phone first, then enhance upward. A desktop layout is never an
excuse to compromise the phone experience.

### Breakpoints

```css
/* Mobile first: base styles target the phone. Enhance at min-width. */
--bp-sm: 480px;   /* large phones */
--bp-md: 768px;   /* tablets */
--bp-lg: 1024px;  /* desktop */
```

Write base CSS for mobile, then add `min-width` media queries to adapt
upward. Never write desktop-first styles that you then claw back for
phones.

### Layout behavior

- **Phone (base):** single column. Stat cards stack or scroll in a row.
  The entry form is full-width. The primary "Add" action is always
  reachable by the thumb (bottom of the screen or a fixed bottom bar).
- **Tablet (`md`):** two columns where it helps; stat cards in a 2-up
  or 3-up grid.
- **Desktop (`lg`):** the dashboard uses a two-column layout (entry and
  activity on one side, breakdown on the other); stat cards in a row of
  five. Content is capped at a max width (~1080px) and centered.

### Touch targets

- Every interactive element is at least 44×44px.
- Spacing between tappable items is at least 8px to prevent mis-taps.
- Primary actions sit in the lower half of the screen, within thumb
  reach, not at the top.

### Mobile-specific rules

- Inputs use the correct mobile keyboard (numeric keypad for amounts).
- The entry form is reachable in one tap from anywhere via a persistent
  add button.
- Avoid hover-only interactions; everything works on touch.
- Test on a real phone, in bright light — this is the actual use
  context.

---

## 8. Core components

The shared building blocks. Each is responsive and uses the tokens
above.

- **Stat card.** A label and a large serif figure. The balance card is
  the one emphasized variant (filled green). Reveals with the staggered
  load animation.
- **Entry form.** Type toggle (expense/income), amount, payment method,
  note, category. Full-width on mobile. Shows the AI category
  suggestion inline beneath the note.
- **Category bar.** A label, an amount, and a progress bar against its
  budget. The fill color reflects status (green / gold / red).
- **Warning banner.** A slim, rounded banner in amber or red with a
  short message. Slides in; dismissible.
- **Transaction row.** An icon, a name and sub-label, and a signed
  amount. Income is green and prefixed with a plus; expense uses ink
  and a minus.
- **Toast.** A pill that slides up from the bottom to confirm an action.
- **Button.** Primary (filled green), secondary (outlined), and quiet
  (text only). All meet the 44px touch target and scale on press.

---

## 9. Accessibility

Accessibility is part of the design, not an afterthought.

- **Contrast.** Text meets WCAG AA contrast against its background. The
  ink-on-paper and white-on-green combinations are checked to pass.
- **Never color alone.** Income versus expense, and budget status, are
  always conveyed by a label, sign, or icon in addition to color, so
  the meaning survives for color-blind users.
- **Focus states.** Every interactive element has a visible focus ring
  (a `--green-soft` outline). Never remove focus outlines.
- **Touch targets.** Minimum 44×44px, as in Section 7.
- **Reduced motion.** Honor `prefers-reduced-motion`. When set, disable
  number tweening, slides, and staggered reveals; use a plain fade or
  no motion.
- **Semantics.** Use real headings, labels tied to inputs, and
  appropriate roles so screen readers can navigate.
- **Text sizing.** Layouts tolerate larger system font sizes without
  breaking.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Do and don't

**Do**

- Lead every screen with the number the user came to see.
- Keep one strong green moment per view.
- Use gold sparingly, for a single highlight.
- Animate transforms and opacity only.
- Design the phone layout first and test it on a real device.

**Don't**

- Use cold blue-grey or purple gradients — they break the aesthetic.
- Add motion that delays the user from acting.
- Rely on hover for anything essential.
- Use shadows that are heavy or pure black.
- Let a desktop layout dictate compromises on mobile.
- Convey status with color alone.

---

## 11. Reference implementation

`preview.html` in the project root is the living reference for this
system: it uses these exact tokens, the Fraunces/Spline Sans pairing,
the staggered card reveal, the slide-up toast, and the color-shifting
budget bars. When in doubt about how something should look or move,
open the preview.
