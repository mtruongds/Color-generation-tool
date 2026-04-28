import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Sliders,
  Plus,
  Trash2,
  Copy,
  Moon,
  Sun,
  Save,
  FolderOpen,
  BookOpen,
  Edit3,
  Download,
  Upload,
  ArrowUp,
  Check,
  PanelLeftClose,
  PanelLeft,
  Menu,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";
import { ScrollArea } from "../ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import {
  generateScale,
  ColorScale,
  getColorScaleInfo,
  generateAlphaScale,
  getStepDescription,
  getOptimizedStep9,
  formatColor,
  ColorFormat,
} from "../../lib/color-utils";
import { toast } from "sonner";
import { copyToClipboard } from "../../lib/clipboard";
import { PaletteDisplay } from "./PaletteDisplay";
import { PaletteDocumentation } from "./PaletteDocumentation";
import { useIsMobile } from "../ui/use-mobile";
import type { PaletteConfig, SavedPreset } from "./types";

// Re-export for backward compat
export type { PaletteConfig } from "./types";

// ============================================================
// Main Component
// ============================================================

const hexToComponents = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
};

export function PaletteGenerator({
  isDarkMode,
  toggleDarkMode,
}: {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}) {
  // --- Palette state ---
  const [palettes, setPalettes] = useState<PaletteConfig[]>([
    {
      id: "1",
      name: "Primary",
      baseColor: "#3e63dd",
      isDark: false,
      hueShift: 0,
      saturationScale: 1,
      lockStep9: false,
    },
    {
      id: "2",
      name: "Neutral",
      baseColor: "#71717a",
      isDark: false,
      hueShift: 0,
      saturationScale: 1,
      lockStep9: false,
    },
  ]);

  const prevIsDarkMode = useRef(isDarkMode);
  useEffect(() => {
    if (prevIsDarkMode.current !== isDarkMode) {
      prevIsDarkMode.current = isDarkMode;
      setPalettes((prev) =>
        prev.map((p) => ({ ...p, isDark: isDarkMode })),
      );
    }
  }, [isDarkMode]);

  const [activePaletteId, setActivePaletteId] =
    useState<string>("1");
  const [activeView, setActiveView] = useState<
    "editor" | "docs"
  >("editor");

  // --- Preset state ---
  const [savedPresets, setSavedPresets] = useState<
    SavedPreset[]
  >([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] =
    useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [isManageDialogOpen, setIsManageDialogOpen] =
    useState(false);

  // --- UI state ---
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const [colorFormat, setColorFormat] =
    useState<ColorFormat>("hex");

  // Scroll tracking
  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;
    const handleScroll = () =>
      setShowGoToTop(el.scrollTop > 400);
    el.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    mainContentRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  // Load presets
  useEffect(() => {
    const saved = localStorage.getItem("radixgen_presets");
    if (saved) {
      try {
        setSavedPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse presets", e);
      }
    }
  }, []);

  // --- Actions ---
  const savePreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    const newPreset: SavedPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPresetName,
      palettes,
      createdAt: Date.now(),
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem(
      "radixgen_presets",
      JSON.stringify(updated),
    );
    setNewPresetName("");
    setIsSaveDialogOpen(false);
    toast.success("Preset saved successfully!");
  }, [newPresetName, palettes, savedPresets]);

  const loadPreset = useCallback((preset: SavedPreset) => {
    const migrated = preset.palettes.map((p) => ({
      ...p,
      lockStep9: p.lockStep9 ?? false,
    }));
    setPalettes(migrated);
    if (preset.palettes.length > 0)
      setActivePaletteId(preset.palettes[0].id);
    setIsManageDialogOpen(false);
    toast.success(`Loaded "${preset.name}"`);
  }, []);

  const deletePreset = useCallback((id: string) => {
    const updated = savedPresets.filter((p) => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem(
      "radixgen_presets",
      JSON.stringify(updated),
    );
    toast.success("Preset deleted");
  }, [savedPresets]);

  const exportPresets = useCallback(() => {
    const data = {
      _meta: {
        app: "Lumina",
        version: 1,
        exportedAt: new Date().toISOString(),
      },
      presets: savedPresets,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumina-presets-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${savedPresets.length} preset(s)`);
  }, [savedPresets]);


  const importPresets = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string);
          let incoming: SavedPreset[] = [];
          if (raw._meta && Array.isArray(raw.presets))
            incoming = raw.presets;
          else if (Array.isArray(raw)) incoming = raw;
          else throw new Error("Unrecognized format");
          for (const p of incoming) {
            if (!p.id || !p.name || !Array.isArray(p.palettes))
              throw new Error("Invalid preset structure");
          }
          const existingIds = new Set(
            savedPresets.map((p) => p.id),
          );
          const newPresets = incoming.filter(
            (p) => !existingIds.has(p.id),
          );
          const merged = [...savedPresets, ...newPresets];
          setSavedPresets(merged);
          localStorage.setItem(
            "radixgen_presets",
            JSON.stringify(merged),
          );
          toast.success(
            `Imported ${newPresets.length} new preset(s)${incoming.length - newPresets.length > 0 ? `, ${incoming.length - newPresets.length} duplicate(s) skipped` : ""}`,
          );
        } catch (err) {
          console.error("Import failed", err);
          toast.error(
            "Import failed — invalid or corrupted file.",
          );
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [savedPresets]);

  const generatedPalettes = useMemo(() => {
    return palettes.map((p) => ({
      ...p,
      scale: generateScale(p.baseColor, p.name, p.isDark, {
        hueShift: p.hueShift,
        saturationScale: p.saturationScale,
        lockStep9: p.lockStep9,
      }),
    }));
  }, [palettes]);

  // Auto-scroll
  useEffect(() => {
    if (!activePaletteId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(
        `palette-${activePaletteId}`,
      );
      const container = mainContentRef.current;
      if (el && container) {
        const offset = -40;
        const elTop = el.offsetTop - container.offsetTop;
        container.scrollTo({
          top: Math.max(0, elTop - offset),
          behavior: "smooth",
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activePaletteId]);

  const updatePalette = useCallback((
    id: string,
    updates: Partial<PaletteConfig>,
  ) => {
    setPalettes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  }, []);

  const addPalette = useCallback(() => {
    const newId = Math.random().toString(36).substr(2, 9);
    setPalettes((prev) => [
      ...prev,
      {
        id: newId,
        name: "New Color",
        baseColor: "#10b981",
        isDark: false,
        hueShift: 0,
        saturationScale: 1,
        lockStep9: false,
      },
    ]);
    setActivePaletteId(newId);
  }, []);

  const removePalette = useCallback((id: string) => {
    if (palettes.length <= 1) {
      toast.error("You must have at least one palette.");
      return;
    }
    setPalettes((prev) => prev.filter((p) => p.id !== id));
    if (activePaletteId === id)
      setActivePaletteId(palettes[0].id);
  }, [palettes, activePaletteId]);

  // --- CSS / JSON generators ---
  const generateCssVariables = useCallback(() => {
    let css = ":root {\n  /* Solid Colors */\n";
    generatedPalettes.forEach((p) => {
      p.scale.colors.forEach((color, i) => {
        const value = formatColor(color, colorFormat);
        css += `  --${p.name.toLowerCase().replace(/\s+/g, "-")}-${i + 1}: ${value};\n`;
      });
    });
    css += "\n  /* Alpha Colors */\n";
    generatedPalettes.forEach((p) => {
      const alphaScale = generateAlphaScale(p.scale, p.isDark);
      alphaScale.colors.forEach((alpha, i) => {
        css += `  --${p.name.toLowerCase().replace(/\s+/g, "-")}-a${i + 1}: ${alpha.rgba};\n`;
      });
    });
    css += "}";
    return css;
  }, [generatedPalettes, colorFormat]);

  const generateJson = useCallback(() => {
    const obj: Record<
      string,
      Record<
        string,
        { value: string; type: string; description: string }
      >
    > = {};
    generatedPalettes.forEach((p) => {
      const name = p.name.toLowerCase().replace(/\s+/g, "-");
      const alphaScale = generateAlphaScale(p.scale, p.isDark);
      const tokens: Record<
        string,
        { value: string; type: string; description: string }
      > = {};
      p.scale.colors.forEach((color, i) => {
        tokens[`${i + 1}`] = {
          value: formatColor(color, colorFormat),
          type: "color",
          description: getStepDescription(i + 1, p.name, false),
        };
      });
      alphaScale.colors.forEach((alpha, i) => {
        tokens[`a${i + 1}`] = {
          value: alpha.rgba,
          type: "color",
          description: getStepDescription(i + 1, p.name, true),
        };
      });
      obj[name] = tokens;
    });
    return JSON.stringify(obj, null, 2);
  }, [generatedPalettes, colorFormat]);

  const generateFigmaJson = useCallback(() => {
    const obj: any = {};

    generatedPalettes.forEach((p) => {
      const name = p.name.toLowerCase().replace(/\s+/g, "-");
      const alphaScale = generateAlphaScale(p.scale, p.isDark);
      const tokens: any = {};

      p.scale.colors.forEach((color, i) => {
        tokens[`${i + 1}`] = {
          "$type": "color",
          "$value": {
            "colorSpace": "srgb",
            "components": hexToComponents(color),
            "alpha": 1,
            "hex": color
          },
          "$description": getStepDescription(i + 1, p.name, false),
          "$extensions": {
            "com.figma.scopes": ["ALL_SCOPES"],
            "com.figma.isOverride": true
          }
        };
      });

      alphaScale.colors.forEach((alpha, i) => {
        tokens[`a${i + 1}`] = {
          "$type": "color",
          "$value": {
            "colorSpace": "srgb",
            "components": [alpha.r / 255, alpha.g / 255, alpha.b / 255],
            "alpha": alpha.alpha,
            "hex": alpha.hex8
          },
          "$description": getStepDescription(i + 1, p.name, true),
          "$extensions": {
            "com.figma.scopes": ["ALL_SCOPES"],
            "com.figma.isOverride": true
          }
        };
      });

      obj[name] = tokens;
    });

    return JSON.stringify({
      Color: {
        ...obj,
        "$extensions": {
          "com.figma.collectionName": "Color",
          "com.figma.modeName": "Mode 1"
        }
      }
    }, null, 2);
  }, [generatedPalettes]);

  const exportFigmaTokens = useCallback(() => {
    const jsonStr = generateFigmaJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Color.tokens.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Figma tokens downloaded");
  }, [generateFigmaJson]);

  const activePalette = palettes.find(
    (p) => p.id === activePaletteId,
  );

  // --- Sidebar content (shared between desktop sidebar and mobile sheet) ---
  const sidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* Logo row */}
      <div
        className={`flex items-center ${collapsed ? "justify-center px-[0.5rem]" : "justify-between px-[1rem]"} py-[0.875rem] border-b border-border`}
      >
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-[1.75rem] w-[1.75rem] rounded-md bg-primary flex items-center justify-center cursor-default">
                <Sliders className="h-[1rem] w-[1rem] text-primary-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Lumina</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <div className="flex items-center gap-[0.75rem]">
              <div className="h-[1.75rem] w-[1.75rem] rounded-md bg-primary flex items-center justify-center">
                <Sliders className="h-[1rem] w-[1rem] text-primary-foreground" />
              </div>
              <span className="text-[1.125rem] font-semibold tracking-tight">
                Lumina
              </span>
              <span className="px-[0.375rem] py-[0.125rem] text-[0.625rem] font-medium bg-primary/10 text-primary rounded border border-primary/20">
                Beta
              </span>
            </div>
          </>
        )}
      </div>

      {/* Palette list */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto flex flex-col ${collapsed ? "px-[0.5rem]" : "px-[1rem]"} pt-[1rem]`}
      >
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-[0.25rem]`}
        >
          {!collapsed && (
            <h3 className="text-[0.75rem] font-semibold text-muted-foreground uppercase tracking-wider">
              Palettes
            </h3>
          )}
          {collapsed ? (
            <div className="flex items-center gap-[0.25rem] flex-wrap justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleDarkMode}
                    className="h-[1.75rem] w-[1.75rem] hover:bg-primary/10"
                  >
                    {isDarkMode ? (
                      <Sun className="h-[0.875rem] w-[0.875rem]" />
                    ) : (
                      <Moon className="h-[0.875rem] w-[0.875rem]" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={addPalette}
                    className="h-[1.75rem] w-[1.75rem] hover:bg-primary/10 hover:text-primary"
                  >
                    <Plus className="h-[0.875rem] w-[0.875rem]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Add Palette
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-[0.25rem]">
              <Button
                variant="ghost"
                size="sm"
                onClick={addPalette}
                className="h-[1.75rem] text-[0.75rem] hover:bg-primary/10 hover:text-primary"
              >
                <Plus className="h-[0.875rem] w-[0.875rem] mr-[0.25rem]" />{" "}
                Add
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="h-[1.75rem] w-[1.75rem] hover:bg-primary/10"
              >
                {isDarkMode ? (
                  <Sun className="h-[0.875rem] w-[0.875rem]" />
                ) : (
                  <Moon className="h-[0.875rem] w-[0.875rem]" />
                )}
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col over gap-[0.375rem] py-[0.5rem]">
            {palettes.map((palette) =>
              collapsed ? (
                <Tooltip key={palette.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={`h-[1.5rem] w-[1.5rem] mx-auto rounded-md border-2 transition-all cursor-pointer hover:scale-110 ${activePaletteId === palette.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent hover:border-border"
                        }`}
                      style={{
                        backgroundColor: palette.baseColor,
                      }}
                      onClick={() =>
                        setActivePaletteId(palette.id)
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span className="font-medium">
                      {palette.name}
                    </span>
                    <span className="ml-[0.5rem] font-mono text-[0.625rem] opacity-70">
                      {palette.baseColor}
                    </span>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div
                  key={palette.id}
                  className={`group flex items-center gap-[0.75rem] p-[0.625rem] rounded-lg border transition-all cursor-pointer hover:bg-accent/50 ${activePaletteId === palette.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-transparent hover:border-border"
                    }`}
                  onClick={() => setActivePaletteId(palette.id)}
                >
                  <div
                    className="h-[2.25rem] w-[2.25rem] rounded-md shadow-sm border border-border flex-shrink-0"
                    style={{
                      backgroundColor: palette.baseColor,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[0.875rem] truncate">
                      {palette.name}
                    </div>
                    <div className="text-[0.75rem] text-muted-foreground font-mono">
                      {palette.baseColor}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 h-[1.75rem] w-[1.75rem] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      removePalette(palette.id);
                    }}
                  >
                    <Trash2 className="h-[0.875rem] w-[0.875rem]" />
                  </Button>
                </div>
              ),
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Active palette config (expanded only) */}
      {!collapsed && activePalette && (
        <div className="min-h-0 overflow-y-auto border-t border-border px-[1rem] py-[1rem]" style={{ height: "27rem" }}>
          <div className="space-y-[1rem]">
            <h3 className="text-[0.75rem] font-semibold text-muted-foreground uppercase tracking-wider">
              Configuration
            </h3>

            {/* Name */}
            <div className="space-y-[0.375rem]">
              <Label className="text-[0.75rem] text-muted-foreground">
                Name
              </Label>
              <Input
                value={activePalette.name}
                onChange={(e) =>
                  updatePalette(activePaletteId, {
                    name: e.target.value,
                  })
                }
                className="bg-muted/30 border-border h-[2.25rem] text-[0.875rem]"
              />
            </div>

            {/* Description */}
            <div className="space-y-[0.375rem]">
              <Label className="text-[0.75rem] text-muted-foreground">
                Description
              </Label>
              <Textarea
                className="min-h-[4.375rem] text-[0.75rem] resize-none bg-muted/30 border-border"
                placeholder="e.g. Used for primary actions."
                value={activePalette.description || ""}
                onChange={(e) =>
                  updatePalette(activePaletteId, {
                    description: e.target.value,
                  })
                }
              />
            </div>

            {/* Lock Step 9 */}
            <div
              className="space-y-[0.375rem] p-[1rem] rounded-lg"
              style={{
                backgroundColor: generatedPalettes.find(
                  (p) => p.name.toLowerCase() === "neutral",
                )?.scale.colors[1],
              }}
            >
              <div className="flex items-center justify-between py-[0.25rem]">
                <Label className="flex items-center gap-[0.5rem] text-[0.75rem] text-muted-foreground">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {activePalette.lockStep9 ? (
                      <>
                        <rect
                          x="3"
                          y="11"
                          width="18"
                          height="11"
                          rx="2"
                          ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </>
                    ) : (
                      <>
                        <path d="M12 2a6 6 0 0 0-6 6v4" />
                        <rect
                          x="3"
                          y="12"
                          width="18"
                          height="10"
                          rx="2"
                        />
                        <circle cx="12" cy="17" r="1" />
                      </>
                    )}
                  </svg>
                  Lock Key Color (Step 9)
                </Label>
                <Switch
                  checked={activePalette.lockStep9}
                  onCheckedChange={(checked: boolean) =>
                    updatePalette(activePaletteId, {
                      lockStep9: checked,
                    })
                  }
                />
              </div>

              {/* Base color */}
              <div className="space-y-[0.375rem]">
                <Label className="text-[0.75rem] text-muted-foreground">
                  Base Color
                </Label>
                <div className="flex gap-[0.5rem]">
                  <Input
                    type="color"
                    className="w-[3rem] p-[0.25rem] h-[2.25rem] cursor-pointer border-border bg-muted/30"
                    value={activePalette.baseColor}
                    onChange={(e) =>
                      updatePalette(activePaletteId, {
                        baseColor: e.target.value,
                      })
                    }
                  />
                  <Input
                    value={activePalette.baseColor}
                    onChange={(e) =>
                      updatePalette(activePaletteId, {
                        baseColor: e.target.value,
                      })
                    }
                    className="bg-muted/30 border-border h-[2.25rem] font-mono text-[0.875rem]"
                  />
                </div>
              </div>

              {/* Dark Mode */}

              {/* Optimization delta */}
              {!activePalette.lockStep9 &&
                (() => {
                  const opt = getOptimizedStep9(
                    activePalette.baseColor,
                    activePalette.isDark,
                  );
                  if (opt.delta === 0) return null;
                  return (
                    <div className="rounded-lg p-[0.625rem] border bg-muted/50 dark:bg-muted/30 border-border">
                      <div className="flex items-start gap-[0.5rem]">
                        <div className="flex items-center gap-[0.375rem] flex-shrink-0 mt-[0.125rem]">
                          <div
                            className="h-[1rem] w-[1rem] rounded border border-border/50"
                            style={{
                              backgroundColor:
                                activePalette.baseColor,
                            }}
                          />
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="text-muted-foreground"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                          <div
                            className="h-[1rem] w-[1rem] rounded border border-border/50"
                            style={{
                              backgroundColor: opt.color,
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.6875rem] font-medium text-foreground">
                            Auto-optimized
                          </div>
                          <div className="text-[0.625rem] text-muted-foreground font-mono">
                            L: {opt.originalL}% →{" "}
                            {opt.optimizedL}% (
                            {opt.delta > 0 ? "+" : ""}
                            {opt.delta}%)
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* Scale optimization indicator */}
            {(() => {
              const scaleInfo = getColorScaleInfo(
                activePalette.baseColor,
                activePalette.isDark,
              );
              if (!scaleInfo.isOptimized) return null;
              const isDarkScale = activePalette.isDark;
              return (
                <div
                  className={`rounded-lg p-[0.75rem] border ${isDarkScale
                    ? "bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800"
                    : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                    }`}
                >
                  <div className="flex items-start gap-[0.5rem]">
                    <div
                      className={`h-[1.25rem] w-[1.25rem] rounded-full flex items-center justify-center flex-shrink-0 mt-[0.125rem] ${isDarkScale ? "bg-violet-500" : "bg-blue-500"}`}
                    >
                      {isDarkScale ? (
                        <Moon className="h-[0.75rem] w-[0.75rem] text-white" />
                      ) : (
                        <Check className="h-[0.75rem] w-[0.75rem] text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[0.75rem] font-medium capitalize ${isDarkScale ? "text-violet-900 dark:text-violet-100" : "text-blue-900 dark:text-blue-100"}`}
                      >
                        {isDarkScale
                          ? "Radix Dark Mode"
                          : scaleInfo.scaleType}{" "}
                        Optimization Active
                      </div>
                      <div
                        className={`text-[0.75rem] mt-[0.125rem] ${isDarkScale ? "text-violet-700 dark:text-violet-300" : "text-blue-700 dark:text-blue-300"}`}
                      >
                        {scaleInfo.description}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Adjustments */}
            <div className="space-y-[0.75rem] pt-[0.75rem] border-t">
              <Label className="text-[0.75rem] uppercase font-semibold text-muted-foreground">
                Easing & Adjustments
              </Label>
              <div className="space-y-[0.75rem]">
                <div className="space-y-[0.25rem]">
                  <div className="flex justify-between">
                    <Label className="text-[0.75rem]">
                      Hue Shift
                    </Label>
                    <span className="text-[0.75rem] text-muted-foreground">
                      {activePalette.hueShift}°
                    </span>
                  </div>
                  <Slider
                    min={-180}
                    max={180}
                    step={1}
                    value={[activePalette.hueShift]}
                    onValueChange={(v: number[]) =>
                      updatePalette(activePaletteId, {
                        hueShift: v[0],
                      })
                    }
                  />
                </div>
                <div className="space-y-[0.25rem]">
                  <div className="flex justify-between">
                    <Label className="text-[0.75rem]">
                      Saturation Boost
                    </Label>
                    <span className="text-[0.75rem] text-muted-foreground">
                      {activePalette.saturationScale}x
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={2}
                    step={0.05}
                    value={[activePalette.saturationScale]}
                    onValueChange={(v: number[]) =>
                      updatePalette(activePaletteId, {
                        saturationScale: v[0],
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle (desktop only, not in mobile sheet) */}
      {!isMobile && (
        <div className="border-t border-border py-[0.5rem] px-[0.75rem] flex justify-start">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-[1.75rem] w-[1.75rem] text-muted-foreground"
                onClick={() =>
                  setSidebarCollapsed((prev) => !prev)
                }
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="h-[1rem] w-[1rem]" />
                ) : (
                  <PanelLeftClose className="h-[1rem] w-[1rem]" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex h-screen w-full min-w-[30.375rem] flex-col bg-background text-foreground overflow-hidden">
      {/* === Top Bar === */}
      <header className="h-[3.25rem] flex items-center justify-between px-[1rem] border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-[0.75rem]">
          {/* Mobile hamburger */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-[2rem] w-[2rem]"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-[1.125rem] w-[1.125rem]" />
            </Button>
          )}
          {/* Editor / Docs toggle */}
          <Tabs
            value={activeView}
            onValueChange={(v: string) =>
              setActiveView(v as "editor" | "docs")
            }
            className="flex-col-0 gap-0"
          >
            <TabsList className="h-[2.3rem] rounded-lg bg-muted/50 border p-[0.25rem]">
              <TabsTrigger
                value="editor"
                className="gap-[0.5rem] px-[1rem] h-[1.75rem] text-[0.8125rem] rounded-md"
              >
                <Edit3 className="h-[0.875rem] w-[0.875rem]" />
                Editor
              </TabsTrigger>
              <TabsTrigger
                value="docs"
                className="gap-[0.5rem] px-[1rem] h-[1.75rem] text-[0.8125rem] rounded-md"
              >
                <BookOpen className="h-[0.875rem] w-[0.875rem]" />
                Docs
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-[0.375rem]">
          {/* Color format toggle */}
          <Tabs
            value={colorFormat}
            onValueChange={(v: string) =>
              setColorFormat(v as "hex" | "oklch")
            }
            className="mr-[0.25rem]"
          >
            <TabsList className="h-[1.75rem] rounded-md bg-muted p-[0.125rem]">
              <TabsTrigger
                value="hex"
                className="h-[1.5rem] text-[0.6875rem] px-[0.5rem] font-mono rounded-sm"
              >
                HEX
              </TabsTrigger>
              <TabsTrigger
                value="oklch"
                className="h-[1.5rem] text-[0.6875rem] px-[0.5rem] font-mono rounded-sm"
              >
                OKLCH
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-[0.375rem] h-[1.75rem] text-[0.8125rem]"
              >
                <Copy className="h-[0.875rem] w-[0.875rem]" />{" "}
                Export CSS
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[25rem] p-0"
              align="end"
            >
              <div className="p-[1rem] bg-muted border-b flex justify-between items-center">
                <span className="font-medium text-[0.875rem]">
                  CSS Variables
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copyToClipboard(generateCssVariables())
                  }
                >
                  Copy
                </Button>
              </div>
              <pre className="p-[1rem] text-[0.75rem] overflow-auto max-h-[18.75rem] bg-zinc-950 text-zinc-50">
                {generateCssVariables()}
              </pre>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-[0.375rem] h-[1.75rem] text-[0.8125rem]"
              >
                <Copy className="h-[0.875rem] w-[0.875rem]" />{" "}
                Export JSON
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[25rem] p-0"
              align="end"
            >
              <div className="p-[1rem] bg-muted border-b flex justify-between items-center">
                <span className="font-medium text-[0.875rem]">
                  JSON
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copyToClipboard(generateJson())
                  }
                >
                  Copy
                </Button>
              </div>
              <pre className="p-[1rem] text-[0.75rem] overflow-auto max-h-[18.75rem] bg-zinc-950 text-zinc-50">
                {generateJson()}
              </pre>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className="gap-[0.375rem] h-[1.75rem] text-[0.8125rem]"
            onClick={exportFigmaTokens}
          >
            <Download className="h-[0.875rem] w-[0.875rem]" />{" "}
            Export Figma
          </Button>

          <Dialog
            open={isSaveDialogOpen}
            onOpenChange={setIsSaveDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-[0.375rem] h-[1.75rem] text-[0.8125rem]"
              >
                <Save className="h-[0.875rem] w-[0.875rem]" />{" "}
                Save
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Preset</DialogTitle>
                <DialogDescription>
                  Save your current palette configuration to
                  access it later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-[1rem] py-[1rem]">
                <div className="grid grid-cols-4 items-center gap-[1rem]">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newPresetName}
                    onChange={(e) =>
                      setNewPresetName(e.target.value)
                    }
                    className="col-span-3"
                    placeholder="My Awesome Theme"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={savePreset}>
                  Save Preset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isManageDialogOpen}
            onOpenChange={setIsManageDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-[0.375rem] h-[1.75rem] text-[0.8125rem]"
              >
                <FolderOpen className="h-[0.875rem] w-[0.875rem]" />{" "}
                Load
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Saved Presets</DialogTitle>
                <DialogDescription>
                  Manage your saved palette configurations.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[18.75rem] pr-[1rem]">
                {savedPresets.length === 0 ? (
                  <div className="text-center py-[2rem] text-muted-foreground">
                    No saved presets found.
                  </div>
                ) : (
                  <div className="flex flex-col gap-[0.5rem]">
                    {savedPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between p-[0.75rem] rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div
                          className="flex flex-col gap-[0.25rem] cursor-pointer flex-1"
                          onClick={() => loadPreset(preset)}
                        >
                          <span className="font-medium">
                            {preset.name}
                          </span>
                          <span className="text-[0.75rem] text-muted-foreground">
                            {new Date(
                              preset.createdAt,
                            ).toLocaleDateString()}{" "}
                            · {preset.palettes.length} scales
                          </span>
                        </div>
                        <div className="flex items-center gap-[0.5rem]">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadPreset(preset)}
                          >
                            Load
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-[2rem] w-[2rem] text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              deletePreset(preset.id)
                            }
                          >
                            <Trash2 className="h-[1rem] w-[1rem]" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="flex items-center gap-[0.5rem] pt-[1rem] border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-[0.5rem] flex-1"
                  onClick={exportPresets}
                  disabled={savedPresets.length === 0}
                >
                  <Download className="h-[0.875rem] w-[0.875rem]" />{" "}
                  Export All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-[0.5rem] flex-1"
                  onClick={importPresets}
                >
                  <Upload className="h-[0.875rem] w-[0.875rem]" />{" "}
                  Import
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* === Body === */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside
            className={`flex flex-col border-r border-border bg-card flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${sidebarCollapsed ? "w-[3.5rem]" : "w-[20rem]"
              }`}
          >
            {sidebarContent(sidebarCollapsed)}
          </aside>
        )}

        {/* Mobile sheet */}
        {isMobile && (
          <Sheet
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
          >
            <SheetContent side="left" className="w-[20rem] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>
                  Palette configuration sidebar
                </SheetDescription>
              </SheetHeader>
              {sidebarContent(false)}
            </SheetContent>
          </Sheet>
        )}

        {/* Main content */}
        <div
          ref={mainContentRef}
          className="flex-1 overflow-y-auto bg-background relative"
        >
          <div className="max-w-[72rem] mx-auto p-[1.5rem] md:p-[2rem] space-y-[1.5rem]">
            {activeView === "editor" ? (
              generatedPalettes.map((palette) => (
                <PaletteDisplay
                  key={palette.id}
                  palette={palette}
                  colorFormat={colorFormat}
                />
              ))
            ) : (
              <PaletteDocumentation
                palettes={generatedPalettes}
                colorFormat={colorFormat}
              />
            )}
          </div>

          {/* Go to top */}
          {showGoToTop && (
            <button
              onClick={scrollToTop}
              className="fixed bottom-[1.5rem] right-[1.5rem] z-50 flex items-center gap-[0.5rem] px-[1rem] py-[0.625rem] rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-300 opacity-90 hover:opacity-100 hover:shadow-xl cursor-pointer"
              aria-label="Go to top"
            >
              <ArrowUp className="h-[1rem] w-[1rem]" />
              <span className="text-[0.875rem] hidden sm:inline">
                Top
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}