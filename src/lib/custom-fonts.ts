import { useEffect, useSyncExternalStore } from 'react';
import type { FontKind } from './fonts';

/**
 * Fonts the user uploads. The files live in this browser's IndexedDB and are registered with
 * `document.fonts`, so any `font-family` naming them renders. Projects only store the family name.
 */

export const FONT_FILE_ACCEPT = '.woff2,.woff,.ttf,.otf';
export const MAX_FONT_FILE_BYTES = 15 * 1024 * 1024;

/** A weight like "600", or a range like "100 900" for a variable font. */
export type FaceWeight = string;
export type FaceStyle = 'normal' | 'italic';

export interface CustomFontFace {
  id: string;
  weight: FaceWeight;
  style: FaceStyle;
  fileName: string;
}

export interface CustomFont {
  family: string;
  kind: FontKind;
  faces: CustomFontFace[];
}

interface FontRecord extends CustomFontFace {
  family: string;
  kind: FontKind;
  data: ArrayBuffer;
  addedAt: number;
}

export interface NewFontFile {
  data: ArrayBuffer;
  weight: FaceWeight;
  style: FaceStyle;
  fileName: string;
}

// ============================================================
// IndexedDB
// ============================================================

const DB_NAME = 'lumina-custom-fonts';
const STORE = 'faces';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

const readAll = async () => ((await tx<FontRecord[]>('readonly', (s) => s.getAll())) ?? []).sort((a, b) => a.addedAt - b.addedAt);

// ============================================================
// Registry
// ============================================================

let fonts: CustomFont[] = [];
let ready = false;
const listeners = new Set<() => void>();
/** FontFace objects added to `document.fonts`, by face id. */
const registered = new Map<string, FontFace>();

function emit() {
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getCustomFonts = () => fonts;
export const isCustomFontsReady = () => ready;
export const findCustomFont = (family: string) => fonts.find((f) => f.family === family);

function group(records: FontRecord[]): CustomFont[] {
  const byFamily = new Map<string, CustomFont>();
  for (const r of records) {
    const font = byFamily.get(r.family) ?? { family: r.family, kind: r.kind, faces: [] };
    font.faces.push({ id: r.id, weight: r.weight, style: r.style, fileName: r.fileName });
    byFamily.set(r.family, font);
  }
  for (const f of byFamily.values()) f.faces.sort((a, b) => parseInt(a.weight) - parseInt(b.weight) || a.style.localeCompare(b.style));
  return [...byFamily.values()];
}

/** Makes `document.fonts` match the records: adds new faces, drops removed ones. */
async function sync(records: FontRecord[]) {
  const ids = new Set(records.map((r) => r.id));
  for (const [id, face] of registered) {
    if (ids.has(id)) continue;
    document.fonts.delete(face);
    registered.delete(id);
  }
  await Promise.all(
    records
      .filter((r) => !registered.has(r.id))
      .map(async (r) => {
        try {
          const face = new FontFace(r.family, r.data, { weight: r.weight, style: r.style });
          await face.load();
          document.fonts.add(face);
          registered.set(r.id, face);
        } catch {
          // A corrupt record shouldn't stop the rest from loading
        }
      }),
  );
  fonts = group(records);
  ready = true;
  emit();
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(DB_NAME) : null;
/** Other windows (the pop-out preview) reload when this one changes the fonts. */
channel?.addEventListener('message', () => void reload());

let loading: Promise<void> | null = null;
async function reload() {
  try {
    await sync(await readAll());
  } catch {
    ready = true;
    emit();
  }
}

/** Loads saved fonts once per window. */
export function initCustomFonts() {
  if (!loading && typeof indexedDB !== 'undefined') loading = reload();
  return loading ?? Promise.resolve();
}

/** The uploaded fonts, loading them on first use and re-rendering when they change. */
export function useCustomFonts(): CustomFont[] {
  useEffect(() => {
    void initCustomFonts();
  }, []);
  return useSyncExternalStore(subscribe, getCustomFonts, getCustomFonts);
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Adds faces to a family, creating it if needed. A face with the same weight and style as an
 * existing one replaces it.
 */
export async function addCustomFont(family: string, kind: FontKind, files: NewFontFile[]) {
  const existing = await readAll();
  const replaced = existing.filter((r) => r.family === family && files.some((f) => f.weight === r.weight && f.style === r.style));
  const now = Date.now();
  const records: FontRecord[] = files.map((f, i) => ({ id: newId(), family, kind, ...f, addedAt: now + i }));
  await tx('readwrite', (s) => {
    for (const r of replaced) s.delete(r.id);
    // Keep the family's kind consistent across all its faces
    for (const r of existing) if (r.family === family && r.kind !== kind && !replaced.includes(r)) s.put({ ...r, kind });
    for (const r of records) s.put(r);
  });
  await reload();
  channel?.postMessage('changed');
}

export async function removeCustomFont(family: string) {
  const ids = (await readAll()).filter((r) => r.family === family).map((r) => r.id);
  await tx('readwrite', (s) => {
    for (const id of ids) s.delete(id);
  });
  await reload();
  channel?.postMessage('changed');
}

// ============================================================
// Reading a font file
// ============================================================

export interface FontFileInfo {
  family?: string;
  weight?: FaceWeight;
  style?: FaceStyle;
}

const WEIGHT_WORDS: [RegExp, number][] = [
  [/thin|hairline/, 100],
  [/extra-?light|ultra-?light/, 200],
  [/light/, 300],
  [/semi-?bold|demi-?bold/, 600],
  [/extra-?bold|ultra-?bold/, 800],
  [/black|heavy/, 900],
  [/bold/, 700],
  [/medium/, 500],
  [/regular|normal|book|roman/, 400],
];

/** Guesses family, weight and style from a name like "KafiSans-SemiBoldItalic.woff2". */
export function infoFromFileName(fileName: string): FontFileInfo {
  const base = fileName.replace(/\.[^.]+$/, '');
  const [familyPart, stylePart = ''] = base.split(/[-_](?=[^-_]*$)/);
  const lower = (stylePart || base).toLowerCase();
  const variable = /variable|\bvf\b|\[wght/i.test(base);
  const weight = variable ? '100 900' : String(WEIGHT_WORDS.find(([re]) => re.test(lower))?.[1] ?? 400);
  const family = (stylePart ? familyPart : base)
    .replace(/\[.*?\]/g, '')
    .replace(/[-_]?(variable|vf)$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return { family: family || undefined, weight, style: /italic|oblique/.test(lower) ? 'italic' : 'normal' };
}

/** WOFF stores each table zlib-compressed; this unpacks it back to a plain sfnt font. */
async function unwoff(buf: ArrayBuffer): Promise<ArrayBuffer | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  const v = new DataView(buf);
  const numTables = v.getUint16(12);
  const tables: { tag: number; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const p = 44 + i * 20;
    const tag = v.getUint32(p);
    const offset = v.getUint32(p + 4);
    const compLength = v.getUint32(p + 8);
    const origLength = v.getUint32(p + 12);
    const raw = new Uint8Array(buf, offset, compLength);
    // Only tables we read need unpacking
    const wanted = tag === 0x6e616d65 || tag === 0x4f532f32 || tag === 0x66766172; // name, OS/2, fvar
    if (!wanted) continue;
    const data =
      compLength < origLength
        ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer())
        : raw;
    tables.push({ tag, data });
  }
  const size = 12 + tables.length * 16 + tables.reduce((n, t) => n + t.data.length + 3, 0);
  const out = new ArrayBuffer(size);
  const ov = new DataView(out);
  ov.setUint32(0, 0x00010000);
  ov.setUint16(4, tables.length);
  let cursor = 12 + tables.length * 16;
  tables.forEach((t, i) => {
    const p = 12 + i * 16;
    ov.setUint32(p, t.tag);
    ov.setUint32(p + 8, cursor);
    ov.setUint32(p + 12, t.data.length);
    new Uint8Array(out, cursor, t.data.length).set(t.data);
    cursor += (t.data.length + 3) & ~3;
  });
  return out;
}

function readSfnt(buf: ArrayBuffer): FontFileInfo {
  const v = new DataView(buf);
  const numTables = v.getUint16(4);
  const tables = new Map<string, number>();
  for (let i = 0; i < numTables; i++) {
    const p = 12 + i * 16;
    const tag = String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
    tables.set(tag, v.getUint32(p + 8));
  }
  const info: FontFileInfo = {};

  const name = tables.get('name');
  if (name !== undefined) {
    const count = v.getUint16(name + 2);
    const strings = name + v.getUint16(name + 4);
    const found: Record<number, string> = {};
    for (let i = 0; i < count; i++) {
      const p = name + 6 + i * 12;
      const platform = v.getUint16(p);
      const nameId = v.getUint16(p + 6);
      if (nameId !== 1 && nameId !== 16) continue;
      const length = v.getUint16(p + 8);
      const offset = strings + v.getUint16(p + 10);
      let s = '';
      if (platform === 3 || platform === 0) for (let j = 0; j < length; j += 2) s += String.fromCharCode(v.getUint16(offset + j));
      else for (let j = 0; j < length; j++) s += String.fromCharCode(v.getUint8(offset + j));
      // Prefer Windows/Unicode names over Mac ones
      if (s && (!found[nameId] || platform !== 1)) found[nameId] = s.trim();
    }
    info.family = found[16] || found[1];
  }

  const os2 = tables.get('OS/2');
  if (os2 !== undefined) {
    const weight = v.getUint16(os2 + 4);
    if (weight >= 1 && weight <= 1000) info.weight = String(Math.round(weight / 100) * 100 || 100);
    info.style = v.getUint16(os2 + 62) & 1 ? 'italic' : 'normal';
  }

  const fvar = tables.get('fvar');
  if (fvar !== undefined) {
    const axesOffset = fvar + v.getUint16(fvar + 4);
    const axisCount = v.getUint16(fvar + 8);
    const axisSize = v.getUint16(fvar + 10);
    for (let i = 0; i < axisCount; i++) {
      const p = axesOffset + i * axisSize;
      if (v.getUint32(p) !== 0x77676874) continue; // 'wght'
      const min = Math.round(v.getInt32(p + 4) / 65536);
      const max = Math.round(v.getInt32(p + 12) / 65536);
      info.weight = `${min} ${max}`;
    }
  }
  return info;
}

/**
 * Family, weight and style from the font's own tables (TTF, OTF and WOFF), falling back to
 * the file name (always for WOFF2, whose tables are Brotli-compressed).
 */
export async function readFontInfo(fileName: string, buf: ArrayBuffer): Promise<FontFileInfo> {
  const fallback = infoFromFileName(fileName);
  try {
    const sig = new DataView(buf).getUint32(0);
    let sfnt: ArrayBuffer | null = null;
    if (sig === 0x00010000 || sig === 0x4f54544f || sig === 0x74727565) sfnt = buf; // TrueType, 'OTTO', 'true'
    else if (sig === 0x774f4646) sfnt = await unwoff(buf); // 'wOFF'
    if (!sfnt) return fallback;
    const info = readSfnt(sfnt);
    return { family: info.family || fallback.family, weight: info.weight ?? fallback.weight, style: info.style ?? fallback.style };
  } catch {
    return fallback;
  }
}

/** "400", "100 900" → labels for the UI. */
export function weightLabel(weight: FaceWeight) {
  return weight.includes(' ') ? `Variable ${weight.replace(' ', '–')}` : weight;
}
