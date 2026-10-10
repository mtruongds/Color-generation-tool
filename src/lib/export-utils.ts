import {
  AlphaColor,
  ColorFormat,
  ColorScale,
  DEFAULT_BACKGROUNDS,
  DEFAULT_GRAY,
  ScaleOptions,
  formatScaleColor,
  generateAlphaScale,
  generateScale,
  getStepDescription,
  getSurfaceColor,
  hexToOklch,
} from './color-utils';
import type { PaletteConfig } from '../components/palette-generator/types';

/** Settings shared by every palette, like the Radix custom page background and gray. */
export interface ScaleContext {
  backgrounds: { light: string; dark: string };
  grayColor: string;
}

export const DEFAULT_SCALE_CONTEXT: ScaleContext = {
  backgrounds: { ...DEFAULT_BACKGROUNDS },
  grayColor: DEFAULT_GRAY,
};

export type GeneratedPalette = PaletteConfig & { scale: ColorScale; context: ScaleContext };

/** The gray of the first gray-role palette tints pure black/white accents. */
export function getScaleContext(palettes: PaletteConfig[], backgrounds: ScaleContext['backgrounds']): ScaleContext {
  const gray = palettes.find((p) => p.role === 'gray');
  return { backgrounds, grayColor: gray?.baseColor ?? DEFAULT_GRAY };
}

export function scaleOptionsFor(p: PaletteConfig, isDark: boolean, context: ScaleContext): ScaleOptions {
  return {
    hueShift: p.hueShift,
    saturationScale: p.saturationScale,
    lockStep9: p.lockStep9,
    role: p.role ?? 'accent',
    background: isDark ? context.backgrounds.dark : context.backgrounds.light,
    grayColor: context.grayColor,
  };
}

export function generatePaletteScale(p: PaletteConfig, isDark: boolean, context: ScaleContext): ColorScale {
  return generateScale(p.baseColor, p.name, isDark, scaleOptionsFor(p, isDark, context));
}

export const toTokenName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, '-') || 'color';

const hexToComponents = (hex: string) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateCssVariables(palettes: GeneratedPalette[], format: ColorFormat) {
  let css = ':root {\n  /* Solid Colors */\n';
  palettes.forEach((p) => {
    p.scale.colors.forEach((_, i) => {
      css += `  --${toTokenName(p.name)}-${i + 1}: ${formatScaleColor(p.scale, i, format)};\n`;
    });
  });
  css += '\n  /* Alpha Colors */\n';
  palettes.forEach((p) => {
    generateAlphaScale(p.scale, p.isDark).colors.forEach((alpha, i) => {
      css += `  --${toTokenName(p.name)}-a${i + 1}: ${alpha.rgba};\n`;
    });
  });
  css += '\n  /* Contrast and Surface */\n';
  palettes.forEach((p) => {
    css += `  --${toTokenName(p.name)}-contrast: ${p.scale.contrast};\n`;
    css += `  --${toTokenName(p.name)}-surface: ${p.scale.surface};\n`;
  });
  css += '}\n';

  // Wide-gamut values for P3 displays, as in Radix custom's CSS output
  css += '\n@supports (color: color(display-p3 1 1 1)) {\n  @media (color-gamut: p3) {\n    :root {\n';
  palettes.forEach((p) => {
    const token = toTokenName(p.name);
    p.scale.wideGamut.forEach((value, i) => (css += `      --${token}-${i + 1}: ${value};\n`));
    p.scale.alphaWideGamut.forEach((value, i) => (css += `      --${token}-a${i + 1}: ${value};\n`));
    css += `      --${token}-surface: ${p.scale.surfaceWideGamut};\n`;
  });
  return css + '    }\n  }\n}';
}

export function generateJsonTokens(palettes: GeneratedPalette[], format: ColorFormat) {
  const obj: Record<string, Record<string, { value: string; type: string; description: string }>> = {};
  palettes.forEach((p) => {
    const tokens: (typeof obj)[string] = {};
    p.scale.colors.forEach((_, i) => {
      tokens[`${i + 1}`] = {
        value: formatScaleColor(p.scale, i, format),
        type: 'color',
        description: getStepDescription(i + 1, p.name, false),
      };
    });
    generateAlphaScale(p.scale, p.isDark).colors.forEach((alpha, i) => {
      tokens[`a${i + 1}`] = {
        value: alpha.rgba,
        type: 'color',
        description: getStepDescription(i + 1, p.name, true),
      };
    });
    tokens.contrast = { value: p.scale.contrast, type: 'color', description: CONTRAST_USAGE };
    tokens.surface = {
      value: format === 'oklch' ? p.scale.surfaceWideGamut : p.scale.surface,
      type: 'color',
      description: SURFACE_USAGE,
    };
    obj[toTokenName(p.name)] = tokens;
  });
  return JSON.stringify(obj, null, 2);
}

export function generateFigmaTokens(palettes: GeneratedPalette[]) {
  const figmaExtensions = { 'com.figma.scopes': ['ALL_SCOPES'], 'com.figma.isOverride': true };
  const obj: Record<string, unknown> = {};

  palettes.forEach((p) => {
    const tokens: Record<string, unknown> = {};
    p.scale.colors.forEach((color, i) => {
      tokens[`${i + 1}`] = {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: hexToComponents(color), alpha: 1, hex: color },
        $description: getStepDescription(i + 1, p.name, false),
        $extensions: figmaExtensions,
      };
    });
    const alphaToken = (alpha: AlphaColor, description: string) => ({
      $type: 'color',
      $value: {
        colorSpace: 'srgb',
        components: [alpha.r / 255, alpha.g / 255, alpha.b / 255],
        alpha: alpha.alpha,
        hex: alpha.hex8,
      },
      $description: description,
      $extensions: figmaExtensions,
    });
    generateAlphaScale(p.scale, p.isDark).colors.forEach((alpha, i) => {
      tokens[`a${i + 1}`] = alphaToken(alpha, getStepDescription(i + 1, p.name, true));
    });
    tokens.contrast = {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: hexToComponents(p.scale.contrast), alpha: 1, hex: p.scale.contrast },
      $description: CONTRAST_USAGE,
      $extensions: figmaExtensions,
    };
    tokens.surface = alphaToken(getSurfaceColor(p.scale), SURFACE_USAGE);
    obj[toTokenName(p.name)] = tokens;
  });

  return JSON.stringify(
    {
      Color: {
        ...obj,
        $extensions: { 'com.figma.collectionName': 'Color', 'com.figma.modeName': 'Mode 1' },
      },
    },
    null,
    2,
  );
}

function alphaToOklch(alpha: AlphaColor): string {
  const hex = `#${[alpha.r, alpha.g, alpha.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const alphaValue =
    alpha.alpha === 1 ? '1' : alpha.alpha.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return hexToOklch(hex).replace(')', ` / ${alphaValue})`);
}

const escapeCsv = (field: string) =>
  /[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;

/** Light + dark values side by side, ready to paste into Google Sheets. */
export function generateSheetCsv(palettes: GeneratedPalette[]) {
  const headers = [
    'Token Name',
    'Light Mode Color',
    'Light Mode OKLCH',
    'Dark Mode Color',
    'Dark Mode OKLCH',
    'Palette Name',
    'Step',
    'Type',
    'Usage',
  ];
  let csv = headers.join(',') + '\n';

  palettes.forEach((p) => {
    const context = p.context ?? DEFAULT_SCALE_CONTEXT;
    const light = generatePaletteScale(p, false, context);
    const dark = generatePaletteScale(p, true, context);
    const lightAlpha = generateAlphaScale(light, false);
    const darkAlpha = generateAlphaScale(dark, true);
    const tokenBase = toTokenName(p.name);

    light.colors.forEach((_, i) => {
      const step = i + 1;
      csv += [
        `${tokenBase}/${step}`,
        light.colors[i],
        light.wideGamut[i],
        dark.colors[i],
        dark.wideGamut[i],
        p.name,
        `${step}`,
        'Solid',
        getStepDescription(step, p.name, false),
      ].map(escapeCsv).join(',') + '\n';
    });
    light.colors.forEach((_, i) => {
      const step = i + 1;
      csv += [
        `${tokenBase}/a${step}`,
        lightAlpha.colors[i].rgba,
        alphaToOklch(lightAlpha.colors[i]),
        darkAlpha.colors[i].rgba,
        alphaToOklch(darkAlpha.colors[i]),
        p.name,
        `a${step}`,
        'Alpha',
        getStepDescription(step, p.name, true),
      ].map(escapeCsv).join(',') + '\n';
    });
    const lightSurface = getSurfaceColor(light);
    const darkSurface = getSurfaceColor(dark);
    csv += [
      `${tokenBase}/contrast`, light.contrast, hexToOklch(light.contrast), dark.contrast, hexToOklch(dark.contrast),
      p.name, 'contrast', 'Solid', CONTRAST_USAGE,
    ].map(escapeCsv).join(',') + '\n';
    csv += [
      `${tokenBase}/surface`, lightSurface.rgba, alphaToOklch(lightSurface), darkSurface.rgba, alphaToOklch(darkSurface),
      p.name, 'surface', 'Alpha', SURFACE_USAGE,
    ].map(escapeCsv).join(',') + '\n';
  });

  return csv;
}

export const CONTRAST_USAGE = 'Text and icons on step 9 solid backgrounds';
export const SURFACE_USAGE = 'Translucent panel and card backgrounds';

/** Radix step roles — shared by the editor ramp labels and the docs table. */
export const STEP_USAGE = [
  'App background',
  'Subtle background',
  'UI element background',
  'Hovered UI element background',
  'Active / selected UI element background',
  'Subtle borders and separators',
  'UI element border and focus rings',
  'Hovered UI element border',
  'Solid backgrounds (buttons, badges)',
  'Hovered solid backgrounds',
  'Low-contrast text, secondary icons',
  'High-contrast text, primary icons',
];

export const STEP_GROUPS = [
  { label: 'Backgrounds', span: 2 },
  { label: 'Interactive', span: 3 },
  { label: 'Borders', span: 3 },
  { label: 'Solid', span: 2 },
  { label: 'Text', span: 2 },
];
