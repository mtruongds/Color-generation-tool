import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Download,
  FolderKanban,
  Globe,
  Info,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Quote,
  Search,
  Settings,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  type Accent,
  type FoundationKey,
  type Foundations,
  type GridConfig,
  type ResolvedFoundations,
  type TypeStyle,
  RADIUS_FULL,
  computeGridLayout,
  generateSpacingScale,
  resolveFoundations,
  sortedBreakpoints,
  spacingTokenName,
} from '../../lib/foundations';
import { typeCss } from './FoundationSample';
import type { ColorScale } from '../../lib/color-utils';
import { type FoundationRow, StepTokenLayer, scaleVars } from '../palette-generator/PalettePreview';
import { ComponentGallery } from './ComponentGallery';

export type PreviewKey = Exclude<FoundationKey, 'color'>;

/** Pages drawn from the foundation tokens. */
export type FoundationPage = 'dashboard' | 'components' | 'landing' | 'article';

/** Room left under the dashboard's last panel for the floating toast. */
const TOAST_CLEARANCE = 88;

/** Deploys per day for the dashboard chart, as a percentage of the axis. */
const CHART = [38, 52, 45, 61, 48, 30, 26, 57, 66, 59, 72, 64, 81, 74];

const PROJECTS: { name: string; meta: string; owner: string; status: string; kind: BadgeKind; progress: number }[] = [
  { name: 'Website redesign', meta: 'web · deployed 2m ago', owner: 'Linh', status: 'Active', kind: 'solid', progress: 72 },
  { name: 'Mobile onboarding', meta: 'ios, android · 18m ago', owner: 'Khoa', status: 'In review', kind: 'soft', progress: 90 },
  { name: 'Design tokens v2', meta: 'package · yesterday', owner: 'Mai', status: 'Draft', kind: 'surface', progress: 24 },
  { name: 'Status page', meta: 'web · 3h ago', owner: 'Hana', status: 'Blocked', kind: 'outline', progress: 41 },
  { name: 'Billing API', meta: 'service · Oct 18', owner: 'An', status: 'Done', kind: 'gray', progress: 100 },
];

/** Button styles, each drawn from the picked scales: [classes, steps for the tooltip]. */
const BUTTONS = {
  solid: ['bg-(--a9) text-(--a-contrast) hover:bg-(--a10)', 'solid: a9 → a10 on hover · text: contrast'],
  soft: ['bg-(--a3) text-(--a11) hover:bg-(--a4) active:bg-(--a5)', 'soft: a3 → a4 on hover · text: a11'],
  surface: ['bg-(--a2) text-(--a11) shadow-[inset_0_0_0_1px_var(--a7)] hover:shadow-[inset_0_0_0_1px_var(--a8)]', 'surface: a2 · border: a7 → a8 · text: a11'],
  outline: ['text-(--a11) shadow-[inset_0_0_0_1px_var(--a8)] hover:bg-(--a2)', 'outline: border a8 · hover a2 · text: a11'],
  ghost: ['text-(--g11) hover:bg-(--g4) hover:text-(--g12)', 'ghost: text g11 · hover g4'],
  gray: ['bg-(--g3) text-(--g12) hover:bg-(--g4) active:bg-(--g5)', 'gray: g3 → g4 on hover · text: g12'],
  neutral: ['bg-(--g-surface) text-(--g12) shadow-[inset_0_0_0_1px_var(--g7)] hover:bg-(--g3)', 'bg: gray surface → g3 on hover · border: g7 · text: g12'],
  disabled: ['cursor-not-allowed bg-(--g3) text-(--g8)', 'disabled: g3 · text: g8'],
} as const;
export type ButtonKind = keyof typeof BUTTONS;

const BADGES = {
  solid: ['bg-(--a9) text-(--a-contrast)', 'solid: a9 · text: contrast'],
  soft: ['bg-(--a3) text-(--a11)', 'soft: a3 · text: a11'],
  surface: ['bg-(--a2) text-(--a11) shadow-[inset_0_0_0_1px_var(--a6)]', 'surface: a2 · border: a6 · text: a11'],
  outline: ['text-(--a11) shadow-[inset_0_0_0_1px_var(--a7)]', 'outline: border a7 · text: a11'],
  gray: ['bg-(--g3) text-(--g11)', 'gray: g3 · text: g11'],
} as const;
export type BadgeKind = keyof typeof BADGES;

/** A dashboard needs a sidebar; when the grid has none, use 240px from the first breakpoint of 768px or wider. */
function dashboardGrid(grid: GridConfig): GridConfig {
  if (grid.sidebar > 0) return grid;
  const from = sortedBreakpoints(grid).find((b) => b.minWidth >= 768)?.name ?? '';
  return { ...grid, sidebar: 240, sidebarFrom: from };
}

/**
 * Viewport size: a preset, or a width in px dragged by hand. A frame wider than the panel is
 * scaled down to fit it.
 */
export type ViewportPreset = 'desktop' | 'tablet' | 'mobile';
export type ViewportSize = ViewportPreset | number;
export const VIEWPORT_TABLET = 768;
export const VIEWPORT_MOBILE = 390;
const VIEWPORT_MIN = 320;
/** Below this width the pages switch to their phone layouts. */
const PHONE_MAX = 767;

/** The grid's largest breakpoint, and never narrower than a 1280px laptop. */
function desktopWidthFor(grid: GridConfig) {
  return Math.max(1280, sortedBreakpoints(grid).at(-1)?.minWidth ?? 0);
}

export type PreviewHighlight = PreviewKey | 'none';

/** Where each page would live, shown in the frame's address bar. */
const PAGE_URL: Record<FoundationPage, string> = {
  dashboard: 'app.northwind.co/overview',
  components: 'ui.northwind.co/components',
  landing: 'northwind.co',
  article: 'northwind.co/blog/rebuilding-color',
};

export const HIGHLIGHT_LABEL: Record<PreviewHighlight, string> = {
  none: 'No highlight',
  typography: 'Text styles',
  spacing: 'Padding and gaps',
  radius: 'Corner radii',
  shadow: 'Elevation',
  grid: 'Grid columns',
};

export interface TextProps {
  s: string;
  /** Repeated items label only their first instance, so tags don't pile up. */
  tagged?: boolean;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

type PadProps = { 'data-fx-spacing'?: string; 'data-fx-spacing-value'?: string; 'data-fx-pad'?: string; style?: React.CSSProperties };

/** What a page drawn outside this file needs: the resolved tokens and the shared element styles. */
export interface PreviewKit {
  tokens: ResolvedFoundations;
  mobile: boolean;
  /** Masonry columns that fit the content width. */
  columns: number;
  gutter: number;
  container: React.CSSProperties;
  typeCss: (s: TypeStyle) => React.CSSProperties;
  Text: (props: TextProps) => React.ReactElement;
  btn: (kind: ButtonKind, size?: 'sm' | 'md' | 'lg' | 'icon') => { className: string; style: React.CSSProperties; 'data-tokens': string };
  badge: (kind: BadgeKind) => { className: string; style: React.CSSProperties; 'data-tokens': string };
  steps: (tokens: string) => { 'data-tokens': string };
  mark: (kind: PreviewKey, label: string, value?: string) => Record<string, string>;
  pad: (multiplier: number, label?: string) => PadProps;
  mergeStyle: (a: PadProps, style: React.CSSProperties) => PadProps;
  MUTED: string;
  HAIRLINE: string;
}

/**
 * A landing or article page built only from foundation tokens. One foundation can be
 * highlighted on top: text styles, padding, radii, shadows or grid columns.
 */
export function FoundationPreview({
  page,
  foundations,
  isDark,
  accent,
  accentScale,
  gray,
  showTokens,
  size,
  onSizeChange,
  highlight,
}: {
  page: FoundationPage;
  foundations: Foundations;
  isDark: boolean;
  /** Steps of `accentScale` in the shape the foundation tokens read. */
  accent: Accent;
  accentScale: ColorScale;
  gray: ColorScale;
  /** Hovering a tagged element shows which accent and gray steps it uses. */
  showTokens: boolean;
  size: ViewportSize;
  /** Called with a preset when a drag lands on one, otherwise with the width in px. */
  onSizeChange: (size: ViewportSize) => void;
  /** Foundation whose tokens are outlined on the page. */
  highlight: PreviewHighlight;
}) {
  // Dashboard controls that respond like the real thing
  const [range, setRange] = useState('30d');
  const [checked, setChecked] = useState(true);
  const [failedEmails, setFailedEmails] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(1024);
  const [available, setAvailable] = useState(1024);
  const [frameHeight, setFrameHeight] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setFrameWidth(Math.round(entry.contentRect.width));
      setFrameHeight((entry.target as HTMLElement).offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const desktopWidth = desktopWidthFor(foundations.grid);
  const maxWidth = Math.max(1920, desktopWidth);
  const presetWidth: Record<ViewportPreset, number> = { desktop: desktopWidth, tablet: VIEWPORT_TABLET, mobile: VIEWPORT_MOBILE };
  const width = Math.min(maxWidth, Math.max(VIEWPORT_MIN, typeof size === 'number' ? size : presetWidth[size]));
  const mobile = width <= PHONE_MAX;
  // A frame wider than the panel is scaled down to fit it
  const scale = Math.min(1, available / width);
  /** A dragged edge snaps to the presets and to where each breakpoint starts. */
  const snapPoints = [
    ...new Set([...Object.values(presetWidth), ...sortedBreakpoints(foundations.grid).map((b) => b.minWidth)]),
  ].filter((w) => w >= VIEWPORT_MIN && w <= maxWidth);
  /** Reports a width as its preset when it matches one, so the toolbar lights it up. */
  const setWidth = (w: number) => {
    const clamped = Math.round(Math.min(maxWidth, Math.max(VIEWPORT_MIN, w)));
    onSizeChange((Object.keys(presetWidth) as ViewportPreset[]).find((k) => presetWidth[k] === clamped) ?? clamped);
  };

  /**
   * Drags one edge of the centred frame. Both edges move together, so the width changes by twice
   * the pointer's travel, divided by the scale so the edge stays under the pointer.
   */
  const startResize = (side: -1 | 1) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const startScale = scale;
    setDragging(true);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent) => {
      const raw = Math.min(maxWidth, Math.max(VIEWPORT_MIN, startWidth + (2 * side * (ev.clientX - startX)) / startScale));
      setWidth(snapPoints.find((p) => Math.abs(p - raw) <= 12 / startScale) ?? raw);
    };
    const onUp = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onHandleKey = (e: React.KeyboardEvent) => {
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    setWidth(width + delta * (e.shiftKey ? 50 : 10));
  };

  /**
   * A full-height strip beside the frame; its grip stays centred on screen while the page scrolls.
   * Called as a function, not rendered as a component, so it keeps keyboard focus across resizes.
   */
  const resizeHandle = (side: -1 | 1) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === -1 ? 'Resize viewport from the left' : 'Resize viewport from the right'}
      aria-valuenow={width}
      aria-valuemin={VIEWPORT_MIN}
      aria-valuemax={maxWidth}
      tabIndex={0}
      title="Drag to resize · double-click for desktop"
      onPointerDown={startResize(side)}
      onDoubleClick={() => onSizeChange('desktop')}
      onKeyDown={onHandleKey}
      className="group absolute inset-y-0 z-10 flex w-5 cursor-ew-resize touch-none justify-center focus-visible:outline-none"
      style={side === -1 ? { right: '100%', marginRight: 2 } : { left: '100%', marginLeft: 2 }}
    >
      <span
        className={cn(
          'sticky top-[calc(50vh-1.5rem)] mt-16 h-12 w-1.5 rounded-full bg-border transition-colors group-hover:bg-ring group-focus-visible:bg-ring',
          dragging && 'bg-ring',
        )}
      />
    </div>
  );
  const tokens = useMemo(() => resolveFoundations(foundations, isDark), [foundations, isDark]);
  const { type: t, space, radius, shadow, mono } = tokens;
  // Lookups from a resolved px value or shadow back to its token, for reading tokens off styles
  const tokenLookup = useMemo(() => {
    const probe = document.createElement('div').style;
    const normalize = (css: string) => ((probe.boxShadow = css), probe.boxShadow);
    return {
      space: new Map(generateSpacingScale(foundations.spacing).map((s) => [s.value, s.name])),
      radius: new Map(Object.entries(radius).map(([name, px]) => [px, `radius-${name}`])),
      shadow: new Map(Object.entries(shadow).map(([name, css]) => [normalize(css), `shadow-${name}`])),
    };
  }, [foundations.spacing, radius, shadow]);
  // Landing and article are full-width sites, so only the dashboard takes the grid's sidebar
  const layout = computeGridLayout(page === 'dashboard' ? dashboardGrid(foundations.grid) : { ...foundations.grid, sidebar: 0 }, frameWidth);
  const { breakpoint: bp } = layout;
  const appSidebar = layout.sidebar;
  const cols = bp.columns;
  const on = (kind: PreviewKey) => highlight === kind;
  const shadowName = (name: string) => `shadow-${name}`;

  /**
   * Tags an element with a foundation token. Every tag shows in the hover tooltip; only the
   * highlighted foundation's tags are outlined (see .fx-preview[data-highlight] in index.css).
   */
  const mark = (kind: PreviewKey, label: string, value?: string): Record<string, string> => {
    const radiusName = kind === 'radius' ? label.match(/^radius-(.+)$/)?.[1] : undefined;
    // Pill radii resolve to 9999px, which says nothing useful, so they go without a value
    const px = radiusName ? radius[radiusName] : undefined;
    const resolved = value ?? (px !== undefined && px !== RADIUS_FULL ? `${px}px` : undefined);
    return { [`data-fx-${kind}`]: label, ...(resolved ? { [`data-fx-${kind}-value`]: resolved } : {}) };
  };
  /** Spacing tag for a gap. */
  const gapMark = (multiplier: number) => mark('spacing', `gap: ${spacingTokenName(multiplier)}`, `${space(multiplier)}px`);
  /** Spacing tag that also tints the padding area while spacing is highlighted. */
  const pad = (multiplier: number, label = `p: ${spacingTokenName(multiplier)}`): PadProps => ({
    'data-fx-spacing': label,
    'data-fx-spacing-value': `${space(multiplier)}px`,
    'data-fx-pad': '',
    style: { '--fx-pad': `${space(multiplier)}px` } as React.CSSProperties,
  });

  /** Reads radius, padding, gap and elevation tokens off an element's own styles, for the hover tooltip. */
  const inspect = (el: HTMLElement): FoundationRow[] => {
    const cs = getComputedStyle(el);
    const px = (v: string) => Math.round(parseFloat(v) * 100) / 100 || 0;
    const spaceName = (v: number) => (v === 0 ? '0' : (tokenLookup.space.get(v) ?? `${v}px`));
    /** CSS shorthand of four sides: "a", "a b", "a b c" or "a b c d". */
    const shorthand = ([top, right, bottom, left]: string[]) =>
      right !== left ? [top, right, bottom, left] : top !== bottom ? [top, right, bottom] : top !== right ? [top, right] : [top];
    const rows: FoundationRow[] = [];

    const corners = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px);
    if (corners.some(Boolean)) {
      const name = (v: number) => (v === 0 ? '0' : (tokenLookup.radius.get(v) ?? `${v}px`));
      const values = shorthand(corners.map(String));
      rows.push({
        label: 'Radius',
        token: values.map((v) => name(Number(v))).join(' '),
        value: values.some((v) => Number(v) === RADIUS_FULL) ? undefined : values.map((v) => `${v}px`).join(' '),
      });
    }

    const sides = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px);
    if (sides.some(Boolean)) {
      const values = shorthand(sides.map(String));
      rows.push({ label: 'Padding', token: values.map((v) => spaceName(Number(v))).join(' '), value: values.map((v) => `${v}px`).join(' ') });
    }

    if (/flex|grid/.test(cs.display)) {
      const row = px(cs.rowGap);
      const col = px(cs.columnGap);
      // A page grid's column gap is the breakpoint gutter, not a spacing step
      const colName = cs.display.includes('grid') && col === bp.gutter && col > 0 ? 'gutter' : spaceName(col);
      if (row || col) {
        rows.push(
          row === col
            ? { label: 'Gap', token: spaceName(row), value: `${row}px` }
            : { label: 'Gap', token: `${spaceName(row)} ${colName}`, value: `${row}px ${col}px` },
        );
      }
    }

    const elevation = el.style.boxShadow && tokenLookup.shadow.get(el.style.boxShadow);
    if (elevation) rows.push({ label: 'Elevation', token: elevation });
    return rows;
  };

  /** Which step a text color reads from, for step tooltips. */
  const stepOf = (color?: string) => {
    if (!color || color === 'var(--foreground)') return 'g12';
    if (color === 'var(--muted-foreground)') return 'g11';
    if (color === 'var(--a-contrast)') return 'contrast';
    return color.match(/^var\(--([ag]\d{1,2})\)$/)?.[1] ?? 'g12';
  };

  const Text = ({
    s,
    as: Tag = 'div',
    className,
    style,
    tagged = true,
    children,
  }: TextProps) => {
    // Truncating clips the highlight label drawn above the box, so a tagged box truncates an inner span instead
    const clips = tagged && /\btruncate\b/.test(className ?? '');
    const css = typeCss(t[s], mobile);
    return (
    <Tag
      className={clips ? className?.replace(/\btruncate\b/, '') : className}
      style={{
        ...css,
        // Headings balance their lines; running text avoids orphans
        textWrap: s === 'display' || /^h\d$/.test(s) ? 'balance' : 'pretty',
        ...style,
      } as React.CSSProperties}
      data-tokens={`text: ${stepOf(style?.color)}`}
      // Untagged repeats still report their style on hover, they just aren't outlined
      {...mark('typography', `text-${s}`, `${css.fontSize}px / ${css.lineHeight} · ${css.fontWeight}`)}
      {...(tagged ? {} : { 'data-fx-quiet': '' })}
    >
      {clips ? <span className="block truncate">{children}</span> : children}
    </Tag>
    );
  };
  /** Names the accent and gray steps an element uses, for step tooltips. */
  const steps = (tokens: string) => ({ 'data-tokens': tokens });
  const MUTED = 'var(--g11)';
  const HAIRLINE = '1px solid var(--g6)';

  /** A button in one of the shared styles; fills and hovers come from classes so hover works. */
  const btn = (kind: ButtonKind, size: 'sm' | 'md' | 'lg' | 'icon' = 'md') => ({
    className: cn(kind === 'disabled' ? '' : 'cursor-pointer', 'transition-[background-color,box-shadow,color]', BUTTONS[kind][0]),
    style: {
      ...typeCss(t[size === 'lg' ? 'body' : 'body-sm'], mobile),
      fontWeight: 500,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space(1.5),
      whiteSpace: 'nowrap',
      borderRadius: radius.md,
      padding:
        size === 'lg'
          ? `${space(3)}px ${space(5)}px`
          : size === 'sm'
            ? `${space(1)}px ${space(2.5)}px`
            : size === 'icon'
              ? space(2)
              : `${space(2)}px ${space(3.5)}px`,
      ...(kind === 'solid' && { boxShadow: shadow.xs }),
    } as React.CSSProperties,
    ...steps(BUTTONS[kind][1]),
  });
  const badge = (kind: BadgeKind) => ({
    // align-middle: inside table cells and text the pill would otherwise ride the baseline and sit low
    className: cn('inline-flex items-center whitespace-nowrap align-middle tabular-nums', BADGES[kind][0]),
    style: { ...typeCss(t.caption, mobile), fontWeight: 500, padding: `${space(0.5)}px ${space(2)}px`, borderRadius: radius.full } as React.CSSProperties,
    ...steps(BADGES[kind][1]),
  });
  const panelStyle: React.CSSProperties = { background: 'var(--bg)', border: HAIRLINE, borderRadius: radius.lg };

  const mergeStyle = (a: PadProps, style: React.CSSProperties): PadProps => ({ ...a, style: { ...style, ...a.style } });

  const container: React.CSSProperties = {
    maxWidth: foundations.grid.maxWidth > 0 ? foundations.grid.maxWidth + bp.margin * 2 : undefined,
    marginInline: 'auto',
    paddingInline: bp.margin,
  };
  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    columnGap: bp.gutter,
    rowGap: space(6),
  };
  /**
   * Layout switches read the real content width, not just the column count: 12 columns beside a
   * sidebar can still be too narrow to put panels side by side.
   */
  const contentWidth = layout.content;
  /** Room for the 12-column splits, such as 8 + 4 panels or the article's rail. */
  const wide = cols >= 12 && contentWidth >= 960;
  /** Room for two-up rows and extra table columns. */
  const roomy = cols >= 8 && contentWidth >= 640;
  /**
   * The lines from `from` to `to` of a 12-column design, mapped proportionally onto the grid's
   * real column count, so layouts keep their shape on 16 or 24 columns. Neighbours share the same
   * rounding, so they always tile without gaps.
   */
  const lines12 = (from: number, to: number) => `${Math.round((from * cols) / 12) + 1} / ${Math.round((to * cols) / 12) + 1}`;
  /** Places a block on the 12-column design; narrower grids stack it full width. */
  const at = (start12: number, span12: number): React.CSSProperties => ({
    gridColumn: wide ? lines12(start12 - 1, start12 - 1 + span12) : '1 / -1',
  });
  /** Left or right half of the grid from tablet up, full width on phones. */
  const half = (i: 0 | 1): React.CSSProperties => ({ gridColumn: roomy ? lines12(i * 6, i * 6 + 6) : '1 / -1' });
  const sectionGap = space(mobile ? 16 : 24);
  const hex = (c: string) => c.toUpperCase();

  /** The 12 steps of a scale as one strip, so the page proves what the product makes. */
  const ScaleStrip = ({ scale, prefix, height }: { scale: ColorScale; prefix: 'a' | 'g'; height: number }) => (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: space(1) }}>
      {scale.colors.map((c, i) => (
        <div key={i} {...steps(`step: ${prefix}${i + 1}`)}>
          <div style={{ height, background: c, borderRadius: radius.sm, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.06)' }} />
          <Text s="caption" tagged={false} className="tabular-nums" style={{ marginTop: space(1.5), color: MUTED, textAlign: 'center' }}>
            {i + 1}
          </Text>
        </div>
      ))}
    </div>
  );

  /** What each run of steps is for, aligned under a ScaleStrip. */
  const STEP_JOBS = [
    { span: 2, label: 'Backgrounds', range: '1–2' },
    { span: 3, label: 'Components', range: '3–5' },
    { span: 3, label: 'Borders', range: '6–8' },
    { span: 2, label: 'Solids', range: '9–10' },
    { span: 2, label: 'Text', range: '11–12' },
  ];
  const StepJobs = () => (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: space(1), marginTop: space(2) }}>
      {STEP_JOBS.map(({ span, label }, i) => (
        <div key={label} style={{ gridColumn: `span ${span} / span ${span}`, borderTop: '1px solid var(--g8)', paddingTop: space(1.5) }}>
          <Text s="caption" tagged={i === 0} className="truncate" style={{ color: MUTED }}>
            {label}
          </Text>
        </div>
      ))}
    </div>
  );

  return (
    // Side padding leaves room for the handles
    <div ref={outerRef} className="px-6">
      {/* Centred box at the frame's on-screen size */}
      <div className="relative mx-auto" style={{ width: width * scale }}>
        {/* Address bar: where this page lives, and the layout it's rendering */}
        <div className="mb-2 flex items-center gap-3 px-1 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <Globe className="size-3.5 shrink-0" />
            <span className="truncate">{PAGE_URL[page]}</span>
          </span>
          <span
            className={cn('ml-auto shrink-0 font-mono text-[0.6875rem] tabular-nums transition-colors', dragging && 'text-foreground')}
            title="Viewport width · breakpoint · columns · scale"
          >
            {width}px · {bp.name} · {cols} cols{appSidebar > 0 && ` · ${appSidebar}px sidebar`}
            {scale < 1 && ` · ${Math.round(scale * 100)}%`}
          </span>
        </div>

        <div className="relative">
          {resizeHandle(-1)}
          {resizeHandle(1)}
          {/* Reserves the scaled frame's height, since a transform doesn't change layout size */}
          <div style={{ height: scale < 1 ? frameHeight * scale : undefined }}>
      <StepTokenLayer
        accent={accentScale}
        gray={gray}
        showTokens={showTokens && !dragging}
        inspect={inspect}
        style={{ width, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left' }}
      >
        <div
          ref={frameRef}
          className="fx-preview relative w-full overflow-hidden bg-background text-foreground"
          data-highlight={highlight}
          style={
            {
              // Re-skin the page with the picked gray, so cards, borders and muted text follow it
              ...scaleVars(accentScale, gray),
              '--background': 'var(--bg)',
              '--foreground': 'var(--g12)',
              '--card': 'var(--g-surface)',
              '--popover': 'var(--g-surface)',
              '--border': 'var(--g6)',
              '--muted': 'var(--g3)',
              '--muted-foreground': 'var(--g11)',
              borderRadius: mobile ? 28 : 16,
              // A ring rather than a border, so the frame's content is exactly the viewport width
              boxShadow: '0 0 0 1px var(--g6)',
              '--fx-accent': accent.solid,
              '--fx-contrast': accent.contrast,
            } as React.CSSProperties
          }
        >
          {/* Grid overlay */}
          {on('grid') && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20" style={{ left: appSidebar }} aria-hidden>
              <div style={{ ...container, height: '100%' }}>
                <div style={{ ...grid, height: '100%' }}>
                  {Array.from({ length: cols }, (_, i) => (
                    <div key={i} style={{ background: `color-mix(in oklab, ${accent.solid} 12%, transparent)`, borderInline: `1px solid color-mix(in oklab, ${accent.solid} 28%, transparent)` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === 'components' ? (
            <ComponentGallery
              kit={{
                tokens,
                mobile,
                columns: contentWidth >= 1080 ? 3 : contentWidth >= 640 ? 2 : 1,
                gutter: bp.gutter,
                container,
                typeCss: (s) => typeCss(s, mobile),
                Text,
                btn,
                badge,
                steps,
                mark,
                pad,
                mergeStyle,
                MUTED,
                HAIRLINE,
              }}
            />
          ) : page === 'dashboard' ? (
            <div className="flex" style={{ minHeight: mobile ? 0 : 880 }}>
              {/* Sidebar: workspace, search, navigation, account */}
              {appSidebar > 0 && (
                <aside
                  className="flex shrink-0 flex-col"
                  style={{ width: appSidebar, background: 'var(--g2)', borderRight: HAIRLINE, padding: space(3), gap: space(4) }}
                  {...steps('sidebar: g2 · rule: g6')}
                >
                  <div className="fx-link flex cursor-pointer items-center" style={{ gap: space(2.5), padding: space(1.5), borderRadius: radius.md }}>
                    <span className="grid shrink-0 grid-cols-2 overflow-hidden" style={{ width: space(6), height: space(6), borderRadius: radius.sm }} {...steps('mark: a6 · a9 · a11 · a12')}>
                      {['--a6', '--a9', '--a11', '--a12'].map((v) => (
                        <span key={v} style={{ background: `var(${v})` }} />
                      ))}
                    </span>
                    <Text s="h5" className="min-w-0 flex-1 truncate">
                      Northwind
                    </Text>
                    <ChevronsUpDown className="size-4 shrink-0" style={{ color: MUTED }} />
                  </div>

                  <label
                    className="flex items-center border border-(--g7) bg-(--bg) transition-[border-color,box-shadow] focus-within:border-(--a8) focus-within:shadow-[0_0_0_3px_var(--a5)] hover:border-(--g8)"
                    style={{ gap: space(2), padding: `${space(1.5)}px ${space(2.5)}px`, borderRadius: radius.md }}
                    {...steps('search: background · border: g7 → g8 · focus: a8 + ring a5')}
                    {...mark('radius', 'radius-md')}
                  >
                    <Search className="size-4 shrink-0" style={{ color: 'var(--g10)' }} />
                    <input
                      placeholder="Search"
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-(--g10)"
                      style={{ ...typeCss(t['body-sm'], mobile) }}
                    />
                    <kbd
                      style={{ ...typeCss(t.caption, mobile), fontFamily: mono, padding: `0 ${space(1.5)}px`, borderRadius: radius.sm, background: 'var(--g4)', color: MUTED }}
                      {...steps('key: g4 · text: g11')}
                    >
                      ⌘K
                    </kbd>
                  </label>

                  <nav className="flex flex-col" style={{ gap: space(0.5) }} {...gapMark(0.5)}>
                    {[
                      { icon: LayoutDashboard, label: 'Overview', count: null },
                      { icon: FolderKanban, label: 'Projects', count: 24 },
                      { icon: BarChart3, label: 'Reports', count: null },
                      { icon: Users, label: 'Team', count: 8 },
                      { icon: Settings, label: 'Settings', count: null },
                    ].map(({ icon: Icon, label, count }, i) => {
                      const active = i === 0;
                      return (
                        <div
                          key={label}
                          className={cn('flex cursor-pointer items-center transition-colors', active ? 'bg-(--a3) text-(--a11)' : 'text-(--g11) hover:bg-(--g4) hover:text-(--g12)')}
                          style={{ ...typeCss(t['body-sm'], mobile), fontWeight: active ? 500 : undefined, gap: space(2.5), padding: `${space(1.5)}px ${space(2)}px`, borderRadius: radius.md }}
                          {...steps(active ? 'active: a3 · text: a11' : 'item: text g11 · hover g4')}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="flex-1">{label}</span>
                          {count !== null && <span className="tabular-nums" style={{ ...typeCss(t.caption, mobile), color: 'var(--g10)' }}>{count}</span>}
                        </div>
                      );
                    })}
                  </nav>

                  <div>
                    <Text s="caption" style={{ color: 'var(--g10)', fontWeight: 500, padding: `0 ${space(2)}px` }}>
                      Pinned
                    </Text>
                    <div className="flex flex-col" style={{ gap: space(0.5), marginTop: space(2) }}>
                      {['Website redesign', 'Mobile onboarding', 'Billing API'].map((l, i) => (
                        <div
                          key={l}
                          className="flex cursor-pointer items-center text-(--g11) transition-colors hover:bg-(--g4) hover:text-(--g12)"
                          style={{ ...typeCss(t['body-sm'], mobile), gap: space(2.5), padding: `${space(1.5)}px ${space(2)}px`, borderRadius: radius.md }}
                          {...steps(`dot: ${['a9', 'a7', 'g8'][i]} · text: g11`)}
                        >
                          <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: radius.full, background: `var(--${['a9', 'a7', 'g8'][i]})` }} />
                          <span className="truncate">{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto flex items-center" style={{ gap: space(2.5), padding: space(1.5), borderTop: HAIRLINE, paddingTop: space(4) }}>
                    <span
                      className="inline-flex shrink-0 items-center justify-center"
                      style={{ width: space(8), height: space(8), borderRadius: radius.full, background: 'var(--a4)', color: 'var(--a11)', ...typeCss(t.caption, mobile), fontWeight: 600 }}
                      {...steps('avatar: a4 · initials: a11')}
                      {...mark('radius', 'radius-full')}
                    >
                      MK
                    </span>
                    <div className="min-w-0">
                      <Text s="body-sm" tagged={false} className="truncate" style={{ fontWeight: 500 }}>
                        Mai Kobayashi
                      </Text>
                      <Text s="caption" tagged={false} className="truncate" style={{ color: MUTED }}>
                        mai@northwind.co
                      </Text>
                    </div>
                  </div>
                </aside>
              )}

              <div className="relative min-w-0 flex-1">
                {/* Top bar */}
                <header style={{ borderBottom: HAIRLINE }} {...steps('top bar: background · rule: g6')}>
                  <div className="flex items-center" style={{ ...container, gap: space(3), paddingBlock: space(3) }}>
                    {appSidebar === 0 && (
                      <>
                        <span {...btn('ghost', 'icon')} aria-label="Menu">
                          <Menu className="size-4" />
                        </span>
                        <Text s="h5" className="flex-1">
                          Northwind
                        </Text>
                      </>
                    )}
                    {appSidebar > 0 && (
                      <Text s="body-sm" tagged={false} className="flex flex-1 items-center" style={{ gap: space(1.5), color: MUTED }}>
                        <span className="fx-link cursor-pointer">Northwind</span>
                        <ChevronRight className="size-3.5" aria-hidden />
                        <span style={{ color: 'var(--g12)', fontWeight: 500 }}>Overview</span>
                      </Text>
                    )}
                    <span {...btn('ghost', 'icon')} className={cn(btn('ghost', 'icon').className, 'relative')} aria-label="Notifications">
                      <Bell className="size-4" />
                      <span className="absolute" style={{ top: 6, right: 6, width: 7, height: 7, borderRadius: radius.full, background: 'var(--a9)', boxShadow: '0 0 0 2px var(--bg)' }} />
                    </span>
                  </div>
                </header>

                {/* Bottom padding keeps the toast clear of the last panel */}
                <main style={{ ...container, paddingTop: space(mobile ? 6 : 8), paddingBottom: space(mobile ? 6 : 8) + TOAST_CLEARANCE }}>
                  {/* Page header */}
                  <div className="flex flex-wrap items-end justify-between" style={{ gap: space(4) }}>
                    <div>
                      <Text s="h3" as="h1">
                        Overview
                      </Text>
                      <Text s="body-sm" style={{ marginTop: space(1), color: MUTED }}>
                        Deploys and project health across your workspace.
                      </Text>
                    </div>
                    <div className="flex flex-wrap items-center" style={{ gap: space(2) }} {...gapMark(2)}>
                      <div className="flex" style={{ padding: 2, gap: 2, borderRadius: radius.md, background: 'var(--g3)' }} {...steps('track: g3 · active: background · text: g12 / g11')}>
                        {['7d', '30d', '90d'].map((r) => (
                          <span
                            key={r}
                            onClick={() => setRange(r)}
                            className={cn('cursor-pointer tabular-nums transition-colors', range === r ? 'text-(--g12)' : 'text-(--g11) hover:text-(--g12)')}
                            style={{
                              ...typeCss(t['body-sm'], mobile),
                              fontWeight: 500,
                              padding: `${space(1)}px ${space(2.5)}px`,
                              borderRadius: Math.max(0, radius.md - 2),
                              ...(range === r && { background: 'var(--bg)', boxShadow: shadow.xs }),
                            }}
                            {...(range === r ? mark('shadow', shadowName('xs')) : {})}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                      {!mobile && (
                        <span {...btn('neutral')}>
                          <Download className="size-4" /> Export
                        </span>
                      )}
                      <span {...btn('solid')} {...mark('radius', 'radius-md')}>
                        <Plus className="size-4" /> New project
                      </span>
                    </div>
                  </div>

                  {/* Banner */}
                  <div
                    className="flex items-start"
                    {...mergeStyle(pad(3, 'padding-banner'), {
                      gap: space(3),
                      marginTop: space(6),
                      padding: space(3),
                      paddingInline: space(4),
                      borderRadius: radius.md,
                      background: 'var(--a3)',
                      border: '1px solid var(--a6)',
                    })}
                    {...steps('banner: a3 · border: a6 · icon: a9 · text: a12 / a11')}
                  >
                    <Info className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--a9)' }} />
                    <Text s="body-sm" tagged={false} className="min-w-0 flex-1" style={{ color: 'var(--a11)' }}>
                      <span style={{ color: 'var(--a12)', fontWeight: 500 }}>Build cache is now on by default.</span> Builds on unchanged
                      packages finish up to 4× faster.{' '}
                      <span className="cursor-pointer underline decoration-(--a7) underline-offset-2 hover:decoration-(--a11)">Read the changelog</span>
                    </Text>
                    <X className="mt-0.5 size-4 shrink-0 cursor-pointer" style={{ color: 'var(--a11)' }} />
                  </div>

                  {/* Stats: one strip with hairline dividers */}
                  <div
                    className="grid overflow-hidden"
                    style={{
                      marginTop: space(6),
                      // Four stats need about 200px each before labels start to wrap
                      gridTemplateColumns: `repeat(${roomy && contentWidth >= 800 ? 4 : 2}, minmax(0, 1fr))`,
                      gap: 1,
                      background: 'var(--g6)',
                      border: HAIRLINE,
                      borderRadius: radius.lg,
                    }}
                    {...steps('strip: background · dividers: g6')}
                    {...mark('radius', 'radius-lg')}
                  >
                    {[
                      { label: 'Active projects', value: '24', delta: '+3', kind: 'soft' as const },
                      { label: 'Deploys', value: '1,286', delta: '+12%', kind: 'soft' as const },
                      { label: 'Median build', value: '1m 42s', delta: '−8s', kind: 'soft' as const },
                      { label: 'Failed builds', value: '3', delta: '0', kind: 'gray' as const },
                    ].map(({ label, value, delta, kind }, i) => (
                      <div key={label} {...mergeStyle(i === 0 ? pad(5, 'padding-stat') : {}, { background: 'var(--bg)', padding: space(mobile ? 4 : 5) })}>
                        <Text s="body-sm" tagged={i === 0} style={{ color: MUTED }}>
                          {label}
                        </Text>
                        {/* Centred, not baseline-aligned: on a baseline the pill hangs below the big number */}
                        <div className="flex flex-wrap items-center" style={{ gap: space(2), marginTop: space(2) }}>
                          <Text s="h3" tagged={i === 0} className="whitespace-nowrap tabular-nums">
                            {value}
                          </Text>
                          <span {...badge(kind)}>{delta}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...grid, marginTop: space(6), alignItems: 'stretch' }}>
                    {/* Chart */}
                    <section className="flex flex-col" style={{ ...at(1, 8), ...panelStyle }} {...steps('panel: background · border: g6')} {...mark('radius', 'radius-lg')}>
                      <div className="flex items-baseline justify-between" style={{ gap: space(3), padding: `${space(5)}px ${space(5)}px 0` }}>
                        <Text s="h5" as="h2">
                          Deploys per day
                        </Text>
                        <Text s="caption" tagged={false} className="flex items-center" style={{ gap: space(3), color: MUTED }}>
                          <span className="flex items-center" style={{ gap: space(1.5) }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--a9)' }} /> Today
                          </span>
                          <span className="flex items-center" style={{ gap: space(1.5) }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--a6)' }} /> Earlier
                          </span>
                        </Text>
                      </div>
                      <div className="relative flex-1" style={{ minHeight: space(52), margin: `${space(6)}px ${space(5)}px ${space(2)}px ${space(5) + 28}px` }}>
                        {[100, 50, 0].map((v) => (
                          <div key={v} className="absolute inset-x-0" style={{ bottom: `${v}%`, borderTop: `1px ${v === 0 ? 'solid' : 'dashed'} var(--g5)` }} {...(v === 100 ? steps('gridline: g5') : {})}>
                            <span className="absolute -translate-y-1/2 tabular-nums" style={{ right: '100%', marginRight: space(2), ...typeCss(t.caption, mobile), color: 'var(--g10)' }}>
                              {v * 1.2}
                            </span>
                          </div>
                        ))}
                        <div className="absolute inset-0 flex items-end" style={{ gap: space(mobile ? 1.5 : 2) }} {...steps('bars: a6 → a8 on hover · today: a9')}>
                          {(mobile ? CHART.slice(-7) : CHART).map((h, i, arr) => (
                            <div
                              key={i}
                              className={cn('flex-1 transition-colors', i === arr.length - 1 ? 'bg-(--a9)' : 'bg-(--a6) hover:bg-(--a8)')}
                              style={{ height: `${h}%`, borderRadius: `${Math.min(radius.sm, 4)}px ${Math.min(radius.sm, 4)}px 0 0` }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between" style={{ margin: `0 ${space(5)}px ${space(5)}px ${space(5) + 28}px` }}>
                        {(mobile ? ['Oct 16', 'Oct 22'] : ['Oct 9', 'Oct 15', 'Oct 22']).map((d) => (
                          <Text key={d} s="caption" tagged={false} className="tabular-nums" style={{ color: 'var(--g10)' }}>
                            {d}
                          </Text>
                        ))}
                      </div>
                    </section>

                    {/* Activity */}
                    <section className="flex flex-col" style={{ ...at(9, 4), ...panelStyle }} {...steps('panel: background · border: g6')}>
                      <div className="flex items-baseline justify-between" style={{ gap: space(3), padding: `${space(5)}px ${space(5)}px ${space(3)}px` }}>
                        <Text s="h5" as="h2" tagged={false}>
                          Activity
                        </Text>
                        <Text s="caption" tagged={false} className="fx-link shrink-0 cursor-pointer whitespace-nowrap" style={{ color: MUTED }}>
                          View all
                        </Text>
                      </div>
                      <div className="flex flex-col" style={{ paddingInline: space(5), gap: space(4) }}>
                        {[
                          { who: 'LN', name: 'Linh', what: 'deployed', target: 'Website redesign', time: '2m', accentAvatar: true },
                          { who: 'KH', name: 'Khoa', what: 'asked for review on', target: 'Mobile onboarding', time: '18m', accentAvatar: false },
                          { who: 'AN', name: 'An', what: 'merged', target: 'Billing API', time: '1h', accentAvatar: false },
                          { who: 'HI', name: 'Hana', what: 'flagged', target: 'Status page', time: '3h', accentAvatar: false },
                        ].map(({ who, name, what, target, time, accentAvatar }, i) => (
                          <div key={name} className="flex items-start" style={{ gap: space(3) }}>
                            <span
                              className="inline-flex shrink-0 items-center justify-center"
                              style={{
                                width: space(7),
                                height: space(7),
                                borderRadius: radius.full,
                                ...typeCss(t.caption, mobile),
                                fontSize: Math.min(t.caption.size, 11),
                                fontWeight: 600,
                                background: accentAvatar ? 'var(--a4)' : 'var(--g4)',
                                color: accentAvatar ? 'var(--a11)' : 'var(--g11)',
                              }}
                              {...steps(accentAvatar ? 'avatar: a4 · initials: a11' : 'avatar: g4 · initials: g11')}
                            >
                              {who}
                            </span>
                            <div className="min-w-0 flex-1">
                              <Text s="body-sm" tagged={i === 0} style={{ color: MUTED }}>
                                <span style={{ color: 'var(--g12)', fontWeight: 500 }}>{name}</span> {what}{' '}
                                <span style={{ color: 'var(--g12)' }}>{target}</span>
                              </Text>
                              <Text s="caption" tagged={false} style={{ color: 'var(--g10)', marginTop: 2 }}>
                                {time} ago
                              </Text>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: space(5), marginTop: 'auto' }}>
                        <span {...btn('soft')} style={{ ...btn('soft').style, width: '100%' }}>
                          <UserPlus className="size-4" /> Invite teammates
                        </span>
                      </div>
                    </section>
                  </div>

                  {/* Projects table */}
                  <section style={{ ...panelStyle, marginTop: space(6), overflow: 'hidden' }} {...steps('panel: background · border: g6')}>
                    <div className="flex flex-wrap items-center justify-between" style={{ gap: space(3), padding: `${space(4)}px ${space(5)}px 0` }}>
                      <div className="flex items-center" style={{ gap: space(2) }}>
                        <Text s="h5" as="h2" tagged={false}>
                          Projects
                        </Text>
                        <span {...badge('gray')}>24</span>
                      </div>
                      <span {...btn('surface', 'sm')}>
                        <SlidersHorizontal className="size-3.5" /> Filters
                      </span>
                    </div>
                    <div className="flex" style={{ gap: space(5), paddingInline: space(5), marginTop: space(3), borderBottom: HAIRLINE }} {...steps('tabs: text g11 · active: g12 · indicator: a9')}>
                      {['All', 'Active', 'In review', 'Done'].map((tab, i) => (
                        <span
                          key={tab}
                          className={cn('cursor-pointer transition-colors', i === 0 ? 'text-(--g12)' : 'text-(--g11) hover:text-(--g12)')}
                          style={{ ...typeCss(t['body-sm'], mobile), fontWeight: 500, paddingBlock: space(2.5), marginBottom: -1, borderBottom: `2px solid ${i === 0 ? 'var(--a9)' : 'transparent'}` }}
                        >
                          {tab}
                        </span>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr {...steps('header: g2 · text: g11 · rule: g6')} style={{ background: 'var(--g2)', borderBottom: HAIRLINE }}>
                            {['', 'Project', ...(roomy ? ['Owner'] : []), 'Status', ...(wide ? ['Progress'] : []), ''].map((h, i) => (
                              <th key={i} style={{ ...typeCss(t.caption, mobile), fontWeight: 500, color: MUTED, padding: `${space(2)}px ${space(i === 0 ? 5 : 3)}px`, width: i === 0 ? 1 : undefined }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PROJECTS.map((p, i) => {
                            const selected = i === 0 && checked;
                            return (
                              <tr
                                key={p.name}
                                className={cn('transition-colors', selected ? 'bg-(--a2)' : 'hover:bg-(--g3)')}
                                style={{ borderBottom: i === PROJECTS.length - 1 ? undefined : HAIRLINE }}
                                {...steps(selected ? 'selected row: a2 · rule: g6' : 'row hover: g3 · rule: g6')}
                              >
                                <td style={{ padding: `${space(3)}px ${space(3)}px ${space(3)}px ${space(5)}px` }}>
                                  <span
                                    role="checkbox"
                                    aria-checked={i === 0 ? checked : false}
                                    onClick={i === 0 ? () => setChecked((v) => !v) : undefined}
                                    className={cn(
                                      'flex cursor-pointer items-center justify-center transition-colors',
                                      i === 0 && checked ? 'bg-(--a9) text-(--a-contrast)' : 'bg-(--bg) shadow-[inset_0_0_0_1px_var(--g7)] hover:shadow-[inset_0_0_0_1px_var(--g8)]',
                                    )}
                                    style={{ width: 16, height: 16, borderRadius: Math.min(radius.xs, 4) }}
                                    {...steps(i === 0 && checked ? 'checkbox: a9 · check: contrast' : 'checkbox: background · border: g7 → g8')}
                                  >
                                    {i === 0 && checked && <Check className="size-3" strokeWidth={3} />}
                                  </span>
                                </td>
                                <td style={{ padding: space(3) }}>
                                  <Text s="body-sm" tagged={i === 0} style={{ fontWeight: 500 }}>
                                    {p.name}
                                  </Text>
                                  <Text s="caption" tagged={false} style={{ color: MUTED }}>
                                    {p.meta}
                                  </Text>
                                </td>
                                {roomy && (
                                  <td style={{ padding: space(3) }}>
                                    <span className="flex items-center" style={{ gap: space(2), ...typeCss(t['body-sm'], mobile), color: MUTED }}>
                                      <span
                                        className="inline-flex shrink-0 items-center justify-center"
                                        style={{ width: space(6), height: space(6), borderRadius: radius.full, background: 'var(--g4)', color: 'var(--g11)', fontSize: Math.min(t.caption.size, 10), fontWeight: 600 }}
                                        {...steps('avatar: g4 · initials: g11')}
                                      >
                                        {p.owner.slice(0, 2).toUpperCase()}
                                      </span>
                                      {p.owner}
                                    </span>
                                  </td>
                                )}
                                <td style={{ padding: space(3) }}>
                                  <span {...badge(p.kind)}>{p.status}</span>
                                </td>
                                {wide && (
                                  <td style={{ padding: space(3), width: '22%' }}>
                                    <div className="flex items-center" style={{ gap: space(3) }}>
                                      <div className="flex-1 overflow-hidden" style={{ height: 6, borderRadius: radius.full, background: 'var(--g4)' }} {...steps('track: g4 · fill: a9')}>
                                        <div style={{ width: `${p.progress}%`, height: '100%', borderRadius: radius.full, background: p.progress === 100 ? 'var(--g8)' : 'var(--a9)' }} />
                                      </div>
                                      <Text s="caption" tagged={false} className="tabular-nums" style={{ color: MUTED, width: '3ch', textAlign: 'right' }}>
                                        {p.progress}
                                      </Text>
                                    </div>
                                  </td>
                                )}
                                <td style={{ padding: `${space(3)}px ${space(4)}px`, width: 1 }}>
                                  <span {...btn('ghost', 'icon')} aria-label="More">
                                    <MoreHorizontal className="size-4" />
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between" style={{ gap: space(3), padding: `${space(3)}px ${space(5)}px`, borderTop: HAIRLINE }}>
                      <Text s="caption" tagged={false} className="tabular-nums" style={{ color: MUTED }}>
                        {checked ? '1 selected · ' : ''}5 of 24
                      </Text>
                      <div className="flex" style={{ gap: space(2) }}>
                        <span {...btn('disabled', 'sm')}>Previous</span>
                        <span {...btn('gray', 'sm')}>Next</span>
                      </div>
                    </div>
                  </section>

                  <div style={{ ...grid, marginTop: space(6), alignItems: 'start' }}>
                    {/* Settings form */}
                    <section style={{ ...at(1, 8), ...panelStyle }} {...steps('panel: background · border: g6')}>
                      <div {...mergeStyle(pad(5, 'padding-panel'), { padding: space(5) })}>
                        <Text s="h5" as="h2" tagged={false}>
                          Notifications
                        </Text>
                        <Text s="body-sm" as="p" tagged={false} style={{ marginTop: space(1), color: MUTED }}>
                          Where we tell you about deploys and failed builds.{' '}
                          <span className="cursor-pointer text-(--a11) underline decoration-(--a7) underline-offset-2 hover:decoration-(--a11)" {...steps('link: a11 · underline: a7 → a11')}>
                            Use a webhook instead
                          </span>
                        </Text>
                        <div style={{ display: 'grid', gridTemplateColumns: roomy ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: space(4), marginTop: space(5) }} {...gapMark(4)}>
                          {[
                            { label: 'Email', node: <input placeholder="you@company.com" defaultValue="mai@northwind.co" className="w-full bg-transparent outline-none placeholder:text-(--g10)" style={typeCss(t['body-sm'], mobile)} />, disabled: false },
                            { label: 'Digest', node: <span className="flex w-full items-center justify-between">Daily, 9:00 <ChevronDown className="size-4" style={{ color: MUTED }} /></span>, disabled: false },
                            { label: 'Workspace ID', node: <span style={{ fontFamily: mono }}>nw_8f2k1</span>, disabled: true },
                          ].map(({ label, node, disabled }, i) => (
                            <label key={label} className="block">
                              <Text s="body-sm" tagged={i === 0} style={{ fontWeight: 500 }}>
                                {label}
                              </Text>
                              <div
                                className={cn(
                                  'flex items-center transition-[border-color,box-shadow]',
                                  disabled
                                    ? 'border border-(--g6) bg-(--g3) text-(--g9)'
                                    : 'border border-(--g7) bg-(--bg) focus-within:border-(--a8) focus-within:shadow-[0_0_0_3px_var(--a5)] hover:border-(--g8)',
                                )}
                                style={{ ...typeCss(t['body-sm'], mobile), marginTop: space(1.5), padding: `${space(2)}px ${space(3)}px`, borderRadius: radius.md }}
                                {...steps(disabled ? 'disabled: g3 · border: g6 · text: g9' : 'field: background · border: g7 → g8 · focus: a8 + ring a5')}
                                {...(i === 0 ? mark('radius', 'radius-md') : {})}
                              >
                                {node}
                              </div>
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-col" style={{ gap: space(3), marginTop: space(5) }}>
                          <span role="checkbox" aria-checked={failedEmails} onClick={() => setFailedEmails((v) => !v)} className="flex cursor-pointer items-center" style={{ gap: space(2.5) }} {...steps(failedEmails ? 'checkbox: a9 · check: contrast' : 'checkbox: border g7')}>
                            <span
                              className={cn('flex shrink-0 items-center justify-center transition-colors', failedEmails ? 'bg-(--a9) text-(--a-contrast)' : 'shadow-[inset_0_0_0_1px_var(--g7)]')}
                              style={{ width: 16, height: 16, borderRadius: Math.min(radius.xs, 4) }}
                            >
                              {failedEmails && <Check className="size-3" strokeWidth={3} />}
                            </span>
                            <Text s="body-sm" tagged={false}>
                              Email me when a build fails
                            </Text>
                          </span>
                          <span role="switch" aria-checked={alerts} onClick={() => setAlerts((v) => !v)} className="flex cursor-pointer items-center" style={{ gap: space(2.5) }} {...steps(alerts ? 'switch: on a9 · thumb: white' : 'switch: off g6')}>
                            <span className={cn('relative shrink-0 transition-colors', alerts ? 'bg-(--a9)' : 'bg-(--g6)')} style={{ width: 32, height: 18, borderRadius: radius.full }}>
                              <span className="absolute bg-white transition-[left]" style={{ top: 2, left: alerts ? 16 : 2, width: 14, height: 14, borderRadius: radius.full, boxShadow: shadow.xs }} />
                            </span>
                            <Text s="body-sm" tagged={false}>
                              Desktop alerts
                            </Text>
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-end" style={{ gap: space(2), padding: `${space(3)}px ${space(5)}px`, borderTop: HAIRLINE, background: 'var(--g2)', borderRadius: `0 0 ${radius.lg}px ${radius.lg}px` }} {...steps('footer: g2 · rule: g6')}>
                        <span {...btn('ghost')}>Cancel</span>
                        <span {...btn('solid')}>Save changes</span>
                      </div>
                    </section>

                    {/* Plan */}
                    <section style={{ ...at(9, 4), ...panelStyle, padding: space(5) }} {...steps('panel: background · border: g6')}>
                      <div className="flex items-center justify-between" style={{ gap: space(2) }}>
                        <Text s="h5" as="h2" tagged={false}>
                          Pro plan
                        </Text>
                        <span {...badge('outline')}>Annual</span>
                      </div>
                      <div className="flex items-baseline justify-between" style={{ marginTop: space(5) }}>
                        <Text s="body-sm" tagged={false} style={{ color: MUTED }}>
                          Storage
                        </Text>
                        <Text s="caption" tagged={false} className="tabular-nums" style={{ color: MUTED }}>
                          32 of 50 GB
                        </Text>
                      </div>
                      <div className="overflow-hidden" style={{ height: 6, marginTop: space(2), borderRadius: radius.full, background: 'var(--a4)' }} {...steps('track: a4 · fill: a9')}>
                        <div style={{ width: '64%', height: '100%', borderRadius: radius.full, background: 'var(--a9)' }} />
                      </div>
                      <div className="flex items-start" style={{ gap: space(2.5), marginTop: space(5), padding: space(3), borderRadius: radius.md, background: 'var(--g3)' }} {...steps('note: g3 · text: g11')}>
                        <Info className="mt-0.5 size-4 shrink-0" style={{ color: MUTED }} />
                        <Text s="body-sm" tagged={false} style={{ color: MUTED }}>
                          Renews on Nov 1, 2026.
                        </Text>
                      </div>
                      <span {...btn('outline')} style={{ ...btn('outline').style, width: '100%', marginTop: space(5) }}>
                        Manage billing
                      </span>
                    </section>
                  </div>
                </main>

                {/* Toast, floating where a real one would */}
                <div
                  className="absolute flex items-start"
                  style={{
                    right: bp.margin,
                    bottom: space(6),
                    left: mobile ? bp.margin : undefined,
                    width: mobile ? undefined : 340,
                    gap: space(3),
                    padding: space(4),
                    borderRadius: radius.lg,
                    background: 'var(--bg)',
                    border: '1px solid var(--g6)',
                    boxShadow: shadow.lg,
                  }}
                  {...steps('toast: background · border: g6 · icon: a9 · action: a11')}
                  {...mark('shadow', shadowName('lg'))} {...mark('radius', 'radius-lg')}
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--a9)' }} />
                  <div className="min-w-0 flex-1">
                    <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                      Website redesign deployed
                    </Text>
                    <Text s="caption" tagged={false} style={{ marginTop: 2, color: MUTED }}>
                      Live at northwind.co in 1m 38s.
                    </Text>
                  </div>
                  <Text s="body-sm" tagged={false} className="cursor-pointer hover:underline" style={{ color: 'var(--a11)', fontWeight: 500 }}>
                    View
                  </Text>
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* Nav */}
          <header style={{ borderBottom: HAIRLINE }} {...steps('header: background · rule: g6')}>
            <div style={{ ...container, paddingBlock: space(4) }} className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: space(2.5) }}>
                {/* The tag sits on an outer box, since the clipping one would hide its label */}
                <span
                  className="shrink-0"
                  style={{ width: space(6), height: space(6), borderRadius: radius.sm }}
                  {...steps('mark: a6 · a9 · a11 · a12')}
                  {...mark('radius', 'radius-sm')}
                >
                  <span className="grid size-full grid-cols-2 overflow-hidden" style={{ borderRadius: radius.sm }}>
                    {['--a6', '--a9', '--a11', '--a12'].map((v) => (
                      <span key={v} style={{ background: `var(${v})` }} />
                    ))}
                  </span>
                </span>
                <Text s="h5">Northwind</Text>
              </div>
              {roomy && (
                <nav className="flex" style={{ gap: space(7) }}>
                  {['Product', 'Pricing', 'Docs', 'Blog'].map((l, i) => (
                    <Text
                      key={l}
                      s="body-sm"
                      tagged={i === 0}
                      className="fx-link cursor-pointer"
                      style={{ color: page === 'article' && l === 'Blog' ? 'var(--g12)' : MUTED, fontWeight: page === 'article' && l === 'Blog' ? 500 : undefined }}
                    >
                      {l}
                    </Text>
                  ))}
                </nav>
              )}
              <div className="flex items-center" style={{ gap: space(4) }}>
                {!mobile && (
                  <Text s="body-sm" tagged={false} className="fx-link cursor-pointer" style={{ color: MUTED }}>
                    Sign in
                  </Text>
                )}
                <span {...btn('solid')} {...mark('radius', 'radius-md')}>
                  Get started
                </span>
              </div>
            </div>
          </header>

          {page === 'landing' ? (
            <main>
              {/* Hero: the offer, and the action in its working form */}
              <section style={{ ...container, paddingTop: space(mobile ? 12 : 24) }}>
                <div style={grid}>
                  <div style={at(1, 10)}>
                    <Text s="display" as="h1">
                      Your whole design system, from one color.
                    </Text>
                  </div>
                  <div style={at(1, 6)}>
                    <Text s="body-lg" as="p" style={{ color: MUTED }}>
                      Northwind turns a brand color and a few decisions into color, type, spacing, radius, shadow and grid
                      tokens, tuned for light and dark and ready for code and Figma.
                    </Text>
                    <div
                      className="flex flex-wrap items-stretch"
                      style={{ gap: space(2), marginTop: space(8) }}
                      {...gapMark(2)}
                    >
                      <div
                        className="flex min-w-0 flex-1 items-center"
                        style={{
                          gap: space(2.5),
                          minWidth: mobile ? '100%' : 240,
                          padding: `${space(2)}px ${space(3)}px`,
                          borderRadius: radius.md,
                          background: 'var(--bg)',
                          boxShadow: `inset 0 0 0 1px var(--g7), ${shadow.xs}`,
                        }}
                        {...steps('field: background · border: g7 · swatch: a9')}
                        {...mark('radius', 'radius-md')} {...mark('shadow', shadowName('xs'))}
                      >
                        <span className="shrink-0" style={{ width: space(5), height: space(5), borderRadius: radius.sm, background: 'var(--a9)' }} />
                        <span style={{ ...typeCss(t.body, mobile), fontFamily: mono, color: 'var(--g12)' }}>{hex(accent.solid)}</span>
                      </div>
                      <span {...btn('solid', 'lg')} style={{ ...btn('solid', 'lg').style, flexGrow: mobile ? 1 : 0 }}>
                        Generate tokens <ArrowRight className="size-4" />
                      </span>
                    </div>
                    <Text s="caption" style={{ marginTop: space(3), color: MUTED }}>
                      Free for personal projects. No account needed to try it.
                    </Text>
                  </div>
                </div>

                {/* Proof: the scales this color produces, and the tokens they become */}
                <div
                  {...mergeStyle(pad(mobile ? 4 : 8, 'padding-panel'), {
                    marginTop: space(mobile ? 12 : 16),
                    padding: space(mobile ? 4 : 8),
                    borderRadius: radius.xl,
                    background: 'var(--g2)',
                    boxShadow: `inset 0 0 0 1px var(--g6), ${shadow.xl}`,
                  })}
                  {...steps('panel: g2 · border: g6')}
                  {...mark('radius', 'radius-xl')} {...mark('shadow', shadowName('xl'))}
                >
                  <div style={{ ...grid, rowGap: space(8), alignItems: 'start' }}>
                    <div style={at(1, 8)}>
                      <div className="flex items-baseline justify-between" style={{ gap: space(3) }}>
                        <Text s="h5">Accent</Text>
                        <Text s="caption" tagged={false} className="tabular-nums" style={{ color: MUTED, fontFamily: mono }}>
                          {hex(accent.solid)} → 12 steps
                        </Text>
                      </div>
                      <div style={{ marginTop: space(3) }}>
                        <ScaleStrip scale={accentScale} prefix="a" height={space(mobile ? 10 : 16)} />
                      </div>
                      <div className="flex items-baseline justify-between" style={{ gap: space(3), marginTop: space(6) }}>
                        <Text s="h5" tagged={false}>
                          Gray
                        </Text>
                        <Text s="caption" tagged={false} style={{ color: MUTED }}>
                          Tinted to match
                        </Text>
                      </div>
                      <div style={{ marginTop: space(3) }}>
                        <ScaleStrip scale={gray} prefix="g" height={space(mobile ? 6 : 10)} />
                      </div>
                      {!mobile && <StepJobs />}
                    </div>

                    <div
                      style={{
                        ...at(9, 4),
                        background: 'var(--bg)',
                        borderRadius: radius.lg,
                        boxShadow: 'inset 0 0 0 1px var(--g6)',
                        overflow: 'hidden',
                      }}
                      {...steps('code: background · border: g6')}
                      {...mark('radius', 'radius-lg')}
                    >
                      <div className="flex items-center justify-between" style={{ padding: `${space(2.5)}px ${space(4)}px`, borderBottom: HAIRLINE }}>
                        <Text s="caption" tagged={false} style={{ fontFamily: mono, color: MUTED }}>
                          tokens.css
                        </Text>
                        <Text s="caption" tagged={false} style={{ color: 'var(--a11)', fontWeight: 500 }}>
                          Copy
                        </Text>
                      </div>
                      <div style={{ padding: space(4), fontFamily: mono, fontSize: Math.max(11, t.caption.size), lineHeight: 1.9 }}>
                        {[
                          ['bg-accent', 'var(--a9)', accentScale.colors[8]],
                          ['bg-accent-hover', 'var(--a10)', accentScale.colors[9]],
                          ['text-accent', 'var(--a11)', accentScale.colors[10]],
                          ['bg-subtle', 'var(--g2)', gray.colors[1]],
                          ['border', 'var(--g6)', gray.colors[5]],
                          ['text', 'var(--g12)', gray.colors[11]],
                        ].map(([name, v, c]) => (
                          <div key={name} className="flex items-center" style={{ gap: space(2) }}>
                            <span className="shrink-0" style={{ width: 10, height: 10, borderRadius: 3, background: v, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.08)' }} />
                            <span className="truncate" style={{ color: MUTED }}>
                              --color-{name}
                            </span>
                            <span className="ml-auto" style={{ color: 'var(--g12)' }}>
                              {hex(c)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* What it does, as editorial rows rather than a row of cards */}
              <section style={{ ...container, marginTop: sectionGap }}>
                <div style={{ ...grid, alignItems: 'start' }}>
                  <div style={at(1, 4)}>
                    <Text s="h2" as="h2">
                      Decisions in, tokens out.
                    </Text>
                  </div>
                  <div style={at(6, 7)}>
                    {[
                      {
                        title: 'One input, twelve steps',
                        body: 'Each step has a single job, from app background to high-contrast text, so contrast holds wherever a step lands.',
                        extra: null,
                      },
                      {
                        title: 'Dark mode, tuned rather than inverted',
                        body: 'Every token ships a dark value adjusted for perceived lightness, so solids stay vivid and surfaces stay calm.',
                        extra: null,
                      },
                      {
                        title: 'Ships where you build',
                        body: 'Export the same system to every platform your team touches, and keep them in sync from one place.',
                        extra: ['CSS', 'Tailwind', 'JSON', 'Figma variables'],
                      },
                    ].map(({ title, body, extra }, i) => (
                      <div
                        key={title}
                        {...mergeStyle(i === 0 ? pad(8, 'py: row') : {}, {
                          paddingBlock: space(8),
                          borderTop: HAIRLINE,
                          ...(i === 2 && { borderBottom: HAIRLINE }),
                        })}
                        {...(i === 0 ? steps('rule: g6') : {})}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 2fr) minmax(0, 3fr)', gap: space(mobile ? 2 : 6) }}>
                          <Text s="h4" as="h3" tagged={i === 0}>
                            {title}
                          </Text>
                          <div>
                            <Text s="body" as="p" tagged={i === 0} style={{ color: MUTED }}>
                              {body}
                            </Text>
                            {extra && (
                              <div className="flex flex-wrap" style={{ gap: space(2), marginTop: space(4) }}>
                                {extra.map((x, j) => (
                                  <span
                                    key={x}
                                    style={{ ...typeCss(t.caption, mobile), fontWeight: 500, padding: `${space(1)}px ${space(2.5)}px`, borderRadius: radius.full, background: 'var(--g3)', color: 'var(--g12)' }}
                                    {...steps('chip: g3 · text: g12')}
                                    {...(j === 0 ? mark('radius', 'radius-full') : {})}
                                  >
                                    {x}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Pricing: one panel split in two, the recommended plan tinted */}
              <section style={{ ...container, marginTop: sectionGap }}>
                <div style={{ ...grid, alignItems: 'end' }}>
                  <div style={at(1, 6)}>
                    <Text s="h2" as="h2">
                      Free to start. Pro when your team joins.
                    </Text>
                  </div>
                </div>
                <div
                  className="overflow-hidden"
                  style={{
                    ...grid,
                    rowGap: 0,
                    columnGap: 0,
                    marginTop: space(10),
                    borderRadius: radius.xl,
                    // A real border: an inset-shadow one would be painted over by the tinted Pro column
                    border: HAIRLINE,
                    boxShadow: shadow.lg,
                    background: 'var(--g-surface)',
                  }}
                  {...steps('panel: gray surface · border: g6')}
                  {...mark('radius', 'radius-xl')} {...mark('shadow', shadowName('lg'))}
                >
                  {[
                    { name: 'Personal', price: '$0', per: 'forever', items: ['All six foundations', 'CSS and JSON export', 'Light and dark themes'], primary: false },
                    { name: 'Pro', price: '$24', per: 'per editor / month', items: ['Everything in Personal', 'Figma variables sync', 'Shared team presets', 'Version history'], primary: true },
                  ].map(({ name, price, per, items, primary }, i) => (
                    <div
                      key={name}
                      className="flex flex-col"
                      {...mergeStyle(i === 0 ? pad(mobile ? 6 : 10, 'padding-plan') : {}, {
                        ...half(i as 0 | 1),
                        padding: space(mobile ? 6 : 10),
                        ...(primary && { background: 'var(--a2)' }),
                        ...(i === 1 && (roomy ? { borderLeft: HAIRLINE } : { borderTop: HAIRLINE })),
                      })}
                      {...(primary ? steps('plan: a2 · rule: g6') : {})}
                    >
                      <div className="flex items-center" style={{ gap: space(2) }}>
                        <Text s="h4" as="h3" tagged={i === 0}>
                          {name}
                        </Text>
                        {primary && (
                          <span
                            style={{ ...typeCss(t.caption, mobile), fontWeight: 500, padding: `0 ${space(2)}px`, borderRadius: radius.full, background: 'var(--a4)', color: 'var(--a11)' }}
                            {...steps('badge: a4 · text: a11')}
                          >
                            For teams
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline" style={{ gap: space(2), marginTop: space(4) }}>
                        <Text s="h1" tagged={i === 0} className="tabular-nums">
                          {price}
                        </Text>
                        <Text s="body-sm" tagged={false} style={{ color: MUTED }}>
                          {per}
                        </Text>
                      </div>
                      <ul className="flex flex-col" style={{ gap: space(3), marginTop: space(6), marginBottom: space(8) }}>
                        {items.map((item, j) => (
                          <li key={item} className="flex items-start" style={{ gap: space(2.5) }}>
                            <Check className="mt-[0.2em] size-4 shrink-0" style={{ color: 'var(--a11)' }} {...steps('icon: a11')} />
                            <Text s="body-sm" tagged={i === 0 && j === 0}>
                              {item}
                            </Text>
                          </li>
                        ))}
                      </ul>
                      <span {...btn(primary ? 'solid' : 'neutral')} style={{ ...btn(primary ? 'solid' : 'neutral').style, marginTop: 'auto' }}>
                        {primary ? 'Start a Pro trial' : 'Start for free'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Closing call to action, the page's one full-accent moment */}
              <section style={{ ...container, marginTop: sectionGap }}>
                <div
                  className="relative overflow-hidden"
                  {...mergeStyle(pad(mobile ? 8 : 16, 'padding-band'), {
                    padding: space(mobile ? 8 : 16),
                    borderRadius: radius['2xl'],
                    background: 'var(--a9)',
                    color: 'var(--a-contrast)',
                  })}
                  {...steps(`band: a9 · text: contrast · steps: ${isDark ? 'a8 → a6' : 'a10 → a12'}`)}
                  {...mark('radius', 'radius-2xl')}
                >
                  {/* The accent's own steps, deepening toward the page background in either theme */}
                  {!mobile && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex" aria-hidden style={{ width: '32%' }}>
                      {(isDark ? ['--a8', '--a7', '--a6'] : ['--a10', '--a11', '--a12']).map((v) => (
                        <span key={v} className="flex-1" style={{ background: `var(${v})` }} />
                      ))}
                    </div>
                  )}
                  <div className="relative" style={{ maxWidth: wide ? '58%' : undefined }}>
                    <Text s="h1" as="h2" style={{ color: 'var(--a-contrast)' }}>
                      Start with the color you already have.
                    </Text>
                    <Text s="body-lg" as="p" style={{ marginTop: space(4), color: 'var(--a-contrast)', opacity: 0.85 }}>
                      Paste it in, adjust what you need, and export a system your whole team can build on.
                    </Text>
                    <span
                      className="cursor-pointer"
                      style={{ ...btn('solid', 'lg').style, marginTop: space(8), background: 'var(--a-contrast)', color: 'var(--a9)' }}
                      {...steps('button: contrast · text: a9')}
                    >
                      Generate my tokens <ArrowRight className="size-4" />
                    </span>
                  </div>
                </div>
              </section>

              {/* Footer */}
              <footer style={{ ...container, marginTop: sectionGap, paddingBottom: space(10) }}>
                <div style={{ ...grid, paddingTop: space(10), borderTop: HAIRLINE }}>
                  <div style={at(1, 4)}>
                    <Text s="h5">Northwind</Text>
                    <Text s="body-sm" as="p" style={{ marginTop: space(2), color: MUTED, maxWidth: '32ch' }}>
                      Design tokens from a few decisions, for every platform your team ships.
                    </Text>
                  </div>
                  {[
                    { head: 'Product', links: ['Color', 'Typography', 'Export'] },
                    { head: 'Resources', links: ['Docs', 'Blog', 'Changelog'] },
                    { head: 'Company', links: ['About', 'Careers', 'Contact'] },
                  ].map(({ head, links }, i) => (
                    <div key={head} style={wide ? at(7 + i * 2, 2) : { gridColumn: roomy ? lines12(i * 4, i * 4 + 4) : `span ${Math.max(1, Math.floor(cols / 2))}` }}>
                      <Text s="body-sm" tagged={i === 0} style={{ fontWeight: 500 }}>
                        {head}
                      </Text>
                      <div className="flex flex-col" style={{ gap: space(2), marginTop: space(3) }}>
                        {links.map((l) => (
                          <Text key={l} s="body-sm" tagged={false} className="fx-link cursor-pointer" style={{ color: MUTED }}>
                            {l}
                          </Text>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Text s="caption" as="p" style={{ marginTop: space(10), color: MUTED }}>
                  © 2026 Northwind. Built with Lumina tokens.
                </Text>
              </footer>
            </main>
          ) : (
            <main style={{ ...container, paddingBlock: space(mobile ? 8 : 16) }}>
              <div style={{ ...grid, alignItems: 'start' }}>
                {/* Rail: who wrote it and where the reader is */}
                {wide && (
                  <aside style={{ ...at(1, 3), paddingTop: space(1) }}>
                    <div className="flex items-center" style={{ gap: space(3) }}>
                      <span
                        className="inline-flex shrink-0 items-center justify-center"
                        style={{ width: space(10), height: space(10), borderRadius: radius.full, background: 'var(--a4)', color: 'var(--a11)', ...typeCss(t['body-sm'], mobile), fontWeight: 600 }}
                        {...steps('avatar: a4 · initials: a11')}
                        {...mark('radius', 'radius-full')}
                      >
                        MK
                      </span>
                      <div>
                        <Text s="body-sm" style={{ fontWeight: 500 }}>
                          Mai Kobayashi
                        </Text>
                        <Text s="caption" style={{ color: MUTED }}>
                          Design engineer
                        </Text>
                      </div>
                    </div>
                    <Text s="caption" tagged={false} className="flex items-center" style={{ gap: space(1.5), marginTop: space(4), color: MUTED }}>
                      Oct 14, 2026 <span aria-hidden>·</span> <Clock className="size-3" /> 6 min read
                    </Text>

                    <nav style={{ marginTop: space(10) }} aria-label="On this page">
                      <Text s="caption" style={{ color: 'var(--g12)', fontWeight: 600 }}>
                        On this page
                      </Text>
                      <div className="flex flex-col" style={{ marginTop: space(3), borderLeft: HAIRLINE }} {...steps('rail: g6 · active: a9 · a11')}>
                        {['Start with the surfaces', 'Give every step a job', 'Ship it as code'].map((l, i) => (
                          <Text
                            key={l}
                            s="body-sm"
                            tagged={i === 0}
                            className="fx-link cursor-pointer"
                            style={{
                              marginLeft: -1,
                              paddingBlock: space(1.5),
                              paddingLeft: space(4),
                              borderLeft: `1px solid ${i === 0 ? 'var(--a9)' : 'transparent'}`,
                              color: i === 0 ? 'var(--a11)' : MUTED,
                              fontWeight: i === 0 ? 500 : undefined,
                            }}
                          >
                            {l}
                          </Text>
                        ))}
                      </div>
                    </nav>
                  </aside>
                )}

                {/* Without the rail the column would run edge to edge, so cap it at a reading measure */}
                <article style={{ ...at(4, 7), maxWidth: wide ? undefined : t.body.size * 44 }}>
                  <Text s="caption" tagged={false} className="flex items-center" style={{ gap: space(1.5), color: MUTED }}>
                    <span className="fx-link cursor-pointer">Blog</span>
                    <ChevronRight className="size-3" aria-hidden />
                    <span className="fx-link cursor-pointer">Engineering</span>
                  </Text>
                  <Text s="h1" as="h1" style={{ marginTop: space(4) }}>
                    How we rebuilt our color system from a single input
                  </Text>
                  <Text s="body-lg" as="p" style={{ marginTop: space(5), color: MUTED }}>
                    Forty hand-picked hex values became one base color and a handful of rules. Here’s what changed, and what
                    we’d do differently.
                  </Text>
                  {!wide && (
                    <div className="flex items-center" style={{ gap: space(3), marginTop: space(6) }}>
                      <span
                        className="inline-flex shrink-0 items-center justify-center"
                        style={{ width: space(9), height: space(9), borderRadius: radius.full, background: 'var(--a4)', color: 'var(--a11)', ...typeCss(t.caption, mobile), fontWeight: 600 }}
                        {...steps('avatar: a4 · initials: a11')}
                        {...mark('radius', 'radius-full')}
                      >
                        MK
                      </span>
                      <div>
                        <Text s="body-sm" tagged={false} style={{ fontWeight: 500 }}>
                          Mai Kobayashi
                        </Text>
                        <Text s="caption" tagged={false} style={{ color: MUTED }}>
                          Oct 14, 2026 · 6 min read
                        </Text>
                      </div>
                    </div>
                  )}

                  {/* Figure: the scale itself, with what each run of steps is for */}
                  <figure style={{ marginTop: space(mobile ? 8 : 12) }}>
                    <div
                      {...mergeStyle(pad(mobile ? 4 : 6, 'padding-figure'), {
                        padding: space(mobile ? 4 : 6),
                        borderRadius: radius.lg,
                        background: 'var(--g2)',
                        boxShadow: shadow.sm,
                      })}
                      {...steps('figure: g2')}
                      {...mark('radius', 'radius-lg')} {...mark('shadow', shadowName('sm'))}
                    >
                      <ScaleStrip scale={accentScale} prefix="a" height={space(mobile ? 8 : 14)} />
                      {!mobile && <StepJobs />}
                    </div>
                    <Text s="caption" as="figcaption" style={{ marginTop: space(3), color: MUTED }}>
                      Figure 1. One base color, twelve steps, each with a single job.
                    </Text>
                  </figure>

                  <Text s="body" as="p" style={{ marginTop: space(10) }}>
                    Every product team eventually hits the same wall: the palette that worked for a landing page falls
                    apart in a dense table, and dark mode turns into a second, slightly different design system.
                  </Text>

                  <Text s="h2" as="h2" style={{ marginTop: space(12) }}>
                    Start with the surfaces
                  </Text>
                  <Text s="body" as="p" tagged={false} style={{ marginTop: space(4) }}>
                    We began with backgrounds and borders, not brand colors. Once steps 1 to 6 felt calm in both themes,
                    the accents had something solid to sit on.
                  </Text>

                  {/* Pull quote, set between hairlines instead of a colored bar */}
                  <blockquote
                    {...mergeStyle(pad(8, 'py: quote'), { marginBlock: space(10), paddingBlock: space(8), borderBlock: HAIRLINE })}
                    {...steps('rules: g6 · mark: a9')}
                  >
                    <Quote aria-hidden className="size-6" style={{ color: 'var(--a9)', fill: 'var(--a9)', marginBottom: space(4) }} />
                    <Text s="h3" tagged={false} as="p" style={{ fontWeight: 500 }}>
                      The moment our tokens had names instead of values, design reviews got shorter.
                    </Text>
                    <Text s="body-sm" tagged={false} style={{ marginTop: space(4), color: MUTED }}>
                      Hana Ito, design lead at Northwind
                    </Text>
                  </blockquote>

                  <Text s="h2" as="h2" tagged={false}>
                    Give every step a job
                  </Text>
                  <Text s="body" as="p" tagged={false} style={{ marginTop: space(4) }}>
                    A step is never picked for how it looks in isolation. It’s picked for the job it does, which keeps the
                    whole scale predictable.
                  </Text>
                  <div className="overflow-x-auto" style={{ marginTop: space(6) }}>
                    <table className="w-full border-collapse text-left" {...steps('header: g11 · rows: g6')}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--g7)' }}>
                          {['Steps', 'Job', 'Token'].map((h) => (
                            <th key={h} style={{ ...typeCss(t.caption, mobile), fontWeight: 600, color: MUTED, padding: `${space(2)}px ${space(3)}px`, paddingLeft: h === 'Steps' ? 0 : undefined }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['1–2', 'App and subtle backgrounds', 'bg, bg-subtle', 1],
                          ['3–5', 'Component states', 'surface-*', 3],
                          ['6–8', 'Borders and focus rings', 'border-*', 6],
                          ['9–10', 'Solid fills', 'bg-accent', 8],
                          ['11–12', 'Text', 'text-*', 11],
                        ].map(([range, job, token, step]) => (
                          <tr key={range as string} style={{ borderBottom: HAIRLINE }}>
                            <td style={{ ...typeCss(t['body-sm'], mobile), padding: `${space(3)}px ${space(3)}px ${space(3)}px 0`, whiteSpace: 'nowrap' }}>
                              <span className="inline-flex items-center tabular-nums" style={{ gap: space(2) }}>
                                <span style={{ width: 10, height: 10, borderRadius: 3, background: accentScale.colors[step as number] }} />
                                {range}
                              </span>
                            </td>
                            <td style={{ ...typeCss(t['body-sm'], mobile), padding: space(3), color: MUTED }}>{job}</td>
                            <td style={{ ...typeCss(t['body-sm'], mobile), padding: space(3), fontFamily: mono, whiteSpace: 'nowrap' }}>{token}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Text s="h2" as="h2" tagged={false} style={{ marginTop: space(12) }}>
                    Ship it as code
                  </Text>
                  <Text s="body" tagged={false} as="p" style={{ marginTop: space(4) }}>
                    Components read semantic tokens only, such as{' '}
                    <code
                      {...steps('code: g3 · text: g12')}
                      style={{ fontFamily: mono, fontSize: '0.875em', padding: `1px ${space(1.5)}px`, borderRadius: radius.sm, background: 'var(--g3)' }}
                    >
                      --color-bg-accent
                    </code>
                    , so swapping a theme never touches a component.
                  </Text>
                  <div
                    className="overflow-hidden"
                    style={{ marginTop: space(6), borderRadius: radius.md, background: 'var(--g2)', boxShadow: 'inset 0 0 0 1px var(--g6)' }}
                    {...steps('code block: g2 · border: g6 · text: g12')}
                    {...mark('radius', 'radius-md')}
                  >
                    <div style={{ padding: `${space(2)}px ${space(4)}px`, borderBottom: HAIRLINE, ...typeCss(t.caption, mobile), fontFamily: mono, color: MUTED }}>
                      button.css
                    </div>
                    <pre
                      className="overflow-x-auto"
                      {...mergeStyle(pad(4), { margin: 0, padding: space(4), fontFamily: mono, fontSize: Math.max(12, t['body-sm'].size - 1), lineHeight: 1.7 })}
                    >
                      {`.button {\n  background: var(--color-bg-accent);\n  border-radius: var(--radius-md);\n  padding: var(--space-2-5) var(--space-4);\n}`}
                    </pre>
                  </div>

                  <ul className="flex flex-col" style={{ gap: space(2), marginTop: space(6), paddingLeft: space(5), listStyle: 'disc' }}>
                    {['One base color per palette', 'Twelve steps, each with one job', 'A tuned value for dark mode'].map((l, i) => (
                      <Text key={l} s="body" as="li" tagged={i === 0}>
                        {l}
                      </Text>
                    ))}
                  </ul>

                  <div
                    className="flex"
                    {...mergeStyle(pad(5, 'padding-callout'), {
                      gap: space(3),
                      marginTop: space(10),
                      padding: space(5),
                      borderRadius: radius.lg,
                      background: 'var(--a3)',
                    })}
                    {...steps('callout: a3 · icon: a11 · text: a12')}
                    {...mark('radius', 'radius-lg')}
                  >
                    <Info className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--a11)' }} />
                    <div>
                      <Text s="h5" tagged={false} style={{ color: 'var(--a12)' }}>
                        Try it on your own brand
                      </Text>
                      <Text s="body-sm" tagged={false} as="p" style={{ marginTop: space(1), color: 'var(--a11)' }}>
                        Pick a base color, export to CSS or Figma variables, and drop it into an existing app.
                      </Text>
                    </div>
                  </div>

                  {/* Keep reading, as rows a reader can scan */}
                  <section style={{ marginTop: space(16) }}>
                    <Text s="h4" as="h2">
                      Keep reading
                    </Text>
                    <div style={{ marginTop: space(4), borderTop: HAIRLINE }}>
                      {[
                        { date: 'Oct 02', title: 'A type scale that survives mobile', time: 4 },
                        { date: 'Sep 18', title: 'Shadows that work in dark mode', time: 5 },
                        { date: 'Sep 03', title: 'Naming tokens people can find', time: 7 },
                      ].map(({ date, title, time }, i) => (
                        <div
                          key={title}
                          className="fx-row flex cursor-pointer items-baseline"
                          {...mergeStyle(i === 0 ? pad(4, 'py: row') : {}, { gap: space(mobile ? 3 : 6), paddingBlock: space(4), borderBottom: HAIRLINE })}
                        >
                          <Text s="caption" tagged={i === 0} className="shrink-0 tabular-nums" style={{ color: MUTED, width: space(14) }}>
                            {date}
                          </Text>
                          <Text s="body" tagged={i === 0} className="fx-row-title min-w-0 flex-1" style={{ fontWeight: 500, transition: 'color 150ms ease-out' }}>
                            {title}
                          </Text>
                          {!mobile && (
                            <Text s="caption" tagged={false} className="flex shrink-0 items-center gap-1" style={{ color: MUTED }}>
                              {time} min <ArrowRight className="size-3" />
                            </Text>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </article>
              </div>

              <Text s="caption" as="p" style={{ marginTop: space(16), color: MUTED }}>
                © 2026 Northwind. Built with Lumina tokens.
              </Text>
            </main>
          )}
            </>
          )}
        </div>
      </StepTokenLayer>
          </div>
        </div>
      </div>
    </div>
  );
}
