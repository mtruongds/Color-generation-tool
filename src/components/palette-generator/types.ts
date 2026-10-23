import type { PaletteRole } from '../../lib/color-utils';
import type { Foundations } from '../../lib/foundations';
import type { ColorRole } from '../../lib/tokens';

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
  description?: string;
  /**
   * Base token role this palette fills (brand-1, brand-secondary-9, success-9, …). Missing means
   * "guess" by name, then brand and neutral go to the first free accent and gray. 'none' keeps it primitive only.
   */
  tokenRole?: ColorRole | 'none';
  /** Role this palette fills in each extra product, by product id. Roles a product leaves out come from the first product. */
  productRoles?: Record<string, ColorRole>;
}

export interface SavedPreset {
  id: string;
  name: string;
  palettes: PaletteConfig[];
  /** Typography, spacing, radius, shadow and grid. Missing on presets saved before foundations existed. */
  foundations?: Foundations;
  createdAt: number;
}
