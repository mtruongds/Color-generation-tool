export interface PaletteConfig {
  id: string;
  name: string;
  baseColor: string;
  isDark: boolean;
  hueShift: number;
  saturationScale: number;
  lockStep9: boolean;
  description?: string;
}

export interface SavedPreset {
  id: string;
  name: string;
  palettes: PaletteConfig[];
  createdAt: number;
}
