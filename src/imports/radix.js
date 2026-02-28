/**
 * Generates a 12-step color scale for a Design System based on a primary brand color.
 * * @param {number} h - Hue (0 - 360)
 * @param {number} s - Saturation (0 - 100)
 * @param {number} l - Lightness (0 - 100) - Ideally around 40-50% for Step 9
 * @returns {Object} An object containing the raw HSL values and formatted CSS tokens
 */
function generateDesignSystemPalette(h, s, l) {
    // 1. Define the Lightness Curve
    // Radix relies on hand-tuned curves rather than linear math to ensure 
    // steps 1-5 are subtle enough, and 11-12 have high enough contrast.
    const lightnessScale = [
        99.0,  // Step 1: App background
        97.5,  // Step 2: Subtle background
        94.0,  // Step 3: UI element background
        89.0,  // Step 4: Hovered UI element
        83.0,  // Step 5: Active UI element
        75.0,  // Step 6: Subtle borders
        65.0,  // Step 7: UI element border and focus rings
        52.0,  // Step 8: Hovered UI element border
        l,     // Step 9: Solid backgrounds (Base Color Anchor)
        Math.max(l - 5, 0),   // Step 10: Hovered solid background
        Math.max(l - 25, 10), // Step 11: Low-contrast text
        11.0   // Step 12: High-contrast text
    ];

    // 2. Define the Saturation Curve
    // Saturation naturally dips at the extreme light and dark ends 
    // to prevent colors from looking neon or muddy.
    const saturationScale = [
        s * 0.20, // Step 1
        s * 0.35, // Step 2
        s * 0.50, // Step 3
        s * 0.65, // Step 4
        s * 0.75, // Step 5
        s * 0.85, // Step 6
        s * 0.90, // Step 7
        s * 0.95, // Step 8
        s,        // Step 9 (Base Color Anchor)
        s * 0.95, // Step 10
        s * 0.80, // Step 11
        s * 0.60  // Step 12
    ];

    // 3. Generate the Palette Array
    const paletteValues = lightnessScale.map((lightness, index) => {
        // Round to 1 decimal place for cleaner CSS output
        const stepS = saturationScale[index].toFixed(1);
        const stepL = lightness.toFixed(1);
        return {
            step: index + 1,
            hslString: `hsl(${h}deg ${stepS}% ${stepL}%)`,
            h, s: stepS, l: stepL
        };
    });

    // 4. Map to CSS Variables (Design Tokens)
    let cssVariables = `:root {\n`;
    paletteValues.forEach(({ step, hslString }) => {
        cssVariables += `  --color-primary-${step}: ${hslString};\n`;
    });
    cssVariables += `}\n`;

    return {
        rawValues: paletteValues,
        cssVariables: cssVariables
    };
}

// --- Usage Example ---
// Assuming our brand primary is a vibrant blue: Hue 210, Saturation 90%, Lightness 50%
const brandBluePalette = generateDesignSystemPalette(210, 90, 50);

console.log("CSS Design Tokens Generated:");
console.log(brandBluePalette.cssVariables);