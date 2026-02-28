import chroma from 'chroma-js';

export interface ColorScale {
  name: string;
  colors: string[]; // Array of 12 hex codes
}

export interface AlphaColor {
  rgba: string;       // rgba(r, g, b, a)
  hsla: string;       // hsla(h, s%, l%, a)
  hex8: string;       // #RRGGBBAA
  alpha: number;      // 0-1 alpha value
  r: number;
  g: number;
  b: number;
}

export interface AlphaColorScale {
  name: string;
  colors: AlphaColor[]; // Array of 12 alpha colors
  background: string;   // The background color used for computation
}

// =====================================================================
// Radix v3.0 Color Generation Logic
// Based on https://www.radix-ui.com/colors/custom
//
// Key principles:
//   1. Steps 1-8 use fixed lightness scaffolds per mode
//   2. Step 9 is anchored to the actual base color's lightness
//   3. Steps 10, 11, 12 are derived from the base lightness
//   4. Saturation follows a curve that multiplies the base saturation
//   5. Hue is kept constant (with optional user shift)
// =====================================================================

// ===== LIGHTNESS SCAFFOLDS (steps 1-8, 0-1 scale) =====
// Steps 9-12 are dynamically derived from the base color's lightness.

// Light mode: from near-white backgrounds down to mid-tone borders
const LIGHT_LIGHTNESS_SCAFFOLD = [
  0.990,  // Step 1: App background
  0.975,  // Step 2: Subtle background
  0.940,  // Step 3: UI element background
  0.890,  // Step 4: Hovered UI element
  0.830,  // Step 5: Active UI element
  0.750,  // Step 6: Subtle borders
  0.650,  // Step 7: UI element border and focus rings
  0.520,  // Step 8: Hovered UI element border
];

// Dark mode: from near-black backgrounds up to mid-tone borders
const DARK_LIGHTNESS_SCAFFOLD = [
  0.085,  // Step 1: App background
  0.110,  // Step 2: Subtle background
  0.140,  // Step 3: UI element background
  0.170,  // Step 4: Hovered UI element
  0.210,  // Step 5: Active UI element
  0.280,  // Step 6: Subtle borders
  0.360,  // Step 7: UI element border and focus rings
  0.450,  // Step 8: Hovered UI element border
];

// ===== SATURATION CURVES (multipliers of base saturation) =====

// Light mode: low saturation at extremes, full at step 9
const LIGHT_SATURATION_CURVE = [
  0.20,  // Step 1
  0.35,  // Step 2
  0.70,  // Step 3
  0.78,  // Step 4
  0.85,  // Step 5
  0.85,  // Step 6
  0.90,  // Step 7
  0.95,  // Step 8
  1.00,  // Step 9 (base anchor)
  0.95,  // Step 10
  0.80,  // Step 11
  0.60,  // Step 12
];

// Dark mode: very low saturation for clean dark surfaces, ramps up to step 9
const DARK_SATURATION_CURVE = [
  0.10,  // Step 1
  0.15,  // Step 2
  0.35,  // Step 3
  0.45,  // Step 4
  0.55,  // Step 5
  0.55,  // Step 6
  0.65,  // Step 7
  0.75,  // Step 8
  1.00,  // Step 9 (base anchor)
  0.95,  // Step 10
  0.80,  // Step 11
  0.60,  // Step 12
];

// ===== HUE-SPECIFIC ADJUSTMENTS =====
// Some hues need tweaks to the base scaffolds for perceptual uniformity.

type HueCategory = 'yellow' | 'lime' | 'cyan' | 'default';

function getHueCategory(hue: number): HueCategory {
  const h = ((hue % 360) + 360) % 360;
  if (h >= 45 && h < 65) return 'yellow';
  if (h >= 65 && h <= 100) return 'lime';
  if (h >= 170 && h <= 200) return 'cyan';
  return 'default';
}

// Light scaffold offsets per hue category (added to base scaffold)
const LIGHT_SCAFFOLD_OFFSETS: Record<HueCategory, number[]> = {
  default: [0, 0, 0, 0, 0, 0, 0, 0],
  yellow:  [-0.005, -0.020, -0.025, -0.020, -0.015, -0.000, 0.020, 0.060],
  lime:    [-0.002, -0.015, -0.020, -0.010, -0.005, 0.010, 0.035, 0.070],
  cyan:    [0.000, -0.010, -0.015, -0.005, 0.005, 0.025, 0.050, 0.080],
};

// Dark scaffold offsets per hue category
const DARK_SCAFFOLD_OFFSETS: Record<HueCategory, number[]> = {
  default: [0, 0, 0, 0, 0, 0, 0, 0],
  yellow:  [-0.010, -0.012, -0.010, -0.015, -0.020, -0.017, -0.016, -0.012],
  lime:    [-0.007, -0.010, -0.008, -0.010, -0.014, -0.012, -0.012, -0.008],
  cyan:    [-0.003, -0.005, -0.008, -0.005, -0.010, -0.008, -0.008, -0.004],
};

// Saturation curve adjustments per hue category (multiplied on top of base curve)
const SAT_CURVE_ADJUSTMENTS: Record<HueCategory, { light: number[]; dark: number[] }> = {
  default: {
    light: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    dark:  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  yellow: {
    light: [1, 1, 1, 1, 1.15, 1.15, 1.15, 1.15, 1, 1, 1, 1],
    dark:  [0.83, 0.86, 0.88, 0.89, 0.90, 0.94, 0.97, 0.97, 1, 1, 0.92, 0.92],
  },
  lime: {
    light: [1, 1, 1, 1.12, 1.12, 1.12, 1.12, 1.12, 1, 1, 1, 1],
    dark:  [0.93, 0.95, 0.96, 0.96, 0.97, 0.99, 1.0, 1.0, 1, 1, 0.95, 0.97],
  },
  cyan: {
    light: [1, 1, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1, 1, 1, 1],
    dark:  [1.07, 1.05, 1.04, 1.03, 1.02, 1.02, 1.03, 1.03, 1, 1, 1.01, 1.05],
  },
};

/**
 * Builds the full 12-step lightness array from the base color's lightness.
 *
 * Steps 1-8: scaffold (fixed per mode, with hue offsets)
 * Step 9:    base lightness (anchor)
 * Step 10:   base ± offset (hover state)
 * Step 11:   base ± larger offset (low-contrast text)
 * Step 12:   fixed endpoint (high-contrast text)
 */
function buildLightnessScale(baseL: number, hue: number, isDark: boolean): number[] {
  const category = getHueCategory(hue);

  if (isDark) {
    const offsets = DARK_SCAFFOLD_OFFSETS[category];
    const scaffold = DARK_LIGHTNESS_SCAFFOLD.map((v, i) => Math.max(0, Math.min(1, v + offsets[i])));
    return [
      ...scaffold,
      baseL,                                          // Step 9
      Math.min(baseL + 0.05, 0.95),                  // Step 10: lighter hover
      Math.min(Math.max(baseL + 0.25, 0.75), 0.90),  // Step 11: low-contrast text
      0.98,                                           // Step 12: high-contrast text
    ];
  }

  const offsets = LIGHT_SCAFFOLD_OFFSETS[category];
  const scaffold = LIGHT_LIGHTNESS_SCAFFOLD.map((v, i) => Math.max(0, Math.min(1, v + offsets[i])));
  return [
    ...scaffold,
    baseL,                                          // Step 9
    Math.max(baseL - 0.05, 0),                      // Step 10: darker hover
    Math.max(baseL - 0.13, 0.25),                   // Step 11: low-contrast text
    0.11,                                           // Step 12: high-contrast text
  ];
}

/**
 * Builds the full 12-step saturation array from the base saturation.
 */
function buildSaturationScale(baseS: number, hue: number, isDark: boolean): number[] {
  const category = getHueCategory(hue);
  const baseCurve = isDark ? DARK_SATURATION_CURVE : LIGHT_SATURATION_CURVE;
  const adj = isDark ? SAT_CURVE_ADJUSTMENTS[category].dark : SAT_CURVE_ADJUSTMENTS[category].light;

  return baseCurve.map((mult, i) => {
    const sat = baseS * mult * adj[i];
    return Math.max(0, Math.min(1, sat));
  });
}

// ===== LEGACY EXPORTS (kept for backward compatibility) =====
// These are no longer used internally but may be referenced externally.

export const DEFAULT_LIGHTNESS_SCALE = [
  0.990, 0.975, 0.940, 0.890, 0.830, 0.750, 0.650, 0.520, 0.50, 0.44, 0.35, 0.12,
];
export const YELLOW_LIGHT_SCALE = [
  0.985, 0.955, 0.915, 0.870, 0.815, 0.750, 0.670, 0.580, 0.48, 0.42, 0.34, 0.12,
];
export const CYAN_LIGHT_SCALE = [
  0.990, 0.965, 0.925, 0.885, 0.835, 0.775, 0.700, 0.600, 0.49, 0.43, 0.35, 0.12,
];
export const LIME_LIGHT_SCALE = [
  0.988, 0.960, 0.920, 0.880, 0.825, 0.760, 0.685, 0.590, 0.485, 0.425, 0.345, 0.12,
];
export const DARK_LIGHTNESS_SCALE = [
  0.085, 0.110, 0.140, 0.170, 0.210, 0.280, 0.360, 0.450, 0.50, 0.58, 0.66, 0.93,
];
export const YELLOW_DARK_SCALE = [
  0.075, 0.098, 0.130, 0.155, 0.182, 0.215, 0.258, 0.330, 0.50, 0.58, 0.72, 0.94,
];
export const CYAN_DARK_SCALE = [
  0.082, 0.105, 0.140, 0.165, 0.192, 0.224, 0.266, 0.338, 0.49, 0.57, 0.67, 0.93,
];
export const LIME_DARK_SCALE = [
  0.078, 0.100, 0.135, 0.160, 0.188, 0.220, 0.262, 0.334, 0.485, 0.57, 0.70, 0.94,
];

// ===== SCALE OPTIONS =====

export interface ScaleOptions {
  hueShift?: number;        // Degrees to shift from start to end
  saturationScale?: number; // Multiplier 0.0 to 2.0
  lockStep9?: boolean;      // When true, step 9 = exact base color; when false, auto-optimize
  useP3?: boolean;          // Use P3 color space (placeholder)
}

// ===== OPTIMAL STEP 9 LIGHTNESS =====

/**
 * Computes the perceptually optimal lightness for step 9 based on hue.
 *
 * Different hues have different ideal lightness values due to the Helmholtz–Kohlrausch
 * effect — yellow and cyan appear brighter at the same measured lightness, so their
 * ideal anchor is adjusted. Values are derived from Radix's published scales.
 *
 * In dark mode, step 9 retains the same ideal lightness so the brand color stays
 * consistent across modes (a core Radix principle).
 */
function getOptimalStep9Lightness(hue: number): number {
  const h = ((hue % 360) + 360) % 360;

  // Yellow / amber range (45-65): appears very bright, needs lower L
  if (h >= 45 && h < 65) return 0.53;

  // Lime / green-yellow (65-100): still high perceived brightness
  if (h >= 65 && h <= 100) return 0.46;

  // Green (100-160): mid-range perceived brightness
  if (h > 100 && h < 160) return 0.44;

  // Cyan / teal (160-200): high perceived brightness
  if (h >= 160 && h <= 200) return 0.47;

  // Blue (200-260): lower perceived brightness, can go slightly higher
  if (h > 200 && h <= 260) return 0.50;

  // Purple / violet (260-310)
  if (h > 260 && h <= 310) return 0.52;

  // Red / magenta / pink (310-360, 0-20)
  if (h > 310 || h < 20) return 0.55;

  // Orange (20-45)
  if (h >= 20 && h < 45) return 0.52;

  // Fallback
  return 0.50;
}

/**
 * Returns the optimized base color for step 9.
 * Keeps the user's hue and saturation but shifts lightness to the ideal value.
 */
export function getOptimizedStep9(baseColor: string, isDark: boolean): {
  color: string;
  originalL: number;
  optimizedL: number;
  delta: number;
} {
  try {
    const base = chroma(baseColor);
    const h = base.get('hsl.h') || 0;
    const s = base.get('hsl.s');
    const originalL = base.get('hsl.l');
    const optimizedL = getOptimalStep9Lightness(h);
    const color = chroma.hsl(h, s, optimizedL).hex().toUpperCase();
    return {
      color,
      originalL: Math.round(originalL * 100),
      optimizedL: Math.round(optimizedL * 100),
      delta: Math.round((optimizedL - originalL) * 100),
    };
  } catch {
    return { color: baseColor, originalL: 50, optimizedL: 50, delta: 0 };
  }
}

// ===== MAIN SCALE GENERATOR =====

/**
 * Generates a 12-step Radix-style color scale from a base color.
 *
 * Follows the Radix v3.0 approach:
 * - Steps 1-8: fixed lightness scaffold with mode-appropriate saturation ramp
 * - Step 9: exact base color (anchor)
 * - Step 10: hover variant of base
 * - Steps 11-12: derived text colors
 *
 * The saturation curve ensures early steps are subtle (especially in dark mode)
 * and text steps are readable without neon artifacts.
 */
export function generateScale(
  baseColor: string,
  name: string = 'Custom',
  isDark: boolean = false,
  options: ScaleOptions = {}
): ColorScale {
  try {
    const { hueShift = 0, saturationScale = 1.0, lockStep9 = false } = options;
    const base = chroma(baseColor);
    const baseH = base.get('hsl.h') || 0;
    const baseS = base.get('hsl.s');       // 0-1
    const rawBaseL = base.get('hsl.l');    // 0-1

    // When unlocked, optimize step 9 lightness for the hue
    const useOptimized = !lockStep9;
    const optimalL = useOptimized ? getOptimalStep9Lightness(baseH) : rawBaseL;
    const anchorL = useOptimized ? optimalL : rawBaseL;
    const anchorColor = useOptimized
      ? chroma.hsl(baseH, baseS, optimalL).hex().toUpperCase()
      : base.hex().toUpperCase();

    // Build dynamic lightness & saturation arrays anchored to the anchor lightness
    const lightnessScale = buildLightnessScale(anchorL, baseH, isDark);
    const saturationCurve = buildSaturationScale(baseS, baseH, isDark);

    const colors = lightnessScale.map((targetL, index) => {
      // Step 9 (index 8): the anchor color (exact base when locked, optimized when unlocked)
      if (index === 8) {
        return anchorColor;
      }

      // Step 10 (index 9): hover state derived from anchor with perceptual adjustment
      if (index === 9) {
        if (isDark) {
          const hoverL = Math.min(1, anchorL + 0.08);
          const hoverS = Math.min(1, baseS * 1.05);
          return chroma.hsl(baseH, hoverS, hoverL).hex().toUpperCase();
        } else {
          const hoverL = Math.max(0, anchorL - 0.07);
          return chroma.hsl(baseH, baseS, hoverL).hex().toUpperCase();
        }
      }

      // Hue: apply user shift distributed across steps, pivoting around step 7
      const userHueAdj = (hueShift / 12) * (index - 6);

      // Subtle blue-tinting for dark mode backgrounds (Radix characteristic)
      let darkHueAdj = 0;
      if (isDark && index <= 1) {
        const blueTarget = 220;
        const hueDiff = blueTarget - baseH;
        darkHueAdj = hueDiff * 0.06 * (2 - index);
      }

      const stepH = baseH + userHueAdj + darkHueAdj;

      // Saturation: curve value × user scale
      let stepS = saturationCurve[index] * saturationScale;

      // Extra dampening for step 12 in dark mode to prevent neon high-contrast text
      if (isDark && index === 11) {
        stepS *= 0.80;
      }

      stepS = Math.max(0, Math.min(1, stepS));

      return chroma.hsl(stepH, stepS, targetL).hex().toUpperCase();
    });

    return { name, colors };
  } catch (e) {
    console.error('Error generating scale', e);
    return { name, colors: Array(12).fill('#000000') };
  }
}

// ===== CONTRAST UTILITIES =====

// WCAG 2.1 Contrast
export function getContrast(c1: string, c2: string) {
  try {
    return chroma.contrast(c1, c2);
  } catch {
    return 0;
  }
}

// APCA Implementation (Simplified G-4g constants)
const sRGBtrc = 2.4;
const Rco = 0.2126729, Gco = 0.7151522, Bco = 0.0721750;
const scaleBoW = 1.14, scaleWoB = 1.14;
const normBG = 0.56, normTXT = 0.57;
const revTXT = 0.62, revBG = 0.65;
const blkThrs = 0.022;

function simpleExp(val: number) {
  return Math.pow(val, sRGBtrc);
}

function getLuminanceAPCA(color: string) {
  const rgb = chroma(color).rgb();
  return (simpleExp(rgb[0] / 255.0) * Rco) + (simpleExp(rgb[1] / 255.0) * Gco) + (simpleExp(rgb[2] / 255.0) * Bco);
}

export function getAPCA(txt: string, bg: string) {
  try {
    let Ytxt = getLuminanceAPCA(txt);
    let Ybg = getLuminanceAPCA(bg);

    if (Ytxt <= blkThrs) Ytxt += Math.pow(blkThrs - Ytxt, 1.414);
    if (Ybg <= blkThrs) Ybg += Math.pow(blkThrs - Ybg, 1.414);

    if (isNaN(Ytxt) || isNaN(Ybg)) return 0;

    let SAPC = 0;

    if (Ybg > Ytxt) {
      SAPC = (Math.pow(Ybg, normBG) - Math.pow(Ytxt, normTXT)) * scaleBoW;
      if (SAPC < 0.0004) SAPC = 0;
      else SAPC = SAPC - 0.027;
      return SAPC * 100;
    } else {
      SAPC = (Math.pow(Ybg, revBG) - Math.pow(Ytxt, revTXT)) * scaleWoB;
      if (SAPC > -0.0004) SAPC = 0;
      else SAPC = SAPC + 0.027;
      return SAPC * 100;
    }
  } catch {
    return 0;
  }
}

export function getAPCARating(score: number) {
  const s = Math.abs(score);
  if (s >= 90) return { label: 'Excellent', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' };
  if (s >= 75) return { label: 'Good (Body)', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' };
  if (s >= 60) return { label: 'Good (Large)', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' };
  if (s >= 45) return { label: 'Poor (Large only)', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' };
  if (s >= 30) return { label: 'Fail (Spot only)', class: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' };
  return { label: 'Fail', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' };
}

export function getWCAGRating(ratio: number) {
  if (ratio >= 7) return { label: 'AAA', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' };
  if (ratio >= 4.5) return { label: 'AA', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' };
  if (ratio >= 3) return { label: 'AA Large', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' };
  return { label: 'Fail', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' };
}

export function isValidColor(c: string) {
  return chroma.valid(c);
}

// ===== SCALE INFO =====

/**
 * Gets information about which color system adjustment is being applied
 */
export function getColorScaleInfo(baseColor: string, isDark: boolean): {
  scaleType: 'default' | 'yellow' | 'lime' | 'cyan';
  description: string;
  isOptimized: boolean;
} {
  try {
    const base = chroma(baseColor);
    const hue = base.get('hsl.h');
    const category = getHueCategory(hue);

    if (isDark) {
      switch (category) {
        case 'yellow':
          return { scaleType: 'yellow', description: 'Dark mode: Radix v3 yellow with suppressed background saturation', isOptimized: true };
        case 'lime':
          return { scaleType: 'lime', description: 'Dark mode: Radix v3 lime with adjusted saturation curve', isOptimized: true };
        case 'cyan':
          return { scaleType: 'cyan', description: 'Dark mode: Radix v3 cyan with boosted visibility', isOptimized: true };
        default:
          return { scaleType: 'default', description: 'Dark mode: Radix v3 scale with base-anchored lightness', isOptimized: true };
      }
    }

    switch (category) {
      case 'yellow':
        return { scaleType: 'yellow', description: 'Radix v3 yellow with enhanced contrast', isOptimized: true };
      case 'lime':
        return { scaleType: 'lime', description: 'Radix v3 lime with adjusted lightness', isOptimized: true };
      case 'cyan':
        return { scaleType: 'cyan', description: 'Radix v3 cyan with improved visibility', isOptimized: true };
      default:
        return { scaleType: 'default', description: 'Radix v3 standard scale', isOptimized: false };
    }
  } catch {
    return { scaleType: 'default', description: 'Standard scale', isOptimized: false };
  }
}

// ===== ALPHA COLOR GENERATION =====

/**
 * Converts a solid color to its alpha equivalent over a given background.
 * Finds the minimum alpha value where all RGB channels remain in [0, 255].
 */
export function solidToAlpha(solidColor: string, backgroundColor: string): AlphaColor {
  try {
    const solid = chroma(solidColor).rgb();
    const bg = chroma(backgroundColor).rgb();

    const sr = solid[0], sg = solid[1], sb = solid[2];
    const br = bg[0], bg_ = bg[1], bb = bg[2];

    let minAlpha = 0.001;

    const channels = [
      { s: sr, b: br },
      { s: sg, b: bg_ },
      { s: sb, b: bb },
    ];

    for (const { s, b } of channels) {
      if (s === b) continue;

      if (s < b) {
        if (b > 0) {
          const needed = (b - s) / b;
          minAlpha = Math.max(minAlpha, needed);
        }
      } else {
        if (b < 255) {
          const needed = (s - b) / (255 - b);
          minAlpha = Math.max(minAlpha, needed);
        } else {
          minAlpha = Math.max(minAlpha, 1);
        }
      }
    }

    let alpha = Math.ceil(minAlpha * 1000) / 1000;
    alpha = Math.min(1, Math.max(0.001, alpha));

    let fgR = Math.round((sr - br * (1 - alpha)) / alpha);
    let fgG = Math.round((sg - bg_ * (1 - alpha)) / alpha);
    let fgB = Math.round((sb - bb * (1 - alpha)) / alpha);

    fgR = Math.max(0, Math.min(255, fgR));
    fgG = Math.max(0, Math.min(255, fgG));
    fgB = Math.max(0, Math.min(255, fgB));

    const alphaStr = alpha === 1 ? '1' : alpha.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');

    const alphaByte = Math.round(alpha * 255);
    const hex8 = `#${fgR.toString(16).padStart(2, '0')}${fgG.toString(16).padStart(2, '0')}${fgB.toString(16).padStart(2, '0')}${alphaByte.toString(16).padStart(2, '0')}`.toUpperCase();

    const fgChroma = chroma(fgR, fgG, fgB);
    const h = fgChroma.get('hsl.h') || 0;
    const s = fgChroma.get('hsl.s') * 100;
    const l = fgChroma.get('hsl.l') * 100;

    return {
      rgba: `rgba(${fgR}, ${fgG}, ${fgB}, ${alphaStr})`,
      hsla: `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${alphaStr})`,
      hex8,
      alpha,
      r: fgR,
      g: fgG,
      b: fgB,
    };
  } catch (e) {
    console.error('Error converting to alpha:', e);
    return {
      rgba: 'rgba(0, 0, 0, 1)',
      hsla: 'hsla(0, 0%, 0%, 1)',
      hex8: '#000000FF',
      alpha: 1,
      r: 0,
      g: 0,
      b: 0,
    };
  }
}

/**
 * Generates a full alpha color scale from a solid color scale.
 */
export function generateAlphaScale(
  solidScale: ColorScale,
  isDark: boolean,
  customBackground?: string
): AlphaColorScale {
  const background = customBackground || (isDark ? '#111111' : '#FFFFFF');

  const alphaColors = solidScale.colors.map(solidColor => {
    return solidToAlpha(solidColor, background);
  });

  return {
    name: `${solidScale.name}A`,
    colors: alphaColors,
    background,
  };
}

/**
 * Formats an alpha color value in the specified format
 */
export function formatAlphaColor(alpha: AlphaColor, format: 'rgba' | 'hsla' | 'hex8'): string {
  switch (format) {
    case 'rgba': return alpha.rgba;
    case 'hsla': return alpha.hsla;
    case 'hex8': return alpha.hex8;
    default: return alpha.rgba;
  }
}

/**
 * Returns a Radix-style usage description for a given color step.
 */
export function getStepDescription(step: number, paletteName: string, isAlpha: boolean): string {
  const prefix = isAlpha ? 'Transparent ' : '';
  const descriptions: Record<number, string> = {
    1: `${prefix}App background`,
    2: `${prefix}Subtle background`,
    3: `${prefix}UI element background`,
    4: `${prefix}Hovered UI element background`,
    5: `${prefix}Active / Selected UI element background`,
    6: `${prefix}Subtle borders and separators`,
    7: `${prefix}UI element border and focus rings`,
    8: `${prefix}Hovered UI element border`,
    9: `${prefix}Solid backgrounds`,
    10: `${prefix}Hovered solid backgrounds`,
    11: `${prefix}Low-contrast text`,
    12: `${prefix}High-contrast text`,
  };
  return descriptions[step] || `${paletteName} color step ${step}`;
}

/**
 * Composites an alpha color over a background to verify visual equivalence
 */
export function compositeAlphaOver(alphaColor: AlphaColor, backgroundColor: string): string {
  try {
    const bg = chroma(backgroundColor).rgb();
    const a = alphaColor.alpha;

    const r = Math.round(alphaColor.r * a + bg[0] * (1 - a));
    const g = Math.round(alphaColor.g * a + bg[1] * (1 - a));
    const b = Math.round(alphaColor.b * a + bg[2] * (1 - a));

    return chroma(r, g, b).hex();
  } catch {
    return '#000000';
  }
}

// ===== COLOR FORMAT CONVERSION =====

export type ColorFormat = 'hex' | 'oklch';

/**
 * Converts a hex color string to OKLCH format.
 * Returns a CSS-ready oklch() string: oklch(L C H)
 */
export function hexToOklch(hex: string): string {
  try {
    const [l, c, h] = chroma(hex).oklch();
    const L = (l * 100).toFixed(2);
    const C = c.toFixed(4);
    const H = isNaN(h) ? '0' : h.toFixed(2);
    return `oklch(${L}% ${C} ${H})`;
  } catch {
    return 'oklch(0% 0 0)';
  }
}

/**
 * Formats a color string in the requested format.
 */
export function formatColor(hex: string, format: ColorFormat): string {
  if (format === 'oklch') return hexToOklch(hex);
  return hex;
}