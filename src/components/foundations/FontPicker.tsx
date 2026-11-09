import { useEffect, useId, useRef, useState } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, Settings2, Trash2, Upload, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { type FontKind, fontKind, isBuiltInFont } from '../../lib/fonts';
import { fontStack } from '../../lib/foundations';
import {
  type CustomFont,
  type FaceStyle,
  type FaceWeight,
  FONT_FILE_ACCEPT,
  MAX_FONT_FILE_BYTES,
  addCustomFont,
  isCustomFontsReady,
  readFontInfo,
  removeCustomFont,
  useCustomFonts,
  weightLabel,
} from '../../lib/custom-fonts';
import { SegmentedField } from './inspector-controls';

const UPLOAD = '__upload-font';
const MANAGE = '__manage-fonts';

function Tag({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'warn' }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-px font-sans text-[0.6875rem] leading-4 font-medium',
        tone === 'warn' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

/** A select item whose tag sits outside ItemText, so the trigger shows only the family. */
function FontItem({ value, children, tag, className }: { value: string; children: React.ReactNode; tag?: React.ReactNode; className?: string }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 [&_svg:not([class*=text-])]:text-muted-foreground',
        className,
      )}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <span className="min-w-0 flex-1 truncate">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </span>
      {tag}
    </SelectPrimitive.Item>
  );
}

export interface FontOption {
  value: string;
  label: React.ReactNode;
}

/**
 * Font dropdown: built-in fonts, the user's uploaded fonts (tagged "Uploaded"), and actions to
 * upload a font or manage the uploaded ones.
 */
export function FontSelectField({
  label,
  value,
  options,
  leading,
  role,
  onChange,
}: {
  label: string;
  value: string;
  /** Built-in fonts for this role. */
  options: FontOption[];
  /** Options above the fonts, such as "inherit from the first product". */
  leading?: FontOption[];
  role: 'text' | 'mono';
  onChange: (family: string) => void;
}) {
  const id = useId();
  const custom = useCustomFonts();
  const [dialog, setDialog] = useState<null | 'upload' | 'manage'>(null);

  const known = new Set([...options, ...(leading ?? [])].map((o) => o.value).concat(custom.map((f) => f.family)));
  // Wait for saved fonts to load before calling a family missing
  const missing = !known.has(value) && isCustomFontsReady() ? value : null;

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="shrink-0 text-sm font-normal">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === UPLOAD) setDialog('upload');
          else if (v === MANAGE) setDialog('manage');
          else onChange(v);
        }}
      >
        <SelectTrigger id={id} size="sm" className="w-[11rem] min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
          {leading?.map((o) => (
            <FontItem key={o.value} value={o.value}>
              {o.label}
            </FontItem>
          ))}
          {missing && (
            <FontItem value={missing} tag={<Tag tone="warn">Missing</Tag>}>
              {missing}
            </FontItem>
          )}
          {custom.length > 0 && (
            <SelectGroup>
              <SelectLabel>Uploaded</SelectLabel>
              {custom.map((f) => (
                <FontItem key={f.family} value={f.family} tag={<Tag>Uploaded</Tag>}>
                  <span style={{ fontFamily: fontStack(f.family, f.kind) }}>{f.family}</span>
                </FontItem>
              ))}
              <SelectSeparator />
            </SelectGroup>
          )}
          <SelectGroup>
            {custom.length > 0 && <SelectLabel>Built-in</SelectLabel>}
            {options.map((o) => (
              <FontItem key={o.value} value={o.value}>
                {o.label}
              </FontItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <FontItem value={UPLOAD} className="text-muted-foreground focus:text-accent-foreground">
            <span className="flex items-center gap-2">
              <Upload className="size-3.5" /> Upload font…
            </span>
          </FontItem>
          {custom.length > 0 && (
            <FontItem value={MANAGE} className="text-muted-foreground focus:text-accent-foreground">
              <span className="flex items-center gap-2">
                <Settings2 className="size-3.5" /> Manage uploaded fonts…
              </span>
            </FontItem>
          )}
        </SelectContent>
      </Select>
      <FontUploadDialog
        open={dialog !== null}
        mode={dialog ?? 'upload'}
        defaultKind={role === 'mono' ? 'mono' : 'sans'}
        onOpenChange={(o) => !o && setDialog(null)}
        onAdded={(family) => {
          onChange(family);
          setDialog(null);
        }}
      />
    </div>
  );
}

// ============================================================
// Upload dialog
// ============================================================

interface PendingFile {
  key: string;
  file: File;
  data: ArrayBuffer;
  weight: FaceWeight;
  style: FaceStyle;
}

const STATIC_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const KIND_OPTIONS: { value: FontKind; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];
const PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog';

let previewCount = 0;

/** Registers the pending files under a throwaway family so the dialog can preview them. */
function usePreviewFamily(files: PendingFile[]) {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    if (!files.length) {
      setFamily(null);
      return;
    }
    const name = `__monism-preview-${++previewCount}`;
    const faces = files.map((f) => new FontFace(name, f.data, { weight: f.weight, style: f.style }));
    let live = true;
    Promise.allSettled(faces.map((face) => face.load())).then(() => {
      if (!live) return;
      faces.forEach((face) => face.status === 'loaded' && document.fonts.add(face));
      setFamily(name);
    });
    return () => {
      live = false;
      faces.forEach((face) => document.fonts.delete(face));
    };
  }, [files]);
  return family;
}

function FontUploadDialog({
  open,
  mode,
  defaultKind,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  mode: 'upload' | 'manage';
  defaultKind: FontKind;
  onOpenChange: (open: boolean) => void;
  onAdded: (family: string) => void;
}) {
  const custom = useCustomFonts();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [family, setFamily] = useState('');
  const [kind, setKind] = useState<FontKind>(defaultKind);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const preview = usePreviewFamily(files);

  // Start fresh each time it opens
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setFamily('');
    setKind(defaultKind);
    setError(null);
    setBusy(false);
  }, [open, defaultKind]);

  const addFiles = async (list: FileList | File[]) => {
    setError(null);
    const accepted = [...list].filter((f) => /\.(woff2?|ttf|otf)$/i.test(f.name));
    if (!accepted.length) {
      setError('Choose a .woff2, .woff, .ttf or .otf file.');
      return;
    }
    const tooBig = accepted.find((f) => f.size > MAX_FONT_FILE_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is over ${MAX_FONT_FILE_BYTES / 1024 / 1024} MB.`);
      return;
    }
    const parsed: PendingFile[] = [];
    let detectedFamily: string | undefined;
    for (const file of accepted) {
      const data = await file.arrayBuffer();
      try {
        await new FontFace('__monism-check', data).load();
      } catch {
        setError(`${file.name} isn't a font the browser can read.`);
        return;
      }
      const info = await readFontInfo(file.name, data);
      detectedFamily ??= info.family;
      parsed.push({ key: `${file.name}-${file.size}-${file.lastModified}`, file, data, weight: info.weight ?? '400', style: info.style ?? 'normal' });
    }
    setFiles((prev) => [...prev.filter((p) => !parsed.some((n) => n.key === p.key)), ...parsed]);
    setFamily((f) => f || detectedFamily || '');
    const existing = custom.find((f) => f.family === detectedFamily);
    if (existing) setKind(existing.kind);
  };

  const trimmed = family.trim();
  const existing = custom.find((f) => f.family === trimmed);
  const duplicate = files.find((f, i) => files.findIndex((o) => o.weight === f.weight && o.style === f.style) !== i);
  const problem = !trimmed
    ? 'Name the font family.'
    : isBuiltInFont(trimmed)
      ? `“${trimmed}” is already a built-in font. Give it another name.`
      : trimmed.startsWith('__')
        ? 'Choose another name.'
        : duplicate
          ? `Two files are set to ${weightLabel(duplicate.weight)} ${duplicate.style}. Change one of them.`
          : null;

  const submit = async () => {
    if (problem || !files.length) return;
    setBusy(true);
    try {
      await addCustomFont(
        trimmed,
        kind,
        files.map((f) => ({ data: f.data, weight: f.weight, style: f.style, fileName: f.file.name })),
      );
      onAdded(trimmed);
    } catch {
      setError('Couldn’t save the font in this browser. Storage may be full or blocked.');
      setBusy(false);
    }
  };

  const showUpload = mode === 'upload' || files.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{mode === 'manage' && !files.length ? 'Uploaded fonts' : 'Upload font'}</DialogTitle>
          <DialogDescription>
            Fonts stay in this browser. They aren’t sent anywhere or included in exports. Projects save only the family name.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept={FONT_FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {showUpload && files.length === 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors hover:border-foreground/30 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              dragging && 'border-foreground/40 bg-accent/60',
            )}
          >
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Drop font files here or click to browse</span>
            <span className="text-xs text-muted-foreground">.woff2, .woff, .ttf, .otf · one file per weight, or one variable font</span>
          </button>
        )}

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-4 py-5">
              <div
                className="truncate text-3xl leading-tight"
                style={{ fontFamily: preview ? `"${preview}", ${kind === 'mono' ? 'monospace' : kind === 'serif' ? 'serif' : 'sans-serif'}` : undefined }}
              >
                {trimmed || 'Aa'}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground" style={{ fontFamily: preview ? `"${preview}"` : undefined }}>
                {PREVIEW_TEXT}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="font-family-name" className="text-sm font-normal">
                  Family name
                </Label>
                <Input id="font-family-name" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="Brand Sans" />
              </div>
              <SegmentedField label="Category" value={kind} options={KIND_OPTIONS} onChange={setKind} />
            </div>
            {existing && !problem && (
              <p className="-mt-2 text-xs text-muted-foreground">Adds these files to your uploaded “{existing.family}”. Matching weights are replaced.</p>
            )}

            <div className="divide-y rounded-lg border">
              {files.map((f) => {
                const variable = f.weight.includes(' ');
                return (
                  <div key={f.key} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs" title={f.file.name}>
                      {f.file.name}
                    </span>
                    <MiniSelect
                      label={`Weight of ${f.file.name}`}
                      value={f.weight}
                      options={[...(variable ? [f.weight] : []), ...STATIC_WEIGHTS].map((w) => ({ value: w, label: weightLabel(w) }))}
                      onChange={(weight) => setFiles((list) => list.map((p) => (p.key === f.key ? { ...p, weight } : p)))}
                    />
                    <MiniSelect
                      label={`Style of ${f.file.name}`}
                      value={f.style}
                      options={[
                        { value: 'normal', label: 'Normal' },
                        { value: 'italic', label: 'Italic' },
                      ]}
                      onChange={(style) => setFiles((list) => list.map((p) => (p.key === f.key ? { ...p, style: style as FaceStyle } : p)))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Remove ${f.file.name}`}
                      onClick={() => setFiles((list) => list.filter((p) => p.key !== f.key))}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              >
                <Upload className="size-3.5" /> Add another weight…
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {files.length > 0 && problem && trimmed && <p className="text-sm text-destructive">{problem}</p>}

        {files.length > 0 ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setFiles([])}>
              Cancel
            </Button>
            <Button disabled={!!problem || busy} onClick={submit}>
              {busy ? 'Adding…' : existing ? 'Add to font' : 'Add font'}
            </Button>
          </DialogFooter>
        ) : (
          <UploadedFontList fonts={custom} onUpload={mode === 'manage' ? () => inputRef.current?.click() : undefined} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MiniSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={label} className="h-7 w-auto gap-1 px-2 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <FontItem key={o.value} value={o.value}>
            {o.label}
          </FontItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "12 styles", or "Variable" for a single variable file. */
function styleCount(f: CustomFont) {
  if (f.faces.length === 1 && f.faces[0].weight.includes(' ')) return 'Variable';
  return `${f.faces.length} ${f.faces.length === 1 ? 'style' : 'styles'}`;
}

/** The uploaded fonts, each with a two-step remove. */
function UploadedFontList({ fonts, onUpload }: { fonts: CustomFont[]; onUpload?: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!fonts.length && !onUpload) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Uploaded fonts</h4>
        {onUpload && (
          <Button variant="outline" size="sm" onClick={onUpload}>
            <Upload /> Upload font
          </Button>
        )}
      </div>
      {fonts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No uploaded fonts yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {fonts.map((f) => (
            <li key={f.family} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base" style={{ fontFamily: fontStack(f.family, fontKind(f.family)) }}>
                    {f.family}
                  </span>
                  <Tag>Uploaded</Tag>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground tabular">
                  {KIND_OPTIONS.find((k) => k.value === f.kind)?.label} · {styleCount(f)}
                </div>
              </div>
              {confirming === f.family ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    Keep
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setConfirming(null);
                      void removeCustomFont(f.family);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${f.family}`} onClick={() => setConfirming(f.family)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Anything using a removed font shows it as Missing until you upload it again or pick another.</p>
    </div>
  );
}
