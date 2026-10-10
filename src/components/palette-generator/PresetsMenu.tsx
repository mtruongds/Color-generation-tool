import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Download, FolderOpen, Library, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { downloadFile } from '../../lib/export-utils';
import type { PaletteConfig, SavedPreset } from './types';

const STORAGE_KEY = 'radixgen_presets';

function persist(presets: SavedPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets', e);
  }
}

const newId = () => Math.random().toString(36).slice(2, 11);

export function PresetsMenu({
  palettes,
  onLoad,
}: {
  palettes: PaletteConfig[];
  onLoad: (palettes: PaletteConfig[]) => void;
}) {
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPresets(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to parse presets', e);
    }
  }, []);

  const update = useCallback((next: SavedPreset[]) => {
    setPresets(next);
    persist(next);
  }, []);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update([...presets, { id: newId(), name: trimmed, palettes, createdAt: Date.now() }]);
    setName('');
    setSaveOpen(false);
    toast.success(`Saved “${trimmed}”`);
  };

  const load = (preset: SavedPreset) => {
    onLoad(preset.palettes);
    setManageOpen(false);
    toast.success(`Loaded “${preset.name}”`);
  };

  const remove = (preset: SavedPreset) => {
    update(presets.filter((p) => p.id !== preset.id));
    toast.success(`Deleted “${preset.name}”`);
  };

  const exportAll = () => {
    const data = {
      _meta: { app: 'Lumina', version: 1, exportedAt: new Date().toISOString() },
      presets,
    };
    downloadFile(
      JSON.stringify(data, null, 2),
      `lumina-presets-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    toast.success(`Exported ${presets.length} preset(s)`);
  };

  const importFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string);
          let incoming: SavedPreset[];
          if (raw._meta && Array.isArray(raw.presets)) incoming = raw.presets;
          else if (Array.isArray(raw)) incoming = raw;
          else throw new Error('Unrecognized format');
          for (const p of incoming) {
            if (!p.id || !p.name || !Array.isArray(p.palettes))
              throw new Error('Invalid preset structure');
          }
          const existing = new Set(presets.map((p) => p.id));
          const fresh = incoming.filter((p) => !existing.has(p.id));
          update([...presets, ...fresh]);
          const skipped = incoming.length - fresh.length;
          toast.success(
            `Imported ${fresh.length} preset(s)${skipped > 0 ? `, ${skipped} duplicate(s) skipped` : ''}`,
          );
        } catch (err) {
          console.error('Import failed', err);
          toast.error('Import failed — invalid or corrupted file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground max-md:size-8 max-md:px-0" aria-label="Presets">
            <Library />
            <span className="hidden md:inline">Presets</span>
            <ChevronDown className="hidden size-3.5 opacity-60 md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setSaveOpen(true)}>
            <Save /> Save current…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            <FolderOpen /> Open preset…
            {presets.length > 0 && (
              <span className="ml-auto text-xs tabular text-muted-foreground">{presets.length}</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={importFile}>
            <Upload /> Import from file
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportAll} disabled={presets.length === 0}>
            <Download /> Export all presets
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
            <DialogDescription>
              Stores the current {palettes.length} palette{palettes.length === 1 ? '' : 's'} in this
              browser.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-2 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Label htmlFor="preset-name">Name</Label>
            <Input
              id="preset-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brand v2"
            />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!name.trim()}>
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Presets</DialogTitle>
            <DialogDescription>Pick a preset to replace the current palettes.</DialogDescription>
          </DialogHeader>
          {presets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <Library className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">No presets yet</p>
              <p className="max-w-[16rem] text-xs text-muted-foreground">
                Save your current palettes, or import a preset file exported from Lumina.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[20rem] -mx-2 px-2">
              <ul className="flex flex-col gap-1.5">
                {presets.map((preset) => (
                  <li key={preset.id} className="group flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors hover:bg-accent/60">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => load(preset)}
                    >
                      <div className="flex -space-x-1.5">
                        {preset.palettes.slice(0, 4).map((p) => (
                          <span
                            key={p.id}
                            className="size-5 rounded-full border-2 border-card"
                            style={{ backgroundColor: p.baseColor }}
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(preset.createdAt).toLocaleDateString()} ·{' '}
                          {preset.palettes.length} scales
                        </div>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${preset.name}`}
                      onClick={() => remove(preset)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
