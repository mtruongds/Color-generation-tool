import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select';
import { resolveColorRoles } from '../../lib/tokens';
import { type ColorScale, getSurfaceColor } from '../../lib/color-utils';
import type { GeneratedPalette } from '../../lib/export-utils';

export const TOOLTIPS_KEY = 'lumina_preview_tooltips';

export function loadTooltipsOn() {
  try {
    return localStorage.getItem(TOOLTIPS_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Exposes both scales as --a1…--a12 / --g1…--g12 so every element below can style itself from tokens. */
export function scaleVars(accent: ColorScale, gray: ColorScale): React.CSSProperties {
  const vars: Record<string, string> = {
    '--bg': accent.background,
    '--a-contrast': accent.contrast,
    '--a-surface': getSurfaceColor(accent).rgba,
    '--g-surface': getSurfaceColor(gray).rgba,
  };
  accent.colors.forEach((c, i) => (vars[`--a${i + 1}`] = c));
  gray.colors.forEach((c, i) => (vars[`--g${i + 1}`] = c));
  return { ...vars, backgroundColor: 'var(--bg)', color: 'var(--g12)' } as React.CSSProperties;
}

/** Accent palettes first, then grays, so the defaults follow each palette's role. */
export function defaultPreviewPalettes(palettes: GeneratedPalette[], activeId?: string) {
  const accents = palettes.filter((p) => (p.role ?? 'accent') === 'accent');
  const grays = palettes.filter((p) => p.role === 'gray');
  const roles = resolveColorRoles(palettes);
  return {
    accentId: (accents.find((p) => p.id === activeId) ?? accents[0] ?? palettes[0])?.id,
    grayId: (grays.find((p) => roles.get(p.id) === 'neutral') ?? grays[0] ?? palettes[0])?.id,
  };
}

/** Accent and Gray pickers, shared by every preview page. */
export function PreviewPaletteControls({
  palettes,
  accentId,
  grayId,
  onAccentChange,
  onGrayChange,
}: {
  palettes: GeneratedPalette[];
  accentId: string;
  grayId: string;
  onAccentChange: (id: string) => void;
  onGrayChange: (id: string) => void;
}) {
  const accents = palettes.filter((p) => (p.role ?? 'accent') === 'accent');
  const grays = palettes.filter((p) => p.role === 'gray');
  return (
    <>
      <PaletteSelect label="Accent" value={accentId} onChange={onAccentChange} palettes={palettes} preferred={accents} />
      <PaletteSelect label="Gray" value={grayId} onChange={onGrayChange} palettes={palettes} preferred={grays} />
    </>
  );
}

function PaletteSelect({
  label,
  value,
  onChange,
  palettes,
  preferred,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  palettes: GeneratedPalette[];
  preferred: GeneratedPalette[];
}) {
  const others = palettes.filter((p) => !preferred.includes(p));
  const item = (p: GeneratedPalette) => (
    <SelectItem key={p.id} value={p.id}>
      <span className="size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]" style={{ backgroundColor: p.scale.colors[8] }} />
      {p.name || 'Untitled'}
    </SelectItem>
  );

  return (
    <Select value={value} onValueChange={onChange}>
      {/* The label sits inside the trigger so the toolbar stays one compact row */}
      <SelectTrigger size="sm" className="w-auto min-w-32 gap-1.5 bg-card" aria-label={`${label} palette`}>
        <span className="text-muted-foreground">{label}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {preferred.length > 0 && <SelectGroup>{preferred.map(item)}</SelectGroup>}
        {others.length > 0 && (
          <SelectGroup>
            <SelectLabel>Other palettes</SelectLabel>
            {others.map(item)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

// ============================================================
// Step tooltips
// ============================================================

/**
 * Wraps a preview so hovering any element tagged with `data-tokens` outlines it and shows
 * which accent and gray steps it uses.
 */
export function StepTokenLayer({
  accent,
  gray,
  showTokens,
  className,
  style,
  children,
}: {
  accent: ColorScale;
  gray: ColorScale;
  showTokens: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    if (!showTokens) setHover(null);
  }, [showTokens]);

  // Outline the hovered element itself (see [data-token-hover] in index.css) so the dashed
  // ring always tracks the element, instead of a fixed overlay sized from a stale rect
  const hoveredEl = hover?.el;
  useEffect(() => {
    if (!hoveredEl) return;
    hoveredEl.setAttribute('data-token-hover', '');
    return () => hoveredEl.removeAttribute('data-token-hover');
  }, [hoveredEl]);

  // The tooltip is fixed-positioned, so drop it once the page scrolls under it
  useEffect(() => {
    if (!hover) return;
    const clear = () => setHover(null);
    window.addEventListener('scroll', clear, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', clear, { capture: true });
  }, [hover]);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showTokens) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tokens]');
    if (!el || !e.currentTarget.contains(el)) return setHover(null);
    setHover({ el, tokens: el.dataset.tokens ?? '', x: e.clientX, y: e.clientY });
  };

  return (
    <div className={className} style={style} onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}>
      {children}
      {hover && <StepTooltip hover={hover} accent={accent} gray={gray} />}
    </div>
  );
}

interface HoverState {
  el: HTMLElement;
  tokens: string;
  x: number;
  y: number;
}

// Step references inside a data-tokens description, e.g. "solid: a9 → a10 · text: contrast"
const TOKEN_RE = /\b([ag]\d{1,2}|contrast|accent surface|gray surface|background)\b/g;

function resolveToken(token: string, accent: ColorScale, gray: ColorScale) {
  const step = token.match(/^([ag])(\d{1,2})$/);
  if (step) {
    const scale = step[1] === 'a' ? accent : gray;
    return { label: `${step[1] === 'a' ? 'Accent' : 'Gray'} ${step[2]}`, color: scale.colors[Number(step[2]) - 1] };
  }
  if (token === 'contrast') return { label: 'Accent contrast', color: accent.contrast };
  if (token === 'accent surface') return { label: 'Accent surface', color: getSurfaceColor(accent).hex8 };
  if (token === 'gray surface') return { label: 'Gray surface', color: getSurfaceColor(gray).hex8 };
  return { label: 'Background', color: accent.background };
}

function StepTooltip({ hover, accent, gray }: { hover: HoverState; accent: ColorScale; gray: ColorScale }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Measure before paint so the first frame isn't placed with a 0×0 size and then jump
  useLayoutEffect(() => {
    if (ref.current) setSize({ width: ref.current.offsetWidth, height: ref.current.offsetHeight });
  }, [hover.tokens]);

  // Follow the cursor, flipping to stay inside the viewport
  const gap = 14;
  const left = hover.x + gap + size.width > window.innerWidth - 8 ? hover.x - gap - size.width : hover.x + gap;
  const top = hover.y + gap + size.height > window.innerHeight - 8 ? hover.y - gap - size.height : hover.y + gap;

  // Portal to <body> so `fixed` is always relative to the viewport, whatever the ancestors' CSS
  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[24rem] space-y-1.5 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
    >
      {hover.tokens.split(' · ').map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1">
          {row.split(TOKEN_RE).map((part, j) => {
            if (j % 2 === 0) return part ? <span key={j} className="text-muted-foreground">{part}</span> : null;
            const { label, color } = resolveToken(part, accent, gray);
            return (
              <span key={j} className="inline-flex items-center gap-1 rounded bg-muted px-1 py-0.5">
                <span className="checkerboard size-3 overflow-hidden rounded-sm">
                  <span className="block size-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]" style={{ backgroundColor: color }} />
                </span>
                <span className="font-medium">{label}</span>
                <span className="font-mono text-[0.625rem] text-muted-foreground uppercase">{color}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>,
    document.body,
  );
}
