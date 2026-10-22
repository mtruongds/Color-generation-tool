import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Download,
  Eye,
  ListTree,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Palette as PaletteIcon,
  RotateCcw,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { IconSwap } from '../ui/icon-swap';
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
import { PalettePicker } from './PalettePicker';
import { PaletteInspector } from './PaletteInspector';
import { ExportDialog } from './ExportDialog';
import { PresetsMenu } from './PresetsMenu';
import { BackgroundControl } from './BackgroundControl';
import type { PaletteConfig } from './types';
import { useGoogleFonts } from '../../lib/fonts';
import {
  type Accent,
  DEFAULT_FOUNDATIONS,
  type FoundationKey,
  type Foundations,
  generateRadiusScale,
  generateShadowScale,
  generateSpacingScale,
  generateTypeScale,
  normalizeFoundations,
  resolveFoundations,
} from '../../lib/foundations';
import { FOUNDATION_META, FOUNDATION_ORDER, FoundationNav } from '../foundations/FoundationNav';
import { FoundationSample } from '../foundations/FoundationSample';
import { FoundationDocs } from '../foundations/FoundationDocs';
import { type ColorRole, type CustomToken, colorTokenInfo, resolveColorRoles } from '../../lib/tokens';
import { FoundationPreview } from '../foundations/FoundationPreview';
import { TokenTiers } from '../foundations/TokenTiers';
import { TypographyCanvas, TypographyInspector } from '../foundations/TypographyFoundation';
import { SpacingCanvas, SpacingInspector } from '../foundations/SpacingFoundation';
import { RadiusCanvas, RadiusInspector } from '../foundations/RadiusFoundation';
import { ShadowCanvas, ShadowInspector } from '../foundations/ShadowFoundation';
import { GridCanvas, GridInspector } from '../foundations/GridFoundation';

// Re-export for backward compat
export type { PaletteConfig } from './types';

const PALETTES_KEY = 'lumina_palettes';
const BACKGROUNDS_KEY = 'lumina_backgrounds';
const FOUNDATIONS_KEY = 'lumina_foundations';
const FOUNDATION_VIEW_KEY = 'lumina_foundation_view';
const PANEL_WIDTH_KEY = 'lumina_panel_width';
/** Docked controls panel width in px: default, and the range the drag handle allows. */
const PANEL_WIDTH = { default: 360, min: 280, max: 560 };
const clampPanelWidth = (w: number) => Math.round(Math.min(PANEL_WIDTH.max, Math.max(PANEL_WIDTH.min, w)));

const DEFAULT_PALETTES: PaletteConfig[] = [
  { id: '1', name: 'Brand', baseColor: '#3e63dd', isDark: false, hueShift: 0, saturationScale: 1, lockStep9: false },
  { id: '2', name: 'Neutral', baseColor: '#71717a', isDark: false, hueShift: 0, saturationScale: 1, lockStep9: false, role: 'gray' },
];

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

type View = 'editor' | 'tokens' | 'docs' | 'preview';

const newId = () => Math.random().toString(36).slice(2, 11);

/**
 * Fills gaps in saved palettes and presets. Older lists had a locked Brand and Neutral that took
 * those roles implicitly; they become explicit roles so exports don't change. The old default name
 * "Primary" becomes Brand, and renamed roles are migrated.
 */
function normalizePalettes(list: (PaletteConfig & { locked?: boolean })[]): PaletteConfig[] {
  return list.map(({ locked, ...p }) => {
    const isGray = p.role === 'gray';
    const legacyRole = p.tokenRole as string | undefined;
    const tokenRole =
      legacyRole === 'primary' ? 'brand' : legacyRole === 'secondary' ? 'brand-secondary' : p.tokenRole;
    return {
      ...p,
      lockStep9: p.lockStep9 ?? false,
      tokenRole: tokenRole ?? (locked ? (isGray ? 'neutral' : 'brand') : undefined),
      ...(locked && !isGray && /^primary$/i.test(p.name.trim()) && { name: 'Brand' }),
    };
  });
}

function loadPalettes(): PaletteConfig[] {
  try {
    const saved = localStorage.getItem(PALETTES_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return normalizePalettes(parsed);
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

function loadFoundations(): Foundations {
  try {
    return normalizeFoundations(JSON.parse(localStorage.getItem(FOUNDATIONS_KEY) ?? 'null'));
  } catch {
    return DEFAULT_FOUNDATIONS;
  }
}

function loadPanelWidth(): number {
  try {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (saved > 0) return clampPanelWidth(saved);
  } catch {
    // Fall through to the default width.
  }
  return PANEL_WIDTH.default;
}

function loadFoundationView(): FoundationKey {
  try {
    const saved = localStorage.getItem(FOUNDATION_VIEW_KEY) as FoundationKey | null;
    if (saved && FOUNDATION_ORDER.includes(saved)) return saved;
  } catch {
    // Fall through to the default view.
  }
  return 'color';
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
  const [foundation, setFoundation] = useState<FoundationKey>(loadFoundationView);
  const [foundations, setFoundations] = useState<Foundations>(loadFoundations);
  const isColor = foundation === 'color';

  // --- UI state ---
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const [resizingPanel, setResizingPanel] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
    } catch {
      // Blocked storage only forgets the width.
    }
  }, [panelWidth]);

  /** Drags the panel's right edge; the width follows the pointer from where the drag began. */
  const startPanelResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    setResizingPanel(true);
    // Keep the resize cursor and block text selection while the pointer is over the page
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent) => setPanelWidth(clampPanelWidth(startWidth + ev.clientX - startX));
    const onUp = () => {
      setResizingPanel(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
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
    try {
      localStorage.setItem(FOUNDATIONS_KEY, JSON.stringify(foundations));
      localStorage.setItem(FOUNDATION_VIEW_KEY, foundation);
    } catch {
      // Storage full or blocked — foundations still work for this session.
    }
  }, [foundations, foundation]);

  const { headingFamily, bodyFamily, monoFamily } = foundations.typography;
  useGoogleFonts([headingFamily, bodyFamily, monoFamily]);

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

  const paletteTokens = useMemo(() => colorTokenInfo(generatedPalettes), [generatedPalettes]);

  /** Brand palette steps used to color the foundation previews. */
  const accent: Accent = useMemo(() => {
    const primary =
      generatedPalettes.find((p) => paletteTokens.get(p.id)?.role === 'brand') ??
      generatedPalettes.find((p) => p.role !== 'gray') ??
      generatedPalettes[0];
    const c = primary.scale.colors;
    return { solid: c[8], contrast: primary.scale.contrast, subtle: c[2], text: c[10] };
  }, [generatedPalettes, paletteTokens]);

  const resolved = useMemo(() => resolveFoundations(foundations, isDarkMode), [foundations, isDarkMode]);

  const summaries: Record<FoundationKey, string> = useMemo(
    () => ({
      color: String(palettes.length),
      typography: String(generateTypeScale(foundations.typography).length),
      spacing: String(generateSpacingScale(foundations.spacing).length),
      radius: String(generateRadiusScale(foundations.radius).length),
      shadow: String(generateShadowScale(foundations.shadow, false).length),
      grid: `${foundations.grid.breakpoints.length} bp`,
    }),
    [palettes.length, foundations],
  );

  const updateFoundation = useCallback(
    <K extends keyof Foundations>(key: K, updates: Partial<Foundations[K]>) =>
      setFoundations((prev) => ({ ...prev, [key]: { ...prev[key], ...updates } })),
    [],
  );

  /** Re-points a base or semantic token; `null` restores the generator's alias. */
  const setAlias = useCallback((name: string, ref: string | null) => {
    setFoundations((prev) => {
      const { [name]: _, ...rest } = prev.aliases ?? {};
      return { ...prev, aliases: ref ? { ...rest, [name]: ref } : rest };
    });
  }, []);

  const resetAliases = useCallback((names: string[]) => {
    setFoundations((prev) => {
      const aliases = { ...prev.aliases };
      for (const n of names) delete aliases[n];
      return { ...prev, aliases };
    });
    toast.success(`Reset ${names.length} token ${names.length === 1 ? 'edit' : 'edits'}`);
  }, []);

  const addToken = useCallback((token: CustomToken) => {
    setFoundations((prev) => ({ ...prev, customTokens: [...(prev.customTokens ?? []), token] }));
    toast.success(`Added ${token.name}`);
  }, []);

  const updateToken = useCallback((name: string, ref: string) => {
    setFoundations((prev) => ({ ...prev, customTokens: prev.customTokens?.map((t) => (t.name === name ? { ...t, ref } : t)) }));
  }, []);

  const removeToken = useCallback((name: string) => {
    setFoundations((prev) => ({ ...prev, customTokens: prev.customTokens?.filter((t) => t.name !== name) }));
    toast.success(`Deleted ${name}`);
  }, []);

  const selectFoundation = useCallback((key: FoundationKey) => {
    setFoundation(key);
    setMobileNavOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

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

  /**
   * Gives a palette a token role and takes it from the palette that held it. Roles of a kind swap
   * (the two brand roles, or two status roles); a palette losing Brand · Primary otherwise steps
   * down to Brand · Secondary when it's free.
   */
  const setTokenRole = useCallback((id: string, tokenRole: ColorRole | 'none' | undefined) => {
    setPalettes((prev) => {
      const roles = resolveColorRoles(prev);
      const holder = tokenRole && tokenRole !== 'none' ? prev.find((p) => p.id !== id && roles.get(p.id) === tokenRole) : undefined;
      if (!holder) return prev.map((p) => (p.id === id ? { ...p, tokenRole } : p));
      const kind = (r: ColorRole) =>
        r === 'brand' || r === 'brand-secondary' ? 'brand' : r === 'neutral' ? 'neutral' : 'status';
      const given = roles.get(id);
      const secondaryFree = ![...roles].some(([pid, r]) => r === 'brand-secondary' && pid !== id);
      const demoted: ColorRole | 'none' =
        given && kind(given) === kind(tokenRole as ColorRole)
          ? given
          : tokenRole === 'brand' && secondaryFree
            ? 'brand-secondary'
            : 'none';
      return prev.map((p) => (p.id === id ? { ...p, tokenRole } : p === holder ? { ...p, tokenRole: demoted } : p));
    });
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
      // The copy can't hold the same role, so it starts unassigned
      const copy = { ...source, id: newId(), name: `${source.name} copy`, tokenRole: undefined };
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
      if (palettes.length <= 1) {
        toast.error('Keep at least one palette.');
        return;
      }
      const remaining = palettes.filter((p) => p.id !== id);
      setPalettes(remaining);
      if (activePaletteId === id) setActivePaletteId(remaining[Math.max(0, index - 1)].id);
      toast.success(`Deleted “${palettes[index].name}”`);
    },
    [palettes, activePaletteId],
  );

  const movePalette = useCallback((id: string, toIndex: number) => {
    setPalettes((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1 || toIndex < 0 || toIndex >= prev.length || toIndex === index) return prev;
      const reordered = [...prev];
      const [palette] = reordered.splice(index, 1);
      reordered.splice(toIndex, 0, palette);
      return reordered;
    });
  }, []);

  const loadPreset = useCallback((loaded: PaletteConfig[], loadedFoundations?: Foundations) => {
    if (loadedFoundations) setFoundations(normalizeFoundations(loadedFoundations));
    if (loaded.length === 0) return;
    const next = normalizePalettes(loaded);
    setPalettes(next);
    setActivePaletteId(next[0].id);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  /** Appends a preset's palettes to the current ones, skipping exact duplicates. */
  const mergePreset = useCallback(
    (incoming: PaletteConfig[]) => {
      const key = (p: PaletteConfig) => `${p.name.trim().toLowerCase()}|${p.baseColor.toLowerCase()}`;
      const existingKeys = new Set(palettes.map(key));
      const usedNames = new Set(palettes.map((p) => p.name.trim().toLowerCase()));
      const takenRoles = new Set(resolveColorRoles(palettes).values());
      const added: PaletteConfig[] = [];
      for (const p of normalizePalettes(incoming)) {
        if (existingKeys.has(key(p))) continue;
        existingKeys.add(key(p));
        // Same name but a different color gets a numbered suffix so exported token names stay unique.
        let name = p.name.trim() || 'Untitled';
        for (let n = 2; usedNames.has(name.toLowerCase()); n++) name = `${p.name.trim()} ${n}`;
        usedNames.add(name.toLowerCase());
        // Roles the current list already fills stay with it
        const tokenRole = p.tokenRole && p.tokenRole !== 'none' && takenRoles.has(p.tokenRole) ? undefined : p.tokenRole;
        added.push({ ...p, id: newId(), name, tokenRole });
      }
      if (added.length > 0) {
        setPalettes((prev) => [...prev, ...added]);
        setActivePaletteId(added[0].id);
        scrollToPalette(added[0].id);
      }
      return { added: added.length, skipped: incoming.length - added.length };
    },
    [palettes, scrollToPalette],
  );

  const editPalette = useCallback((id: string) => {
    setActivePaletteId(id);
    setInspectorOpen(true);
  }, []);

  const resetFoundation = useCallback(() => {
    if (foundation === 'color') return;
    setFoundations((prev) => ({ ...prev, [foundation]: DEFAULT_FOUNDATIONS[foundation] }));
    toast.success(`Reset ${FOUNDATION_META[foundation].label.toLowerCase()} to defaults`);
  }, [foundation]);

  const sidebarProps = {
    palettes: generatedPalettes,
    activeId: activePalette?.id ?? '',
    onSelect: selectFromNav,
    onAdd: addPalette,
    onMove: movePalette,
    onDuplicate: duplicatePalette,
    onRemove: removePalette,
    roles: paletteTokens,
    onSetRole: setTokenRole,
  };

  const inspector = isColor ? (
    activePalette && (
      <PaletteInspector
        key={activePalette.id}
        palette={activePalette}
        tokens={paletteTokens.get(activePalette.id)}
        onChange={(updates) => updatePalette(activePalette.id, updates)}
        onSetRole={(role) => setTokenRole(activePalette.id, role)}
      />
    )
  ) : foundation === 'typography' ? (
    <TypographyInspector config={foundations.typography} onChange={(u) => updateFoundation('typography', u)} />
  ) : foundation === 'spacing' ? (
    <SpacingInspector config={foundations.spacing} onChange={(u) => updateFoundation('spacing', u)} />
  ) : foundation === 'radius' ? (
    <RadiusInspector config={foundations.radius} onChange={(u) => updateFoundation('radius', u)} />
  ) : foundation === 'shadow' ? (
    <ShadowInspector config={foundations.shadow} accent={accent.solid} onChange={(u) => updateFoundation('shadow', u)} />
  ) : (
    <GridInspector config={foundations.grid} spacingBase={foundations.spacing.base} onChange={(u) => updateFoundation('grid', u)} />
  );

  const inspectorHeader = isColor ? (
    <PalettePicker {...sidebarProps} />
  ) : (
    <FoundationInspectorHeader foundation={foundation as Exclude<FoundationKey, 'color'>} onReset={resetFoundation} />
  );

  const FoundationIcon = FOUNDATION_META[foundation].icon;

  const showDockedInspector = isDesktop;

  const mobileNavContent = (
    <div className="flex h-full flex-col">
      <FoundationNav active={foundation} summaries={summaries} onSelect={selectFoundation} />
    </div>
  );

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* === Top bar === */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar px-3 sm:gap-3">
        {!isDesktop && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <PanelLeft />
          </Button>
        )}

        {/* On desktop the mark sits in a rail-wide box so it lines up with the foundation icons below */}
        <div className="hidden items-center gap-2 sm:flex md:-ml-3">
          <div className="flex justify-center md:w-14">
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
          </div>
          <span className="text-[0.9375rem] font-semibold tracking-tight md:-ml-2">Lumina</span>
          <span className="rounded-full border px-1.5 py-px text-[0.625rem] font-medium text-muted-foreground">
            Beta
          </span>
        </div>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as View)} className="gap-0">
          <TabsList className="h-8 rounded-lg">
            <TabsTrigger value="editor" title="Editor" className="gap-1.5 rounded-md px-2 text-xs lg:px-3">
              {isColor ? <PaletteIcon className="size-3.5" /> : <FoundationIcon className="size-3.5" />}
              <span className="max-lg:sr-only">Editor</span>
            </TabsTrigger>
            <TabsTrigger value="tokens" title="Tokens" className="gap-1.5 rounded-md px-2 text-xs lg:px-3">
              <ListTree className="size-3.5" />
              <span className="max-lg:sr-only">Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="docs" title="Docs" className="gap-1.5 rounded-md px-2 text-xs lg:px-3">
              <BookOpen className="size-3.5" />
              <span className="max-lg:sr-only">Docs</span>
            </TabsTrigger>
            <TabsTrigger value="preview" title="Preview" className="gap-1.5 rounded-md px-2 text-xs lg:px-3">
              <Eye className="size-3.5" />
              <span className="max-lg:sr-only">Preview</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Tabs
            value={colorFormat}
            onValueChange={(v) => setColorFormat(v as ColorFormat)}
            className={cn('hidden gap-0', isColor && 'lg:flex')}
          >
            <TabsList className="h-8 rounded-lg" aria-label="Color format">
              <TabsTrigger value="hex" className="rounded-md px-2 font-mono text-[0.6875rem]">
                HEX
              </TabsTrigger>
              <TabsTrigger value="oklch" className="rounded-md px-2 font-mono text-[0.6875rem]">
                OKLCH
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <PresetsMenu palettes={palettes} foundations={foundations} onLoad={loadPreset} onMerge={mergePreset} />

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
                <IconSwap active={isDarkMode} on={<Sun />} off={<Moon />} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDarkMode ? 'Light mode' : 'Dark mode'}</TooltipContent>
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
          <>
            <FoundationNav
              variant="rail"
              active={foundation}
              summaries={summaries}
              onSelect={selectFoundation}
              footer={
                showDockedInspector && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-xl text-muted-foreground"
                        aria-label={panelCollapsed ? 'Show controls' : 'Hide controls'}
                        onClick={() => setPanelCollapsed((c) => !c)}
                      >
                        <IconSwap active={!panelCollapsed} on={<PanelLeftClose />} off={<PanelLeft />} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{panelCollapsed ? 'Show controls' : 'Hide controls'}</TooltipContent>
                  </Tooltip>
                )
              }
            />
            {showDockedInspector && inspector && (
              <aside
                className={cn(
                  'relative shrink-0 border-r bg-sidebar',
                  // No easing while dragging, so the edge stays under the pointer
                  !resizingPanel && 'transition-[width] duration-200 ease-out',
                  panelCollapsed && 'border-r-0',
                )}
                style={{ width: panelCollapsed ? 0 : panelWidth }}
              >
                <div className="h-full overflow-hidden">
                  {/* Fixed inner width keeps the controls from reflowing while the panel animates */}
                  <div className="scrollbar-thin h-full overflow-y-auto" style={{ width: panelWidth }}>
                    {inspectorHeader}
                    {inspector}
                  </div>
                </div>
                {!panelCollapsed && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize controls"
                    aria-valuenow={panelWidth}
                    aria-valuemin={PANEL_WIDTH.min}
                    aria-valuemax={PANEL_WIDTH.max}
                    tabIndex={0}
                    title="Drag to resize · double-click to reset"
                    onPointerDown={startPanelResize}
                    onDoubleClick={() => setPanelWidth(PANEL_WIDTH.default)}
                    onKeyDown={(e) => {
                      const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
                      if (!delta) return;
                      e.preventDefault();
                      setPanelWidth((w) => clampPanelWidth(w + delta * (e.shiftKey ? 40 : 10)));
                    }}
                    className={cn(
                      'group absolute inset-y-0 -right-1.5 z-20 w-3 cursor-col-resize touch-none focus-visible:outline-none',
                      'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-transparent after:transition-colors',
                      'hover:after:bg-ring/60 focus-visible:after:bg-ring',
                      resizingPanel && 'after:bg-ring',
                    )}
                  />
                )}
              </aside>
            )}
          </>
        ) : (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Switch foundations</SheetDescription>
              </SheetHeader>
              <div className="h-full pt-10">{mobileNavContent}</div>
            </SheetContent>
          </Sheet>
        )}

        <main ref={mainRef} className="scrollbar-thin relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
            {activeView === 'tokens' ? (
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold tracking-tight">{FOUNDATION_META[foundation].label} tokens</h1>
                  <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                    Primitive → Base → Semantic. Primitives are locked raw values. Point any base or semantic token at
                    another token in the tier below, or add your own. Changes apply to every export.
                  </p>
                </div>
                <TokenTiers
                  group={foundation}
                  palettes={generatedPalettes}
                  foundations={foundations}
                  colorFormat={colorFormat}
                  isDark={isDarkMode}
                  onAliasChange={setAlias}
                  onResetAliases={resetAliases}
                  onAddToken={addToken}
                  onUpdateToken={updateToken}
                  onRemoveToken={removeToken}
                />
              </>
            ) : !isColor && activeView === 'docs' ? (
              <FoundationDocs foundation={foundation} foundations={foundations} isDark={isDarkMode} accent={accent} />
            ) : !isColor ? (
              <>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                      {activeView === 'preview' ? `${FOUNDATION_META[foundation].label} in context` : FOUNDATION_META[foundation].title}
                    </h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {activeView === 'preview'
                        ? `A sample page built from every foundation, with ${FOUNDATION_META[foundation].label.toLowerCase()} highlighted.`
                        : FOUNDATION_META[foundation].blurb}
                    </p>
                  </div>
                  {!isDesktop && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInspectorOpen(true)}>
                      <SlidersHorizontal /> Settings
                    </Button>
                  )}
                </div>
                {activeView === 'preview' ? (
                  <FoundationPreview foundation={foundation} foundations={foundations} isDark={isDarkMode} accent={accent} />
                ) : foundation === 'typography' ? (
                  <TypographyCanvas config={foundations.typography} />
                ) : foundation === 'spacing' ? (
                  <SpacingCanvas config={foundations.spacing} accent={accent} />
                ) : foundation === 'radius' ? (
                  <RadiusCanvas config={foundations.radius} accent={accent} />
                ) : foundation === 'shadow' ? (
                  <ShadowCanvas config={foundations.shadow} isDark={isDarkMode} radius={resolved.radius.lg} />
                ) : (
                  <GridCanvas config={foundations.grid} accent={accent} />
                )}
                {activeView === 'editor' && foundation !== 'grid' && (
                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">All foundations together</h2>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setActiveView('preview')}>
                        Full preview <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                    <FoundationSample tokens={resolved} accent={accent} />
                  </div>
                )}
              </>
            ) : activeView === 'editor' ? (
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
                  <div className="flex items-center gap-2">
                    {/* The header's format toggle only fits from lg up */}
                    <Tabs value={colorFormat} onValueChange={(v) => setColorFormat(v as ColorFormat)} className="gap-0 lg:hidden">
                      <TabsList className="h-7 rounded-lg" aria-label="Color format">
                        <TabsTrigger value="hex" className="rounded-md px-2 font-mono text-[0.625rem]">
                          HEX
                        </TabsTrigger>
                        <TabsTrigger value="oklch" className="rounded-md px-2 font-mono text-[0.625rem]">
                          OKLCH
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                      {isDarkMode ? <Moon className="size-3" /> : <Sun className="size-3" />}
                      {isDarkMode ? 'Dark' : 'Light'} mode
                    </span>
                    {!isDesktop && (
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInspectorOpen(true)}>
                        <SlidersHorizontal /> Settings
                      </Button>
                    )}
                  </div>
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
              'fixed right-6 bottom-6 z-40 size-10 rounded-full bg-card shadow-card-hover transition-[opacity,translate,scale] duration-200',
              showGoToTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
            )}
          >
            <ArrowUp />
          </Button>
        </main>

      </div>

      {!isDesktop && (
        <Sheet open={inspectorOpen && !!inspector} onOpenChange={setInspectorOpen}>
          <SheetContent side="left" className="w-[22rem] max-w-[90vw] gap-0 overflow-y-auto bg-sidebar p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{isColor ? 'Edit palette' : `${FOUNDATION_META[foundation].label} settings`}</SheetTitle>
              <SheetDescription>{isColor ? 'Adjust the active palette' : FOUNDATION_META[foundation].blurb}</SheetDescription>
            </SheetHeader>
            {inspectorHeader}
            {inspector}
          </SheetContent>
        </Sheet>
      )}

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        palettes={generatedPalettes}
        colorFormat={colorFormat}
        foundations={foundations}
        isDark={isDarkMode}
        initialScope={foundation}
      />
    </div>
  );
}

function FoundationInspectorHeader({ foundation, onReset }: { foundation: Exclude<FoundationKey, 'color'>; onReset: () => void }) {
  const { label, icon: Icon } = FOUNDATION_META[foundation];
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-sidebar/95 px-5 py-3.5 backdrop-blur">
      <div>
        <div className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">Settings</div>
        <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {label}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={onReset} aria-label={`Reset ${label}`}>
            <RotateCcw />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset to defaults</TooltipContent>
      </Tooltip>
    </div>
  );
}
