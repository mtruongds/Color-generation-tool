import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  History,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import type { Project } from '../../lib/projects';

const timeAgo = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(t).toLocaleDateString();
};

/** The open project, with everything to switch, keep versions of, or move projects in and out of the browser. */
export function ProjectMenu({
  projects,
  activeId,
  onSwitch,
  onNew,
  onQuickStart,
  onRename,
  onDuplicate,
  onDelete,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  onImport,
  onDownload,
  versionsOpen,
  onVersionsOpenChange,
}: {
  projects: Project[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onQuickStart: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveVersion: (label: string) => void;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onImport: () => void;
  onDownload: () => void;
  versionsOpen: boolean;
  onVersionsOpenChange: (open: boolean) => void;
}) {
  const active = projects.find((p) => p.id === activeId) ?? projects[0];
  const [dialog, setDialog] = useState<'rename' | 'save' | 'delete' | null>(null);
  const [draft, setDraft] = useState('');

  const open = (kind: 'rename' | 'save' | 'delete', initial = '') => {
    setDraft(initial);
    setDialog(kind);
  };
  const submit = () => {
    if (dialog === 'rename' && draft.trim()) onRename(draft.trim());
    if (dialog === 'save') onSaveVersion(draft.trim() || `Version ${active.versions.length + 1}`);
    if (dialog === 'delete') onDelete();
    setDialog(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 max-w-48 gap-1.5 px-2 text-sm font-medium" aria-label={`Project: ${active.name}`}>
            <span className="truncate">{active.name}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Projects in this browser</DropdownMenuLabel>
          <div className="scrollbar-thin max-h-56 overflow-y-auto">
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => p.id !== active.id && onSwitch(p.id)}>
                <Check className={cn(p.id === active.id ? 'opacity-100' : 'opacity-0')} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="flex shrink-0 -space-x-1">
                  {p.data.palettes.slice(0, 3).map((c) => (
                    <span key={c.id} className="size-3 rounded-full border border-popover" style={{ backgroundColor: c.baseColor }} />
                  ))}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onQuickStart}>
            <Sparkles /> New from brand color…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onNew}>
            <FilePlus2 /> New blank project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => open('save')}>
            <Save /> Save version…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onVersionsOpenChange(true)}>
            <History /> Version history
            {active.versions.length > 0 && <span className="ml-auto text-xs text-muted-foreground tabular">{active.versions.length}</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => open('rename', active.name)}>
            <Pencil /> Rename…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onImport}>
            <Upload /> Open project file…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDownload}>
            <Download /> Download project file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={projects.length <= 1} onSelect={() => open('delete')}>
            <Trash2 /> Delete project…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === 'rename' ? 'Rename project' : dialog === 'save' ? 'Save version' : `Delete “${active.name}”?`}</DialogTitle>
            <DialogDescription>
              {dialog === 'rename'
                ? 'Shown in the header and used for the project file name.'
                : dialog === 'save'
                  ? 'A snapshot of every palette and foundation you can go back to from Version history.'
                  : `Its ${active.versions.length ? `${active.versions.length} saved versions and ` : ''}settings are removed from this browser. Download the project file first to keep a copy.`}
            </DialogDescription>
          </DialogHeader>
          {dialog !== 'delete' && (
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Label htmlFor="project-dialog-name">{dialog === 'rename' ? 'Name' : 'Label'}</Label>
              <Input
                id="project-dialog-name"
                autoFocus
                value={draft}
                placeholder={dialog === 'save' ? `Version ${active.versions.length + 1}` : undefined}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant={dialog === 'delete' ? 'destructive' : 'default'} onClick={submit} disabled={dialog === 'rename' && !draft.trim()}>
              {dialog === 'rename' ? 'Rename' : dialog === 'save' ? 'Save version' : 'Delete project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionsOpen} onOpenChange={onVersionsOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>
              Restoring replaces the current palettes and foundations. You can undo it with ⌘Z.
            </DialogDescription>
          </DialogHeader>
          {active.versions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <History className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">No versions yet</p>
              <p className="max-w-[17rem] text-xs text-muted-foreground">Save a version before a big change or before handing tokens to developers.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5"
                onClick={() => {
                  onVersionsOpenChange(false);
                  open('save');
                }}
              >
                <Save /> Save version
              </Button>
            </div>
          ) : (
            <ul className="scrollbar-thin -mx-1 flex max-h-80 flex-col gap-1 overflow-y-auto px-1">
              {active.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                  <span className="flex w-12 shrink-0 -space-x-1.5">
                    {v.data.palettes.slice(0, 4).map((p) => (
                      <span key={p.id} className="size-4 rounded-full border-2 border-card" style={{ backgroundColor: p.baseColor }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{v.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {timeAgo(v.createdAt)} · {v.data.palettes.length} {v.data.palettes.length === 1 ? 'palette' : 'palettes'}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => {
                      onRestoreVersion(v.id);
                      onVersionsOpenChange(false);
                    }}
                  >
                    <RotateCcw className="size-3" /> Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${v.label}`}
                    onClick={() => onDeleteVersion(v.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
