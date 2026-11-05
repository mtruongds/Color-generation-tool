import { useEffect, useId, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export function Section({
  title,
  children,
  action,
  info,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Explanation shown in a tooltip beside the title. */
  info?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b px-5 py-5 last:border-b-0">
      <div className="flex h-5 items-center justify-between">
        <div className="flex items-center gap-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
          {info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${title.toLowerCase()}`}
                  className="relative grid size-4 place-items-center rounded-sm text-muted-foreground/70 transition-colors after:absolute after:-inset-1.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Info className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-[19rem] text-pretty">
                {info}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-6 text-muted-foreground after:absolute after:-inset-2"
      aria-label={`Reset ${label}`}
      onClick={onClick}
    >
      <RotateCcw className="size-3" />
    </Button>
  );
}

export function SliderField({
  label,
  value,
  display,
  min,
  max,
  step,
  defaultValue,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const changed = value !== defaultValue;
  return (
    <div className="space-y-2.5 pb-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {changed && <ResetButton label={label} onClick={() => onChange(defaultValue)} />}
          <span className="min-w-[3rem] rounded-md bg-muted px-1.5 py-0.5 text-right font-mono text-xs tabular">
            {display}
          </span>
        </div>
      </div>
      <Slider id={id} min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode }[];
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="shrink-0 text-sm font-normal">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger id={id} size="sm" className="w-[11rem] min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-normal">{label}</Label>
      <Tabs value={value} onValueChange={(v) => onChange(v as T)} className="gap-0">
        <TabsList className="h-8 rounded-lg" aria-label={label}>
          {options.map((o) => (
            <TabsTrigger key={o.value} value={o.value} className="rounded-md px-2.5 text-xs">
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

export function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Compact number input that commits in-range values as you type, clamps on blur, and restores the last value when the draft isn't a number. */
export function NumberInput({
  value,
  min,
  max,
  decimals = 0,
  onChange,
  className,
  ...props
}: {
  value: number;
  min?: number;
  max?: number;
  /** Digits kept after the point; 0 rounds to whole numbers. */
  decimals?: number;
  onChange: (v: number) => void;
  className?: string;
  'aria-label': string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const f = 10 ** decimals;
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.round(n * f) / f));
  return (
    <Input
      {...props}
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        // Out-of-range values wait for blur, so typing "1" on the way to "1.2" isn't clamped mid-word
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= (min ?? -Infinity) && n <= (max ?? Infinity)) onChange(clamp(n));
      }}
      onBlur={() => {
        const n = Number(draft);
        if (draft.trim() !== '' && Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n));
        else setDraft(String(value));
      }}
      className={className ?? 'h-8 px-2 text-right font-mono text-xs tabular'}
    />
  );
}

/** Small uppercase heading used above each block of a foundation page. */
export function CanvasHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children && <div className="text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}
