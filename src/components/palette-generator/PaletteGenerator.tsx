import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  Download,
  Eye,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Palette as PaletteIcon,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';
import { ColorFormat, DEFAULT_BACKGROUNDS } from '../../lib/color-utils';
import {
  type GeneratedPalette,
  type ScaleContext,
  generatePaletteScale,
  getScaleContext,
} from '../../lib/export-utils';
import { PaletteDisplay } from './PaletteDisplay';
import { PaletteDocumentation } from './PaletteDocumentation';
import { PalettePreview } from './PalettePreview';
import { PaletteSidebar } from './PaletteSidebar';
import { PaletteInspector } from './PaletteInspector';
import { ExportDialog } from './ExportDialog';
import { PresetsMenu } from './PresetsMenu';
import { BackgroundControl } from './BackgroundControl';
import type { MoveDirection, PaletteConfig } from './types';

// Re-export for backward compat
export type { PaletteConfig } from './types';

const PALETTES_KEY = 'lumina_palettes';
const BACKGROUNDS_KEY = 'lumina_backgrounds';

const DEFAULT_PALETTES: PaletteConfig[] = [
  { id: '1', name: 'Primary', baseColor: '#3e63dd', isDark: false, hueShift: 0, saturationScale: 1, lockStep9: false, locked: true },
  { id: '2', name: 'Neutral', baseColor: '#71717a', isDark: false, hueShift: 0, saturationScale: 1, lockStep9: false, role: 'gray', locked: true },
];
const [DEFAULT_PRIMARY, DEFAULT_NEUTRAL] = DEFAULT_PALETTES;

/** Offered in order when adding a palette, skipping any base color already in use. */
const SUGGESTIONS = [
  { name: 'Green', baseColor: '#30a46c' },
  { name: 'Amber', baseColor: '#ffc53d' },
  { name: 'Red', baseColor: '#e5484d' },
  { name: 'Violet', baseColor: '#6e56cf' },
  { name: 'Cyan', baseColor: '#00a2c7' },
  { name: 'Pink', baseColor: '#d6409f' },
  { name: 'Orange', baseColor: '#f76b15' },
  { name: 'Teal', baseColor: '#12a594' },
];

type View = 'editor' | 'docs' | 'preview';

const newId = () => Math.random().toString(36).slice(2, 11);

/**
 * Every palette list keeps one locked accent (Primary) and one locked gray. Older saves and
 * presets get their first accent and first gray locked, or the missing default added.
 */
function ensureDefaultPalettes(list: PaletteConfig[]): PaletteConfig[] {
  let result = list.map((p) => ({ ...p, lockStep9: p.lockStep9 ?? false }));
  const isGray = (p: PaletteConfig) => p.role === 'gray';

  if (!result.some((p) => p.locked && !isGray(p))) {
    const primary = result.find((p) => !isGray(p));
    result = primary
      ? result.map((p) => (p === primary ? { ...p, locked: true } : p))
      : [{ ...DEFAULT_PRIMARY, id: newId() }, ...result];
  }
  if (!result.some((p) => p.locked && isGray(p))) {
    // Saves from before the gray role kept the default Neutral as an accent; promote it instead of duplicating
    const gray =
      result.find(isGray) ??
      result.find((p) => !p.locked && (p.id === DEFAULT_NEUTRAL.id || /^(neutral|gr[ae]y)$/i.test(p.name.trim())));
    result = gray
      ? result.map((p) => (p === gray ? { ...p, role: 'gray' as const, locked: true } : p))
      : [...result, { ...DEFAULT_NEUTRAL, id: newId() }];
  }
  return result;
}

function loadPalettes(): PaletteConfig[] {
  try {
    const saved = localStorage.getItem(PALETTES_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return ensureDefaultPalettes(parsed);
  } catch {
    // Fall through to defaults when storage is unavailable or corrupted.
  }
  return DEFAULT_PALETTES;
}

function loadBackgrounds(): ScaleContext['backgrounds'] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BACKGROUNDS_KEY) ?? 'null');
    if (typeof parsed?.light === 'string' && typeof parsed?.dark === 'string') return parsed;
  } catch {
    // Fall through to defaults when storage is unavailable or corrupted.
  }
  return { ...DEFAULT_BACKGROUNDS };
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function PaletteGenerator({
  isDarkMode,
  toggleDarkMode,
}: {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}) {
  // --- Palette state ---
  const [palettes, setPalettes] = useState<PaletteConfig[]>(loadPalettes);
  const [activePaletteId, setActivePaletteId] = useState<string>(() => palettes[0]?.id ?? '1');
  const [activeView, setActiveView] = useState<View>('editor');
  const [colorFormat, setColorFormat] = useState<ColorFormat>('hex');
  const [backgrounds, setBackgrounds] = useState(loadBackgrounds);

  // --- UI state ---
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PALETTES_KEY, JSON.stringify(palettes));
    } catch {
      // Storage full or blocked — palettes still work for this session.
    }
  }, [palettes]);

  useEffect(() => {
    try {
      localStorage.setItem(BACKGROUNDS_KEY, JSON.stringify(backgrounds));
    } catch {
      // Storage full or blocked — backgrounds still work for this session.
    }
  }, [backgrounds]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowGoToTop(el.scrollTop > 400);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const generatedPalettes: GeneratedPalette[] = useMemo(() => {
    const context = getScaleContext(palettes, backgrounds);
    return palettes.map((p) => ({
      ...p,
      isDark: isDarkMode,
      context,
      scale: generatePaletteScale(p, isDarkMode, context),
    }));
  }, [palettes, isDarkMode, backgrounds]);

  const activePalette = generatedPalettes.find((p) => p.id === activePaletteId) ?? generatedPalettes[0];

  // --- Actions ---
  const scrollToPalette = useCallback((id: string) => {
    requestAnimationFrame(() =>
      document.getElementById(`palette-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, []);

  const selectFromNav = useCallback(
    (id: string) => {
      setActivePaletteId(id);
      setMobileNavOpen(false);
      scrollToPalette(id);
    },
    [scrollToPalette],
  );

  const updatePalette = useCallback((id: string, updates: Partial<PaletteConfig>) => {
    setPalettes((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const addPalette = useCallback(() => {
    const used = new Set(palettes.map((p) => p.baseColor.toLowerCase()));
    const suggestion = SUGGESTIONS.find((s) => !used.has(s.baseColor)) ?? SUGGESTIONS[0];
    const id = newId();
    setPalettes((prev) => [
      ...prev,
      { id, ...suggestion, isDark: isDarkMode, hueShift: 0, saturationScale: 1, lockStep9: false },
    ]);
    setActivePaletteId(id);
    setActiveView('editor');
    setMobileNavOpen(false);
    scrollToPalette(id);
  }, [palettes, isDarkMode, scrollToPalette]);

  const duplicatePalette = useCallback(
    (id: string) => {
      const source = palettes.find((p) => p.id === id);
      if (!source) return;
      const copy = { ...source, id: newId(), name: `${source.name} copy`, locked: false };
      setPalettes((prev) => {
        const index = prev.findIndex((p) => p.id === id);
        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      });
      setActivePaletteId(copy.id);
      scrollToPalette(copy.id);
    },
    [palettes, scrollToPalette],
  );

  const removePalette = useCallback(
    (id: string) => {
      const index = palettes.findIndex((p) => p.id === id);
      if (palettes[index]?.locked) {
        toast.error(`“${palettes[index].name}” is a default palette and can’t be deleted.`);
        return;
      }
      const remaining = palettes.filter((p) => p.id !== id);
      setPalettes(remaining);
      if (activePaletteId === id) setActivePaletteId(remaining[Math.max(0, index - 1)].id);
      toast.success(`Deleted “${palettes[index].name}”`);
    },
    [palettes, activePaletteId],
  );

  const movePalette = useCallback((id: string, direction: MoveDirection) => {
    setPalettes((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      const next = direction === 'top' ? 0 : direction === 'last' ? prev.length - 1 : index + direction;
      if (index === -1 || next < 0 || next >= prev.length) return prev;
      const reordered = [...prev];
      const [palette] = reordered.splice(index, 1);
      reordered.splice(next, 0, palette);
      return reordered;
    });
  }, []);

  const loadPreset = useCallback((loaded: PaletteConfig[]) => {
    if (loaded.length === 0) return;
    const next = ensureDefaultPalettes(loaded);
    setPalettes(next);
    setActivePaletteId(next[0].id);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const editPalette = useCallback((id: string) => {
    setActivePaletteId(id);
    setInspectorOpen(true);
  }, []);

  const sidebarProps = {
    palettes: generatedPalettes,
    activeId: activePalette?.id ?? '',
    onSelect: selectFromNav,
    onAdd: addPalette,
    onMove: movePalette,
    onDuplicate: duplicatePalette,
    onRemove: removePalette,
  };

  const inspector = activePalette && (
    <PaletteInspector
      key={activePalette.id}
      palette={activePalette}
      onChange={(updates) => updatePalette(activePalette.id, updates)}
    />
  );

  const showDockedInspector = activeView === 'editor' && isWide;

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* === Top bar === */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar px-3 sm:gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label={isDesktop ? (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar') : 'Open palettes'}
              onClick={() => (isDesktop ? setSidebarCollapsed((c) => !c) : setMobileNavOpen(true))}
            >
              {isDesktop && !sidebarCollapsed ? <PanelLeftClose /> : <PanelLeft />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isDesktop ? 'Toggle sidebar' : 'Palettes'}</TooltipContent>
        </Tooltip>

        <div className="hidden items-center gap-2 sm:flex">
          <div
            className="size-7 rounded-lg shadow-sm"
            style={{
              background: `conic-gradient(from 200deg, ${generatedPalettes
                .slice(0, 4)
                .map((p) => p.scale.colors[8])
                .concat(generatedPalettes[0]?.scale.colors[8] ?? '#3e63dd')
                .join(', ')})`,
            }}
            aria-hidden
          />
          <span className="text-[0.9375rem] font-semibold tracking-tight">Lumina</span>
          <span className="rounded-full border px-1.5 py-px text-[0.625rem] font-medium text-muted-foreground">
            Beta
          </span>
        </div>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as View)} className="gap-0">
          <TabsList className="h-8 rounded-lg">
            <TabsTrigger value="editor" className="gap-1.5 rounded-md px-3 text-xs">
              <PaletteIcon className="hidden size-3.5 sm:block" /> Editor
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5 rounded-md px-3 text-xs">
              <BookOpen className="hidden size-3.5 sm:block" /> Docs
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 rounded-md px-3 text-xs">
              <Eye className="hidden size-3.5 sm:block" /> Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Tabs value={colorFormat} onValueChange={(v) => setColorFormat(v as ColorFormat)} className="hidden gap-0 sm:flex">
            <TabsList className="h-8 rounded-lg" aria-label="Color format">
              <TabsTrigger value="hex" className="rounded-md px-2 font-mono text-[0.6875rem]">
                HEX
              </TabsTrigger>
              <TabsTrigger value="oklch" className="rounded-md px-2 font-mono text-[0.6875rem]">
                OKLCH
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <PresetsMenu palettes={palettes} onLoad={loadPreset} />

          <BackgroundControl
            isDark={isDarkMode}
            value={isDarkMode ? backgrounds.dark : backgrounds.light}
            onChange={(color) => setBackgrounds((prev) => ({ ...prev, [isDarkMode ? 'dark' : 'light']: color }))}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={toggleDarkMode}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? <Sun /> : <Moon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDarkMode ? 'Light scales' : 'Dark scales'}</TooltipContent>
          </Tooltip>

          <Button size="sm" className="ml-1 gap-1.5" onClick={() => setExportOpen(true)} aria-label="Export tokens">
            <Download />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </header>

      {/* === Body === */}
      <div className="flex min-h-0 flex-1">
        {isDesktop ? (
          <aside
            className={cn(
              'shrink-0 overflow-hidden border-r bg-sidebar transition-[width] duration-200 ease-out',
              sidebarCollapsed ? 'w-14' : 'w-64',
            )}
          >
            <PaletteSidebar {...sidebarProps} collapsed={sidebarCollapsed} />
          </aside>
        ) : (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
              <SheetHeader className="sr-only">
                <SheetTitle>Palettes</SheetTitle>
                <SheetDescription>Select, add or reorder palettes</SheetDescription>
              </SheetHeader>
              <div className="h-full pt-10">
                <PaletteSidebar {...sidebarProps} />
              </div>
            </SheetContent>
          </Sheet>
        )}

        <main ref={mainRef} className="scrollbar-thin relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
            {activeView === 'editor' ? (
              <>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight">Color scales</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      12-step {isDarkMode ? 'dark' : 'light'} scales on{' '}
                      <span className="font-mono">{isDarkMode ? backgrounds.dark : backgrounds.light}</span> · click any
                      swatch to copy
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                    {isDarkMode ? <Moon className="size-3" /> : <Sun className="size-3" />}
                    {isDarkMode ? 'Dark' : 'Light'} mode
                  </span>
                </div>
                <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
                  {generatedPalettes.map((palette) => (
                    <PaletteDisplay
                      key={palette.id}
                      palette={palette}
                      colorFormat={colorFormat}
                      active={palette.id === activePalette?.id}
                      onSelect={() => setActivePaletteId(palette.id)}
                      onEdit={() => editPalette(palette.id)}
                    />
                  ))}
                </div>
              </>
            ) : activeView === 'docs' ? (
              <PaletteDocumentation palettes={generatedPalettes} colorFormat={colorFormat} />
            ) : (
              <PalettePreview palettes={generatedPalettes} activeId={activePalette?.id} />
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className={cn(
              'fixed right-6 bottom-6 z-40 size-10 rounded-full bg-card shadow-card-hover transition-[opacity,transform] duration-200',
              showDockedInspector && 'right-[21.5rem]',
              showGoToTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
            )}
          >
            <ArrowUp />
          </Button>
        </main>

        {showDockedInspector && activePalette && (
          <aside className="scrollbar-thin w-80 shrink-0 overflow-y-auto border-l bg-sidebar">
            <InspectorHeader palette={activePalette} />
            {inspector}
          </aside>
        )}
      </div>

      {!isWide && (
        <Sheet open={inspectorOpen && !!activePalette} onOpenChange={setInspectorOpen}>
          <SheetContent side="right" className="w-[22rem] max-w-[90vw] gap-0 overflow-y-auto bg-sidebar p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Edit palette</SheetTitle>
              <SheetDescription>Adjust the active palette</SheetDescription>
            </SheetHeader>
            {activePalette && <InspectorHeader palette={activePalette} />}
            {inspector}
          </SheetContent>
        </Sheet>
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        palettes={generatedPalettes}
        colorFormat={colorFormat}
      />
    </div>
  );
}

function InspectorHeader({ palette }: { palette: GeneratedPalette }) {
  return (
    <div className="sticky top-0 z-10 border-b bg-sidebar/95 px-5 py-3.5 backdrop-blur">
      <div className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">Editing</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="truncate text-sm font-semibold">{palette.name || 'Untitled'}</span>
      </div>
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full">
        {palette.scale.colors.map((c, i) => (
          <span key={i} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}
