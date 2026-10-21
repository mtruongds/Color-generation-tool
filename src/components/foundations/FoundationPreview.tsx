import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Layers, Monitor, Smartphone, Sparkles, Zap } from 'lucide-react';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { type Accent, type FoundationKey, type Foundations, computeGridLayout, resolveFoundations, spacingTokenName } from '../../lib/foundations';
import { typeCss } from './FoundationSample';

type PreviewKey = Exclude<FoundationKey, 'color'>;

const MOBILE_WIDTH = 390;

const HIGHLIGHT_LABEL: Record<PreviewKey, string> = {
  typography: 'Show text styles',
  spacing: 'Show padding and gaps',
  radius: 'Show corner radii',
  shadow: 'Show elevation',
  grid: 'Show columns',
};

/** Column span for a 12-column design, adapted to grids with fewer columns. */
function spanFor(span12: number, cols: number) {
  if (cols >= 12) return Math.min(span12, cols);
  if (cols >= 8) return span12 >= 5 ? cols : Math.round(cols / 2);
  return cols;
}

/**
 * One product page built only from foundation tokens. The current foundation can be
 * highlighted on top: text styles, padding, radii, shadows or grid columns.
 */
export function FoundationPreview({
  foundation,
  foundations,
  isDark,
  accent,
}: {
  foundation: PreviewKey;
  foundations: Foundations;
  isDark: boolean;
  accent: Accent;
}) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>(() =>
    window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
  );
  const [highlight, setHighlight] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(1024);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setFrameWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewport]);

  const mobile = viewport === 'mobile';
  const tokens = useMemo(() => resolveFoundations(foundations, isDark), [foundations, isDark]);
  const { type: t, space, radius, shadow } = tokens;
  // The preview is a marketing page, so the sidebar setting doesn't apply here
  const layout = computeGridLayout({ ...foundations.grid, sidebar: 0 }, frameWidth);
  const { breakpoint: bp } = layout;
  const cols = bp.columns;
  const on = (kind: PreviewKey) => highlight && foundation === kind;
  const shadowName = (name: string) => `shadow-${name}`;

  /** Tags an element for the active highlight. Only the current foundation's tags show. */
  const mark = (kind: PreviewKey, label: string) => (on(kind) ? { 'data-fx': label } : {});
  /** Spacing tag that also tints the padding area. */
  const pad = (multiplier: number, label = `p: ${spacingTokenName(multiplier)}`) =>
    on('spacing')
      ? { 'data-fx': label, 'data-fx-pad': '', style: { '--fx-pad': `${space(multiplier)}px` } as React.CSSProperties }
      : {};

  const Text = ({
    s,
    as: Tag = 'div',
    className,
    style,
    tagged = true,
    children,
  }: {
    s: string;
    /** Repeated items label only their first instance, so tags don't pile up. */
    tagged?: boolean;
    as?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
  }) => (
    <Tag className={className} style={{ ...typeCss(t[s], mobile), ...style }} {...(tagged ? mark('typography', `text-${s}`) : {})}>
      {children}
    </Tag>
  );

  const button = (primary: boolean): React.CSSProperties => ({
    ...typeCss(t['body-sm'], mobile),
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: space(1.5),
    borderRadius: radius.md,
    padding: `${space(2.5)}px ${space(4)}px`,
    ...(primary
      ? { background: accent.solid, color: accent.contrast, boxShadow: shadow.xs }
      : { background: 'var(--card)', border: '1px solid var(--border)' }),
  });

  const mergeStyle = (a: ReturnType<typeof pad>, style: React.CSSProperties) => ({ ...a, style: { ...style, ...('style' in a ? a.style : {}) } });

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
  const col = (span12: number): React.CSSProperties => ({ gridColumn: `span ${spanFor(span12, cols)} / span ${spanFor(span12, cols)}` });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={viewport} onValueChange={(v) => setViewport(v as typeof viewport)} className="gap-0">
          <TabsList className="h-8 rounded-lg" aria-label="Viewport">
            <TabsTrigger value="desktop" className="gap-1.5 rounded-md px-2.5 text-xs">
              <Monitor className="size-3.5" /> Desktop
            </TabsTrigger>
            <TabsTrigger value="mobile" className="gap-1.5 rounded-md px-2.5 text-xs">
              <Smartphone className="size-3.5" /> Mobile
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.6875rem] text-muted-foreground tabular">
            {frameWidth}px · {bp.name} · {cols} cols
          </span>
          <div className="flex items-center gap-2">
            <Switch id="fx-highlight" checked={highlight} onCheckedChange={setHighlight} />
            <Label htmlFor="fx-highlight" className="text-xs font-normal">
              {HIGHLIGHT_LABEL[foundation]}
            </Label>
          </div>
        </div>
      </div>

      {/* Frame */}
      <div className={mobile ? 'flex justify-center' : undefined}>
        <div
          ref={frameRef}
          className="fx-preview relative w-full overflow-hidden border bg-background text-foreground"
          style={
            {
              maxWidth: mobile ? MOBILE_WIDTH : undefined,
              borderRadius: mobile ? 28 : 16,
              '--fx-accent': accent.solid,
              '--fx-contrast': accent.contrast,
            } as React.CSSProperties
          }
        >
          {/* Grid overlay */}
          {on('grid') && (
            <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
              <div style={{ ...container, height: '100%' }}>
                <div style={{ ...grid, height: '100%' }}>
                  {Array.from({ length: cols }, (_, i) => (
                    <div key={i} style={{ background: `color-mix(in oklab, ${accent.solid} 12%, transparent)`, borderInline: `1px solid color-mix(in oklab, ${accent.solid} 28%, transparent)` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <header className="border-b bg-card">
            <div style={{ ...container, paddingBlock: space(4) }} className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: space(2) }}>
                <span className="size-6" style={{ background: accent.solid, borderRadius: radius.sm }} {...mark('radius', 'radius-sm')} />
                <Text s="h5">Northwind</Text>
              </div>
              {!mobile && cols >= 8 && (
                <nav className="flex" style={{ gap: space(6) }}>
                  {['Product', 'Pricing', 'Docs'].map((l, i) => (
                    <Text key={l} s="body-sm" tagged={i === 0} style={{ color: 'var(--muted-foreground)' }}>
                      {l}
                    </Text>
                  ))}
                </nav>
              )}
              <span style={button(true)} {...mark('radius', 'radius-md')}>
                Sign up
              </span>
            </div>
          </header>

          <main style={{ ...container, paddingBlock: space(mobile ? 10 : 16) }}>
            {/* Hero */}
            <section style={{ ...grid, alignItems: 'center' }}>
              <div style={col(7)}>
                <Text s="caption" style={{ color: accent.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  New · Release 4.0
                </Text>
                <Text s="display" as="h1" style={{ marginTop: space(3) }}>
                  Ship a design system in an afternoon
                </Text>
                <Text s="body-lg" as="p" style={{ marginTop: space(4), color: 'var(--muted-foreground)' }}>
                  Generate color, type, spacing, radius, shadow and grid tokens from a few decisions, then export them
                  everywhere your team builds.
                </Text>
                <div className="flex flex-wrap" style={{ gap: space(3), marginTop: space(8) }} {...mark('spacing', `gap: ${spacingTokenName(3)}`)}>
                  <span style={button(true)}>
                    Get started <ArrowRight className="size-4" />
                  </span>
                  <span style={button(false)}>View docs</span>
                </div>
              </div>

              <div style={col(5)}>
                <div
                  className="border bg-card"
                  {...mergeStyle(pad(6, 'padding-card'), { borderRadius: radius.xl, padding: space(6), boxShadow: shadow.lg })}
                  {...(on('radius') ? { 'data-fx': 'radius-xl' } : {})}
                  {...(on('shadow') ? { 'data-fx': shadowName('lg') } : {})}
                >
                  <Text s="body-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Monthly active teams
                  </Text>
                  <Text s="h2" style={{ marginTop: space(1) }}>
                    12,480
                  </Text>
                  <div className="flex items-end" style={{ gap: space(1.5), height: 72, marginTop: space(4) }}>
                    {[40, 55, 48, 70, 62, 86, 78].map((h, i) => (
                      <span key={i} className="flex-1" style={{ height: `${h}%`, background: i === 5 ? accent.solid : accent.subtle, borderRadius: radius.xs }} />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Features */}
            <section style={{ marginTop: space(mobile ? 12 : 20) }}>
              <Text s="h2" as="h2">
                Everything stays in sync
              </Text>
              <div style={{ ...grid, marginTop: space(6) }}>
                {[
                  { icon: Zap, title: 'Instant tokens', body: 'Change one input and every scale updates.' },
                  { icon: Layers, title: 'Light and dark', body: 'Each token ships with a tuned dark value.' },
                  { icon: Sparkles, title: 'Any platform', body: 'CSS, Tailwind, JSON and Figma variables.' },
                ].map(({ icon: Icon, title, body }, i) => (
                  <div
                    key={title}
                    className="border bg-card"
                    {...mergeStyle(pad(6, 'padding-card'), { ...col(4), borderRadius: radius.lg, padding: space(6), boxShadow: shadow.sm })}
                    {...(on('radius') && i === 0 ? { 'data-fx': 'radius-lg' } : {})}
                    {...(on('shadow') && i === 0 ? { 'data-fx': shadowName('sm') } : {})}
                  >
                    <span
                      className="inline-flex items-center justify-center"
                      style={{ width: space(10), height: space(10), borderRadius: radius.md, background: accent.subtle, color: accent.text }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <Text s="h4" as="h3" style={{ marginTop: space(4) }}>
                      {title}
                    </Text>
                    <Text s="body" as="p" style={{ marginTop: space(2), color: 'var(--muted-foreground)' }}>
                      {body}
                    </Text>
                  </div>
                ))}
              </div>
            </section>

            {/* Settings + dialog */}
            <section style={{ ...grid, marginTop: space(mobile ? 12 : 20), alignItems: 'start' }}>
              <div
                className="border bg-card"
                {...mergeStyle(pad(6, 'padding-card'), { ...col(7), borderRadius: radius.lg, padding: space(6) })}
              >
                <Text s="h3" as="h2">
                  Workspace
                </Text>
                <Text s="body-sm" as="p" style={{ marginTop: space(1), color: 'var(--muted-foreground)' }}>
                  Applies to everyone on the Pro plan.
                </Text>
                <div className="flex flex-col" style={{ gap: space(4), marginTop: space(6) }} {...mark('spacing', `gap: ${spacingTokenName(4)}`)}>
                  {['Workspace name', 'Billing email'].map((l, i) => (
                    <div key={l}>
                      <Text s="body-sm" style={{ fontWeight: 500 }}>
                        {l}
                      </Text>
                      <div
                        className="border bg-background"
                        style={{
                          ...typeCss(t['body-sm'], mobile),
                          marginTop: space(1.5),
                          borderRadius: radius.md,
                          padding: `${space(2)}px ${space(3)}px`,
                          boxShadow: shadow.xs,
                          color: 'var(--muted-foreground)',
                        }}
                        {...(on('radius') && i === 0 ? { 'data-fx': 'radius-md' } : {})}
                        {...(on('shadow') && i === 0 ? { 'data-fx': shadowName('xs') } : {})}
                      >
                        {i === 0 ? 'Northwind Studio' : 'billing@northwind.co'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="border bg-popover"
                {...mergeStyle(pad(8, 'padding-dialog'), { ...col(5), borderRadius: radius.xl, padding: space(8), boxShadow: shadow.xl })}
                {...(on('radius') ? { 'data-fx': 'radius-xl' } : {})}
                {...(on('shadow') ? { 'data-fx': shadowName('xl') } : {})}
              >
                <span
                  className="inline-flex items-center justify-center"
                  style={{ width: space(9), height: space(9), borderRadius: radius.full, background: accent.subtle, color: accent.text }}
                  {...mark('radius', 'radius-full')}
                >
                  <Check className="size-4" />
                </span>
                <Text s="h4" as="h3" style={{ marginTop: space(4) }}>
                  Upgrade to Pro?
                </Text>
                <Text s="body-sm" as="p" style={{ marginTop: space(2), color: 'var(--muted-foreground)' }}>
                  You’ll be charged $24 today. Cancel any time from billing settings.
                </Text>
                <div className="flex justify-end" style={{ gap: space(2), marginTop: space(6) }}>
                  <span style={button(false)}>Cancel</span>
                  <span style={button(true)}>Upgrade</span>
                </div>
              </div>
            </section>

            <Text s="caption" as="p" style={{ marginTop: space(16), color: 'var(--muted-foreground)' }}>
              © 2026 Northwind · Built with Lumina tokens
            </Text>
          </main>
        </div>
      </div>
    </div>
  );
}
