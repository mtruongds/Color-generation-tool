import chroma from 'chroma-js';
import Color from 'colorjs.io';
import BezierEasing from 'bezier-easing';
import * as RadixColors from '@radix-ui/colors';

export type PaletteRole = 'accent' | 'gray';

export interface ColorScale {
  name: string;
  colors: string[];          // 12 sRGB hex codes
  wideGamut: string[];       // 12 oklch() strings (P3-capable)
  alphaWideGamut: string[];  // 12 color(display-p3 … / a) strings
  contrast: string;          // Text color for use on step 9
  surface: string;           // Translucent panel color (hex8)
  surfaceWideGamut: string;
  background: string;        // Page background the scale was fitted to
  mixedFrom: [string, string, number]; // Reference scales and mix ratio
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
// Radix custom color generation
// Port of radix-ui/website components/generate-radix-colors.tsx
// (https://www.radix-ui.com/colors/custom), on @radix-ui/colors 3.0.0
// and colorjs.io 0.5.2 to match the official output.
//
//   1. find the two closest official Radix P3 scales in OKLCH
//   2. mix them in proportion to their distance from the submitted color
//   3. rescale chroma and pin hue to the submitted color
//   4. transpose lightness to the page background
//   5. anchor step 9 to the submitted color and derive step 10
//
// Hue shift, saturation and lock step 9 are additions of this tool. At
// their defaults (0, 1, off) the output is identical to Radix custom.
// =====================================================================

type ArrayOf12<T> = [T, T, T, T, T, T, T, T, T, T, T, T];
const arrayOf12 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

// prettier-ignore
const grayScaleNames = ['gray', 'mauve', 'slate', 'sage', 'olive', 'sand'] as const;

// prettier-ignore
const scaleNames = [...grayScaleNames, 'tomato', 'red', 'ruby', 'crimson', 'pink',
  'plum', 'purple', 'violet', 'iris', 'indigo', 'blue', 'cyan', 'teal', 'jade', 'green',
  'grass', 'brown', 'orange', 'sky', 'mint', 'lime', 'yellow', 'amber'] as const;

type ScaleSet = Record<string, ArrayOf12<Color>>;

export const DEFAULT_BACKGROUNDS = { light: '#FFFFFF', dark: '#111111' } as const;
// Default gray of the Radix custom tool, used to tint pure black/white accents
export const DEFAULT_GRAY = '#8B8D98';

const radixExports = RadixColors as unknown as Record<string, Record<string, string>>;
const referenceCache = new Map<string, ScaleSet>();

function getReferenceScales(isDark: boolean, graysOnly: boolean): ScaleSet {
  const key = `${isDark ? 'dark' : 'light'}-${graysOnly ? 'gray' : 'all'}`;
  const cached = referenceCache.get(key);
  if (cached) return cached;

  const names = graysOnly ? grayScaleNames : scaleNames;
  const scales = Object.fromEntries(
    names.map((name) => [
      name,
      Object.values(radixExports[`${name}${isDark ? 'DarkP3' : 'P3'}`]).map((str) => new Color(str).to('oklch')),
    ]),
  ) as ScaleSet;
  referenceCache.set(key, scales);
  return scales;
}

const cloneScale = (scale: ArrayOf12<Color>) => scale.map((color) => color.clone()) as ArrayOf12<Color>;

const toHex = (color: Color) => formatHex(color.to('srgb').toString({ format: 'hex' })).toUpperCase();

export interface ScaleOptions {
  hueShift?: number;        // Degrees to shift from start to end
  saturationScale?: number; // Multiplier 0.0 to 2.0
  lockStep9?: boolean;      // When true, force step 9 to the exact base color
  role?: PaletteRole;       // 'gray' fits only the Radix gray scales, like Radix custom's gray input
  background?: string;      // Page background (defaults to #FFFFFF / #111111)
  grayColor?: string;       // Gray that tints pure black/white accents
}

function buildRadixCustomScale(baseColor: string, isDark: boolean, options: ScaleOptions) {
  const {
    hueShift = 0,
    saturationScale = 1,
    lockStep9 = false,
    role = 'accent',
    background = isDark ? DEFAULT_BACKGROUNDS.dark : DEFAULT_BACKGROUNDS.light,
    grayColor = DEFAULT_GRAY,
  } = options;
  const tweaks = { hueShift, saturationScale };
  const backgroundColor = new Color(background).to('oklch');
  const backgroundHex = toHex(backgroundColor);
  const grayScales = getReferenceScales(isDark, true);
  const baseOklch = new Color(baseColor).to('oklch');

  let scaleColors: ArrayOf12<Color>;
  let mixedFrom: [string, string, number];
  let contrastColor: Color;
  let surfaceHex: string;
  let surfaceWideGamut: string;

  if (role === 'gray') {
    // Radix custom uses the gray scale as fitted, without anchoring step 9
    ({ scale: scaleColors, mixedFrom } = getScaleFromColor(baseOklch, grayScales, backgroundColor, tweaks));
    contrastColor = getTextColor(scaleColors[8]);
    surfaceHex = isDark ? '#0000000D' : '#FFFFFFCC';
    surfaceWideGamut = isDark ? 'color(display-p3 0 0 0 / 5%)' : 'color(display-p3 1 1 1 / 80%)';
  } else {
    ({ scale: scaleColors, mixedFrom } = getScaleFromColor(
      baseOklch,
      getReferenceScales(isDark, false),
      backgroundColor,
      tweaks,
    ));

    // Make sure we use the tint from the gray scale for when base is pure white or black
    const baseHex = baseOklch.to('srgb').toString({ format: 'hex' });
    if (baseHex === '#000' || baseHex === '#fff') {
      const gray = getScaleFromColor(new Color(grayColor).to('oklch'), grayScales, backgroundColor, tweaks);
      scaleColors = cloneScale(gray.scale);
      mixedFrom = gray.mixedFrom;
    }

    const [step9, contrast] = getStep9Colors(scaleColors, baseOklch, lockStep9);
    contrastColor = contrast;
    scaleColors[8] = step9;
    scaleColors[9] = getButtonHoverColor(step9, [scaleColors]);

    // Limit saturation of the text colors
    const maxTextChroma = Math.max(scaleColors[8].coords[1], scaleColors[7].coords[1]);
    scaleColors[10].coords[1] = Math.min(maxTextChroma, scaleColors[10].coords[1]);
    scaleColors[11].coords[1] = Math.min(maxTextChroma, scaleColors[11].coords[1]);
  }

  const colors = scaleColors.map(toHex);
  const wideGamut = scaleColors.map(toOklchString);

  if (role !== 'gray') {
    surfaceHex = getAlphaColorSrgb(colors[1], backgroundHex, isDark ? 0.5 : 0.8);
    surfaceWideGamut = getAlphaColorP3(wideGamut[1], backgroundHex, isDark ? 0.5 : 0.8);
  }

  return {
    colors,
    wideGamut,
    alphaWideGamut: colors.map((color) => getAlphaColorP3(color, backgroundHex)),
    contrast: toHex(contrastColor),
    surface: surfaceHex!,
    surfaceWideGamut: surfaceWideGamut!,
    background: backgroundHex,
    mixedFrom,
  };
}

function getStep9Colors(scale: ArrayOf12<Color>, accentBaseColor: Color, lockStep9: boolean): [Color, Color] {
  const referenceBackgroundColor = scale[0];
  const distance = accentBaseColor.deltaEOK(referenceBackgroundColor) * 100;

  // If the accent base color is close to the page background color, it's likely
  // white on white or black on black, so we want to return something that makes sense instead
  if (distance < 25 && !lockStep9) {
    return [scale[8], getTextColor(scale[8])];
  }

  return [accentBaseColor, getTextColor(accentBaseColor)];
}

function getButtonHoverColor(source: Color, scales: ArrayOf12<Color>[]) {
  const [L, C, H] = source.coords;
  const newL = L > 0.4 ? L - 0.03 / (L + 0.1) : L + 0.03 / (L + 0.1);
  const newC = L > 0.4 && !isNaN(H) ? C * 0.93 + 0 : C;
  const buttonHoverColor = new Color('oklch', [newL, newC, H]);

  // Find closest in-scale color to donate the chroma and hue.
  // Especially useful when the source color is pure white or black,
  // but the gray scale is tinted.
  let closestColor = buttonHoverColor;
  let minDistance = Infinity;

  scales.forEach((scale) => {
    for (const color of scale) {
      const distance = buttonHoverColor.deltaEOK(color);
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }
    }
  });

  buttonHoverColor.coords[1] = closestColor.coords[1];
  buttonHoverColor.coords[2] = closestColor.coords[2];
  return buttonHoverColor;
}

function getScaleFromColor(
  source: Color,
  scales: ScaleSet,
  backgroundColor: Color,
  { hueShift, saturationScale }: { hueShift: number; saturationScale: number },
): { scale: ArrayOf12<Color>; mixedFrom: [string, string, number] } {
  const allColors: { scale: string; color: Color; distance: number }[] = [];

  Object.entries(scales).forEach(([name, scale]) => {
    for (const color of scale) {
      const distance = source.deltaEOK(color);
      allColors.push({ scale: name, distance, color });
    }
  });

  allColors.sort((a, b) => a.distance - b.distance);

  // Remove non-unique scales
  const closestColors = allColors.filter(
    (color, i, arr) => i === arr.findIndex((value) => value.scale === color.scale),
  );

  // If the next two closest colors are both grays, remove the second one until it's not a gray anymore.
  // The grays are all extremely close to each other, so a second gray gives no useful data.
  const grayScaleNamesStr = grayScaleNames as readonly string[];
  const allAreGrays = closestColors.every((color) => grayScaleNamesStr.includes(color.scale));
  if (!allAreGrays && grayScaleNamesStr.includes(closestColors[0].scale)) {
    while (grayScaleNamesStr.includes(closestColors[1].scale)) {
      closestColors.splice(1, 1);
    }
  }

  const colorA = closestColors[0];
  const colorB = closestColors[1];

  // Treat source (C) and the two closest colors (A, B) as a triangle. If neither angle A nor B is
  // obtuse, mix B into A in proportion to AD:BD, where D is the foot of the altitude from C.
  // Otherwise B is directionally the same as A and only A is used.
  const a = colorB.distance;
  const b = colorA.distance;
  const c = colorA.color.deltaEOK(colorB.color);

  const cosA = (b ** 2 + c ** 2 - a ** 2) / (2 * b * c);
  const sinA = Math.sin(Math.acos(cosA));
  const cosB = (a ** 2 + c ** 2 - b ** 2) / (2 * a * c);
  const sinB = Math.sin(Math.acos(cosB));

  // The ratio of the tangents of angle C in triangles ACD and BCD equals AD:BD
  const tanC1 = cosA / sinA;
  const tanC2 = cosB / sinB;
  const ratio = Math.max(0, tanC1 / tanC2) * 0.5;

  const scaleA = scales[colorA.scale];
  const scaleB = scales[colorB.scale];
  const scale = arrayOf12.map((i) =>
    new Color(Color.mix(scaleA[i], scaleB[i], ratio)).to('oklch'),
  ) as ArrayOf12<Color>;

  // Get the closest color from the pre-mixed scale we created
  const baseColor = scale.slice().sort((x, y) => source.deltaEOK(x) - source.deltaEOK(y))[0];

  // Note the chroma difference between the source color and the base color
  const ratioC = source.coords[1] / baseColor.coords[1];

  // Modify hue and chroma of the scale to match the source color
  scale.forEach((color, i) => {
    color.coords[1] = Math.min(source.coords[1] * 1.5, color.coords[1] * ratioC * saturationScale);
    color.coords[2] = hueShift ? source.coords[2] + (hueShift / 12) * (i - 6) : source.coords[2];
  });

  const mixedFrom: [string, string, number] = [colorA.scale, colorB.scale, ratio];

  // Light mode
  if (scale[0].coords[0] > 0.5) {
    const lightnessScale = scale.map(({ coords }) => coords[0]);
    const backgroundL = Math.max(0, Math.min(1, backgroundColor.coords[0]));
    const newLightnessScale = transposeProgressionStart(
      backgroundL,
      // Add white as the first "step" of the light scale
      [1, ...lightnessScale],
      lightModeEasing,
    );

    // Remove the step we added
    newLightnessScale.shift();

    newLightnessScale.forEach((lightness, i) => {
      scale[i].coords[0] = lightness;
    });

    return { scale, mixedFrom };
  }

  // Dark mode
  const ease: typeof darkModeEasing = [...darkModeEasing];
  const referenceBackgroundColorL = scale[0].coords[0];
  const backgroundColorL = Math.max(0, Math.min(1, backgroundColor.coords[0]));

  // If background is lighter than step 0, we want to gradually change the easing to linear
  const ratioL = backgroundColorL / referenceBackgroundColorL;

  if (ratioL > 1) {
    const maxRatio = 1.5;

    for (let i = 0; i < ease.length; i++) {
      const metaRatio = (ratioL - 1) * (maxRatio / (maxRatio - 1));
      ease[i] = ratioL > maxRatio ? 0 : Math.max(0, ease[i] * (1 - metaRatio));
    }
  }

  const lightnessScale = scale.map(({ coords }) => coords[0]);
  const backgroundL = backgroundColor.coords[0];
  const newLightnessScale = transposeProgressionStart(backgroundL, lightnessScale, ease);

  newLightnessScale.forEach((lightness, i) => {
    scale[i].coords[0] = lightness;
  });

  return { scale, mixedFrom };
}

function getTextColor(background: Color) {
  const white = new Color('oklch', [1, 0, 0]);

  if (Math.abs(white.contrastAPCA(background)) < 40) {
    const [, C, H] = background.coords;
    return new Color('oklch', [0.25, Math.max(0.08 * C, 0.04), H]);
  }

  return white;
}

const darkModeEasing = [1, 0, 1, 0] as [number, number, number, number];
const lightModeEasing = [0, 2, 0, 2] as [number, number, number, number];

function transposeProgressionStart(to: number, arr: number[], curve: [number, number, number, number]) {
  return arr.map((n, i, all) => {
    const lastIndex = all.length - 1;
    const diff = all[0] - to;
    const fn = BezierEasing(...curve);
    return n - diff * fn(1 - i / lastIndex);
  });
}

// Convert to OKLCH string with percentage for the lightness channel
// https://github.com/radix-ui/themes/issues/420
function toOklchString(color: Color) {
  const L = +(color.coords[0] * 100).toFixed(1);
  return color
    .to('oklch')
    .toString({ precision: 4 })
    .replace(/(\S+)(.+)/, `oklch(${L}%$2`);
}

// ===== MAIN SCALE GENERATOR =====

/**
 * Generates a 12-step Radix color scale from a base color, matching the
 * official Radix custom palette generator.
 */
export function generateScale(
  baseColor: string,
  name: string = 'Custom',
  isDark: boolean = false,
  options: ScaleOptions = {}
): ColorScale {
  try {
    return { name, ...buildRadixCustomScale(baseColor, isDark, options) };
  } catch (e) {
    console.error('Error generating scale', e);
    const black = Array(12).fill('#000000');
    return {
      name,
      colors: black,
      wideGamut: Array(12).fill('oklch(0% 0 0)'),
      alphaWideGamut: Array(12).fill('color(display-p3 0 0 0)'),
      contrast: '#FFFFFF',
      surface: '#000000',
      surfaceWideGamut: 'color(display-p3 0 0 0)',
      background: isDark ? DEFAULT_BACKGROUNDS.dark : DEFAULT_BACKGROUNDS.light,
      mixedFrom: ['gray', 'gray', 0],
    };
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

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses a 3 or 6 digit hex (with or without #) into lowercase #rrggbb, or null. */
export function normalizeHex(value: string): string | null {
  const match = value.trim().match(HEX_RE);
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex}`;
}

// ===== ALPHA COLOR GENERATION =====
// Same algorithm as Radix custom, so alpha steps blend back to the solid
// steps exactly the way browsers composite them.

// target = background * (1 - alpha) + foreground * alpha
// alpha = (target - background) / (foreground - background)
// Expects 0-1 numbers for the RGB channels
function getAlphaColor(
  targetRgb: number[],
  backgroundRgb: number[],
  rgbPrecision: number,
  alphaPrecision: number,
  targetAlpha?: number,
) {
  const [tr, tg, tb] = targetRgb.map((c) => Math.round(c * rgbPrecision));
  const [br, bg, bb] = backgroundRgb.map((c) => Math.round(c * rgbPrecision));

  // Is the background lighter, RGB-wise, than the target? If at least one channel of the
  // target is lighter than the background, lighten the background; otherwise darken it.
  let desiredRgb = 0;
  if (tr > br) {
    desiredRgb = rgbPrecision;
  } else if (tg > bg) {
    desiredRgb = rgbPrecision;
  } else if (tb > bb) {
    desiredRgb = rgbPrecision;
  }

  const alphaR = (tr - br) / (desiredRgb - br);
  const alphaG = (tg - bg) / (desiredRgb - bg);
  const alphaB = (tb - bb) / (desiredRgb - bb);

  const isPureGray = [alphaR, alphaG, alphaB].every((alpha) => alpha === alphaR);

  // No need for precision gymnastics with pure grays, and we can get cleaner output
  if (!targetAlpha && isPureGray) {
    const V = desiredRgb / rgbPrecision;
    return [V, V, V, alphaR] as const;
  }

  const clampRgb = (n: number) => (isNaN(n) ? 0 : Math.min(rgbPrecision, Math.max(0, n)));
  const clampA = (n: number) => (isNaN(n) ? 0 : Math.min(alphaPrecision, Math.max(0, n)));
  const maxAlpha = targetAlpha ?? Math.max(alphaR, alphaG, alphaB);

  const A = clampA(Math.ceil(maxAlpha * alphaPrecision)) / alphaPrecision;
  let R = clampRgb(((br * (1 - A) - tr) / A) * -1);
  let G = clampRgb(((bg * (1 - A) - tg) / A) * -1);
  let B = clampRgb(((bb * (1 - A) - tb) / A) * -1);

  R = Math.ceil(R);
  G = Math.ceil(G);
  B = Math.ceil(B);

  const blendedR = blendAlpha(R, A, br);
  const blendedG = blendAlpha(G, A, bg);
  const blendedB = blendAlpha(B, A, bb);

  // Correct for rounding errors in light mode
  if (desiredRgb === 0) {
    if (tr <= br && tr !== blendedR) R = tr > blendedR ? R + 1 : R - 1;
    if (tg <= bg && tg !== blendedG) G = tg > blendedG ? G + 1 : G - 1;
    if (tb <= bb && tb !== blendedB) B = tb > blendedB ? B + 1 : B - 1;
  }

  // Correct for rounding errors in dark mode
  if (desiredRgb === rgbPrecision) {
    if (tr >= br && tr !== blendedR) R = tr > blendedR ? R + 1 : R - 1;
    if (tg >= bg && tg !== blendedG) G = tg > blendedG ? G + 1 : G - 1;
    if (tb >= bb && tb !== blendedB) B = tb > blendedB ? B + 1 : B - 1;
  }

  return [R / rgbPrecision, G / rgbPrecision, B / rgbPrecision, A] as const;
}

// Browsers round each blended channel term separately, not the whole result.
function blendAlpha(foreground: number, alpha: number, background: number) {
  return Math.round(background * (1 - alpha)) + Math.round(foreground * alpha);
}

function getAlphaColorSrgb(targetColor: string, backgroundColor: string, targetAlpha?: number) {
  const [r, g, b, a] = getAlphaColor(
    new Color(targetColor).to('srgb').coords,
    new Color(backgroundColor).to('srgb').coords,
    255,
    255,
    targetAlpha,
  );

  return formatHex(new Color('srgb', [r, g, b], a).toString({ format: 'hex' })).toUpperCase();
}

function getAlphaColorP3(targetColor: string, backgroundColor: string, targetAlpha?: number) {
  const [r, g, b, a] = getAlphaColor(
    new Color(targetColor).to('p3').coords,
    new Color(backgroundColor).to('p3').coords,
    // P3 alpha colors blend most precisely in browsers when rounded to 255 integers too
    255,
    1000,
    targetAlpha,
  );

  return new Color('p3', [r, g, b], a)
    .toString({ precision: 4 })
    // In non-browser environments colorjs.io outputs a different format
    .replace('color(p3 ', 'color(display-p3 ');
}

// Format shortform hex to longform
function formatHex(str: string) {
  if (!str.startsWith('#')) return str;
  if (str.length === 4 || str.length === 5) {
    return '#' + str.slice(1).split('').map((c) => c + c).join('');
  }
  return str;
}

/** Parses a #RRGGBB or #RRGGBBAA hex into an AlphaColor. */
function hex8ToAlphaColor(hex8: string): AlphaColor {
  const hex = formatHex(hex8).padEnd(9, 'F').toUpperCase();
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const alpha = parseInt(hex.slice(7, 9), 16) / 255;
  const alphaStr = alpha === 1 ? '1' : alpha.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');

  const fg = chroma(r, g, b);
  const h = fg.get('hsl.h') || 0;
  const s = fg.get('hsl.s') * 100;
  const l = fg.get('hsl.l') * 100;

  return {
    rgba: `rgba(${r}, ${g}, ${b}, ${alphaStr})`,
    hsla: `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${alphaStr})`,
    hex8: hex,
    alpha,
    r,
    g,
    b,
  };
}

/**
 * Converts a solid color to its alpha equivalent over a given background.
 */
export function solidToAlpha(solidColor: string, backgroundColor: string, targetAlpha?: number): AlphaColor {
  try {
    return hex8ToAlphaColor(getAlphaColorSrgb(solidColor, backgroundColor, targetAlpha));
  } catch (e) {
    console.error('Error converting to alpha:', e);
    return hex8ToAlphaColor('#000000FF');
  }
}

/**
 * Generates a full alpha color scale from a solid color scale, over the
 * background the scale was generated for.
 */
export function generateAlphaScale(
  solidScale: ColorScale,
  isDark: boolean,
  customBackground?: string
): AlphaColorScale {
  const background =
    customBackground || solidScale.background || (isDark ? DEFAULT_BACKGROUNDS.dark : DEFAULT_BACKGROUNDS.light);

  return {
    name: `${solidScale.name}A`,
    colors: solidScale.colors.map((solidColor) => solidToAlpha(solidColor, background)),
    background,
  };
}

/** The scale's surface color (translucent step 2) as an AlphaColor. */
export function getSurfaceColor(scale: ColorScale): AlphaColor {
  return hex8ToAlphaColor(scale.surface);
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

/**
 * Formats one step of a scale. OKLCH uses the wide-gamut value, like Radix custom.
 */
export function formatScaleColor(scale: ColorScale, index: number, format: ColorFormat): string {
  return format === 'oklch' ? scale.wideGamut[index] : scale.colors[index];
}
