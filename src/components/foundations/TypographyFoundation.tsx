import { useMemo, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { copyToClipboard } from '../../lib/clipboard';
import { FONT_OPTIONS, fontKind } from '../../lib/fonts';
import {
  DEFAULT_FOUNDATIONS,
  FONT_WEIGHTS,
  type FontWeightName,
  TYPE_RATIOS,
  type TypographyConfig,
  fontStack,
  generateTypeScale,
} from '../../lib/foundations';
import { typeCss } from './FoundationSample';
import { CanvasHeading, Section, SegmentedField, SelectField, SliderField, SwitchField } from './inspector-controls';

const DEFAULTS = DEFAULT_FOUNDATIONS.typography;

const SAMPLE: Record<string, string> = {
  display: 'Design at scale',
  h1: 'Build a system once',
  h2: 'Every size from one ratio',
  h3: 'Steps that stay in rhythm',
  h4: 'Headings for cards and dialogs',
  h5: 'Small titles and group labels',
  'body-lg': 'Lead paragraphs open a page and set its tone.',
  body: 'Body text carries most of the reading, so it gets the most care.',
  'body-sm': 'Secondary details, table cells and dense controls.',
  caption: 'Captions, timestamps and helper text',
};

export function TypographyCanvas({ config }: { config: TypographyConfig }) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>(() =>
    window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
  );
  const styles = useMemo(() => generateTypeScale(config), [config]);
  const mobile = viewport === 'mobile';
  const heading = fontStack(config.headingFamily, fontKind(config.headingFamily));
  const body = fontStack(config.bodyFamily, fontKind(config.bodyFamily));

  return (
    <div className="space-y-8">
      {/* Font pairing */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { role: 'Heading', family: config.headingFamily, stack: heading, weight: FONT_WEIGHTS[config.headingWeight] },
          { role: 'Body', family: config.bodyFamily, stack: body, weight: FONT_WEIGHTS[config.bodyWeight] },
          { role: 'Mono', family: config.monoFamily, stack: fontStack(config.monoFamily, 'mono'), weight: 400 },
        ].map((f) => (
          <div key={f.role} className="min-w-0 rounded-2xl border bg-card p-3.5 shadow-card sm:p-5">
            <div className="text-xs text-muted-foreground">{f.role}</div>
            <div className="mt-3 text-3xl leading-none sm:text-5xl" style={{ fontFamily: f.stack, fontWeight: f.weight }}>
              Aa
            </div>
            <div className="mt-4 truncate text-sm font-medium">{f.family}</div>
            <div className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground tabular">{f.weight}</div>
          </div>
        ))}
      </div>

      {/* Scale */}
      <div>
        <CanvasHeading title="Type scale">
          <Tabs value={viewport} onValueChange={(v) => setViewport(v as typeof viewport)} className="gap-0">
            <TabsList className="h-7 rounded-lg" aria-label="Viewport">
              <TabsTrigger value="desktop" className="gap-1 rounded-md px-2 text-[0.6875rem]">
                <Monitor className="size-3" /> Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile" className="gap-1 rounded-md px-2 text-[0.6875rem]">
                <Smartphone className="size-3" /> Mobile
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CanvasHeading>
        <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
          {styles.map((s) => {
            const size = mobile ? s.mobileSize : s.size;
            const lh = mobile ? s.mobileLineHeight : s.lineHeight;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => copyToClipboard(`text-${s.name}`, 'Token')}
                className="group grid w-full grid-cols-1 gap-2 px-5 py-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:grid-cols-[10rem_minmax(0,1fr)] md:items-center md:gap-6"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-medium">text-{s.name}</div>
                  <div className="mt-1 font-mono text-[0.6875rem] text-muted-foreground tabular">
                    {size}/{lh} · {s.weightName}
                    {s.tracking !== 0 && ` · ${s.tracking > 0 ? '+' : ''}${s.tracking}em`}
                  </div>
                </div>
                <div className="min-w-0 md:truncate" style={typeCss(s, mobile)}>
                  {SAMPLE[s.name]}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Sizes are base × ratio<sup>step</sup>, rounded to whole pixels; sizes below body step down at half the
          ratio. Line heights snap to a{' '}
          {config.lineHeightGrid || 1}px grid. Click a row to copy its token.
        </p>
      </div>

      {/* Reading sample */}
      <div>
        <CanvasHeading title="In a page" />
        <article className={`rounded-2xl border bg-card p-6 shadow-card sm:p-10 ${mobile ? 'mx-auto max-w-sm' : ''}`}>
          <div style={{ ...typeCss(styleOf(styles, 'caption'), mobile), textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground)' }}>
            Field notes
          </div>
          <h2 className="mt-3" style={typeCss(styleOf(styles, 'h1'), mobile)}>
            A type system grows from two numbers
          </h2>
          <p className="mt-4 max-w-[38rem] text-muted-foreground" style={typeCss(styleOf(styles, 'body-lg'), mobile)}>
            Pick a base size and a ratio. Every heading, label and caption follows, so the whole product reads as one
            voice.
          </p>
          <h3 className="mt-8" style={typeCss(styleOf(styles, 'h3'), mobile)}>
            Why a ratio works
          </h3>
          <p className="mt-3 max-w-[38rem]" style={typeCss(styleOf(styles, 'body'), mobile)}>
            Each step is the previous one multiplied by the same number, so the contrast between neighbours stays
            even. A small ratio suits dense dashboards; a large one gives marketing pages more drama. Run{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[0.875em]" style={{ fontFamily: fontStack(config.monoFamily, 'mono') }}>
              text-h3
            </code>{' '}
            anywhere you need this heading.
          </p>
          <p className="mt-3 text-muted-foreground" style={typeCss(styleOf(styles, 'body-sm'), mobile)}>
            Updated 21 Oct 2026 · 4 min read
          </p>
        </article>
      </div>
    </div>
  );
}

const styleOf = (styles: ReturnType<typeof generateTypeScale>, name: string) => styles.find((s) => s.name === name)!;

const textFonts = FONT_OPTIONS.filter((f) => f.kind !== 'mono').map((f) => ({
  value: f.family,
  label: <span style={{ fontFamily: fontStack(f.family, f.kind) }}>{f.family}</span>,
}));
const monoFonts = FONT_OPTIONS.filter((f) => f.kind === 'mono').map((f) => ({
  value: f.family,
  label: <span style={{ fontFamily: fontStack(f.family, 'mono') }}>{f.family}</span>,
}));
const ratioOptions = TYPE_RATIOS.map((r) => ({
  value: String(r.value),
  label: (
    <span>
      {r.value} <span className="text-muted-foreground">· {r.label}</span>
    </span>
  ),
}));
const weightOptions = (Object.keys(FONT_WEIGHTS) as FontWeightName[]).map((w) => ({
  value: w,
  label: (
    <span>
      {w[0].toUpperCase() + w.slice(1)} <span className="text-muted-foreground tabular">{FONT_WEIGHTS[w]}</span>
    </span>
  ),
}));

export function TypographyInspector({
  config,
  onChange,
}: {
  config: TypographyConfig;
  onChange: (updates: Partial<TypographyConfig>) => void;
}) {
  return (
    <div className="flex flex-col">
      <Section title="Fonts">
        <SelectField label="Heading" value={config.headingFamily} options={textFonts} onChange={(headingFamily) => onChange({ headingFamily })} />
        <SelectField label="Body" value={config.bodyFamily} options={textFonts} onChange={(bodyFamily) => onChange({ bodyFamily })} />
        <SelectField label="Mono" value={config.monoFamily} options={monoFonts} onChange={(monoFamily) => onChange({ monoFamily })} />
      </Section>

      <Section title="Scale">
        <SliderField
          label="Base size"
          value={config.baseSize}
          display={`${config.baseSize}px`}
          min={12}
          max={22}
          step={1}
          defaultValue={DEFAULTS.baseSize}
          onChange={(baseSize) => onChange({ baseSize })}
        />
        <SelectField label="Ratio" value={String(config.ratio)} options={ratioOptions} onChange={(v) => onChange({ ratio: Number(v) })} />
        <SelectField
          label="Mobile ratio"
          value={String(config.mobileRatio)}
          options={ratioOptions}
          onChange={(v) => onChange({ mobileRatio: Number(v) })}
        />
        <p className="text-xs leading-snug text-muted-foreground">
          Headings use the mobile ratio below the md breakpoint, so they step down on small screens. Body sizes don’t
          change.
        </p>
      </Section>

      <Section title="Weights">
        <SelectField label="Headings" value={config.headingWeight} options={weightOptions} onChange={(headingWeight) => onChange({ headingWeight })} />
        <SelectField label="Body" value={config.bodyWeight} options={weightOptions} onChange={(bodyWeight) => onChange({ bodyWeight })} />
      </Section>

      <Section title="Rhythm">
        <SegmentedField
          label="Line grid"
          value={String(config.lineHeightGrid)}
          options={[
            { value: '0', label: 'Off' },
            { value: '2', label: '2px' },
            { value: '4', label: '4px' },
            { value: '8', label: '8px' },
          ]}
          onChange={(v) => onChange({ lineHeightGrid: Number(v) })}
        />
        <SwitchField
          label="Optical tracking"
          hint="Tightens letter spacing on large sizes and opens it up on small ones."
          checked={config.opticalTracking}
          onChange={(opticalTracking) => onChange({ opticalTracking })}
        />
      </Section>
    </div>
  );
}
