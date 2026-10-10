import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { DEFAULT_BACKGROUNDS, normalizeHex } from '../../lib/color-utils';

/** Page background the scales are fitted to, per mode — same as Radix custom's Background input. */
export function BackgroundControl({
  isDark,
  value,
  onChange,
}: {
  isDark: boolean;
  value: string;
  onChange: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const valid = normalizeHex(draft) !== null;
  const fallback = isDark ? DEFAULT_BACKGROUNDS.dark : DEFAULT_BACKGROUNDS.light;
  const isDefault = normalizeHex(value) === normalizeHex(fallback);

  useEffect(() => {
    setDraft((d) => (normalizeHex(d) === normalizeHex(value) ? d : value));
  }, [value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground max-md:size-8 max-md:px-0"
          aria-label="Page background"
        >
          <span
            className="size-4 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]"
            style={{ backgroundColor: value }}
          />
          <span className="hidden md:inline">Background</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div>
          <div className="text-sm font-medium">{isDark ? 'Dark' : 'Light'} background</div>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Scales and alpha steps are fitted to this color.
          </p>
        </div>
        <div className="flex gap-2">
          <label
            className="swatch-outline relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md focus-within:ring-[3px] focus-within:ring-ring/50"
            style={{ backgroundColor: value }}
          >
            <span className="sr-only">Pick background color</span>
            <input
              type="color"
              value={normalizeHex(value) ?? fallback}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <Input
            aria-label="Background hex"
            aria-invalid={!valid}
            value={draft}
            spellCheck={false}
            onChange={(e) => {
              setDraft(e.target.value);
              const hex = normalizeHex(e.target.value);
              if (hex) onChange(hex);
            }}
            onBlur={() => setDraft(value)}
            className="font-mono uppercase"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground"
            aria-label="Reset background"
            disabled={isDefault}
            onClick={() => onChange(fallback)}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
        {!valid && <p className="text-xs text-destructive">Enter a 3 or 6 digit hex value.</p>}
      </PopoverContent>
    </Popover>
  );
}
