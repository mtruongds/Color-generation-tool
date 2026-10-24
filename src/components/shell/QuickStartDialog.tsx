import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { SegmentedField, SelectField } from '../foundations/inspector-controls';
import { DEFAULT_BACKGROUNDS, getContrast, normalizeHex } from '../../lib/color-utils';
import { FONT_OPTIONS, useGoogleFonts } from '../../lib/fonts';
import { DEFAULT_FOUNDATIONS, RADIUS_PRESETS, fontStack, type Foundations } from '../../lib/foundations';
import type { ProjectData } from '../../lib/projects';
import type { PaletteConfig } from '../palette-generator/types';

type Density = 'compact' | 'default' | 'airy';

const DENSITY: Record<Density, { label: string; textSize: number; spacing: Foundations['spacing'] }> = {
  compact: { label: 'Compact', textSize: 14, spacing: { base: 4, progression: 'linear' } },
  default: { label: 'Default', textSize: 16, spacing: { base: 4, progression: 'linear' } },
  airy: { label: 'Airy', textSize: 16, spacing: { base: 4, progression: 'geometric' } },
};

const STATUS = [
  { name: 'Green', baseColor: '#30a46c' },
  { name: 'Amber', baseColor: '#ffc53d' },
  { name: 'Red', baseColor: '#e5484d' },
];

const textFonts = FONT_OPTIONS.filter((f) => f.kind !== 'mono').map((f) => ({ value: f.family, label: f.family }));

const newId = () => Math.random().toString(36).slice(2, 11);

const palette = (name: string, baseColor: string, extra: Partial<PaletteConfig> = {}): PaletteConfig => ({
  id: newId(),
  name,
  baseColor,
  isDark: false,
  hueShift: 0,
  saturationScale: 1,
  lockStep9: false,
  ...extra,
});

/**
 * One screen from a brand color to a full system: every foundation is generated from these few
 * choices, then the preview opens so the whole thing shows at once.
 */
export function QuickStartDialog({
  open,
  onOpenChange,
  createsProject,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Asks for a project name, for "New from brand color" rather than the first visit. */
  createsProject: boolean;
  onCreate: (name: string, data: ProjectData) => void;
}) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('#3e63dd');
  const [draft, setDraft] = useState('#3e63dd');
  const [heading, setHeading] = useState('Inter');
  const [body, setBody] = useState('Inter');
  const [density, setDensity] = useState<Density>('default');
  const [radius, setRadius] = useState(String(RADIUS_PRESETS[2].base));
  const [status, setStatus] = useState(true);

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  useGoogleFonts(open ? [heading, body] : []);

  const create = () => {
    const d = DENSITY[density];
    const foundations: Foundations = {
      ...DEFAULT_FOUNDATIONS,
      typography: { ...DEFAULT_FOUNDATIONS.typography, headingFamily: heading, bodyFamily: body, baseSize: d.textSize },
      spacing: d.spacing,
      radius: { base: Number(radius) },
      shadow: { ...DEFAULT_FOUNDATIONS.shadow, tint: brand },
    };
    const palettes = [
      palette('Brand', brand, { tokenRole: 'brand' }),
      palette('Neutral', '#71717a', { role: 'gray', tokenRole: 'neutral' }),
      ...(status ? STATUS.map((s) => palette(s.name, s.baseColor)) : []),
    ];
    onCreate(name.trim() || 'Untitled project', { palettes, foundations, backgrounds: { ...DEFAULT_BACKGROUNDS } });
    onOpenChange(false);
  };

  const r = Number(radius);
  const onBrand = getContrast(brand, '#ffffff') >= getContrast(brand, '#111111') ? '#ffffff' : '#111111';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-[40rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Start from your brand color
          </DialogTitle>
          <DialogDescription>
            Pick a few things and Lumina generates color, type, spacing, radius, shadow and grid. You can fine-tune everything after.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-[1fr_15rem]">
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            {createsProject && (
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="qs-name" className="text-sm">
                  Project
                </label>
                <Input id="qs-name" value={name} placeholder="Untitled project" onChange={(e) => setName(e.target.value)} className="h-8 w-[11rem]" />
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Brand color</span>
              <div className="flex w-[11rem] gap-1.5">
                <label className="swatch-outline relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md" style={{ backgroundColor: brand }}>
                  <span className="sr-only">Pick brand color</span>
                  <input
                    type="color"
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      setDraft(e.target.value);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <Input
                  aria-label="Brand color hex"
                  value={draft}
                  spellCheck={false}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    const hex = normalizeHex(e.target.value);
                    if (hex) setBrand(hex);
                  }}
                  onBlur={() => setDraft(brand)}
                  className="h-8 font-mono uppercase"
                />
              </div>
            </div>
            <SelectField label="Heading font" value={heading} options={textFonts} onChange={setHeading} />
            <SelectField label="Body font" value={body} options={textFonts} onChange={setBody} />
            <SegmentedField
              label="Density"
              value={density}
              options={(Object.keys(DENSITY) as Density[]).map((k) => ({ value: k, label: DENSITY[k].label }))}
              onChange={setDensity}
            />
            <SegmentedField
              label="Corners"
              value={radius}
              options={RADIUS_PRESETS.map((p) => ({ value: String(p.base), label: p.label }))}
              onChange={setRadius}
            />
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Status colors
                <span className="block text-xs text-muted-foreground">Success, warning and danger</span>
              </span>
              <Switch checked={status} onCheckedChange={setStatus} />
            </label>
            <button type="submit" hidden />
          </form>

          {/* A small sample so the choices read as a product, not a list of settings */}
          <div aria-hidden className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card" style={{ borderRadius: r * 1.5 }}>
            <div className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">Sample</div>
            <div style={{ fontFamily: fontStack(heading), fontSize: DENSITY[density].textSize * 1.5, fontWeight: 600, lineHeight: 1.2 }}>
              Ship faster
            </div>
            <p className="text-muted-foreground" style={{ fontFamily: fontStack(body), fontSize: DENSITY[density].textSize * 0.875, lineHeight: 1.5 }}>
              One system for every screen, generated from your brand.
            </p>
            <div className="mt-auto flex gap-2" style={{ gap: density === 'compact' ? 6 : density === 'airy' ? 12 : 8 }}>
              <span
                className="px-3 py-1.5 whitespace-nowrap"
                style={{ background: brand, color: onBrand, borderRadius: r, fontFamily: fontStack(body), fontSize: DENSITY[density].textSize * 0.875, fontWeight: 500 }}
              >
                Get started
              </span>
              <span
                className="border px-3 py-1.5 whitespace-nowrap"
                style={{ borderRadius: r, fontFamily: fontStack(body), fontSize: DENSITY[density].textSize * 0.875 }}
              >
                Learn more
              </span>
            </div>
            {status && (
              <div className="flex gap-1.5">
                {STATUS.map((s) => (
                  <span key={s.name} className="h-1.5 flex-1 rounded-full" style={{ background: s.baseColor }} />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {createsProject ? 'Cancel' : 'Skip, start from defaults'}
          </Button>
          <Button onClick={create} className="gap-1.5">
            <Sparkles /> Generate system
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
