import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  ArrowUp,
  BookOpen,
  Command as CommandIcon,
  Download,
  FilePlus2,
  FolderOpen,
  History,
  ListTree,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Palette as PaletteIcon,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Undo2,
  Upload,
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
  downloadFile,
  generatePaletteScale,
  getScaleContext,
} from '../../lib/export-utils';
import { PaletteDisplay } from './PaletteDisplay';
import { PaletteDocumentation } from './PaletteDocumentation';
import { PalettePicker } from './PalettePicker';
import { PaletteInspector } from './PaletteInspector';
import { ExportDialog } from './ExportDialog';
import { PresetsMenu } from './PresetsMenu';
import { BackgroundControl } from './BackgroundControl';
import type { PaletteConfig } from './types';
import { useGoogleFonts } from '../../lib/fonts';
import { type EditMode, loadEditMode, saveEditMode } from '../../lib/edit-mode';
import { isTextEditing, useHistory } from '../../lib/history';
import {
  PROJECTS_KEY,
  type ProjectData,
  type ProjectStore,
  addVersion,
  createProject,
  loadProjectStore,
  parseProjectFile,
  pickTextFile,
  projectFileContent,
  projectFileName,
  saveProjectStore,
  uniqueProjectName,
} from '../../lib/projects';
import type { InterfaceTheme } from '../../App';
import { ContextBar } from '../shell/ContextBar';
import { ThemeMenu } from '../shell/ThemeMenu';
import { ProjectMenu } from '../shell/ProjectMenu';
import { type CommandAction, CommandMenu } from '../shell/CommandMenu';
import { QuickStartDialog } from '../shell/QuickStartDialog';
import { PageHeader, type View } from '../shell/PageHeader';
import { openPreviewWindow } from '../../lib/preview-window';
import {
  type Accent,
  DEFAULT_FOUNDATIONS,
  type FoundationKey,
  type Foundations,
  generateRadiusScale,
  generateShadowScale,
  generateSpacingScale,
  generateTypeScale,
  allFontFamilies,
  foundationsForProduct,
  normalizeFoundations,
  resolveFoundations,
} from '../../lib/foundations';
import { FOUNDATION_META, NAV_META, NAV_ORDER, type NavKey, FoundationNav } from '../foundations/FoundationNav';
import { FoundationDocs } from '../foundations/FoundationDocs';
import {
  type ColorRole,
  type CustomToken,
  type FontRole,
  type Product,
  DEFAULT_PRODUCT,
  brandSolid,
  colorTokenInfo,
  productShadowTints,
  productsOf,
  resolveColorRoles,
  resolveProductRoles,
  withProductRole,
} from '../../lib/tokens';
import { PreviewSection } from '../foundations/PreviewSection';
import { TokenTiers } from '../foundations/TokenTiers';
import { TypographyCanvas, TypographyInspector } from '../foundations/TypographyFoundation';
import { SpacingCanvas, SpacingInspector } from '../foundations/SpacingFoundation';
import { RadiusCanvas, RadiusInspector } from '../foundations/RadiusFoundation';
import { ShadowCanvas, ShadowInspector } from '../foundations/ShadowFoundation';
import { GridCanvas, GridInspector } from '../foundations/GridFoundation';

// Re-export for backward compat
export type { PaletteConfig } from './types';

export const PALETTES_KEY = 'lumina_palettes';
export const BACKGROUNDS_KEY = 'lumina_backgrounds';
export const FOUNDATIONS_KEY = 'lumina_foundations';
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

export function loadPalettes(): PaletteConfig[] {
  try {
    const saved = localStorage.getItem(PALETTES_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return normalizePalettes(parsed);
  } catch {
    // Fall through to defaults when storage is unavailable or corrupted.
  }
  return DEFAULT_PALETTES;
}

export function loadBackgrounds(): ScaleContext['backgrounds'] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BACKGROUNDS_KEY) ?? 'null');
    if (typeof parsed?.light === 'string' && typeof parsed?.dark === 'string') return parsed;
  } catch {
    // Fall through to defaults when storage is unavailable or corrupted.
  }
  return { ...DEFAULT_BACKGROUNDS };
}

export function loadFoundations(): Foundations {
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

function loadSection(): NavKey {
  try {
    const saved = localStorage.getItem(FOUNDATION_VIEW_KEY) as NavKey | null;
    if (saved && NAV_ORDER.includes(saved)) return saved;
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

/** True on the very first visit, before anything has been saved, to offer the quick start. */
function isFirstVisit() {
  try {
    return !localStorage.getItem(PALETTES_KEY) && !localStorage.getItem(PROJECTS_KEY);
  } catch {
    return false;
  }
}

export function PaletteGenerator({
  interfaceDark,
  theme,
  onThemeChange,
}: {
  /** Whether the app chrome is dark. The canvas follows the edit mode instead. */
  interfaceDark: boolean;
  theme: InterfaceTheme;
  onThemeChange: (theme: InterfaceTheme) => void;
}) {
  // --- Edit mode: which tokens are being edited, apart from the interface theme ---
  const [editMode, setEditMode] = useState<EditMode>(loadEditMode);
  const isDarkMode = editMode === 'dark';
  useEffect(() => saveEditMode(editMode), [editMode]);
  const toggleEditMode = useCallback(() => setEditMode((m) => (m === 'dark' ? 'light' : 'dark')), []);

  // --- Palette state ---
  const [firstVisit] = useState(isFirstVisit);
  const [palettes, setPalettes] = useState<PaletteConfig[]>(loadPalettes);
  const [activePaletteId, setActivePaletteId] = useState<string>(() => palettes[0]?.id ?? '1');
  const [activeView, setActiveView] = useState<View>('editor');
  const [colorFormat, setColorFormat] = useState<ColorFormat>('hex');
  const [backgrounds, setBackgrounds] = useState(loadBackgrounds);
  const [section, setSection] = useState<NavKey>(loadSection);
  const [foundations, setFoundations] = useState<Foundations>(loadFoundations);
  const isPreview = section === 'preview';
  // Preview has no controls of its own; color stands in wherever a foundation is required
  const foundation: FoundationKey = isPreview ? 'color' : section;
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [quickStart, setQuickStart] = useState<'first' | 'new' | null>(() => (firstVisit ? 'first' : null));
  const mainRef = useRef<HTMLDivElement>(null);

  // --- Undo and redo over everything a project holds ---
  const doc: ProjectData = useMemo(() => ({ palettes, backgrounds, foundations }), [palettes, backgrounds, foundations]);
  const applyDoc = useCallback((d: ProjectData) => {
    setPalettes(d.palettes);
    setBackgrounds(d.backgrounds);
    setFoundations(d.foundations);
  }, []);
  const history = useHistory(doc, applyDoc);

  /** A success toast with an Undo that puts back exactly what the action changed. */
  const undoableToast = useCallback((message: string, restore: () => void) => {
    toast.success(message, { duration: 5000, action: { label: 'Undo', onClick: restore } });
  }, []);

  // --- Projects: the working copy above is the open project, saved into the store as it changes ---
  const [projectStore, setProjectStore] = useState<ProjectStore>(() => {
    const saved = loadProjectStore();
    if (saved) return saved;
    const project = createProject('Untitled project', { palettes, backgrounds, foundations });
    return { activeId: project.id, projects: [project] };
  });
  const activeProject = projectStore.projects.find((p) => p.id === projectStore.activeId) ?? projectStore.projects[0];
  const syncTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      setProjectStore((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === s.activeId ? { ...p, data: doc, updatedAt: Date.now() } : p)),
      }));
    }, 300);
    return () => window.clearTimeout(syncTimer.current);
  }, [doc]);

  useEffect(() => saveProjectStore(projectStore), [projectStore]);

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
      localStorage.setItem(FOUNDATION_VIEW_KEY, section);
    } catch {
      // Storage full or blocked — foundations still work for this session.
    }
  }, [foundations, section]);

  // Every product's fonts, so switching products doesn't wait on a download
  useGoogleFonts(allFontFamilies(foundations));

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

  // --- Products: modes of the Color collection, each refilling roles of the first ---
  const products = useMemo(() => productsOf(foundations), [foundations]);
  const [activeProductId, setActiveProductId] = useState(DEFAULT_PRODUCT.id);
  const activeProduct = products.find((p) => p.id === activeProductId) ?? products[0];
  const isExtraProduct = activeProduct.id !== products[0].id;
  const productRoles = useMemo(() => resolveProductRoles(palettes, products), [palettes, products]);
  const activeProductRoles = productRoles.get(activeProduct.id) ?? new Map();

  /** The role each palette fills itself in the active product. */
  const activeRoles = useMemo(() => {
    if (!isExtraProduct) return paletteTokens;
    const own = new Map<string, { primitive: string; role?: ColorRole }>();
    for (const [id, info] of paletteTokens) own.set(id, { primitive: info.primitive });
    for (const [role, h] of activeProductRoles) if (!h.inherited) own.set(h.paletteId, { ...own.get(h.paletteId)!, role });
    return own;
  }, [isExtraProduct, paletteTokens, activeProductRoles]);

  const inheritance = useMemo(() => {
    if (!isExtraProduct) return undefined;
    const byId = new Map(generatedPalettes.map((p) => [p.id, p]));
    const holders = new Map<ColorRole, GeneratedPalette>();
    for (const [role, h] of activeProductRoles) if (h.inherited && byId.has(h.paletteId)) holders.set(role, byId.get(h.paletteId)!);
    return { roles: [...activeProductRoles.keys()], holders, from: products[0].name };
  }, [isExtraProduct, generatedPalettes, activeProductRoles, products]);

  const setProducts = useCallback((update: (list: ReturnType<typeof productsOf>) => ReturnType<typeof productsOf>) => {
    setFoundations((prev) => ({ ...prev, products: update(productsOf(prev)) }));
  }, []);

  const addProduct = useCallback(() => {
    const names = new Set(products.map((p) => p.name.toLowerCase()));
    // Counts the added products only, so the first one after Main is Product 1
    let n = products.length;
    while (names.has(`product ${n}`)) n++;
    const product = { id: newId(), name: `Product ${n}` };
    setProducts((list) => [...list, product]);
    setActiveProductId(product.id);
  }, [products, setProducts]);

  const renameProduct = useCallback(
    (id: string, name: string) => {
      // Names become mode names and data-product values, so they stay unique
      if (products.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
        toast.error(`There's already a product named “${name}”.`);
        return;
      }
      setProducts((list) => list.map((p) => (p.id === id ? { ...p, name } : p)));
    },
    [products, setProducts],
  );

  const removeProduct = useCallback(
    (id: string) => {
      const product = products.find((p) => p.id === id);
      if (!product || id === products[0].id) return;
      const before = { palettes, foundations };
      setProducts((list) => list.filter((p) => p.id !== id));
      setPalettes((prev) =>
        prev.map(({ productRoles, ...p }) => {
          const { [id]: _, ...rest } = productRoles ?? {};
          return Object.keys(rest).length ? { ...p, productRoles: rest } : p;
        }),
      );
      setActiveProductId(products[0].id);
      undoableToast(`Deleted “${product.name}”`, () => {
        setPalettes(before.palettes);
        setFoundations(before.foundations);
        setActiveProductId(id);
      });
    },
    [products, setProducts, palettes, foundations, undoableToast],
  );

  /** Sets the active extra product's font for a role; undefined inherits the first product's again. */
  const setProductFont = useCallback(
    (role: FontRole, family: string | undefined) =>
      setProducts((list) =>
        list.map((p) => {
          if (p.id !== activeProduct.id) return p;
          const { [role]: _, ...rest } = p.fonts ?? {};
          const fonts = family ? { ...rest, [role]: family } : rest;
          return { ...p, fonts: Object.keys(fonts).length ? fonts : undefined };
        }),
      ),
    [activeProduct.id, setProducts],
  );

  /** Sets a field on the active extra product; undefined inherits the first product's again. */
  const setProductField = useCallback(
    <K extends 'radius' | 'shadowTint'>(key: K, value: Product[K]) =>
      setProducts((list) =>
        list.map((p) => {
          if (p.id !== activeProduct.id) return p;
          const next = { ...p };
          if (value === undefined) delete next[key];
          else next[key] = value;
          return next;
        }),
      ),
    [activeProduct.id, setProducts],
  );

  /** Fills a role in an extra product, taking it from the palette that filled it there before. */
  const setProductRole = useCallback((productId: string, id: string, role: ColorRole | 'none' | undefined) => {
    setPalettes((prev) => withProductRole(prev, productId, id, role));
  }, []);

  /** Brand palette steps used to color the foundation previews. */
  const accent: Accent = useMemo(() => {
    const primary =
      generatedPalettes.find((p) => paletteTokens.get(p.id)?.role === 'brand') ??
      generatedPalettes.find((p) => p.role !== 'gray') ??
      generatedPalettes[0];
    const c = primary.scale.colors;
    return { solid: c[8], contrast: primary.scale.contrast, subtle: c[2], text: c[10] };
  }, [generatedPalettes, paletteTokens]);

  const shadowTints = useMemo(() => productShadowTints(generatedPalettes, foundations), [generatedPalettes, foundations]);
  /** The active product's brand step 9, offered as its shadow tint. */
  const productBrand = useMemo(() => {
    const brand = generatedPalettes.find((p) => p.id === activeProductRoles.get('brand')?.paletteId);
    return brand ? brandSolid(brand) : accent.solid;
  }, [activeProductRoles, generatedPalettes, accent.solid]);

  /** Foundations with the active product's fonts, radius and shadow tint, for the canvases and samples. */
  const productFoundations = useMemo(
    () => foundationsForProduct(foundations, activeProduct.id, shadowTints.get(activeProduct.id)),
    [foundations, activeProduct.id, shadowTints],
  );
  const resolved = useMemo(() => resolveFoundations(productFoundations, isDarkMode), [productFoundations, isDarkMode]);

  const summaries: Record<NavKey, string> = useMemo(
    () => ({
      color: String(palettes.length),
      typography: String(generateTypeScale(foundations.typography).length),
      spacing: String(generateSpacingScale(foundations.spacing).length),
      radius: String(generateRadiusScale(foundations.radius).length),
      shadow: String(generateShadowScale(foundations.shadow, false).length),
      grid: `${foundations.grid.breakpoints.length} bp`,
      preview: '3',
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

  const resetAliases = useCallback(
    (names: string[]) => {
      const before = foundations.aliases;
      setFoundations((prev) => {
        const aliases = { ...prev.aliases };
        for (const n of names) delete aliases[n];
        return { ...prev, aliases };
      });
      undoableToast(`Reset ${names.length} token ${names.length === 1 ? 'edit' : 'edits'}`, () =>
        setFoundations((prev) => ({ ...prev, aliases: before })),
      );
    },
    [foundations.aliases, undoableToast],
  );

  const addToken = useCallback((token: CustomToken) => {
    setFoundations((prev) => ({ ...prev, customTokens: [...(prev.customTokens ?? []), token] }));
    toast.success(`Added ${token.name}`);
  }, []);

  const updateToken = useCallback((name: string, ref: string) => {
    setFoundations((prev) => ({ ...prev, customTokens: prev.customTokens?.map((t) => (t.name === name ? { ...t, ref } : t)) }));
  }, []);

  const removeToken = useCallback(
    (name: string) => {
      const before = foundations.customTokens;
      setFoundations((prev) => ({ ...prev, customTokens: prev.customTokens?.filter((t) => t.name !== name) }));
      undoableToast(`Deleted ${name}`, () => setFoundations((prev) => ({ ...prev, customTokens: before })));
    },
    [foundations.customTokens, undoableToast],
  );

  const selectFoundation = useCallback((key: NavKey) => {
    setSection(key);
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
   * (the two brand roles, or two status roles); otherwise the previous holder is left with no role.
   */
  const setTokenRole = useCallback((id: string, tokenRole: ColorRole | 'none' | undefined) => {
    setPalettes((prev) => {
      const roles = resolveColorRoles(prev);
      const holder = tokenRole && tokenRole !== 'none' ? prev.find((p) => p.id !== id && roles.get(p.id) === tokenRole) : undefined;
      if (!holder) return prev.map((p) => (p.id === id ? { ...p, tokenRole } : p));
      const kind = (r: ColorRole) =>
        r === 'brand' || r === 'brand-secondary' ? 'brand' : r === 'neutral' ? 'neutral' : 'status';
      const given = roles.get(id);
      const demoted: ColorRole | 'none' = given && kind(given) === kind(tokenRole as ColorRole) ? given : 'none';
      return prev.map((p) => (p.id === id ? { ...p, tokenRole } : p === holder ? { ...p, tokenRole: demoted } : p));
    });
  }, []);

  /** Sets a role in whichever product is active. */
  const setActiveRole = useCallback(
    (id: string, role: ColorRole | 'none' | undefined) =>
      isExtraProduct ? setProductRole(activeProduct.id, id, role) : setTokenRole(id, role),
    [isExtraProduct, activeProduct.id, setProductRole, setTokenRole],
  );

  const addPalette = useCallback(() => {
    const used = new Set(palettes.map((p) => p.baseColor.toLowerCase()));
    const suggestion = SUGGESTIONS.find((s) => !used.has(s.baseColor)) ?? SUGGESTIONS[0];
    const id = newId();
    setPalettes((prev) => [
      ...prev,
      // Added for an extra product, it shouldn't take a role in the first one by its name
      { id, ...suggestion, isDark: isDarkMode, hueShift: 0, saturationScale: 1, lockStep9: false, ...(isExtraProduct && { tokenRole: 'none' as const }) },
    ]);
    setActivePaletteId(id);
    setActiveView('editor');
    setSection('color');
    setMobileNavOpen(false);
    scrollToPalette(id);
  }, [palettes, isDarkMode, isExtraProduct, scrollToPalette]);

  const duplicatePalette = useCallback(
    (id: string) => {
      const source = palettes.find((p) => p.id === id);
      if (!source) return;
      // The copy can't hold the same role, so it starts unassigned
      const copy = { ...source, id: newId(), name: `${source.name} copy`, tokenRole: undefined, productRoles: undefined };
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
      const before = palettes;
      setPalettes(remaining);
      if (activePaletteId === id) setActivePaletteId(remaining[Math.max(0, index - 1)].id);
      undoableToast(`Deleted “${palettes[index].name}”`, () => {
        setPalettes(before);
        setActivePaletteId(id);
      });
    },
    [palettes, activePaletteId, undoableToast],
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
        // Products aren't merged, so roles in the preset's products are dropped
        added.push({ ...p, id: newId(), name, tokenRole, productRoles: undefined });
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
    if (foundation === 'color') {
      // Back to Brand and Neutral, dropping every palette, so it can be undone. Products stay, they hold the fonts too.
      const previous = { palettes, activeId: activePaletteId };
      setPalettes(DEFAULT_PALETTES);
      setActivePaletteId(DEFAULT_PALETTES[0].id);
      undoableToast('Reset color to defaults', () => {
        setPalettes(previous.palettes);
        setActivePaletteId(previous.activeId);
      });
      return;
    }
    const key = foundation;
    const previous = foundations[key];
    setFoundations((prev) => ({ ...prev, [key]: DEFAULT_FOUNDATIONS[key] }));
    undoableToast(`Reset ${FOUNDATION_META[key].label.toLowerCase()} to defaults`, () =>
      setFoundations((prev) => ({ ...prev, [key]: previous })),
    );
  }, [foundation, palettes, activePaletteId, foundations, undoableToast]);

  // --- Projects ---
  /** Opens a project's data with a fresh undo history, after saving the open one. */
  const openProject = useCallback(
    (store: ProjectStore, data: ProjectData) => {
      window.clearTimeout(syncTimer.current);
      setProjectStore(store);
      history.reset(data);
      setActivePaletteId(data.palettes[0]?.id ?? '');
      setActiveProductId(DEFAULT_PRODUCT.id);
      mainRef.current?.scrollTo({ top: 0 });
    },
    [history],
  );

  /** The store with the open project's latest edits written in, so switching away never loses them. */
  const flushedStore = useCallback(
    (): ProjectStore => ({
      ...projectStore,
      projects: projectStore.projects.map((p) => (p.id === projectStore.activeId ? { ...p, data: doc, updatedAt: Date.now() } : p)),
    }),
    [projectStore, doc],
  );

  const switchProject = useCallback(
    (id: string) => {
      const store = flushedStore();
      const target = store.projects.find((p) => p.id === id);
      if (!target) return;
      openProject({ ...store, activeId: id }, target.data);
      toast.success(`Opened “${target.name}”`);
    },
    [flushedStore, openProject],
  );

  const newProject = useCallback(
    (name: string, data: ProjectData) => {
      const store = flushedStore();
      const project = createProject(uniqueProjectName(name, store.projects), data);
      openProject({ activeId: project.id, projects: [...store.projects, project] }, data);
      toast.success(`Created “${project.name}”`);
    },
    [flushedStore, openProject],
  );

  const newBlankProject = useCallback(
    () =>
      newProject('Untitled project', {
        palettes: DEFAULT_PALETTES.map((p) => ({ ...p, id: newId() })),
        backgrounds: { ...DEFAULT_BACKGROUNDS },
        foundations: DEFAULT_FOUNDATIONS,
      }),
    [newProject],
  );

  const renameProject = useCallback((name: string) => {
    setProjectStore((s) => {
      const taken = s.projects.some((p) => p.id !== s.activeId && p.name.toLowerCase() === name.toLowerCase());
      if (taken) {
        toast.error(`There's already a project named “${name}”.`);
        return s;
      }
      return { ...s, projects: s.projects.map((p) => (p.id === s.activeId ? { ...p, name } : p)) };
    });
  }, []);

  const duplicateProject = useCallback(
    () => newProject(`${activeProject.name} copy`, structuredClone(doc)),
    [newProject, activeProject.name, doc],
  );

  const deleteProject = useCallback(() => {
    const store = flushedStore();
    if (store.projects.length <= 1) return;
    const remaining = store.projects.filter((p) => p.id !== store.activeId);
    const next = remaining[0];
    openProject({ activeId: next.id, projects: remaining }, next.data);
    toast.success(`Deleted “${activeProject.name}”`);
  }, [flushedStore, openProject, activeProject.name]);

  const saveVersion = useCallback(
    (label?: string) => {
      const name = label || `Version ${activeProject.versions.length + 1}`;
      setProjectStore((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === s.activeId ? addVersion({ ...p, data: doc }, name, structuredClone(doc)) : p)),
      }));
      toast.success(`Saved “${name}”`);
    },
    [activeProject.versions.length, doc],
  );

  const restoreVersion = useCallback(
    (versionId: string) => {
      const version = activeProject.versions.find((v) => v.id === versionId);
      if (!version) return;
      // Through the normal setters, so ⌘Z takes the restore back
      applyDoc(structuredClone(version.data));
      setActivePaletteId(version.data.palettes[0]?.id ?? '');
      toast.success(`Restored “${version.label}”`, { duration: 5000, action: { label: 'Undo', onClick: () => history.undo() } });
    },
    [activeProject.versions, applyDoc, history],
  );

  const deleteVersion = useCallback((versionId: string) => {
    setProjectStore((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === s.activeId ? { ...p, versions: p.versions.filter((v) => v.id !== versionId) } : p)),
    }));
  }, []);

  const importProject = useCallback(async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const { name, data } = parseProjectFile(text);
      newProject(name, {
        palettes: normalizePalettes(data.palettes),
        backgrounds: data.backgrounds ?? { ...DEFAULT_BACKGROUNDS },
        foundations: normalizeFoundations(data.foundations),
      });
    } catch {
      toast.error('That file isn’t a Lumina project or preset.');
    }
  }, [newProject]);

  const downloadProject = useCallback(() => {
    downloadFile(projectFileContent(activeProject, doc), projectFileName(activeProject.name), 'application/json');
    toast.success(`Downloaded ${projectFileName(activeProject.name)}`);
  }, [activeProject, doc]);

  const finishQuickStart = useCallback(
    (name: string, data: ProjectData) => {
      if (quickStart === 'new') newProject(name, data);
      else {
        // First visit: fill the starter project rather than adding a second one
        history.reset(data);
        setActivePaletteId(data.palettes[0].id);
      }
      setSection('preview');
      setActiveView('editor');
    },
    [quickStart, newProject, history],
  );

  const sidebarProps = {
    palettes: generatedPalettes,
    activeId: activePalette?.id ?? '',
    onSelect: selectFromNav,
    onAdd: addPalette,
    onMove: movePalette,
    onDuplicate: duplicatePalette,
    onRemove: removePalette,
    roles: activeRoles,
    onSetRole: setActiveRole,
    inheritance,
  };

  /** Every role in the active extra product, the palette behind it and what it inherits, for the inspector's list. */
  const productHolders = useMemo(() => {
    const toRole = (p: GeneratedPalette) => ({ id: p.id, name: p.name, baseColor: p.baseColor, gray: p.role === 'gray' });
    const byId = new Map(generatedPalettes.map((p) => [p.id, p]));
    const mainHolder = new Map<ColorRole, GeneratedPalette>();
    for (const [id, info] of paletteTokens) if (info.role && byId.has(id)) mainHolder.set(info.role, byId.get(id)!);
    return [...activeProductRoles].flatMap(([role, { paletteId, inherited }]) => {
      const p = byId.get(paletteId);
      const fallback = mainHolder.get(role);
      return p ? [{ role, inherited, palette: toRole(p), fallback: fallback && toRole(fallback) }] : [];
    });
  }, [activeProductRoles, generatedPalettes, paletteTokens]);

  /** Assigns a role in the active product; null hands it back to the first product's palette. */
  const assignProductRole = useCallback(
    (role: ColorRole, paletteId: string | null) => {
      if (paletteId) return setProductRole(activeProduct.id, paletteId, role);
      const own = activeProductRoles.get(role);
      if (own && !own.inherited) setProductRole(activeProduct.id, own.paletteId, 'none');
    },
    [activeProduct.id, activeProductRoles, setProductRole],
  );

  const inspector = isColor ? (
    activePalette && (
      <PaletteInspector
        key={activePalette.id}
        palette={activePalette}
        tokens={activeRoles.get(activePalette.id)}
        onChange={(updates) => updatePalette(activePalette.id, updates)}
        onSetRole={(role) => setActiveRole(activePalette.id, role)}
        product={
          inheritance && {
            name: activeProduct.name,
            from: inheritance.from,
            holders: productHolders,
            palettes: generatedPalettes.map((p) => ({ id: p.id, name: p.name, baseColor: p.baseColor, gray: p.role === 'gray' })),
            onAssign: assignProductRole,
          }
        }
      />
    )
  ) : foundation === 'typography' ? (
    <TypographyInspector
      config={foundations.typography}
      onChange={(u) => updateFoundation('typography', u)}
      products={{
        products,
        activeProductId: activeProduct.id,
        onSetFont: setProductFont,
      }}
    />
  ) : foundation === 'spacing' ? (
    <SpacingInspector config={foundations.spacing} onChange={(u) => updateFoundation('spacing', u)} />
  ) : foundation === 'radius' ? (
    <RadiusInspector
      config={foundations.radius}
      onChange={(u) => updateFoundation('radius', u)}
      product={
        isExtraProduct
          ? { name: activeProduct.name, from: products[0].name, base: activeProduct.radius, onChange: (base) => setProductField('radius', base) }
          : undefined
      }
    />
  ) : foundation === 'shadow' ? (
    <ShadowInspector
      config={foundations.shadow}
      accent={accent.solid}
      onChange={(u) => updateFoundation('shadow', u)}
      product={
        isExtraProduct
          ? {
              name: activeProduct.name,
              from: products[0].name,
              tint: activeProduct.shadowTint,
              brand: productBrand,
              onChange: (tint) => setProductField('shadowTint', tint),
            }
          : undefined
      }
    />
  ) : (
    <GridInspector config={foundations.grid} spacingBase={foundations.spacing.base} onChange={(u) => updateFoundation('grid', u)} />
  );

  const inspectorHeader = isColor ? (
    <>
      <FoundationInspectorHeader foundation="color" onReset={resetFoundation} />
      <PalettePicker
        {...sidebarProps}
      />
    </>
  ) : (
    <FoundationInspectorHeader foundation={foundation as Exclude<FoundationKey, 'color'>} onReset={resetFoundation} />
  );

  const showDockedInspector = isDesktop && !isPreview;

  const mobileNavContent = (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 pb-3">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Project</div>
        <div className="mt-1 truncate text-sm font-semibold">{activeProject.name}</div>
      </div>
      <FoundationNav active={section} summaries={summaries} onSelect={selectFoundation} />
      {/* Header actions that don't fit a phone's top bar */}
      <div className="mt-auto flex items-center gap-1 border-t p-2">
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="Undo" disabled={!history.canUndo} onClick={history.undo}>
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="Redo" disabled={!history.canRedo} onClick={history.redo}>
          <Redo2 />
        </Button>
        <ThemeMenu theme={theme} onChange={onThemeChange} />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => {
            setMobileNavOpen(false);
            setCommandOpen(true);
          }}
        >
          <CommandIcon /> All actions
        </Button>
      </div>
    </div>
  );

  // --- Command menu and shortcuts ---
  const commands: CommandAction[] = [
    ...NAV_ORDER.map((key, i) => ({
      id: `go-${key}`,
      group: 'Go to',
      label: NAV_META[key].label,
      icon: NAV_META[key].icon,
      shortcut: String(i + 1),
      run: () => selectFoundation(key),
    })),
    ...(isPreview
      ? []
      : ([
          ['editor', 'Editor', FOUNDATION_META[foundation].icon],
          ['tokens', 'Tokens', ListTree],
          ['docs', 'Docs', BookOpen],
        ] as const).map(([v, label, icon]) => ({
          id: `view-${v}`,
          group: `${FOUNDATION_META[foundation].label} view`,
          label: `${label}`,
          icon,
          run: () => setActiveView(v),
        }))),
    {
      id: 'mode',
      group: 'Context',
      label: isDarkMode ? 'Edit light tokens' : 'Edit dark tokens',
      icon: isDarkMode ? Sun : Moon,
      shortcut: '⇧D',
      keywords: ['mode', 'theme', 'light', 'dark'],
      run: toggleEditMode,
    },
    ...products
      .filter((p) => p.id !== activeProduct.id)
      .map((p) => ({ id: `product-${p.id}`, group: 'Context', label: `Switch to ${p.name}`, icon: PaletteIcon, keywords: ['product'], run: () => setActiveProductId(p.id) })),
    { id: 'add-product', group: 'Context', label: 'Add product', icon: Plus, keywords: ['mode'], run: addProduct },
    { id: 'add-palette', group: 'Palettes', label: 'Add palette', icon: Plus, run: addPalette },
    ...generatedPalettes.map((p) => ({
      id: `palette-${p.id}`,
      group: 'Palettes',
      label: `Edit ${p.name || 'Untitled'}`,
      icon: PaletteIcon,
      keywords: [p.baseColor],
      run: () => {
        setSection('color');
        setActiveView('editor');
        selectFromNav(p.id);
      },
    })),
    { id: 'undo', group: 'Edit', label: 'Undo', icon: Undo2, shortcut: '⌘Z', disabled: !history.canUndo, run: history.undo },
    { id: 'redo', group: 'Edit', label: 'Redo', icon: Redo2, shortcut: '⇧⌘Z', disabled: !history.canRedo, run: history.redo },
    { id: 'export', group: 'Project', label: 'Export tokens…', icon: Download, run: () => setExportOpen(true) },
    { id: 'save-version', group: 'Project', label: 'Save version', icon: Save, run: () => saveVersion() },
    { id: 'versions', group: 'Project', label: 'Version history', icon: History, run: () => setVersionsOpen(true) },
    { id: 'quick-start', group: 'Project', label: 'New project from brand color…', icon: Sparkles, run: () => setQuickStart('new') },
    { id: 'new-project', group: 'Project', label: 'New blank project', icon: FilePlus2, run: newBlankProject },
    ...projectStore.projects
      .filter((p) => p.id !== activeProject.id)
      .map((p) => ({ id: `project-${p.id}`, group: 'Project', label: `Open ${p.name}`, icon: FolderOpen, run: () => switchProject(p.id) })),
    { id: 'import', group: 'Project', label: 'Open project file…', icon: Upload, run: importProject },
    { id: 'download', group: 'Project', label: 'Download project file', icon: Download, run: downloadProject },
    { id: 'preview-window', group: 'App', label: 'Open preview in a new window', icon: AppWindow, run: openPreviewWindow },
    ...(['system', 'light', 'dark'] as const)
      .filter((t) => t !== theme)
      .map((t) => ({
        id: `theme-${t}`,
        group: 'App',
        label: `Interface theme: ${t[0].toUpperCase()}${t.slice(1)}`,
        icon: t === 'system' ? Monitor : t === 'light' ? Sun : Moon,
        run: () => onThemeChange(t),
      })),
    ...(showDockedInspector
      ? [{ id: 'panel', group: 'App', label: panelCollapsed ? 'Show controls' : 'Hide controls', icon: PanelLeft, shortcut: '⌘\\', run: () => setPanelCollapsed((c) => !c) }]
      : []),
  ];

  // Latest handlers for the one keydown listener, so it never needs re-binding
  const keys = useRef({ undo: history.undo, redo: history.redo, selectFoundation, toggleEditMode, togglePanel: () => setPanelCollapsed((c) => !c) });
  keys.current = { undo: history.undo, redo: history.redo, selectFoundation, toggleEditMode, togglePanel: () => setPanelCollapsed((c) => !c) };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
        return;
      }
      // Text fields keep their own undo and typing
      if (isTextEditing(e.target)) return;
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) keys.current.redo();
        else keys.current.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        keys.current.redo();
        return;
      }
      if (mod && e.key === '\\') {
        e.preventDefault();
        keys.current.togglePanel();
        return;
      }
      // Single keys only when nothing modal is open, so they don't fire behind a dialog or menu
      if (mod || e.altKey || document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      if (e.shiftKey && key === 'd') {
        e.preventDefault();
        keys.current.toggleEditMode();
        return;
      }
      if (!e.shiftKey && /^[1-7]$/.test(e.key)) {
        e.preventDefault();
        keys.current.selectFoundation(NAV_ORDER[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const editorTitle = FOUNDATION_META[foundation].title;
  const viewBlurb =
    activeView === 'tokens'
      ? 'Primitive → Base → Semantic. Primitives are locked raw values. Point any base or semantic token at another token in the tier below, or add your own. Changes apply to every export.'
      : activeView === 'docs'
        ? isColor
          ? 'Token names, values, contrast and recommended usage for every step, for the developers using them.'
          : 'Usage guidance and every value, for the developers using them.'
        : isColor
          ? (
              <>
                12-step {isDarkMode ? 'dark' : 'light'} scales on{' '}
                <span className="font-mono">{isDarkMode ? backgrounds.dark : backgrounds.light}</span> · click any swatch to copy
              </>
            )
          : FOUNDATION_META[foundation].blurb;

  const formatToggle = (
    <Tabs value={colorFormat} onValueChange={(v) => setColorFormat(v as ColorFormat)} className="gap-0">
      <TabsList className="h-7 rounded-lg" aria-label="Color format">
        <TabsTrigger value="hex" className="rounded-md px-2 font-mono text-[0.625rem]">
          HEX
        </TabsTrigger>
        <TabsTrigger value="oklch" className="rounded-md px-2 font-mono text-[0.625rem]">
          OKLCH
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const pageActions = (
    <>
      {isColor && activeView === 'editor' && (
        <BackgroundControl
          isDark={isDarkMode}
          value={isDarkMode ? backgrounds.dark : backgrounds.light}
          onChange={(color) => setBackgrounds((prev) => ({ ...prev, [isDarkMode ? 'dark' : 'light']: color }))}
        />
      )}
      {isColor && formatToggle}
      {!isDesktop && activeView === 'editor' && (
        <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => setInspectorOpen(true)}>
          <SlidersHorizontal /> Settings
        </Button>
      )}
    </>
  );

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* === Top bar: global only. Left is what you're editing, right is what you can do with it === */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar px-3 sm:gap-2.5">
        {!isDesktop && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <PanelLeft />
          </Button>
        )}

        {/* On desktop the mark sits in a rail-wide box so it lines up with the foundation icons below */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex md:-ml-3">
          <div className="flex justify-center md:w-[4.5rem]">
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
          <span className="text-[0.9375rem] font-semibold tracking-tight md:-ml-3">Lumina</span>
          <span className="rounded-full border px-1.5 py-px text-[0.625rem] font-medium text-muted-foreground max-xl:hidden">Beta</span>
        </div>

        <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

        <div className="flex min-w-0 items-center gap-1.5">
          <div className="min-w-0 shrink max-sm:hidden [&>button]:max-w-full">
            <ProjectMenu
              projects={projectStore.projects}
              activeId={activeProject.id}
              onSwitch={switchProject}
              onNew={newBlankProject}
              onQuickStart={() => setQuickStart('new')}
              onRename={renameProject}
              onDuplicate={duplicateProject}
              onDelete={deleteProject}
              onSaveVersion={saveVersion}
              onRestoreVersion={restoreVersion}
              onDeleteVersion={deleteVersion}
              onImport={importProject}
              onDownload={downloadProject}
              versionsOpen={versionsOpen}
              onVersionsOpenChange={setVersionsOpen}
            />
          </div>
          <ContextBar
            products={products}
            activeProductId={activeProduct.id}
            onSelectProduct={setActiveProductId}
            onAddProduct={addProduct}
            onRenameProduct={renameProduct}
            onRemoveProduct={removeProduct}
            mode={editMode}
            onModeChange={setEditMode}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <div className="flex items-center max-sm:hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label="Undo"
                  disabled={!history.canUndo}
                  onClick={history.undo}
                >
                  <Undo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Undo <span className="ml-1 font-mono opacity-60">⌘Z</span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  aria-label="Redo"
                  disabled={!history.canRedo}
                  onClick={history.redo}
                >
                  <Redo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Redo <span className="ml-1 font-mono opacity-60">⇧⌘Z</span>
              </TooltipContent>
            </Tooltip>
          </div>

          <span aria-hidden className="mx-1 h-5 w-px bg-border max-sm:hidden" />

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-2 text-muted-foreground max-xl:size-8 max-xl:border-0 max-xl:bg-transparent max-xl:px-0 max-xl:shadow-none max-sm:hidden"
            onClick={() => setCommandOpen(true)}
            aria-label="Command menu"
            title="Command menu · ⌘K"
          >
            <CommandIcon />
            <span className="text-xs max-xl:hidden">Search</span>
            <kbd className="rounded border bg-muted px-1 font-mono text-[0.625rem] max-xl:hidden">⌘K</kbd>
          </Button>

          <div className="max-md:hidden">
            <PresetsMenu palettes={palettes} foundations={foundations} onLoad={loadPreset} onMerge={mergePreset} />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground max-md:hidden"
                onClick={openPreviewWindow}
                aria-label="Open preview in a new window"
              >
                <AppWindow />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Preview in a new window, live while you edit</TooltipContent>
          </Tooltip>

          <div className="max-md:hidden">
            <ThemeMenu theme={theme} onChange={onThemeChange} />
          </div>

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
              active={section}
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
                    <TooltipContent side="right">
                      {panelCollapsed ? 'Show controls' : 'Hide controls'} <span className="ml-1 font-mono opacity-60">⌘\</span>
                    </TooltipContent>
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

        {/* The canvas renders in the mode being edited, whatever the interface theme */}
        <main
          ref={mainRef}
          className={cn('scrollbar-thin relative min-w-0 flex-1 overflow-y-auto bg-background text-foreground', editMode)}
          aria-label={`Canvas, ${editMode} mode`}
        >
          {/* Preview pages get the full width, so the desktop frame scales down as little as possible */}
          <div className={cn('mx-auto px-4 py-6 sm:px-6 md:px-8 md:py-8', !isPreview && 'max-w-6xl')}>
            {isPreview ? (
              <PreviewSection
                palettes={generatedPalettes}
                activePaletteId={activePalette?.id}
                activeProductId={activeProduct.id}
                foundations={foundations}
                isDark={isDarkMode}
              />
            ) : (
              <>
                <PageHeader
                  title={activeView === 'tokens' ? `${FOUNDATION_META[foundation].label} tokens` : activeView === 'docs' ? `${FOUNDATION_META[foundation].label} reference` : editorTitle}
                  blurb={viewBlurb}
                  view={activeView}
                  onViewChange={setActiveView}
                  editorIcon={FOUNDATION_META[foundation].icon}
                  actions={pageActions}
                />
                {activeView === 'tokens' ? (
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
                ) : activeView === 'docs' ? (
                  isColor ? (
                    <PaletteDocumentation palettes={generatedPalettes} colorFormat={colorFormat} />
                  ) : (
                    <FoundationDocs foundation={foundation} foundations={productFoundations} isDark={isDarkMode} accent={accent} />
                  )
                ) : isColor ? (
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
                ) : foundation === 'typography' ? (
                  <TypographyCanvas config={productFoundations.typography} />
                ) : foundation === 'spacing' ? (
                  <SpacingCanvas config={foundations.spacing} accent={accent} />
                ) : foundation === 'radius' ? (
                  <RadiusCanvas config={productFoundations.radius} accent={accent} />
                ) : foundation === 'shadow' ? (
                  <ShadowCanvas config={productFoundations.shadow} isDark={isDarkMode} radius={resolved.radius.lg} />
                ) : (
                  <GridCanvas config={foundations.grid} accent={accent} />
                )}
              </>
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

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} actions={commands} />

      <QuickStartDialog
        open={quickStart !== null}
        onOpenChange={(open) => !open && setQuickStart(null)}
        createsProject={quickStart === 'new'}
        onCreate={finishQuickStart}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        palettes={generatedPalettes}
        colorFormat={colorFormat}
        foundations={foundations}
        initialScope={isPreview ? 'all' : foundation}
      />
    </div>
  );
}

function FoundationInspectorHeader({ foundation, onReset }: { foundation: FoundationKey; onReset?: () => void }) {
  const { label, icon: Icon } = FOUNDATION_META[foundation];
  return (
    <div className="sticky top-0 z-10 flex h-11 items-center justify-between gap-2 border-b bg-sidebar/95 px-5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" />
        {label} settings
      </div>
      {onReset && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-1.5 size-7 text-muted-foreground hover:text-foreground"
              onClick={onReset}
              aria-label={`Reset ${label}`}
            >
              <RotateCcw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset to defaults · can be undone</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
