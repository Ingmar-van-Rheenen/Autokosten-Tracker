---
name: Vroom
description: Persoonlijke rittenregistratie en kostenverevening, op weg naar multi-user via vroom-api.
colors:
  avondlucht: "#1b2537"
  avondlucht-mid: "#232f44"
  avondlucht-surface: "#2a3850"
  avondlucht-border: "#35445e"
  bosrand: "#4e7d52"
  bosrand-mid: "#5e9464"
  bosrand-lite: "#7ab87a"
  bosrand-bg: "#d4e8d4"
  warm-ivoor: "#f0ebe0"
  warm-ivoor-2: "#e6e0d2"
  fout-rood: "#c94040"
  txt-donker: "#dce8f4"
  txt-donker-gedimpt: "#546070"
  txt-licht-gedimpt: "#7a8a9a"
typography:
  display:
    fontFamily: "'Fraunces', serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "'Fraunces', serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "'Space Mono', monospace"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.06em"
rounded:
  pill: "100px"
  card: "16px"
  sm: "10px"
  xs: "8px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.bosrand}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "15px 26px"
  button-primary-hover:
    backgroundColor: "{colors.bosrand-mid}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "15px 26px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.txt-licht-gedimpt}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  input-field:
    backgroundColor: "{colors.warm-ivoor}"
    textColor: "{colors.avondlucht}"
    rounded: "{rounded.xs}"
    padding: "13px 14px"
  saldo-hero:
    backgroundColor: "{colors.avondlucht-mid}"
    textColor: "{colors.bosrand-lite}"
    rounded: "{rounded.card}"
    padding: "24px 20px"
---

# Design System: Vroom

## 1. Overview

**Creative North Star: "Het Buitenspiegel"**

The wing mirror. A tool you glance at for two seconds while doing something else entirely. Vroom is not a dashboard you sit down with; it is a glance that happens while unlocking the car, at a red light, or right before a bank transfer. Everything in this system earns its place by answering one question: can Ingmar read this in three seconds and know where he stands?

The system lives mostly in the dark: deep Avondlucht navy surfaces that recede into the background so the information — and only the information — holds the eye. When cream surfaces appear, they signal input: here is where you fill something in. The green accent, Bosrand, is reserved for actions and positive numbers. Fout-rood for negative balance. The system never decorates; it reports.

This is a warm and functional system. Warmth comes from Fraunces and the cream input surfaces, not from gradients or rounded-everything. Functional means no element is present for atmosphere alone. The Dutch directness from PRODUCT.md runs through to the copy, the spacing, and the component density: just enough, never too much.

It explicitly rejects the sterile cold of banking apps (ING, ABN AMRO mobile: white backgrounds, conservative type, zero personality) and the noisy self-importance of SaaS dashboards (hero metrics in navy and teal, identical card grids, gradient accents that try too hard).

**Key Characteristics:**
- Dark-primary theme justified by glanceable on-the-go use in variable ambient light
- Tonal layering for depth: three dark steps (avondlucht, avondlucht-mid, avondlucht-surface), no decorative shadows
- Two-register system: dark for reading, cream for writing
- Three-font trio: Fraunces for personality, DM Sans for clarity, Space Mono for precision data
- Pill-shaped primary actions; card-radius (16px) for containers
- Saldo is always the typographic hero on any screen that has one


## 2. Colors: The Avondlucht Palette

The palette is committed and restrained simultaneously: committed to the dark navy, restrained with the green. Bosrand appears on actions, active states, and positive numbers. It never decorates; it signals.

### Primary
- **Bosrand Groen** (`#4e7d52`, oklch(52% 0.09 145)): The single accent. Used on primary buttons, active nav icons, positive saldo values, and the road dashes in the car animation. Nowhere else.
- **Bosrand Lite** (`#7ab87a`, oklch(71% 0.11 145)): On-dark foreground for Bosrand-tinted text (labels, active states on dark surfaces). Never used as a background.

### Secondary
- **Fout-rood** (`#c94040`, oklch(53% 0.18 25)): Negative saldo, error states, delete actions. Never used decoratively. If it appears, something needs attention.

### Neutral (Dark)
- **Avondlucht** (`#1b2537`): The base. Screen backgrounds, fullscreen overlays. The surface everything else sits on.
- **Avondlucht Mid** (`#232f44`): Secondary screens, bottom sheet surfaces, changelog cards.
- **Avondlucht Surface** (`#2a3850`): Cards within dark screens, toggle backgrounds, form elements within dark context.
- **Avondlucht Border** (`#35445e`): Dividers, input borders, and card outlines on dark surfaces.
- **Txt-donker** (`#dce8f4`): Primary text on dark surfaces. Faintly blue-tinted white; never pure `#fff`.
- **Txt-donker-gedimpt** (`#546070`): Secondary/muted text on dark surfaces. Handle bars, placeholders, supporting data.

### Neutral (Light)
- **Warm Ivoor** (`#f0ebe0`): Light surface background. Used exclusively for input areas and the cream-register screens (auto-selectie, form sections). Its presence signals "this is where you write."
- **Warm Ivoor 2** (`#e6e0d2`): Borders and dividers on cream surfaces.
- **Txt-licht-gedimpt** (`#7a8a9a`): Muted text and labels on light/cream surfaces.

### Named Rules
**The Bosrand Restraint Rule.** Bosrand appears on ≤15% of any given screen. Its rarity is what makes it readable as a signal. If a screen feels green, there is too much green.

**The Two-Register Rule.** Dark surfaces are for reading. Cream surfaces are for writing. Never put an editable input field on a dark background. Never use cream as a general container background.


## 3. Typography

**Display Font:** Fraunces (opsz 9..144, wght 600-700), with Georgia, serif fallback
**Body Font:** DM Sans (wght 400-600), with system sans-serif fallback
**Label/Mono Font:** Space Mono (wght 400, 700), with monospace fallback

**Character:** Fraunces is the personality: optical, warm, slightly editorial, confident without being loud. DM Sans is the workhorse: humanist, readable at small sizes, never sterile. Space Mono is the precision layer: every number, every label, every stat. The trio creates a clear hierarchy of voice: Fraunces says something, DM Sans explains it, Space Mono proves it.

### Hierarchy
- **Display** (700, 2.5rem, lh 1.1, Fraunces): The saldo number. Intro screen hero headings. Used exactly once per screen when it appears. Its presence should feel significant.
- **Headline** (600, 1.35rem, lh 1.2, Fraunces): Section titles, changelog titles, bottom sheet headings. Never more than two per screen.
- **Title** (600, 0.95rem, lh 1.3, DM Sans): Card titles, item headings, navigation-level labels.
- **Body** (400-500, 0.88rem, lh 1.55, DM Sans): All paragraph text, list item descriptions, form help text. Max line length 65ch on any read-heavy surface.
- **Label** (700, 0.72rem, lh 1.3, Space Mono, letter-spacing 0.06em, uppercase or lowercase tracked): Data labels, stat captions, chip text, all numeric values paired with a unit. All money amounts. Every kilometer count.

### Named Rules
**The Mono Numbers Rule.** Every number in the interface uses Space Mono, regardless of surrounding font. Proportional-width number rendering in DM Sans creates unsteady alignment in changing values. Space Mono locks them.

**The One Display Rule.** Fraunces Display is used once per screen. If it appears twice, one of those instances should be a Headline.


## 4. Elevation

Vroom uses tonal layering on dark surfaces, not shadows. Depth is expressed by lightness steps: Avondlucht (darkest) at the base, Avondlucht Mid for overlaid surfaces, Avondlucht Surface for interactive cards and inset elements. This keeps the interface flat and legible in all ambient conditions, including direct sunlight on a phone screen.

Light (cream) surfaces use minimal ambient shadow for lift, never for decoration.

### Shadow Vocabulary
- **Card lift on cream** (`box-shadow: 0 2px 10px rgba(0,0,0,0.05)`): Used on `.shortcut-kaart` and similar white/cream cards within light-register screens. Signals that the surface is elevated above the page. Never used on dark surfaces.
- **Drop shadows for visual chrome** (`filter: drop-shadow(0 8px 24px rgba(0,0,0,0.4))`): Used on visual elements (intro map preview, install sheet illustrations) to lift decorative surfaces from the background. Not a UI pattern.

### Named Rules
**The Flat-Dark Rule.** Dark surfaces never receive box-shadow. Elevation on dark is expressed by surface lightness. If something needs to feel higher on a dark background, lighten its background color by one step in the Avondlucht scale.

**The Cream Lift Rule.** Box-shadow is permitted on light/cream surfaces only, and only with opacity below 0.08. It is ambient lift, not structural depth.


## 5. Components

The component system is warm and functional: cream inputs with clear focus treatment, pill-shaped primary actions, 16px radius cards. Nothing is decorative.

### Buttons
- **Shape:** Fully rounded pill (100px radius) for primary and secondary actions. Signals a decisive, single action.
- **Primary** (Bosrand `#4e7d52` fill, white text, 15px/26px padding, Space Mono 700, 0.18em letter-spacing, uppercase tracking): The single call to action per screen. "Opslaan", "Start rit", "Toevoegen". Scale(0.96) on active.
- **Ghost / Secondary** (no fill, `txt-licht-gedimpt` text, same padding): Dismissive actions. "Annuleren", "Misschien later". Never Bosrand.
- **Hover/Active:** Primary darkens to bosrand-mid (`#5e9464`). 0.15s transition. Active: scale(0.96) transform. No box-shadow on hover.

### Chips / Pills
- **Inactive:** Avondlucht Surface fill, Avondlucht Border outline, txt-donker-gedimpt text. 8px radius or 100px pill depending on context.
- **Active / positive state:** Bosrand-bg fill (`#d4e8d4`), bosrand text. Used for active nav, rit pill indicator.
- **Error state:** Fout-rood tint fill, fout-rood border. Negative saldo indicators.

### Cards / Containers
- **Dark cards** (Avondlucht Mid or Surface background, Avondlucht Border top/side): 16px radius. No box-shadow. Padding varies for rhythm: 16px for dense items, 20-24px for content cards.
- **Cream cards** (Warm Ivoor background): 16px radius, optional light box-shadow (0 2px 10px rgba(0,0,0,0.05)). Used in light-register screens only.
- **Never nest cards.** A card inside a card is always wrong. Use dividers, spacing, or list items instead.

### Inputs / Fields
- **Style:** Warm Ivoor background (`#f0ebe0`), 1.5px Warm Ivoor 2 border, 8px radius. DM Sans body text, `avondlucht` color.
- **Focus:** Border shifts to bosrand (`#4e7d52`), 2px. No glow, no box-shadow. The border color change is the signal.
- **Placeholder:** `txt-licht-gedimpt` (`#7a8a9a`).
- **Error:** Fout-rood border, fout-rood helper text below.
- **Select elements** match input styling exactly. No custom arrow glyph beyond the browser default.

### Navigation
- **Bottom nav bar:** Dark surface (avondlucht), icon + label layout, 4 tabs. Active tab: bosrand-lite icon, bosrand-bg pill behind icon. Inactive: txt-donker-gedimpt. Font: Space Mono 0.58rem uppercase. Safe area inset on bottom for iOS/Android.
- **Tab transitions:** Horizontal slide (tab-from-right / tab-from-left), 0.28s cubic-bezier(0.22, 1, 0.36, 1). Never fade-only; the direction communicates position.

### Saldo Hero (Signature Component)
The saldo display is the primary surface of the app. It sits in the content tab header area, always visible when the app is open.
- **Structure:** Large Space Mono value (display role), DM Sans label above, DM Sans subtitle below. Three secondary stats alongside.
- **Positive saldo:** Bosrand-lite text for the main value.
- **Negative saldo:** Fout-rood text for the main value.
- **Zero:** Txt-donker, no color treatment.
- **This is the one place the Display type role is used in the main app.** Do not use Fraunces Display anywhere else in the main tab screens.

### Bottom Sheet
Slides up from the screen bottom. Avondlucht Mid surface, 24px top radius. Handle bar (36px x 4px, Avondlucht Border fill) at the top center. Padding-bottom respects safe-area-inset-bottom. Transition: 0.38s cubic-bezier(0.22, 1, 0.36, 1).


## 6. Do's and Don'ts

### Do:
- **Do** use Space Mono for every number in the interface, including saldo values, kilometer counts, and fuel prices.
- **Do** use Fraunces (Display) at most once per screen. If the saldo hero is on screen, that is the display instance.
- **Do** use the Two-Register Rule: dark surface for reading screens, cream for input/form screens.
- **Do** use tonal layering (Avondlucht steps) for depth on dark surfaces. Box-shadows are for cream surfaces only, at opacity below 0.08.
- **Do** use pill shape (100px radius) for all primary action buttons. It distinguishes actions from containers.
- **Do** keep Bosrand rare. Saldo values, primary buttons, active nav: that is the full list of Bosrand uses.
- **Do** scale primary buttons on active (transform: scale(0.96)) instead of background darkening alone. The haptic-feeling feedback matters on mobile.
- **Do** vary padding for rhythm: 8px, 16px, 24px, 32px are the four steps. No element should have the same padding as every surrounding element.

### Don't:
- **Don't** use this system as a banking or finance app. ING, ABN AMRO, Revolut: conservative, sterile, cold. Zero personality. This is the explicit anti-reference. If a new screen looks like a banking app, it is wrong.
- **Don't** build SaaS dashboard screens: no navy-plus-teal color schemes, no hero-metric templates (big number, small label, gradient accent), no identical card grids.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe. Prohibited. Use background tints, full borders, or icons instead.
- **Don't** use gradient text (`background-clip: text`). Decorative, never meaningful. Use a single solid color with weight or size for emphasis.
- **Don't** use glassmorphism decoratively. Backdrop-filter blur is permitted only on overlays (bottom sheet backdrop, info overlay backdrop) where it serves a structural function.
- **Don't** put box-shadow on dark surfaces. Tonal layering is the depth mechanism on dark.
- **Don't** use DM Sans for numbers. Space Mono only for all numeric values.
- **Don't** use Fraunces Display more than once per screen. One hero, one voice.
- **Don't** nest cards. A card containing another card is always a layout failure. Restructure with dividers or list items.
- **Don't** use Bosrand for decoration. It must mean something: an action, an active state, or a positive value. If it appears on a non-interactive, non-positive-saldo element, it is misused.
