import type { PaletteRole } from '../../lib/color-utils';

export interface PaletteConfig {
  id: string;
  name: string;
  baseColor: string;
  isDark: boolean;
  hueShift: number;
  saturationScale: number;
  lockStep9: boolean;
  /** 'gray' fits only the Radix gray scales. Missing on older saves, which means 'accent'. */
  role?: PaletteRole;
  /** Default palettes (Primary and the default gray) can't be deleted or change role. */
  locked?: boolean;
  description?: string;
}

export interface SavedPreset {
  id: string;
  name: string;
  palettes: PaletteConfig[];
  createdAt: number;
}
