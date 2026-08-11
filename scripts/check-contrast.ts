import { generateScale, getAPCA, getContrast, getWCAGRating, getAPCARating } from '../src/lib/color-utils';

type CheckTarget = {
  name: string;
  base: string;
};

const targets: CheckTarget[] = [
  { name: 'Primary', base: '#3e63dd' },
  { name: 'Neutral', base: '#71717a' },
];

function fmt(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 'NaN';
  return value.toFixed(digits);
}

function reportFor(target: CheckTarget) {
  [false, true].forEach((isDark) => {
    const scale = generateScale(target.base, target.name, isDark);
    const colors = scale.colors;
    const bg = colors[0];
    const step9 = colors[8];
    const step10 = colors[9];
    const step11 = colors[10];
    const step12 = colors[11];

    console.log(`\n=== ${target.name} — mode: ${isDark ? 'dark' : 'light'} ===`);
    console.log('base:', target.base);
    console.log('step9 :', step9);
    console.log('step10:', step10);
    console.log('step11:', step11);
    console.log('step12:', step12);

    // APCA: text vs background
    const apca11_bg = getAPCA(step11, bg);
    const apca11_10 = getAPCA(step11, step10);
    const apca12_bg = getAPCA(step12, bg);

    console.log(`APCA step11 vs background: ${fmt(apca11_bg)}`, getAPCARating(apca11_bg).label);
    console.log(`APCA step11 vs step10    : ${fmt(apca11_10)}`, getAPCARating(apca11_10).label);
    console.log(`APCA step12 vs background: ${fmt(apca12_bg)}`, getAPCARating(apca12_bg).label);

    // WCAG contrast ratio
    const wcag11_bg = getContrast(step11, bg);
    const wcag12_bg = getContrast(step12, bg);
    const wcag11_10 = getContrast(step11, step10);

    console.log(`WCAG step11 vs background: ${fmt(wcag11_bg)}`, getWCAGRating(wcag11_bg).label);
    console.log(`WCAG step12 vs background: ${fmt(wcag12_bg)}`, getWCAGRating(wcag12_bg).label);
    console.log(`WCAG step11 vs step10    : ${fmt(wcag11_10)}`, getWCAGRating(wcag11_10).label);

    // Short summary
    console.log('---');
  });
}

(async function main() {
  console.log('Running contrast checks for Primary and Neutral palettes...');
  targets.forEach(reportFor);
  console.log('\nDone.');
})();
