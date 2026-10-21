# Lumina — Design Foundations Generator

Generate the foundations of a design system from a few inputs, preview them live, and export design tokens:

- **Color** — Radix-style 12-step scales (solid + alpha) from a single base color, with APCA/WCAG contrast checks
- **Typography** — a responsive type scale from a base size and a ratio, with font pairing, weights, snapped line heights and optical tracking
- **Spacing** — a scale of multiples of one base unit, linear or geometric
- **Radius** — corner radii scaled from one base value
- **Shadow** — layered, tintable elevation levels, tuned separately for light and dark
- **Layout grid** — breakpoints, columns, gutters, margins, a content cap and an optional sidebar

Exports: CSS, Tailwind v4, W3C JSON tokens, Figma variables (one collection per file) and a Sheets CSV for colors.

### Token tiers

Every export is layered **primitive → base → semantic**; each tier only references the one below it.

| Tier | What it holds | Examples |
|---|---|---|
| Primitive | Raw values, named so a config change never renames them | `brand-scale-9`, `font-size-step-5`, `space-4`, `radius-1`, `elevation-4`, `grid-md-columns` |
| Base | Roles that alias primitives; dark mode and breakpoints swap them | `brand-9`, `font-size-4xl`, `space-md`, `radius-md`, `shadow-md`, `grid-columns` |
| Semantic | Purposes that alias base tokens — use these in components | `bg-brand`, `text-h1-size`, `padding-card`, `radius-control`, `shadow-dialog`, `page-margin` |

Primitive names never encode their value, so changing the base, ratio, fonts or colors keeps every name: spacing and radius use multipliers of the base (`space-4` is 4 × base, `radius-1` is md), type uses scale steps (`font-size-step-0` is body, `step-n1` one down, `-mobile` below the type breakpoint), font families use slots (`font-family-primary`, `-secondary`, `-mono`), and colors use the palette's name — names starting with a role word get `-scale` (Brand → `brand-scale-9`). Each palette's **token role** (brand, secondary, neutral, info, success, warning, danger) is set in its inspector, or guessed from its name; the default palettes Brand and Neutral fill brand and neutral. Base and semantic tokens can be re-pointed or added in the **Tokens** view. CSS, Tailwind and JSON contain light and dark together; base tokens switch under `.dark` (put the class on `<html>`). Figma exports one mode per file.

Original design: https://www.figma.com/design/jGuf8eCUhTKBJDkFGUPHzQ/Color-Generation-Toolv2.5

## Running the code

```sh
npm i
npm run dev     # http://localhost:3000
npm run build   # outputs to dist/
```

## Project structure

- `src/components/palette-generator/`
  - `PaletteGenerator.tsx` — app shell: header, foundations + palettes sidebar, canvas, inspector
  - `PaletteSidebar.tsx` — palette list (select, add, reorder, duplicate, delete)
  - `PaletteInspector.tsx` — editing panel for the active palette
  - `PaletteDisplay.tsx` — scale card with Solid / Alpha / Contrast views
  - `PaletteDocumentation.tsx` — Docs view (token reference table + previews)
  - `ExportDialog.tsx` — export by scope (all or one foundation): CSS, Tailwind, JSON, Figma, Sheets CSV
  - `PresetsMenu.tsx` — save / open / import / export presets (palettes + foundation settings)
- `src/components/foundations/`
  - `FoundationNav.tsx` — foundation list in the sidebar
  - `TypographyFoundation.tsx`, `SpacingFoundation.tsx`, `RadiusFoundation.tsx`, `ShadowFoundation.tsx`, `GridFoundation.tsx` — canvas + inspector for each foundation
  - `FoundationDocs.tsx` — Docs view for each foundation: do/don't guidelines and a token reference table
  - `FoundationPreview.tsx` — Preview view: a sample page built from every foundation, with the current one highlighted
  - `FoundationSample.tsx` — compact sample UI shown under each editor
  - `inspector-controls.tsx` — shared inspector fields
- `src/lib/color-utils.ts` — scale generation, alpha conversion, contrast math
- `src/lib/export-utils.ts` — color token generators shared by export and docs
- `src/lib/foundations.ts` — foundation configs, defaults and generators
- `src/lib/tokens.ts` — the tiered token model (primitive → base → semantic) and color roles
- `src/lib/foundation-export.ts` — CSS, Tailwind, JSON and Figma formatters over the token model
- `src/lib/fonts.ts` — font options and on-demand Google Fonts loading
- `src/index.css` — Tailwind v4 entry and theme tokens (light + dark)

Palettes, foundation settings and presets are stored in `localStorage`, so work survives a reload.
