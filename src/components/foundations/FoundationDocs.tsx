import { Check, X } from 'lucide-react';
import { copyToClipboard } from '../../lib/clipboard';
import { formatLength, typeBreakpoint } from '../../lib/foundation-export';
import {
  type Accent,
  type FoundationKey,
  type Foundations,
  RADIUS_FULL,
  generateRadiusScale,
  generateShadowScale,
  generateTypeScale,
  sortedBreakpoints,
} from '../../lib/foundations';
import { buildTokens, resolveToken } from '../../lib/tokens';
import { typeCss } from './FoundationSample';

type DocKey = Exclude<FoundationKey, 'color'>;

interface Row {
  token: string;
  preview: React.ReactNode;
  value: React.ReactNode;
  cssVar: string;
  usage: string;
}

/** Short rules for each foundation, shown above its token table. */
const GUIDELINES: Record<DocKey, { intro: string; dos: string[]; donts: string[] }> = {
  typography: {
    intro: 'Text styles bundle family, size, line height, weight and tracking. Use a whole style rather than mixing its parts.',
    dos: [
      'Pick styles by role: h1 for the page title, h4 for card titles, body for reading text.',
      'Keep one h1 per page and step down one level at a time.',
      'Use body-sm and caption for secondary information, not for main content.',
    ],
    donts: [
      'Don’t set font sizes by hand — add a style to the scale if one is missing.',
      'Don’t use display for anything but hero headlines.',
      'Don’t bold body text to fake a heading.',
    ],
  },
  spacing: {
    intro: 'Every gap, padding and margin comes from multiples of the base unit, so layouts keep one rhythm.',
    dos: [
      'Use 2xs–sm inside components and lg and up between sections.',
      'Group related items with less space than unrelated ones.',
      'Match inner padding to the component’s size: dense controls get smaller insets.',
    ],
    donts: [
      'Don’t use values off the scale, like 13px or 7px.',
      'Don’t add margins to both siblings — let the parent’s gap do it.',
    ],
  },
  radius: {
    intro: 'Radii scale from the md value, so every component shares one corner character.',
    dos: [
      'Use md for controls, lg for cards and xl for dialogs.',
      'Nest corners by subtracting padding: inner = outer − padding.',
      'Use full only for pills, avatars and circular icon buttons.',
    ],
    donts: [
      'Don’t give a child the same radius as its padded parent.',
      'Don’t mix sharp and round styles in one surface.',
    ],
  },
  shadow: {
    intro: 'Higher elevation means the element floats further above the page. Shadows get bigger and softer as they rise.',
    dos: [
      'Use one level per layer: cards at sm, menus at lg, dialogs at xl.',
      'Raise an element one level on hover to show it’s interactive.',
      'Let dark mode switch the colors — the same shadow gets stronger and adds a light edge.',
    ],
    donts: [
      'Don’t stack shadows on elements inside an already raised card.',
      'Don’t use shadows as borders — use a border color token instead.',
    ],
  },
  grid: {
    intro: 'The grid fixes columns, gutters and margins per breakpoint, so pages line up at every width.',
    dos: [
      'Span content across whole columns and align edges to column lines.',
      'Let the content cap stop lines from getting too long on wide screens.',
      'Use the gutter for gaps between grid items.',
    ],
    donts: [
      'Don’t use different margins from the grid on the same page.',
      'Don’t place text closer to the screen edge than the margin.',
    ],
  },
};

function spacingUsage(multiplier: number) {
  if (multiplier === 0) return 'Reset, flush layouts';
  if (multiplier <= 1) return 'Icon-to-label gaps, hairline offsets';
  if (multiplier <= 3) return 'Control padding, inline gaps';
  if (multiplier <= 6) return 'Card padding, stacked groups';
  if (multiplier <= 12) return 'Gaps between sections';
  return 'Page sections, hero spacing';
}

function deviceFor(minWidth: number) {
  if (minWidth < 576) return 'Phones';
  if (minWidth < 992) return 'Large phones, tablets';
  if (minWidth < 1400) return 'Laptops, desktops';
  return 'Wide desktops';
}

function rowsFor(key: DocKey, f: Foundations, isDark: boolean, accent: Accent): Row[] {
  switch (key) {
    case 'typography': {
      const bp = typeBreakpoint(f);
      return generateTypeScale(f.typography).map((s) => ({
        token: `text-${s.name}`,
        preview: (
          <span className="block max-w-[10rem] truncate" style={{ ...typeCss(s), fontSize: Math.min(s.size, 32), lineHeight: 1.2 }}>
            Ag
          </span>
        ),
        value: (
          <>
            <div>
              {s.size}/{s.lineHeight} · {s.weight}
              {s.tracking !== 0 && ` · ${s.tracking}em`}
            </div>
            {(s.mobileSize !== s.size || s.mobileLineHeight !== s.lineHeight) && (
              <div className="text-[0.6875rem] text-muted-foreground/80">
                &lt;{bp}px: {s.mobileSize}/{s.mobileLineHeight}
              </div>
            )}
          </>
        ),
        cssVar: `--text-${s.name}-*`,
        usage: s.usage,
      }));
    }
    case 'spacing': {
      // The roles, like radius, so the table names what components use; re-pointed and added ones included
      const tokens = buildTokens([], f, { groups: ['spacing'], modes: 'light', colorFormat: 'hex' });
      const byName = new Map(tokens.map((t) => [t.name, t]));
      return tokens
        .filter((t) => t.tier === 'base')
        .map((t) => {
          const value = Number(resolveToken(t, byName)?.value ?? 0);
          return {
            token: t.name,
            preview: <span className="block h-3 rounded-[2px]" style={{ width: Math.min(value, 96), minWidth: value ? 2 : 0, background: accent.solid }} />,
            value: `${value}px · ${formatLength(value, 'rem')}`,
            cssVar: `--${t.name}`,
            usage: t.description ?? spacingUsage(value / f.spacing.base),
          };
        });
    }
    case 'radius':
      return generateRadiusScale(f.radius).map((t) => ({
        token: `radius-${t.name}`,
        preview: (
          <span
            className="block size-7 border-t-2 border-l-2"
            style={{ borderTopLeftRadius: Math.min(t.value, 28), borderColor: accent.solid, background: `color-mix(in oklab, ${accent.solid} 10%, transparent)` }}
          />
        ),
        value: t.value === RADIUS_FULL ? '9999px' : `${t.value}px`,
        cssVar: `--radius-${t.name}`,
        usage: t.usage,
      }));
    case 'shadow': {
      return generateShadowScale(f.shadow, isDark).map((s) => ({
        token: `shadow-${s.name}`,
        preview: <span className="block h-7 w-10 rounded-md bg-card" style={{ boxShadow: s.css }} />,
        value: `elevation ${s.elevation} · ${s.layers.length} ${s.layers.length === 1 ? 'layer' : 'layers'}`,
        cssVar: `--shadow-${s.name}`,
        usage: s.usage,
      }));
    }
    case 'grid':
      return [
        ...sortedBreakpoints(f.grid).map((b) => ({
          token: `breakpoint-${b.name}`,
          preview: (
            <span className="flex h-4 w-24 gap-px">
              {Array.from({ length: b.columns }, (_, i) => (
                <span key={i} className="flex-1 rounded-[1px]" style={{ background: `color-mix(in oklab, ${accent.solid} 45%, transparent)` }} />
              ))}
            </span>
          ),
          value: `≥${b.minWidth}px · ${b.columns} cols · ${b.gutter}/${b.margin}px`,
          cssVar: `--breakpoint-${b.name}, --grid-${b.name}-*`,
          usage: deviceFor(b.minWidth),
        })),
        {
          token: 'container-max',
          preview: <span className="block h-4 w-24 rounded-sm border border-dashed border-foreground/40" />,
          value: f.grid.maxWidth > 0 ? `${f.grid.maxWidth}px` : 'none (fluid)',
          cssVar: '--container-max',
          usage: 'Caps content width on wide screens',
        },
        ...(f.grid.sidebar > 0
          ? [
              {
                token: 'sidebar-width',
                preview: <span className="block h-4 w-6 rounded-sm bg-muted-foreground/30" />,
                value: `${f.grid.sidebar}px from ${f.grid.sidebarFrom}`,
                cssVar: '--sidebar-width',
                usage: 'Fixed navigation beside the grid',
              },
            ]
          : []),
      ];
  }
}

export function FoundationDocs({
  foundation,
  foundations,
  isDark,
  accent,
}: {
  foundation: DocKey;
  foundations: Foundations;
  isDark: boolean;
  accent: Accent;
}) {
  const guide = GUIDELINES[foundation];
  const rows = rowsFor(foundation, foundations, isDark, accent);

  return (
    <div className="space-y-8 pb-16">
      {/* The page header names the foundation; this is the guidance that opens its reference */}
      <p className="max-w-2xl text-sm text-muted-foreground">{guide.intro}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { title: 'Do', items: guide.dos, icon: Check, tone: 'text-emerald-600 dark:text-emerald-400' },
          { title: 'Don’t', items: guide.donts, icon: X, tone: 'text-rose-600 dark:text-rose-400' },
        ].map(({ title, items, icon: Icon, tone }) => (
          <div key={title} className="rounded-xl border bg-card p-4 shadow-card">
            <div className={`flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase ${tone}`}>
              <Icon className="size-3.5" /> {title}
            </div>
            <ul className="mt-2.5 space-y-1.5 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Token</th>
                <th className="px-4 py-2.5 font-medium">Preview</th>
                <th className="px-4 py-2.5 font-medium">Value</th>
                <th className="px-4 py-2.5 font-medium">CSS variable</th>
                <th className="px-4 py-2.5 font-medium">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.token} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(r.token, 'Token')}
                      className="rounded font-mono text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {r.token}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">{r.preview}</td>
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground tabular">{r.value}</td>
                  <td className="px-4 py-2.5 font-mono text-[0.6875rem] text-muted-foreground">{r.cssVar}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
