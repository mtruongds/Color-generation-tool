import { useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  Boxes,
  Highlighter,
  LayoutDashboard,
  Monitor,
  MousePointer2,
  Newspaper,
  PanelsTopLeft,
  Smartphone,
  Tablet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';
import type { Accent, Foundations } from '../../lib/foundations';
import type { GeneratedPalette } from '../../lib/export-utils';
import { openPreviewWindow } from '../../lib/preview-window';
import { productsOf, resolveProductRoles } from '../../lib/tokens';
import { foundationsForProduct } from '../../lib/foundations';
import {
  PreviewPaletteControls,
  TOOLTIPS_KEY,
  defaultPreviewPalettes,
  loadTooltipsOn,
} from '../palette-generator/PalettePreview';
import {
  FoundationPreview,
  HIGHLIGHT_LABEL,
  VIEWPORT_MOBILE,
  VIEWPORT_TABLET,
  type PreviewHighlight,
  type ViewportPreset,
  type ViewportSize,
} from './FoundationPreview';

const PAGE_KEY = 'lumina_preview_page';
const VIEW_KEY = 'lumina_preview_view';
const PRODUCT_KEY = 'lumina_preview_product';
/** Product select value for palettes picked by hand. */
const CUSTOM = 'custom';

function loadProduct(): string | null {
  try {
    return localStorage.getItem(PRODUCT_KEY);
  } catch {
    return null;
  }
}

type PreviewPage = 'dashboard' | 'landing' | 'article';

const PAGES: Record<PreviewPage, { label: string; icon: LucideIcon; blurb: string }> = {
  dashboard: {
    label: 'Dashboard',
    icon: LayoutDashboard,
    blurb: 'An app screen with every state your components need.',
  },
  landing: {
    label: 'Landing',
    icon: PanelsTopLeft,
    blurb: 'A marketing page that leads with your palette.',
  },
  article: {
    label: 'Article',
    icon: Newspaper,
    blurb: 'A long-form page that puts your type scale and rhythm first.',
  },
};

const PRESETS: { key: ViewportPreset; label: string; icon: LucideIcon; hint: string }[] = [
  { key: 'desktop', label: 'Desktop', icon: Monitor, hint: "Your grid's largest breakpoint" },
  { key: 'tablet', label: 'Tablet', icon: Tablet, hint: `${VIEWPORT_TABLET}px` },
  { key: 'mobile', label: 'Mobile', icon: Smartphone, hint: `${VIEWPORT_MOBILE}px` },
];

interface ViewSettings {
  /** A preset follows its width (desktop tracks the grid); a number is a width dragged by hand. */
  size: ViewportSize;
  highlight: PreviewHighlight;
}

function loadPage(): PreviewPage {
  try {
    const saved = localStorage.getItem(PAGE_KEY);
    if (saved && saved in PAGES) return saved as PreviewPage;
  } catch {
    // Fall through to the default page.
  }
  return 'dashboard';
}

function loadView(): ViewSettings {
  const fallback: ViewportPreset = window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    // Older saves stored `viewport: 'desktop' | 'mobile'`
    const size = saved?.size ?? saved?.viewport;
    return {
      size: typeof size === 'number' && size > 0 ? size : PRESETS.some((p) => p.key === size) ? size : fallback,
      highlight: typeof saved?.highlight === 'string' && saved.highlight in HIGHLIGHT_LABEL ? saved.highlight : 'none',
    };
  } catch {
    return { size: fallback, highlight: 'none' };
  }
}

/** Sample pages that show every foundation working together. */
export function PreviewSection({
  palettes,
  activePaletteId,
  activeProductId,
  foundations,
  isDark,
  popout = false,
}: {
  palettes: GeneratedPalette[];
  activePaletteId?: string;
  /** The product selected in the editor, which the preview starts on. */
  activeProductId?: string;
  foundations: Foundations;
  isDark: boolean;
  /** Rendered in its own window, which follows the editor live. */
  popout?: boolean;
}) {
  const [page, setPage] = useState<PreviewPage>(loadPage);
  const [view, setView] = useState<ViewSettings>(loadView);
  const [accentId, setAccentId] = useState(() => defaultPreviewPalettes(palettes, activePaletteId).accentId);
  const [grayId, setGrayId] = useState(() => defaultPreviewPalettes(palettes, activePaletteId).grayId);
  const [tooltipsOn, setTooltipsOn] = useState(loadTooltipsOn);
  const products = useMemo(() => productsOf(foundations), [foundations]);
  const rolesByProduct = useMemo(() => resolveProductRoles(palettes, products), [palettes, products]);
  const hasProducts = products.length > 1;
  /** The product whose brand and neutral paint the page, or custom when they were picked by hand. */
  const [productId, setProductId] = useState<string>(() => activeProductId ?? loadProduct() ?? products[0].id);
  const product = hasProducts && productId !== CUSTOM ? products.find((p) => p.id === productId) : undefined;
  const productRoles = product && rolesByProduct.get(product.id);
  // The product's fonts too; custom palettes keep the first product's type
  const shownFoundations = useMemo(() => foundationsForProduct(foundations, product?.id), [foundations, product?.id]);
  const updateView = (updates: Partial<ViewSettings>) => setView((v) => ({ ...v, ...updates }));

  useEffect(() => {
    try {
      localStorage.setItem(TOOLTIPS_KEY, tooltipsOn ? 'on' : 'off');
      localStorage.setItem(PAGE_KEY, page);
      localStorage.setItem(VIEW_KEY, JSON.stringify(view));
      localStorage.setItem(PRODUCT_KEY, productId);
    } catch {
      // Blocked storage only forgets these between visits.
    }
  }, [tooltipsOn, page, view, productId]);

  // A product paints with its own brand and neutral, live as its roles change; roles it lacks keep the picks
  const shownAccentId = productRoles?.get('brand')?.paletteId ?? accentId;
  const shownGrayId = productRoles?.get('neutral')?.paletteId ?? grayId;
  const accentPalette = palettes.find((p) => p.id === shownAccentId) ?? palettes[0];
  const grayPalette = palettes.find((p) => p.id === shownGrayId) ?? palettes.find((p) => p.role === 'gray') ?? accentPalette;

  /** Picking a palette by hand leaves the product, keeping the other palette where it was. */
  const pickByHand = (accent: string, gray: string) => {
    setAccentId(accent);
    setGrayId(gray);
    setProductId(CUSTOM);
  };

  /** The picked accent's steps, in the shape the foundation pages read. */
  const accent: Accent = useMemo(() => {
    const c = accentPalette.scale.colors;
    return { solid: c[8], contrast: accentPalette.scale.contrast, subtle: c[2], text: c[10] };
  }, [accentPalette]);

  /** A drag that lands on a preset's width reports the preset, so it lights up here. */
  const activePreset = typeof view.size === 'string' ? view.size : '';

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            Preview
            {popout && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground" title="Follows changes made in the editor window">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Live
              </span>
            )}
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            {PAGES[page].blurb}
            {popout && ' Edit foundations in the other window and this page updates as you go.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
        {!popout && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={openPreviewWindow}>
                <AppWindow /> Open in window
              </Button>
            </TooltipTrigger>
            <TooltipContent>Keep the preview beside the editor and watch it update as you change foundations</TooltipContent>
          </Tooltip>
        )}
        <Tabs value={page} onValueChange={(v) => setPage(v as PreviewPage)} className="gap-0">
          <TabsList className="h-9 rounded-lg" aria-label="Preview page">
            {(Object.keys(PAGES) as PreviewPage[]).map((key) => {
              const { label, icon: Icon } = PAGES[key];
              return (
                <TabsTrigger key={key} value={key} className="gap-1.5 rounded-md px-3 text-[0.8125rem]">
                  <Icon className="size-4" /> {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
        </div>
      </div>

      {/* One toolbar for every control, pinned while the page scrolls */}
      <div
        role="toolbar"
        aria-label="Preview controls"
        className="sticky top-0 z-30 -mx-4 mt-4 mb-5 flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2.5 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8"
      >
        {/* What the page is painted with */}
        {hasProducts && (
          <Select
            value={product?.id ?? CUSTOM}
            onValueChange={(v) => (v === CUSTOM ? pickByHand(accentPalette.id, grayPalette.id) : setProductId(v))}
          >
            <SelectTrigger size="sm" className="w-auto min-w-36 gap-1.5 bg-card" aria-label="Product">
              <Boxes className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => {
                const brand = palettes.find((x) => x.id === rolesByProduct.get(p.id)?.get('brand')?.paletteId);
                return (
                  <SelectItem key={p.id} value={p.id}>
                    <span
                      className="size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]"
                      style={{ backgroundColor: brand?.scale.colors[8] ?? 'transparent' }}
                    />
                    {p.name}
                  </SelectItem>
                );
              })}
              <SelectItem value={CUSTOM}>
                <span className="size-3 shrink-0 rounded-full border border-dashed border-muted-foreground/50" />
                Custom palettes
              </SelectItem>
            </SelectContent>
          </Select>
        )}
        <PreviewPaletteControls
          palettes={palettes}
          accentId={accentPalette.id}
          grayId={grayPalette.id}
          onAccentChange={(id) => pickByHand(id, grayPalette.id)}
          onGrayChange={(id) => pickByHand(accentPalette.id, id)}
        />

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

        {/* How to inspect it */}
        <Select value={view.highlight} onValueChange={(v) => updateView({ highlight: v as PreviewHighlight })}>
          <SelectTrigger
            size="sm"
            className={cn('w-auto min-w-36 gap-1.5 bg-card', view.highlight !== 'none' && 'border-ring/60')}
            aria-label="Highlight a foundation"
          >
            <Highlighter className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(HIGHLIGHT_LABEL) as PreviewHighlight[]).map((k) => (
              <SelectItem key={k} value={k}>
                {HIGHLIGHT_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-card pr-2 pl-2.5 text-xs">
              <MousePointer2 className="size-3.5 text-muted-foreground" />
              Step tooltips
              <Switch checked={tooltipsOn} onCheckedChange={setTooltipsOn} aria-label="Step tooltips" />
            </label>
          </TooltipTrigger>
          <TooltipContent>Hover any element to see which accent and gray steps it uses</TooltipContent>
        </Tooltip>

        {/* How big to show it */}
        <div className="ml-auto flex items-center gap-2">
          <Tabs value={activePreset} onValueChange={(v) => updateView({ size: v as ViewportPreset })} className="gap-0">
            <TabsList className="h-8 rounded-lg" aria-label="Viewport size">
              {PRESETS.map(({ key, label, icon: Icon, hint }) => (
                <TabsTrigger key={key} value={key} className="gap-1.5 rounded-md px-2.5 text-xs" title={`${label}: ${hint}`}>
                  <Icon className="size-3.5" /> <span className="max-xl:sr-only">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <FoundationPreview
        page={page}
        foundations={shownFoundations}
        isDark={isDark}
        accent={accent}
        accentScale={accentPalette.scale}
        gray={grayPalette.scale}
        showTokens={tooltipsOn}
        size={view.size}
        onSizeChange={(size) => updateView({ size })}
        highlight={view.highlight}
      />
    </div>
  );
}
