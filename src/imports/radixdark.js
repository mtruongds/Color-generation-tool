/**
 * Generates a 12-step Dark Mode color scale for a Design System.
 * @param {number} h - Hue (0 - 360)
 * @param {number} s - Saturation (0 - 100)
 * @param {number} l - Lightness (0 - 100) - Same anchor used in Light Mode
 * @returns {Object} An object containing the raw HSL values and formatted CSS tokens
 */
function generateDarkModePalette(h, s, l) {
    // 1. Define the Dark Lightness Curve
    const darkLightnessScale = [
        8.5,   // Step 1: App background (Very deep dark)
        11.0,  // Step 2: Subtle background
        14.0,  // Step 3: UI element background
        17.0,  // Step 4: Hovered UI element
        21.0,  // Step 5: Active UI element
        28.0,  // Step 6: Subtle borders
        36.0,  // Step 7: UI element border and focus rings
        45.0,  // Step 8: Hovered UI element border
        l,     // Step 9: Solid backgrounds (Base Color Anchor remains consistent!)
        Math.min(l + 5, 95),  // Step 10: Hovered solid background (gets lighter)
        Math.max(l + 35, 85), // Step 11: Low-contrast text (must be bright for legibility)
        98.0   // Step 12: High-contrast text (Almost pure white)
    ];

    // 2. Define the Dark Saturation Curve
    // Notice the severe drop in saturation for the darkest steps (0.10 multiplier).
    // Dark colors need less chroma to look like clean UI surfaces.
    const darkSaturationScale = [
        s * 0.10, // Step 1
        s * 0.15, // Step 2
        s * 0.20, // Step 3
        s * 0.30, // Step 4
        s * 0.40, // Step 5
        s * 0.50, // Step 6
        s * 0.60, // Step 7
        s * 0.75, // Step 8
        s,        // Step 9 (Base Color Anchor)
        s * 0.95, // Step 10
        s * 0.80, // Step 11
        s * 0.60  // Step 12
    ];

    // 3. Generate the Palette Array
    const paletteValues = darkLightnessScale.map((lightness, index) => {
        const stepS = darkSaturationScale[index].toFixed(1);
        const stepL = lightness.toFixed(1);
        return {
            step: index + 1,
            hslString: `hsl(${h}deg ${stepS}% ${stepL}%)`
        };
    });

    // 4. Map to CSS Variables inside a Media Query
    let cssVariables = `@media (prefers-color-scheme: dark) {\n  :root {\n`;
    paletteValues.forEach(({ step, hslString }) => {
        // We override the exact same variable names used in light mode.
        cssVariables += `    --color-primary-${step}: ${hslString};\n`;
    });
    cssVariables += `  }\n}\n`;

    return {
        rawValues: paletteValues,
        cssVariables: cssVariables
    };
}

// --- Usage Example ---
// Using the same vibrant blue: Hue 210, Saturation 90%, Lightness 50%
const brandBlueDark = generateDarkModePalette(210, 90, 50);

console.log("CSS Dark Mode Tokens Generated:");
console.log(brandBlueDark.cssVariables);