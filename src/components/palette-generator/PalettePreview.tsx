import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { resolveColorRoles } from '../../lib/tokens';
import { type ColorScale, getSurfaceColor } from '../../lib/color-utils';
import type { GeneratedPalette } from '../../lib/export-utils';

export const TOOLTIPS_KEY = 'monism_preview_tooltips';

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

/** A token a foundation value can switch to in the preview. `value` is the CSS it becomes. */
export interface TokenOption {
  token: string;
  value: string;
  /** Shown after the token in the picker, e.g. "16px". */
  note?: string;
}

/** One value of a row, e.g. the top padding of "space-2 space-4". */
export interface TokenPart {
  current: string;
  options: TokenOption[];
}

/** A tooltip row the user can try other tokens on: its values and the CSS and tags they turn into. */
export interface RowEditor {
  label: FoundationRow['label'];
  parts: TokenPart[];
  /** CSS properties (kebab-case) and attributes for the picked values, one per part. */
  apply: (values: string[]) => { css: Record<string, string>; attrs?: Record<string, string> };
}

/** Tokens tried on one element. Lives only in the preview: never saved, never exported. */
interface Override {
  /** The element before the first change, to undo to. */
  before: { style: string | null; attrs: Record<string, string | null> };
  /** Each changed row: the token it started on, and what was applied. */
  rows: Partial<Record<FoundationRow['label'], { was: string; css: Record<string, string>; attrs: Record<string, string> }>>;
}

/**
 * Elements are found again by their position under the layer, since React rebuilds many of them
 * on every render and a stored node would go stale.
 */
function pathOf(el: Element, root: Element): string {
  const steps: number[] = [];
  for (let n = el; n !== root && n.parentElement; n = n.parentElement) steps.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
  return steps.join('/');
}

function atPath(root: Element, path: string): HTMLElement | null {
  let n: Element | undefined = root;
  for (const i of path ? path.split('/') : []) n = n?.children[Number(i)];
  return (n as HTMLElement | undefined) ?? null;
}

function paint(el: HTMLElement, o: Override) {
  for (const row of Object.values(o.rows)) {
    if (!row) continue;
    for (const [k, v] of Object.entries(row.css)) if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v);
    for (const [k, v] of Object.entries(row.attrs)) if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  }
}

function unpaint(el: HTMLElement, o: Override) {
  if (o.before.style === null) el.removeAttribute('style');
  else el.setAttribute('style', o.before.style);
  for (const [k, v] of Object.entries(o.before.attrs)) {
    if (v === null) el.removeAttribute(k);
    else el.setAttribute(k, v);
  }
}

/**
 * Wraps a preview so hovering any element tagged with `data-tokens` outlines it and shows
 * which accent and gray steps it uses, plus any foundation tokens it carries (`data-fx-*`).
 * With `edit`, clicking an element pins the tooltip so its foundation tokens can be swapped,
 * to see what each one does. Swaps stay in the preview.
 */
export function StepTokenLayer({
  accent,
  gray,
  showTokens,
  inspect,
  edit,
  resetKey,
  className,
  style,
  children,
}: {
  accent: ColorScale;
  gray: ColorScale;
  showTokens: boolean;
  /** Reads foundation tokens off an element's own styles, for elements nobody tagged. */
  inspect?: (el: HTMLElement) => FoundationRow[];
  /** The rows of an element that can try other tokens. */
  edit?: (el: HTMLElement, rows: FoundationRow[]) => RowEditor[];
  /** Swaps are dropped when this changes, e.g. on another page or layout. */
  resetKey?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [pinned, setPinned] = useState<{ path: string; x: number; y: number } | null>(null);
  const overrides = useRef(new Map<string, Override>());
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const reapply = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const [path, o] of overrides.current) {
      const el = atPath(root, path);
      if (el) paint(el, o);
    }
  }, []);

  // React rewrites elements from props, so put the swaps back after each render and each rebuild
  useLayoutEffect(reapply);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new MutationObserver(reapply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [reapply]);

  const resetAll = useCallback(() => {
    const root = rootRef.current;
    for (const [path, o] of overrides.current) {
      const el = root && atPath(root, path);
      if (el) unpaint(el, o);
    }
    overrides.current.clear();
    setPinned(null);
    setVersion((v) => v + 1);
  }, []);

  // Positions point at other elements on another page or layout
  useEffect(() => {
    if (overrides.current.size) resetAll();
  }, [resetKey, resetAll]);

  useEffect(() => {
    if (showTokens) return;
    setHover(null);
    setPinned(null);
  }, [showTokens]);

  const pinnedEl = pinned && rootRef.current ? atPath(rootRef.current, pinned.path) : null;

  // Outline the hovered element itself (see [data-token-hover] in index.css) so the dashed
  // ring always tracks the element, instead of a fixed overlay sized from a stale rect
  const outlined = pinnedEl ?? hover?.el;
  useEffect(() => {
    if (!outlined) return;
    outlined.setAttribute('data-token-hover', '');
    return () => outlined.removeAttribute('data-token-hover');
  }, [outlined]);

  // Tooltip and popover are fixed-positioned, so drop them once the page scrolls under them
  const open = !!hover || !!pinned;
  useEffect(() => {
    if (!open) return;
    const clear = () => {
      setHover(null);
      setPinned(null);
    };
    window.addEventListener('scroll', clear, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', clear, { capture: true });
  }, [open]);

  // A pinned popover closes on Escape or a press anywhere else
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setPinned(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  const target = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(HOVER_SELECTOR);
    return el && e.currentTarget.contains(el) ? el : null;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showTokens || pinned) return;
    const el = target(e);
    if (!el) return setHover(null);
    const foundations = foundationRows(el, e.currentTarget, inspect);
    const editable = !!edit && edit(el, foundations).length > 0;
    setHover({ el, tokens: el.dataset.tokens ?? '', foundations, editable, x: e.clientX, y: e.clientY });
  };

  // Clicking an element with swappable tokens pins its tooltip instead of pressing it
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showTokens || !edit) return;
    const el = target(e);
    if (!el || !edit(el, foundationRows(el, e.currentTarget, inspect)).length) return;
    e.preventDefault();
    e.stopPropagation();
    setHover(null);
    setPinned({ path: pathOf(el, e.currentTarget), x: e.clientX, y: e.clientY });
  };

  const resetRow = (path: string, label: FoundationRow['label']) => {
    const o = overrides.current.get(path);
    const el = rootRef.current && atPath(rootRef.current, path);
    if (!o) return;
    delete o.rows[label];
    if (el) unpaint(el, o);
    if (Object.keys(o.rows).length) {
      if (el) paint(el, o);
    } else overrides.current.delete(path);
    bump();
  };

  const change = (path: string, el: HTMLElement, editor: RowEditor, now: string, tokens: string[]) => {
    const o = overrides.current.get(path) ?? { before: { style: el.getAttribute('style'), attrs: {} }, rows: {} };
    const was = o.rows[editor.label]?.was ?? now;
    // Picking the starting tokens again is an undo
    if (tokens.join(' ') === was) return resetRow(path, editor.label);
    const values = tokens.map((t, i) => editor.parts[i].options.find((opt) => opt.token === t)?.value ?? t);
    const { css, attrs = {} } = editor.apply(values);
    for (const k of Object.keys(attrs)) if (!(k in o.before.attrs)) o.before.attrs[k] = el.getAttribute(k);
    o.rows[editor.label] = { was, css, attrs };
    overrides.current.set(path, o);
    unpaint(el, o);
    paint(el, o);
    bump();
  };

  let popover: React.ReactNode = null;
  if (pinned && pinnedEl && rootRef.current) {
    const rows = foundationRows(pinnedEl, rootRef.current, inspect);
    const editors = new Map((edit?.(pinnedEl, rows) ?? []).map((r) => [r.label, r]));
    const o = overrides.current.get(pinned.path);
    popover = (
      <FloatingCard innerRef={popRef} x={pinned.x} y={pinned.y} interactive deps={[pinned, version]}>
        <ColorRows tokens={pinnedEl.dataset.tokens ?? ''} accent={accent} gray={gray} />
        {rows.length > 0 && (
          <div className={cn('grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5', pinnedEl.dataset.tokens && 'border-t pt-1.5')}>
            {rows.map((row) => {
              const editor = editors.get(row.label);
              const was = o?.rows[row.label]?.was;
              return (
                <Fragment key={row.label}>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="flex items-center gap-1.5">
                    {editor ? (
                      editor.parts.map((part, i) => (
                        // Own chevron in reserved space: the native arrow sits over long labels
                        <span key={i} className="relative inline-flex">
                          <select
                            aria-label={`${row.label}${editor.parts.length > 1 ? ` ${i + 1}` : ''}`}
                            value={part.current}
                            onChange={(e) =>
                              change(pinned.path, pinnedEl, editor, row.token, editor.parts.map((p, j) => (j === i ? e.target.value : p.current)))
                            }
                            className={cn(
                              'h-6 max-w-44 cursor-pointer appearance-none truncate rounded border bg-background pr-6 pl-1.5 font-mono text-[0.625rem] font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                              was && 'border-ring',
                            )}
                          >
                            {part.options.map((opt) => (
                              <option key={opt.token} value={opt.token}>
                                {opt.note ? `${opt.token} · ${opt.note}` : opt.token}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        </span>
                      ))
                    ) : (
                      <span className="rounded bg-muted px-1 py-0.5 font-mono text-[0.625rem] font-medium">{row.token}</span>
                    )}
                    {was ? (
                      <button
                        type="button"
                        onClick={() => resetRow(pinned.path, row.label)}
                        className="cursor-pointer rounded px-1 font-mono text-[0.625rem] text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={`Back to ${was}`}
                      >
                        was {was} ↺
                      </button>
                    ) : (
                      !editor && row.value && <span className="font-mono text-[0.625rem] text-muted-foreground">{row.value}</span>
                    )}
                  </span>
                </Fragment>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-3 border-t pt-1.5 text-[0.6875rem] text-muted-foreground">
          <span>Preview only · not saved or exported</span>
          {overrides.current.size > 0 && (
            <button type="button" onClick={resetAll} className="ml-auto cursor-pointer font-medium text-foreground hover:underline">
              Reset all ({overrides.current.size})
            </button>
          )}
        </div>
      </FloatingCard>
    );
  }

  return (
    <div
      ref={rootRef}
      className={className}
      style={style}
      onMouseMove={onMouseMove}
      onClickCapture={onClickCapture}
      onMouseLeave={() => setHover(null)}
    >
      {children}
      {hover && !pinned && (
        <FloatingCard x={hover.x} y={hover.y} deps={[hover.tokens, hover.foundations]}>
          <ColorRows tokens={hover.tokens} accent={accent} gray={gray} />
          {hover.foundations.length > 0 && (
            <div className={cn('grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1', hover.tokens && 'border-t pt-1.5')}>
              {hover.foundations.map((row) => (
                <Fragment key={row.label}>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1 py-0.5 font-mono text-[0.625rem] font-medium">{row.token}</span>
                    {row.value && <span className="font-mono text-[0.625rem] text-muted-foreground">{row.value}</span>}
                  </span>
                </Fragment>
              ))}
            </div>
          )}
          {hover.editable && <div className="border-t pt-1.5 text-[0.6875rem] text-muted-foreground">Click to try other tokens</div>}
        </FloatingCard>
      )}
      {popover}
    </div>
  );
}

interface HoverState {
  el: HTMLElement;
  tokens: string;
  foundations: FoundationRow[];
  /** Whether a click pins it to swap tokens. */
  editable: boolean;
  x: number;
  y: number;
}

/** Foundation tags a preview element can carry: `data-fx-<key>` and `data-fx-<key>-value`. */
const FOUNDATION_TAGS = ['typography', 'spacing', 'radius', 'shadow'] as const;

/** Tooltip rows, in order. */
const FOUNDATION_LABELS = ['Text style', 'Padding', 'Gap', 'Radius', 'Elevation', 'Grid'] as const;

const HOVER_SELECTOR = ['[data-tokens]', ...FOUNDATION_TAGS.map((key) => `[data-fx-${key}]`)].join(', ');

export interface FoundationRow {
  label: (typeof FOUNDATION_LABELS)[number];
  token: string;
  value?: string;
}

/** What the element's styles resolve to, filled in by its tags where the styles say nothing. */
function foundationRows(el: HTMLElement, root: HTMLElement, inspect?: (el: HTMLElement) => FoundationRow[]): FoundationRow[] {
  const rows = inspect?.(el) ?? [];
  for (const key of FOUNDATION_TAGS) {
    const token = el.getAttribute(`data-fx-${key}`);
    if (!token) continue;
    const label =
      key === 'typography' ? 'Text style' : key === 'radius' ? 'Radius' : key === 'shadow' ? 'Elevation' : token.startsWith('gap') ? 'Gap' : 'Padding';
    if (!rows.some((r) => r.label === label)) rows.push({ label, token, value: el.getAttribute(`data-fx-${key}-value`) ?? undefined });
  }
  const grid = gridPlacement(el, root);
  if (grid) rows.push({ label: 'Grid', ...grid });
  return rows.sort((a, b) => FOUNDATION_LABELS.indexOf(a.label) - FOUNDATION_LABELS.indexOf(b.label));
}

/** The columns the nearest grid-placed block around `el` spans, e.g. "cols 1–8" of 12. */
function gridPlacement(el: HTMLElement, root: HTMLElement): { token: string; value: string } | null {
  for (let node: HTMLElement | null = el; node && node !== root; node = node.parentElement) {
    const placement = node.style.gridColumn;
    const parent = node.parentElement;
    if (!placement || !parent) continue;
    const total = getComputedStyle(parent).gridTemplateColumns.split(' ').filter(Boolean).length;
    if (!total) continue;
    const [startRaw, endRaw = ''] = placement.split('/').map((p) => p.trim());
    const span = (startRaw.match(/^span (\d+)$/) ?? endRaw.match(/^span (\d+)$/))?.[1];
    const start = Number(startRaw) || 1;
    const end = span ? start + Number(span) : endRaw === '-1' ? total + 1 : Number(endRaw) || start + 1;
    const cols = end - start;
    return { token: cols >= total ? 'full width' : `cols ${start}–${end - 1}`, value: `${cols} of ${total}` };
  }
  return null;
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

/** The accent and gray steps a `data-tokens` description names, each with its swatch. */
function ColorRows({ tokens, accent, gray }: { tokens: string; accent: ColorScale; gray: ColorScale }) {
  if (!tokens) return null;
  return (
    <>
      {tokens.split(' · ').map((row, i) => (
    <div key={i} className="flex items-center gap-1">
      {row.split(TOKEN_RE).map((part, j) => {
        if (j % 2 === 0) return part ? <span key={j} className="text-muted-foreground">{part}</span> : null;
        const { label, color } = resolveToken(part, accent, gray);
        return (
          <span key={j} className="inline-flex items-center gap-1 rounded bg-muted px-1 py-0.5">
            {/* Color and checkerboard as layers of one box, so the checker can't fringe the rounded edge */}
            <span
              className="size-3 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
              style={{
                background: `linear-gradient(${color}, ${color}), repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 0 0 / 0.375rem 0.375rem`,
              }}
            />
            <span className="font-medium">{label}</span>
            <span className="font-mono text-[0.625rem] text-muted-foreground uppercase">{color}</span>
          </span>
        );
      })}
    </div>
      ))}
    </>
  );
}

/** A card beside the point (x, y), flipping to stay inside the viewport. */
function FloatingCard({
  x,
  y,
  deps,
  interactive = false,
  innerRef,
  children,
}: {
  x: number;
  y: number;
  /** Re-measure when these change. */
  deps: unknown[];
  interactive?: boolean;
  innerRef?: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = innerRef ?? ownRef;
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Measure before paint so the first frame isn't placed with a 0×0 size and then jump
  useLayoutEffect(() => {
    if (ref.current) setSize({ width: ref.current.offsetWidth, height: ref.current.offsetHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const gap = 14;
  const left = x + gap + size.width > window.innerWidth - 8 ? x - gap - size.width : x + gap;
  const top = y + gap + size.height > window.innerHeight - 8 ? y - gap - size.height : y + gap;

  // Portal to <body> so `fixed` is always relative to the viewport, whatever the ancestors' CSS
  return createPortal(
    <div
      ref={ref}
      role={interactive ? 'dialog' : 'tooltip'}
      aria-label={interactive ? 'Try other tokens' : undefined}
      className={cn(
        'fixed z-50 w-max max-w-[calc(100vw-1rem)] space-y-1.5 rounded-lg border bg-popover px-3 py-2 text-xs whitespace-nowrap text-popover-foreground shadow-lg',
        !interactive && 'pointer-events-none',
      )}
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
    >
      {children}
    </div>,
    document.body,
  );
}
