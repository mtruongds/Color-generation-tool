import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  FolderKanban,
  Info,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { resolveColorRoles } from '../../lib/tokens';
import { type ColorScale, getSurfaceColor } from '../../lib/color-utils';
import type { GeneratedPalette } from '../../lib/export-utils';

const TOOLTIPS_KEY = 'lumina_preview_tooltips';

function loadTooltipsOn() {
  try {
    return localStorage.getItem(TOOLTIPS_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Exposes both scales as --a1…--a12 / --g1…--g12 so every element below can style itself from tokens. */
function scaleVars(accent: ColorScale, gray: ColorScale): React.CSSProperties {
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

export function PalettePreview({
  palettes,
  activeId,
}: {
  palettes: GeneratedPalette[];
  activeId?: string;
}) {
  const accents = palettes.filter((p) => (p.role ?? 'accent') === 'accent');
  const grays = palettes.filter((p) => p.role === 'gray');

  const [accentId, setAccentId] = useState(
    () => accents.find((p) => p.id === activeId)?.id ?? accents[0]?.id ?? palettes[0]?.id,
  );
  const [grayId, setGrayId] = useState(() => {
    const roles = resolveColorRoles(palettes);
    return (grays.find((p) => roles.get(p.id) === 'neutral') ?? grays[0] ?? palettes[0])?.id;
  });
  const [tooltipsOn, setTooltipsOn] = useState(loadTooltipsOn);

  useEffect(() => {
    try {
      localStorage.setItem(TOOLTIPS_KEY, tooltipsOn ? 'on' : 'off');
    } catch {
      // Storage blocked — the toggle still works for this session.
    }
  }, [tooltipsOn]);

  const accent = palettes.find((p) => p.id === accentId) ?? palettes[0];
  const gray = palettes.find((p) => p.id === grayId) ?? grays[0] ?? accent;

  if (!accent || !gray) return null;

  return (
    <div className="space-y-6 pb-16">
      <div className="space-y-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mood preview</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Real UI built only from your accent and gray scales. Turn on step tooltips and hover any element to see which steps it uses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PaletteSelect label="Accent" value={accent.id} onChange={setAccentId} palettes={palettes} preferred={accents} />
          <PaletteSelect
            label="Gray"
            value={gray.id}
            onChange={setGrayId}
            palettes={palettes}
            preferred={grays}
          />
          <div className="flex h-8 items-center gap-2 rounded-md border bg-card px-2.5">
            <Switch id="step-tooltips" checked={tooltipsOn} onCheckedChange={setTooltipsOn} />
            <Label htmlFor="step-tooltips" className="text-xs font-normal">
              Step tooltips
            </Label>
          </div>
        </div>
      </div>

      <MoodCanvas accent={accent.scale} gray={gray.scale} brand={accent.name || 'Acme'} showTokens={tooltipsOn} />
    </div>
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
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-auto min-w-36" aria-label={`${label} palette`}>
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
    </div>
  );
}

// ============================================================
// Canvas
// ============================================================

function MoodCanvas({
  accent,
  gray,
  brand,
  showTokens,
}: {
  accent: ColorScale;
  gray: ColorScale;
  brand: string;
  showTokens: boolean;
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
    <div
      className="space-y-4 rounded-xl border p-4 sm:p-6"
      style={scaleVars(accent, gray)}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      <AppShell brand={brand} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Hero brand={brand} />
        <FormBlock />
        <FeedbackBlock />
      </div>
      <ButtonsRow />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TypographyBlock />
        <TableBlock />
      </div>
      {hover && <StepTooltip hover={hover} accent={accent} gray={gray} />}
    </div>
  );
}

// ---------- Step tooltip ----------

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

function Panel({ title, tokens, className, children }: { title: string; tokens?: string; className?: string; children: React.ReactNode }) {
  return (
    <div
      data-tokens={tokens ?? 'bg: g2 · border: g6'}
      className={cn('rounded-xl border border-(--g6) bg-(--g2) p-4', className)}
    >
      <div className="mb-3 text-[0.6875rem] font-medium tracking-wide text-(--g11) uppercase">{title}</div>
      {children}
    </div>
  );
}

// ---------- App shell ----------

const NAV = [
  { icon: LayoutDashboard, label: 'Overview', active: true },
  { icon: FolderKanban, label: 'Projects' },
  { icon: Users, label: 'Team' },
  { icon: Settings, label: 'Settings' },
];

const BARS = [38, 52, 44, 70, 58, 86, 64];

function AppShell({ brand }: { brand: string }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-(--g6)" data-tokens="page: background · border: g6">
      <aside className="hidden w-48 shrink-0 flex-col gap-1 border-r border-(--g6) bg-(--g2) p-3 md:flex" data-tokens="sidebar: g2">
        <div className="mb-3 flex items-center gap-2 px-2 pt-1">
          <span className="size-5 rounded-md bg-(--a9)" data-tokens="logo: a9" />
          <span className="truncate text-sm font-semibold">{brand}</span>
        </div>
        {NAV.map(({ icon: Icon, label, active }) => (
          <div
            key={label}
            data-tokens={active ? 'active nav: bg a3 · text a11' : 'nav: text g11 · hover g4'}
            className={cn(
              'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
              active ? 'bg-(--a3) font-medium text-(--a11)' : 'text-(--g11) hover:bg-(--g4)',
            )}
          >
            <Icon className="size-4" />
            {label}
          </div>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-(--g6) px-4 py-3">
          <div className="text-base font-semibold" data-tokens="heading: g12">
            Overview
          </div>
          <div
            className="ml-auto hidden h-8 w-56 items-center gap-2 rounded-md border border-(--g7) bg-(--g1) px-2.5 text-sm text-(--g10) transition-colors hover:border-(--g8) sm:flex"
            data-tokens="search: bg g1 · border g7 → g8 · placeholder g10"
          >
            <Search className="size-3.5" /> Search…
          </div>
          <span className="relative text-(--g11)" data-tokens="icon: g11 · dot: a9">
            <Bell className="size-4" />
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--a9)" />
          </span>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-(--a9) px-3 text-sm font-medium text-(--a-contrast) transition-colors hover:bg-(--a10)"
            data-tokens="solid: a9 → a10 · text: contrast"
          >
            <Plus className="size-4" /> New project
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <div
            className="rounded-lg border border-(--a6) bg-(--a-surface) p-3"
            data-tokens="card: accent surface · border a6"
          >
            <div className="text-xs text-(--g11)">Revenue</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">$48.2k</span>
              <span className="rounded bg-(--a3) px-1.5 py-0.5 text-[0.6875rem] font-medium text-(--a11)" data-tokens="soft badge: a3 · a11">
                ▲ 12%
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-(--g6) bg-(--g-surface) p-3" data-tokens="card: gray surface · border g6">
            <div className="text-xs text-(--g11)">Weekly activity</div>
            <div className="mt-2 flex h-12 items-end gap-1" data-tokens="bars: a6 → a9">
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ height: `${h}%`, backgroundColor: `var(--a${i === BARS.length - 2 ? 9 : 6 + (i % 3)})` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-(--g6) bg-(--g-surface) p-3" data-tokens="card: gray surface · border g6">
            <div className="flex justify-between text-xs text-(--g11)">
              <span>Storage</span>
              <span className="font-mono">64%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--a4)" data-tokens="track: a4 · fill: a9">
              <div className="h-full w-[64%] rounded-full bg-(--a9)" />
            </div>
            <div className="mt-2 text-xs text-(--g11)">32 of 50 GB used</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Hero ----------

function Hero({ brand }: { brand: string }) {
  return (
    <div
      className="flex flex-col justify-between gap-6 rounded-xl bg-(--a9) p-5 text-(--a-contrast)"
      data-tokens="hero: a9 · text: contrast"
    >
      <div>
        <div className="text-[0.6875rem] font-medium tracking-wide uppercase opacity-80">{brand}</div>
        <div className="mt-2 text-2xl leading-tight font-semibold tracking-tight">Ship your next idea faster</div>
        <p className="mt-2 text-sm opacity-85">Everything you need to plan, build and launch — in one place.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-md bg-(--a12) px-4 text-sm font-medium text-(--a1) transition-opacity hover:opacity-90"
          data-tokens="button: a12 · text a1"
        >
          Get started
        </button>
        <button
          type="button"
          className="h-9 rounded-md border border-current/40 px-4 text-sm font-medium transition-colors hover:bg-current/10"
          data-tokens="outline: contrast at 40%"
        >
          Learn more
        </button>
      </div>
    </div>
  );
}

// ---------- Form ----------

function FormBlock() {
  const [remember, setRemember] = useState(true);
  const [notify, setNotify] = useState(true);

  return (
    <Panel title="Form">
      <div className="space-y-3">
        <label className="block space-y-1.5" data-tokens="input: bg g1 · border g7 → g8 · focus a8 + ring a5">
          <span className="text-sm font-medium">Email</span>
          <input
            placeholder="you@company.com"
            className="h-9 w-full rounded-md border border-(--g7) bg-(--g1) px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-(--g10) hover:border-(--g8) focus:border-(--a8) focus:shadow-[0_0_0_3px_var(--a5)]"
          />
        </label>
        <div
          className="flex h-9 items-center justify-between rounded-md border border-(--g7) bg-(--g1) px-3 text-sm"
          data-tokens="select: bg g1 · border g7"
        >
          Workspace: Design
          <ChevronDown className="size-4 text-(--g11)" />
        </div>
        <div
          className="flex h-9 items-center rounded-md border border-(--g6) bg-(--g3) px-3 text-sm text-(--g9)"
          data-tokens="disabled: bg g3 · border g6 · text g9"
        >
          Disabled field
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={remember}
            onClick={() => setRemember((v) => !v)}
            className="flex items-center gap-2 text-sm"
            data-tokens="checkbox: a9 + contrast · off: border g7"
          >
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded border transition-colors',
                remember ? 'border-transparent bg-(--a9) text-(--a-contrast)' : 'border-(--g7) bg-(--g1)',
              )}
            >
              {remember && <Check className="size-3" strokeWidth={3} />}
            </span>
            Remember me
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={notify}
            onClick={() => setNotify((v) => !v)}
            className="flex items-center gap-2 text-sm"
            data-tokens="switch: on a9 · off g5"
          >
            <span
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                notify ? 'bg-(--a9)' : 'bg-(--g5)',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left]',
                  notify ? 'left-[1.125rem]' : 'left-0.5',
                )}
              />
            </span>
            Alerts
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="h-9 flex-1 rounded-md bg-(--a9) text-sm font-medium text-(--a-contrast) transition-colors hover:bg-(--a10)"
            data-tokens="solid: a9 → a10"
          >
            Submit
          </button>
          <button
            type="button"
            className="h-9 rounded-md px-4 text-sm font-medium text-(--g11) transition-colors hover:bg-(--g4)"
            data-tokens="ghost: text g11 · hover g4"
          >
            Cancel
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ---------- Feedback ----------

function FeedbackBlock() {
  return (
    <Panel title="Feedback">
      <div className="space-y-3">
        <div className="flex gap-2.5 rounded-lg border border-(--a6) bg-(--a3) p-3" data-tokens="callout: bg a3 · border a6 · icon a9 · text a11">
          <Info className="mt-0.5 size-4 shrink-0 text-(--a9)" />
          <div className="text-sm">
            <div className="font-medium text-(--a12)">New version available</div>
            <div className="text-(--a11)">Update to get the latest improvements.</div>
          </div>
        </div>
        <div className="flex gap-2.5 rounded-lg border border-(--g6) bg-(--g3) p-3" data-tokens="neutral callout: bg g3 · border g6 · text g11">
          <Info className="mt-0.5 size-4 shrink-0 text-(--g11)" />
          <div className="text-sm text-(--g11)">Changes are saved automatically.</div>
        </div>
        <div
          className="flex items-start gap-2.5 rounded-lg border border-(--g6) bg-(--g-surface) p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.25)]"
          data-tokens="toast: gray surface · border g6 · icon a9 · action a11"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-(--a9)" />
          <div className="flex-1 text-sm">
            <div className="font-medium">Project published</div>
            <div className="text-(--g11)">It’s now live for your team.</div>
          </div>
          <span className="cursor-pointer text-sm font-medium text-(--a11) hover:underline">Undo</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge className="bg-(--a9) text-(--a-contrast)" tokens="solid: a9 · contrast">Solid</Badge>
          <Badge className="bg-(--a3) text-(--a11)" tokens="soft: a3 · a11">Soft</Badge>
          <Badge className="border border-(--a7) text-(--a11)" tokens="outline: a7 · a11">Outline</Badge>
          <Badge className="border border-(--a6) bg-(--a2) text-(--a11)" tokens="surface: a2 · a6 · a11">Surface</Badge>
          <Badge className="bg-(--g3) text-(--g11)" tokens="gray soft: g3 · g11">Gray</Badge>
        </div>
      </div>
    </Panel>
  );
}

function Badge({ className, tokens, children }: { className: string; tokens: string; children: React.ReactNode }) {
  return (
    <span data-tokens={tokens} className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', className)}>
      {children}
    </span>
  );
}

// ---------- Buttons ----------

const BUTTONS = [
  { label: 'Solid', className: 'bg-(--a9) text-(--a-contrast) hover:bg-(--a10)', tokens: 'a9 → a10 · contrast' },
  { label: 'Soft', className: 'bg-(--a3) text-(--a11) hover:bg-(--a4) active:bg-(--a5)', tokens: 'a3 → a4 → a5 · a11' },
  { label: 'Surface', className: 'border border-(--a7) bg-(--a2) text-(--a11) hover:border-(--a8)', tokens: 'a2 · border a7 → a8 · a11' },
  { label: 'Outline', className: 'border border-(--a8) text-(--a11) hover:bg-(--a2)', tokens: 'border a8 · hover a2 · a11' },
  { label: 'Ghost', className: 'text-(--a11) hover:bg-(--a4)', tokens: 'a11 · hover a4' },
  { label: 'Gray', className: 'bg-(--g3) text-(--g12) hover:bg-(--g4) active:bg-(--g5)', tokens: 'g3 → g4 → g5 · g12' },
  { label: 'Disabled', className: 'cursor-not-allowed bg-(--g3) text-(--g8)', tokens: 'g3 · g8' },
];

function ButtonsRow() {
  return (
    <Panel title="Buttons" tokens="Tab through to see focus rings: a8">
      <div className="flex flex-wrap gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            data-tokens={b.tokens}
            className={cn(
              'h-9 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--a8)',
              b.className,
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ---------- Typography ----------

function TypographyBlock() {
  return (
    <Panel title="Typography" tokens="bg: g2">
      <div className="space-y-2.5">
        <h3 className="text-2xl font-semibold tracking-tight" data-tokens="heading: g12">
          The quick brown fox
        </h3>
        <p className="text-sm leading-relaxed" data-tokens="body: g12 · link a11 · code a3/a11">
          Design systems help teams build consistent interfaces. Read the{' '}
          <a className="cursor-pointer text-(--a11) underline decoration-(--a7) underline-offset-2 hover:decoration-(--a11)">
            getting started guide
          </a>{' '}
          or install with <code className="rounded bg-(--a3) px-1 py-0.5 font-mono text-[0.8125rem] text-(--a11)">npm i ui</code>.
        </p>
        <p className="text-sm text-(--g11)" data-tokens="muted: g11">
          Secondary copy and metadata use lower contrast.
        </p>
        <blockquote className="border-l-2 border-(--a6) pl-3 text-sm text-(--g11) italic" data-tokens="quote: border a6 · text g11">
          Good color is invisible until it’s wrong.
        </blockquote>
      </div>
    </Panel>
  );
}

// ---------- Table ----------

const ROWS = [
  { name: 'Website redesign', owner: 'Linh', status: 'Active' },
  { name: 'Mobile onboarding', owner: 'Khoa', status: 'Review' },
  { name: 'Billing API', owner: 'An', status: 'Done' },
];

function TableBlock() {
  return (
    <Panel title="Data" tokens="bg: g2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-(--g6) text-left text-xs text-(--g11)" data-tokens="header: g11 · divider g6">
            <th className="pb-2 font-medium">Project</th>
            <th className="pb-2 font-medium">Owner</th>
            <th className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => (
            <tr
              key={r.name}
              className={cn('border-b border-(--g5) transition-colors last:border-0 hover:bg-(--g3)', i === 0 && 'bg-(--a2)')}
              data-tokens={i === 0 ? 'selected row: a2' : 'row hover: g3 · divider g5'}
            >
              <td className="py-2 pr-2">{r.name}</td>
              <td className="py-2 pr-2 text-(--g11)">{r.owner}</td>
              <td className="py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    r.status === 'Active' && 'bg-(--a9) text-(--a-contrast)',
                    r.status === 'Review' && 'bg-(--a3) text-(--a11)',
                    r.status === 'Done' && 'bg-(--g3) text-(--g11)',
                  )}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
