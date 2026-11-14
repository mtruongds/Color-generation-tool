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
  /**
   * Hand-set colors that replace generated steps, per mode, e.g. legacy colors a team already ships.
   * Every other step stays generated. Step 9 is never here: the base color drives it.
   */
  stepOverrides?: StepOverrides;
}

/** Step number (1–12) to #RRGGBB. */
export type StepMap = Partial<Record<number, string>>;

export interface StepOverrides {
  light?: StepMap;
  dark?: StepMap;
  /**
   * A step set by hand in one mode only also sets the other mode, derived with the same tint. Steps
   * listed here opt out: their other mode stays generated. A step set in both modes keeps both colors.
   */
  unsync?: number[];
}

export interface SavedPreset {
  id: string;
  name: string;
  palettes: PaletteConfig[];
  /** Typography, spacing, radius, shadow and grid. Missing on presets saved before foundations existed. */
  foundations?: Foundations;
  createdAt: number;
}
