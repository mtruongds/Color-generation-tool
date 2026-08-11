import chroma from 'chroma-js';
import * as radixColors from '@radix-ui/colors';

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
// Radix custom color generation logic
// References https://www.radix-ui.com/colors/custom
//
// The Radix custom tool does not build palettes from raw HSL ramps. It:
//   1. finds the closest official Radix scales in OKLCH
//   2. mixes those reference scales
//   3. rescales chroma to the submitted color
//   4. pins the requested hue across the generated scale
//   5. anchors step 9 to the submitted color and derives step 10
// =====================================================================

const RADIX_GRAY_SCALE_NAMES = ['gray', 'mauve', 'slate', 'sage', 'olive', 'sand'] as const;
const RADIX_ACCENT_SCALE_NAMES = [
  ...RADIX_GRAY_SCALE_NAMES,
  'tomato',
  'red',
  'ruby',
  'crimson',
  'pink',
  'plum',
  'purple',
  'violet',
  'iris',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'jade',
  'green',
  'grass',
  'brown',
  'orange',
  'sky',
  'mint',
  'lime',
  'yellow',
  'amber',
] as const;

type RadixScaleName = typeof RADIX_ACCENT_SCALE_NAMES[number];
type OklchTuple = [number, number, number];

const radixColorExports = radixColors as unknown as Record<string, Record<string, string>>;

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function scaleExportKey(name: RadixScaleName, isDark: boolean): string {
  return isDark ? `${name}Dark` : name;
}

function getRadixScale(name: RadixScaleName, isDark: boolean): string[] {
  const scale = radixColorExports[scaleExportKey(name, isDark)];
  return Array.from({ length: 12 }, (_, index) => scale[`${name}${index + 1}`]);
}

function colorToOklch(color: string): OklchTuple {
  const [l, c, h] = chroma(color).oklch();
  return [clamp01(l), Math.max(0, c || 0), Number.isFinite(h) ? normalizeHue(h) : 0];
}

function colorFromOklch([l, c, h]: OklchTuple): string {
  return chroma.oklch(clamp01(l), Math.max(0, c), normalizeHue(h)).hex().toUpperCase();
}

function oklchDistance(a: OklchTuple, b: OklchTuple): number {
  const hueA = a[2] * Math.PI / 180;
  const hueB = b[2] * Math.PI / 180;
  const aa = a[1] * Math.cos(hueA);
  const ab = a[1] * Math.sin(hueA);
  const ba = b[1] * Math.cos(hueB);
  const bb = b[1] * Math.sin(hueB);

  return Math.hypot(a[0] - b[0], aa - ba, ab - bb);
}

const RADIX_REFERENCE_CACHE = new Map<string, Record<RadixScaleName, string[]>>();

function getReferenceScales(isDark: boolean): Record<RadixScaleName, string[]> {
  const cacheKey = isDark ? 'dark' : 'light';
  const cached = RADIX_REFERENCE_CACHE.get(cacheKey);
  if (cached) return cached;

  const scales = Object.fromEntries(
    RADIX_ACCENT_SCALE_NAMES.map(name => [name, getRadixScale(name, isDark)])
  ) as Record<RadixScaleName, string[]>;
  RADIX_REFERENCE_CACHE.set(cacheKey, scales);
  return scales;
}

function findClosestReferenceScales(
  target: OklchTuple,
  references: Record<RadixScaleName, string[]>
): [RadixScaleName, RadixScaleName, number] {
  const ranked = Object.entries(references).map(([name, scale]) => {
    const distance = Math.min(...scale.map(color => oklchDistance(target, colorToOklch(color))));
    return { name: name as RadixScaleName, distance };
  }).sort((a, b) => a.distance - b.distance);

  const nearest = ranked[0];
  let candidates = ranked.filter((entry, index, all) => (
    index === all.findIndex(item => item.name === entry.name)
  ));

  const nearestIsGray = RADIX_GRAY_SCALE_NAMES.includes(nearest.name as typeof RADIX_GRAY_SCALE_NAMES[number]);
  const allCandidatesAreGray = candidates.every(entry => (
    RADIX_GRAY_SCALE_NAMES.includes(entry.name as typeof RADIX_GRAY_SCALE_NAMES[number])
  ));

  if (nearestIsGray && !allCandidatesAreGray) {
    candidates = [nearest, ...candidates.filter(entry => (
      !RADIX_GRAY_SCALE_NAMES.includes(entry.name as typeof RADIX_GRAY_SCALE_NAMES[number])
    ))];
  }

  const first = candidates[0];
  const second = candidates[1] ?? candidates[0];
  const firstStep = references[first.name].reduce((closest, color) => {
    const distance = oklchDistance(target, colorToOklch(color));
    return distance < closest.distance ? { color, distance } : closest;
  }, { color: references[first.name][8], distance: Number.POSITIVE_INFINITY });
  const secondStep = references[second.name].reduce((closest, color) => {
    const distance = oklchDistance(target, colorToOklch(color));
    return distance < closest.distance ? { color, distance } : closest;
  }, { color: references[second.name][8], distance: Number.POSITIVE_INFINITY });

  const h = first.distance;
  const C = second.distance;
  const d = oklchDistance(colorToOklch(firstStep.color), colorToOklch(secondStep.color));
  const denominator = 2 * h * d;
  const u = denominator === 0 ? 0 : (h ** 2 + d ** 2 - C ** 2) / denominator;
  const g = Math.sin(Math.acos(Math.max(-1, Math.min(1, u)))) || 1;
  const pDenominator = 2 * C * d;
  const p = pDenominator === 0 ? 0 : (C ** 2 + d ** 2 - h ** 2) / pDenominator;
  const m = Math.sin(Math.acos(Math.max(-1, Math.min(1, p)))) || 1;
  const mixAmount = clamp01(0.5 * Math.max(0, (u / g) / (p / m || 1)));

  return [first.name, second.name, mixAmount];
}

function mixReferenceScales(first: string[], second: string[], amount: number): OklchTuple[] {
  return first.map((color, index) => (
    colorToOklch(chroma.mix(color, second[index], amount, 'oklch').hex())
  ));
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      const d = sampleDX(t);
      if (Math.abs(dx) < 1e-5 || Math.abs(d) < 1e-5) break;
      t -= dx / d;
    }
    return sampleY(clamp01(t));
  };
}

function adjustLightnessToBackground(
  scale: OklchTuple[],
  backgroundL: number,
  isDark: boolean
): OklchTuple[] {
  const adjusted = scale.map(color => [...color] as OklchTuple);
  const ease = isDark
    ? cubicBezier(1, 0, 1, 0)
    : cubicBezier(0, 2, 0, 2);
  const values = isDark
    ? adjusted.map(color => color[0])
    : [1, ...adjusted.map(color => color[0])];

  if (isDark) {
    const firstL = adjusted[0][0] || 1;
    const ratio = backgroundL / firstL;
    const darkEase = ratio > 1.5 ? cubicBezier(0, 0, 0, 0) : ease;
    adjusted.forEach((color, index, all) => {
      color[0] = clamp01(values[index] - (values[0] - backgroundL) * darkEase(1 - index / (all.length - 1)));
    });
    return adjusted;
  }

  const lightValues = values.map((value, index, all) => {
    return value - (all[0] - backgroundL) * ease(1 - index / (all.length - 1));
  });
  lightValues.shift();
  lightValues.forEach((value, index) => {
    adjusted[index][0] = clamp01(value);
  });
  return adjusted;
}

function buildRadixCustomScale(
  baseColor: string,
  isDark: boolean,
  options: ScaleOptions
): string[] {
  const { hueShift = 0, saturationScale = 1, lockStep9 = false } = options;
  const target = colorToOklch(baseColor);
  const background = colorToOklch(isDark ? '#111111' : '#FFFFFF');
  const references = getReferenceScales(isDark);
  const [firstName, secondName, mixAmount] = findClosestReferenceScales(target, references);
  const mixed = mixReferenceScales(references[firstName], references[secondName], mixAmount);
  const closestInMixed = mixed.reduce((closest, color) => {
    const distance = oklchDistance(target, color);
    return distance < closest.distance ? { color, distance } : closest;
  }, { color: mixed[8], distance: Number.POSITIVE_INFINITY }).color;
  const chromaRatio = closestInMixed[1] > 0 ? target[1] / closestInMixed[1] : 1;

  mixed.forEach((color, index) => {
    const hueAdjustment = (hueShift / 12) * (index - 6);
    color[1] = Math.min(1.5 * target[1], color[1] * chromaRatio * saturationScale);
    color[2] = normalizeHue(target[2] + hueAdjustment);
  });

  const adjusted = adjustLightnessToBackground(mixed, background[0], isDark);
  const colors = adjusted.map(colorFromOklch);
  // Radix normally uses the submitted accent as step 9. The exception is when
  // that color sits too close to the background, where the generated scale's
  // step 9 keeps component contrast healthier. `lockStep9` forces exact output.
  const shouldUseGeneratedStep9 = !lockStep9 && oklchDistance(target, adjusted[0]) * 100 < 25;
  colors[8] = shouldUseGeneratedStep9 ? colorFromOklch(adjusted[8]) : chroma(baseColor).hex().toUpperCase();

  const [step9L, step9C, step9H] = colorToOklch(colors[8]);
  // Step 10 is derived from step 9, matching Radix custom's solid-hover logic.
  const step10L = step9L > 0.4
    ? step9L - 0.03 / (step9L + 0.1)
    : step9L + 0.03 / (step9L + 0.1);
  const step10C = step9L > 0.4 ? Math.max(0, 0.93 * step9C) : step9C;
  colors[9] = colorFromOklch([step10L, step10C, step9H]);

  const step8C = colorToOklch(colors[7])[1];
  const step11 = colorToOklch(colors[10]);
  const step12 = colorToOklch(colors[11]);

  // Adjust chroma for steps 11 and 12 based on steps 8 and 9
  step11[1] = Math.min(Math.max(step9C, step8C), step11[1]);
  step12[1] = Math.min(Math.max(step9C, step8C), step12[1]);

  // Radix-like contrast adjustment for step 11, ensuring it's distinct and has good contrast
  // Step 11 (colors[10]) is often used for high-contrast text or icons
  const [currentStep10L] = colorToOklch(colors[9]); // Get lightness of step 10
  
  if (isDark) {
    // In dark mode, step 11 should be lighter than step 10 to provide contrast
    step11[0] = Math.min(0.99, Math.max(step11[0], currentStep10L + 0.12)); // Ensure it's sufficiently lighter
    step12[0] = Math.min(0.99, Math.max(step12[0], step11[0] + 0.08)); // Step 12 even lighter
  } else {
    // In light mode, step 11 should be darker than step 10
    step11[0] = Math.max(0.02, Math.min(step11[0], currentStep10L - 0.12)); // Ensure it's sufficiently darker
    step12[0] = Math.max(0.02, Math.min(step12[0], step11[0] - 0.08)); // Step 12 even darker
  }

  colors[10] = colorFromOklch(step11);
  colors[11] = colorFromOklch(step12);

  return colors;
}

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
  0.50,  // Step 3 — smoothed ramp (was 0.70)
  0.65,  // Step 4 — smoothed ramp (was 0.78)
  0.78,  // Step 5 — smoothed ramp (was 0.85)
  0.85,  // Step 6
  0.90,  // Step 7
  0.95,  // Step 8
  1.00,  // Step 9 (base anchor)
  0.95,  // Step 10
  0.80,  // Step 11
  0.90,  // Step 12 — retain brand hue vibe at high-contrast text
];

// Dark mode: very low saturation for clean dark surfaces, ramps up to step 9
const DARK_SATURATION_CURVE = [
  0.10,  // Step 1
  0.15,  // Step 2
  0.40,  // Step 3 — raised from 0.35 for better surface color visibility
  0.45,  // Step 4
  0.52,  // Step 5 — differentiated from step 6 (was 0.55)
  0.62,  // Step 6 — differentiated from step 5 (was 0.55)
  0.65,  // Step 7
  0.75,  // Step 8
  1.00,  // Step 9 (base anchor)
  0.95,  // Step 10
  0.80,  // Step 11
  0.90,  // Step 12 — retain brand hue vibe at high-contrast text
];

// ===== HUE-SPECIFIC ADJUSTMENTS =====
// Some hues need tweaks to the base scaffolds for perceptual uniformity.

type HueCategory = 'yellow' | 'orange' | 'lime' | 'cyan' | 'default';

function getHueCategory(hue: number): HueCategory {
  const h = ((hue % 360) + 360) % 360;
  if (h >= 45 && h < 65) return 'yellow';
  if (h >= 20 && h < 45)  return 'orange';
  if (h >= 65 && h <= 100) return 'lime';
  if (h >= 170 && h <= 200) return 'cyan';
  return 'default';
}

// Light scaffold offsets per hue category (added to base scaffold)
const LIGHT_SCAFFOLD_OFFSETS: Record<HueCategory, number[]> = {
  default: [0, 0, 0, 0, 0, 0, 0, 0],
  yellow:  [-0.005, -0.020, -0.025, -0.020, -0.015, -0.000, 0.020, 0.060],
  orange:  [-0.003, -0.010, -0.012, -0.010, -0.008,  0.000, 0.010, 0.030],
  lime:    [-0.002, -0.015, -0.020, -0.010, -0.005,  0.010, 0.035, 0.070],
  cyan:    [ 0.000, -0.010, -0.015, -0.005,  0.005,  0.025, 0.050, 0.080],
};

// Dark scaffold offsets per hue category
const DARK_SCAFFOLD_OFFSETS: Record<HueCategory, number[]> = {
  default: [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
  yellow:  [-0.010, -0.012, -0.010, -0.015, -0.020, -0.017, -0.016, -0.012],
  orange:  [-0.005, -0.006, -0.005, -0.008, -0.010, -0.009, -0.008, -0.006],
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
  orange: {
    light: [1, 1, 1, 1, 1.07, 1.07, 1.07, 1.07, 1, 1, 1, 1],
    dark:  [0.90, 0.92, 0.93, 0.94, 0.95, 0.97, 0.98, 0.98, 1, 1, 0.96, 0.96],
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
      Math.min(Math.max(baseL + 0.25, 0.70), 0.75),  // Step 11: low-contrast text (capped at 0.75, always ≥0.12 below step 12)
      0.87,                                           // Step 12: high-contrast text (~12.5:1 against dark bg)
    ];
  }

  const offsets = LIGHT_SCAFFOLD_OFFSETS[category];
  const scaffold = LIGHT_LIGHTNESS_SCAFFOLD.map((v, i) => Math.max(0, Math.min(1, v + offsets[i])));
  return [
    ...scaffold,
    baseL,                                          // Step 9
    Math.max(baseL - 0.05, 0),                      // Step 10: darker hover
    Math.max(baseL - 0.13, 0.33),                   // Step 11: low-contrast text (floored at 0.33, always ≥0.13 above step 12)
    0.20,                                           // Step 12: high-contrast text (~12.5:1 against light bg)
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getAPCAScore(text: string, background: string): number {
  return Math.abs(getAPCA(text, background));
}

function findLightnessForAPCAScore(
  background: string,
  hue: number,
  saturation: number,
  preferredLightness: number,
  targetScore: number,
): number {
  let bestLightness = clamp01(preferredLightness);
  let bestScoreDelta = Number.POSITIVE_INFINITY;
  let bestDistanceFromPreferred = Number.POSITIVE_INFINITY;

  const consider = (lightness: number) => {
    const candidateLightness = clamp01(lightness);
    const score = getAPCAScore(chroma.hsl(hue, saturation, candidateLightness).hex(), background);
    const scoreDelta = Math.abs(score - targetScore);
    const distanceFromPreferred = Math.abs(candidateLightness - preferredLightness);

    if (
      scoreDelta < bestScoreDelta ||
      (Math.abs(scoreDelta - bestScoreDelta) < 0.001 && distanceFromPreferred < bestDistanceFromPreferred)
    ) {
      bestLightness = candidateLightness;
      bestScoreDelta = scoreDelta;
      bestDistanceFromPreferred = distanceFromPreferred;
    }
  };

  const sampleCount = 96;
  let prevLightness = 0;
  let prevScoreDelta = getAPCAScore(chroma.hsl(hue, saturation, prevLightness).hex(), background) - targetScore;
  consider(prevLightness);

  for (let i = 1; i <= sampleCount; i++) {
    const currentLightness = i / sampleCount;
    const currentScoreDelta = getAPCAScore(chroma.hsl(hue, saturation, currentLightness).hex(), background) - targetScore;
    consider(currentLightness);

    if (prevScoreDelta === 0 || currentScoreDelta === 0 || prevScoreDelta * currentScoreDelta < 0) {
      let low = prevLightness;
      let high = currentLightness;

      for (let j = 0; j < 20; j++) {
        const mid = (low + high) / 2;
        const midScoreDelta = getAPCAScore(chroma.hsl(hue, saturation, mid).hex(), background) - targetScore;
        consider(mid);

        if (prevScoreDelta * midScoreDelta <= 0) {
          high = mid;
        } else {
          low = mid;
          prevScoreDelta = midScoreDelta;
        }
      }
    }

    prevLightness = currentLightness;
    prevScoreDelta = currentScoreDelta;
  }

  return bestLightness;
}

function adjustStep8ToAPCAMidpoint(
  colors: string[],
  lightnessScale: number[],
  hue: number,
  saturation: number,
): string[] {
  const background = colors[0];
  const step7Score = getAPCAScore(colors[6], background);
  const step9Score = getAPCAScore(colors[8], background);

  if (!Number.isFinite(step7Score) || !Number.isFinite(step9Score) || step9Score <= step7Score) {
    return colors;
  }

  const targetScore = (step7Score + step9Score) / 2;
  const step8Lightness = findLightnessForAPCAScore(
    background,
    hue,
    saturation,
    lightnessScale[7],
    targetScore,
  );

  const adjusted = [...colors];
  adjusted[7] = chroma.hsl(hue, saturation, step8Lightness).hex().toUpperCase();
  return adjusted;
}

// ===== LEGACY EXPORTS (kept for backward compatibility) =====
// @deprecated These constants reflect the original fixed-scale approach and
// may diverge from current generator output. The live scale uses
// buildLightnessScale() which is anchor-based. Do not rely on these for new code.

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
  lockStep9?: boolean;      // When true, force step 9 to the exact base color
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
  if (h >= 20 && h < 45) return 0.54;

  // Fallback
  return 0.50;
}

/**
 * Returns the generated step 9 preview. Usually this is the exact base color;
 * it changes only when Radix's background-proximity safeguard kicks in.
 */
export function getOptimizedStep9(baseColor: string, isDark: boolean): {
  color: string;
  originalL: number;
  optimizedL: number;
  delta: number;
} {
  try {
    const [originalL] = colorToOklch(baseColor);
    const scale = buildRadixCustomScale(baseColor, isDark, { lockStep9: false });
    const color = scale[8];
    const [optimizedL] = colorToOklch(color);
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
 * Follows the Radix custom palette approach:
 * - find and mix nearby official Radix scales
 * - reshape the mixed scale in OKLCH to the input color's hue/chroma
 * - anchor step 9 to the input color unless it is too close to the background
 * - derive step 10 and clamp text-step chroma like Radix custom
 */
export function generateScale(
  baseColor: string,
  name: string = 'Custom',
  isDark: boolean = false,
  options: ScaleOptions = {}
): ColorScale {
  try {
    return { name, colors: buildRadixCustomScale(baseColor, isDark, options) };
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
    const target = colorToOklch(baseColor);
    const references = getReferenceScales(isDark);
    const [firstName, secondName] = findClosestReferenceScales(target, references);
    const category = getHueCategory(target[2]);
    const scaleType = category === 'yellow' || category === 'lime' || category === 'cyan'
      ? category
      : 'default';
    const description = `Radix custom: mixed from ${firstName} and ${secondName}, then reshaped in OKLCH`;

    if (isDark) {
      return { scaleType, description: `Dark mode: ${description}`, isOptimized: true };
    }

    return { scaleType, description, isOptimized: true };
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

    let minAlpha = 0.01; // 1% floor avoids precision issues with near-matching solid+bg pairs

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
