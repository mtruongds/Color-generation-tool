import { useEffect, useMemo, useState } from 'react';
import { Monitor, Plus, RotateCcw, Smartphone, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { copyToClipboard } from '../../lib/clipboard';
import { FONT_OPTIONS, fontKind } from '../../lib/fonts';
import {
  DEFAULT_FOUNDATIONS,
  FONT_WEIGHTS,
  type FontWeightName,
  TYPE_RATIOS,
  TYPE_STEPS,
  type TypeStepConfig,
  type TypeStyle,
  type TypographyConfig,
  computedTypeSize,
  fontStack,
  generateTypeScale,
  sortTypeSteps,
  typeStepLabel,
  typeStepSlug,
  typeStyleFor,
} from '../../lib/foundations';
import { typeCss } from './FoundationSample';
import { CanvasHeading, NumberInput, Section, SegmentedField, SelectField, SliderField, SwitchField } from './inspector-controls';

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

/** Sample text for steps the user added. */
const sampleFor = (s: TypeStyle) =>
  SAMPLE[s.name] ?? (s.role === 'heading' ? 'A step of your own' : 'Body text on a step you added to the scale.');

export function TypographyCanvas({ config }: { config: TypographyConfig }) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>(() =>
    window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
  );
  const styles = useMemo(() => generateTypeScale(config), [config]);
  const mobile = viewport === 'mobile';
  const [showGrid, setShowGrid] = useState(true);
  const row = config.lineHeightGrid;
  /** Gaps between blocks round up to whole grid rows, so every line box below stays on the grid. */
  const gap = (px: number) => (row > 0 ? Math.ceil(px / row) * row : px);
  const heading = fontStack(config.headingFamily, fontKind(config.headingFamily));
  const body = fontStack(config.bodyFamily, fontKind(config.bodyFamily));

  return (
    <div className="space-y-8">
      {/* Font pairing */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { role: 'Heading', family: config.headingFamily, stack: heading, weight: (styles.find((s) => s.role === 'heading') ?? styleOf(styles, 'h1')).weight },
          { role: 'Body', family: config.bodyFamily, stack: body, weight: styleOf(styles, 'body').weight },
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
                className="group grid w-full grid-cols-1 gap-2 px-5 py-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:grid-cols-[13rem_minmax(0,1fr)] md:items-center md:gap-6"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-medium">text-{s.name}</div>
                  <div className="mt-1 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground tabular">
                    {size}/{lh} · {s.weightName}
                    {s.tracking !== 0 && ` · ${s.tracking > 0 ? '+' : ''}${s.tracking}em`}
                  </div>
                  <div className="mt-0.5 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground/70 tabular">
                    step {s.step}
                    {row > 0 && ` · ${lh / row} rows`}
                    {s.overridden && ' · custom size'}
                  </div>
                </div>
                <div className="min-w-0 md:truncate" style={typeCss(s, mobile)}>
                  {sampleFor(s)}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Sizes are base × ratio<sup>step</sup>, rounded to whole pixels; sizes below body step down at half the
          ratio. A size typed in the Steps panel replaces the computed one for that step. Line heights are size ×
          multiplier, rounded to the nearest {row > 0 ? `${row}px grid row` : 'pixel'}. Click a row to copy its token.
        </p>
      </div>

      {/* Reading sample */}
      <div>
        <CanvasHeading title="In a page">
          {row > 0 && (
            <label className="flex cursor-pointer items-center gap-2">
              Grid rows
              <Switch checked={showGrid} onCheckedChange={setShowGrid} aria-label="Show grid rows" />
            </label>
          )}
        </CanvasHeading>
        <article className={`rounded-2xl border bg-card p-6 shadow-card sm:p-10 ${mobile ? 'mx-auto max-w-sm' : ''}`}>
          <div
            style={
              row > 0 && showGrid
                ? {
                    // Alternating bands one row tall, as on thegoodlineheight.com
                    backgroundImage:
                      'linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 6%, transparent) 50%, transparent 50%)',
                    backgroundSize: `100% ${row * 2}px`,
                  }
                : undefined
            }
          >
            <div style={{ ...typeCss(styleOf(styles, 'caption'), mobile), textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground)' }}>
              Field notes
            </div>
            <h2 style={{ ...typeCss(styleOf(styles, 'h1'), mobile), marginTop: gap(12) }}>
              A type system grows from two numbers
            </h2>
            <p className="max-w-[38rem] text-muted-foreground" style={{ ...typeCss(styleOf(styles, 'body-lg'), mobile), marginTop: gap(16) }}>
              Pick a base size and a ratio. Every heading, label and caption follows, so the whole product reads as one
              voice.
            </p>
            <h3 style={{ ...typeCss(styleOf(styles, 'h3'), mobile), marginTop: gap(32) }}>
              Why a ratio works
            </h3>
            <p className="max-w-[38rem]" style={{ ...typeCss(styleOf(styles, 'body'), mobile), marginTop: gap(12) }}>
              Each step is the previous one multiplied by the same number, so the contrast between neighbours stays
              even. A small ratio suits dense dashboards; a large one gives marketing pages more drama. Run{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[0.875em]" style={{ fontFamily: fontStack(config.monoFamily, 'mono') }}>
                text-h3
              </code>{' '}
              anywhere you need this heading.
            </p>
            <p className="text-muted-foreground" style={{ ...typeCss(styleOf(styles, 'body-sm'), mobile), marginTop: gap(12) }}>
              Updated 21 Oct 2026 · 4 min read
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

const styleOf = typeStyleFor;

const textFonts = FONT_OPTIONS.filter((f) => f.kind !== 'mono').map((f) => ({
  value: f.family,
  label: <span style={{ fontFamily: fontStack(f.family, f.kind) }}>{f.family}</span>,
}));
const monoFonts = FONT_OPTIONS.filter((f) => f.kind === 'mono').map((f) => ({
  value: f.family,
  label: <span style={{ fontFamily: fontStack(f.family, 'mono') }}>{f.family}</span>,
}));
const ratioOptions = [
  ...TYPE_RATIOS.map((r) => ({
    value: String(r.value),
    label: (
      <span>
        {r.value} <span className="text-muted-foreground">· {r.label}</span>
      </span>
    ),
  })),
  { value: 'custom', label: <span>Custom</span> },
];
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
        <RatioField label="Ratio" value={config.ratio} onChange={(ratio) => onChange({ ratio })} />
        <RatioField label="Mobile ratio" value={config.mobileRatio} onChange={(mobileRatio) => onChange({ mobileRatio })} />
        <p className="text-xs leading-snug text-muted-foreground">
          Headings use the mobile ratio below the md breakpoint, so they step down on small screens. Body sizes don’t
          change.
        </p>
      </Section>

      <StepsSection config={config} onChange={onChange} />

      <Section title="Rhythm" info={<LineHeightInfo config={config} />}>
        <SliderField
          label="Grid row"
          value={config.lineHeightGrid}
          display={config.lineHeightGrid === 0 ? 'off' : `${config.lineHeightGrid}px`}
          min={0}
          max={16}
          step={1}
          defaultValue={DEFAULTS.lineHeightGrid}
          onChange={(lineHeightGrid) => onChange({ lineHeightGrid })}
        />
        <SliderField
          label="Heading line height"
          value={config.headingLineHeight}
          display={`${config.headingLineHeight.toFixed(2)}×`}
          min={1}
          max={2}
          step={0.05}
          defaultValue={DEFAULTS.headingLineHeight}
          onChange={(headingLineHeight) => onChange({ headingLineHeight })}
        />
        <SliderField
          label="Body line height"
          value={config.bodyLineHeight}
          display={`${config.bodyLineHeight.toFixed(2)}×`}
          min={1}
          max={2}
          step={0.05}
          defaultValue={DEFAULTS.bodyLineHeight}
          onChange={(bodyLineHeight) => onChange({ bodyLineHeight })}
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

function RatioField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const isPreset = TYPE_RATIOS.some((r) => r.value === value);
  const [custom, setCustom] = useState(!isPreset);
  // A preset or import can bring in a ratio that isn't on the list
  useEffect(() => {
    if (!isPreset) setCustom(true);
  }, [isPreset]);
  return (
    <>
      <SelectField
        label={label}
        value={custom ? 'custom' : String(value)}
        options={ratioOptions}
        onChange={(v) => {
          setCustom(v === 'custom');
          if (v !== 'custom') onChange(Number(v));
        }}
      />
      {custom && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Custom {label.toLowerCase()}</span>
          <NumberInput
            aria-label={`Custom ${label.toLowerCase()}`}
            value={value}
            min={1.01}
            max={4}
            decimals={3}
            onChange={onChange}
            className="h-8 w-[11rem] px-2 text-right font-mono text-xs tabular"
          />
        </div>
      )}
    </>
  );
}

const sameSteps = (a: TypeStepConfig[], b: TypeStepConfig[]) => JSON.stringify(sortTypeSteps(a)) === JSON.stringify(sortTypeSteps(b));

/** Steps the user can add, rename, move and resize, like a type scale's fine-tune panel. */
function StepsSection({
  config,
  onChange,
}: {
  config: TypographyConfig;
  onChange: (updates: Partial<TypographyConfig>) => void;
}) {
  const steps = sortTypeSteps(config.steps);
  const styles = useMemo(() => generateTypeScale(config), [config]);
  const changed = !sameSteps(config.steps, TYPE_STEPS) || Object.keys(config.sizeOverrides).length > 0;

  const uniqueName = (base: string, except?: string) => {
    const taken = new Set(config.steps.map((s) => s.name).filter((n) => n !== except));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  };
  /** Drops overrides for steps no style sits on any more. */
  const withSteps = (next: TypeStepConfig[]): Partial<TypographyConfig> => {
    const used = new Set(next.map((s) => String(s.step)));
    return { steps: next, sizeOverrides: Object.fromEntries(Object.entries(config.sizeOverrides).filter(([k]) => used.has(k))) };
  };
  const update = (name: string, updates: Partial<TypeStepConfig>) =>
    onChange(withSteps(config.steps.map((s) => (s.name === name ? { ...s, ...updates } : s))));
  const add = (direction: 1 | -1) => {
    const edge = direction > 0 ? Math.max(...config.steps.map((s) => s.step)) : Math.min(...config.steps.map((s) => s.step));
    const name = uniqueName(direction > 0 ? 'display' : 'micro');
    onChange({
      steps: [
        ...config.steps,
        {
          name,
          label: typeStepLabel(name),
          step: edge + direction,
          role: direction > 0 ? 'heading' : 'body',
          // Same weight as the step it grows from
          weight: sortTypeSteps(config.steps)[direction > 0 ? 0 : config.steps.length - 1].weight,
          usage: '',
        },
      ],
    });
  };
  const setSize = (step: number, size: number | undefined) => {
    const { [step]: _, ...rest } = config.sizeOverrides;
    onChange({ sizeOverrides: size === undefined || size === computedTypeSize(config, step) ? rest : { ...rest, [step]: size } });
  };

  return (
    <Section
      title="Steps"
      info={
        <>
          Step 0 is body; each step up multiplies by the ratio. Type a size to pin it, clear it to follow the ratio
          again. Styles on the same step share a size. Role picks the heading or body font. The name becomes the token, as in{' '}
          <code className="font-mono">text-{steps[0]?.name}</code>.
        </>
      }
      action={
        changed && (
          <Button
            variant="ghost"
            size="icon"
            className="relative size-6 text-muted-foreground after:absolute after:-inset-2"
            aria-label="Reset steps"
            onClick={() => onChange({ steps: TYPE_STEPS, sizeOverrides: {} })}
          >
            <RotateCcw className="size-3" />
          </Button>
        )
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_3rem_3rem_1.75rem_1.25rem] items-center gap-x-1 gap-y-1.5">
        {['Name', 'Step', 'Size', 'Weight', 'Role', ''].map((h, i) => (
          <span key={i} className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
            {h}
          </span>
        ))}
        {steps.map((s) => {
          const style = styles.find((st) => st.name === s.name)!;
          return (
            <StepRow
              key={s.name}
              step={s}
              style={style}
              computed={computedTypeSize(config, s.step)}
              canRemove={config.steps.length > 1}
              onRename={(raw) => {
                const slug = typeStepSlug(raw);
                if (!slug || slug === s.name) return;
                const name = uniqueName(slug, s.name);
                update(s.name, { name, label: typeStepLabel(name) });
              }}
              onStep={(step) => update(s.name, { step })}
              onRole={() => update(s.name, { role: s.role === 'heading' ? 'body' : 'heading' })}
              onWeight={(weight) => update(s.name, { weight })}
              onSize={(size) => setSize(s.step, size)}
              onRemove={() => onChange(withSteps(config.steps.filter((x) => x.name !== s.name)))}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => add(1)}>
          <Plus className="size-3" /> Larger step
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => add(-1)}>
          <Plus className="size-3" /> Smaller step
        </Button>
      </div>
    </Section>
  );
}

function StepRow({
  step: s,
  style,
  computed,
  canRemove,
  onRename,
  onStep,
  onRole,
  onWeight,
  onSize,
  onRemove,
}: {
  step: TypeStepConfig;
  style: TypeStyle;
  computed: number;
  canRemove: boolean;
  onRename: (name: string) => void;
  onStep: (step: number) => void;
  onRole: () => void;
  onWeight: (weight: FontWeightName) => void;
  onSize: (size: number | undefined) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(s.name);
  useEffect(() => setName(s.name), [s.name]);
  return (
    <>
      <Input
        aria-label={`${s.name} name`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          onRename(name);
          setName(s.name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setName(s.name);
            requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
          }
        }}
        className="h-8 px-2 font-mono text-xs"
      />
      <NumberInput aria-label={`${s.name} step`} value={s.step} min={-6} max={12} onChange={onStep} />
      <SizeInput name={s.name} size={style.size} computed={computed} overridden={style.overridden} onChange={onSize} />
      <Select value={s.weight} onValueChange={(v) => onWeight(v as FontWeightName)}>
        <SelectTrigger
          size="sm"
          aria-label={`${s.name} weight`}
          className="h-8 w-full min-w-0 justify-center px-1 font-mono text-xs tabular [&>svg]:hidden"
        >
          <SelectValue>{FONT_WEIGHTS[s.weight]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {weightOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-0 font-mono text-xs text-muted-foreground"
        aria-label={`${s.name} role: ${s.role}. Switch to ${s.role === 'heading' ? 'body' : 'heading'}`}
        title={s.role === 'heading' ? 'Heading font and weight' : 'Body font and weight'}
        onClick={onRole}
      >
        {s.role === 'heading' ? 'H' : 'B'}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground"
        aria-label={`Remove ${s.name}`}
        disabled={!canRemove}
        onClick={onRemove}
      >
        <X className="size-3" />
      </Button>
    </>
  );
}

/** Px size that pins the step when typed and follows the ratio again when cleared. */
function SizeInput({
  name,
  size,
  computed,
  overridden,
  onChange,
}: {
  name: string;
  size: number;
  computed: number;
  overridden: boolean;
  onChange: (size: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(overridden ? String(size) : '');
  useEffect(() => setDraft(overridden ? String(size) : ''), [size, overridden]);
  return (
    <Input
      aria-label={`${name} size in px`}
      inputMode="numeric"
      placeholder={String(computed)}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Math.round(Number(e.target.value));
        if (e.target.value.trim() === '') onChange(undefined);
        else if (Number.isFinite(n) && n >= 6 && n <= 256) onChange(n);
      }}
      onBlur={() => setDraft(overridden ? String(size) : '')}
      className={`h-8 px-2 text-right font-mono text-xs tabular placeholder:text-muted-foreground ${overridden ? 'border-primary/50 text-foreground' : ''}`}
    />
  );
}

/** How line heights are worked out, with the math for body and the largest heading, like The Good Line-Height's result. */
function LineHeightInfo({ config }: { config: TypographyConfig }) {
  const styles = generateTypeScale(config);
  const body = typeStyleFor(styles, 'body');
  const top = styles.find((s) => s.role === 'heading');
  const row = config.lineHeightGrid;
  return (
    <div className="space-y-2 py-0.5">
      <p>
        Line height is size × multiplier, rounded to the nearest {row > 0 ? `${row}px grid row` : 'pixel'}, so every line
        spans whole rows and text keeps one vertical rhythm.
      </p>
      <div className="space-y-0.5 font-mono text-[0.6875rem] tabular">
        {[top, body]
          .filter((s): s is TypeStyle => !!s)
          .map((s) => {
            const multiplier = s.role === 'heading' ? config.headingLineHeight : config.bodyLineHeight;
            return (
              <div key={s.name} className="flex items-baseline justify-between gap-2">
                <span className="truncate opacity-70">
                  {s.name} {s.size} × {multiplier.toFixed(2)} = {(s.size * multiplier).toFixed(1)}
                </span>
                <span className="shrink-0">
                  {s.lineHeight}px{row > 0 && <span className="opacity-70"> · {s.lineHeight / row} rows</span>}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
