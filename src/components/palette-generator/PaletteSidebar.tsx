import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, CopyPlus, Lock, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import type { GeneratedPalette } from '../../lib/export-utils';
import type { MoveDirection } from './types';

interface PaletteSidebarProps {
  palettes: GeneratedPalette[];
  activeId: string;
  collapsed?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, direction: MoveDirection) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

export function PaletteSidebar({
  palettes,
  activeId,
  collapsed = false,
  onSelect,
  onAdd,
  onMove,
  onDuplicate,
  onRemove,
}: PaletteSidebarProps) {
  if (collapsed) {
    return (
      <nav aria-label="Palettes" className="flex h-full flex-col items-center gap-2 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={onAdd} aria-label="Add palette">
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add palette</TooltipContent>
        </Tooltip>
        <div className="h-px w-6 bg-border" />
        {/* Full width + padding so the ring and its offset aren't clipped by the scroll container. */}
        <div className="scrollbar-thin flex w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto py-1.5">
          {palettes.map((p) => (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={p.name}
                  aria-current={p.id === activeId}
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    'relative size-7 rounded-md ring-offset-2 ring-offset-sidebar transition-[scale,box-shadow] after:absolute after:-inset-x-1.5 after:-inset-y-[5px] hover:scale-105 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    p.id === activeId && 'ring-2 ring-foreground/70',
                  )}
                  style={{ backgroundColor: p.baseColor }}
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                {p.name} <span className="ml-1 font-mono opacity-70">{p.baseColor}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Palettes" className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Palettes <span className="ml-1 tabular text-muted-foreground/70">{palettes.length}</span>
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative size-7 after:absolute after:-inset-1.5" onClick={onAdd} aria-label="Add palette">
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add palette</TooltipContent>
        </Tooltip>
      </div>

      <ul className="scrollbar-thin flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        {palettes.map((p, index) => {
          const active = p.id === activeId;
          return (
            <li key={p.id}>
              <div
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-2 py-2 transition-colors',
                  active ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-current={active}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  <span
                    className="swatch-outline size-8 shrink-0 rounded-sm"
                    style={{ backgroundColor: p.baseColor }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{p.name || 'Untitled'}</span>
                      <span className="font-mono text-[0.6875rem] text-muted-foreground uppercase">
                        {p.baseColor.replace('#', '')}
                      </span>
                    </span>
                    <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full">
                      {p.scale.colors.map((c, i) => (
                        <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${p.name} options`}
                      className="relative z-10 size-7 shrink-0 text-muted-foreground after:absolute after:-inset-1.5 opacity-100 hover:text-foreground data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="right" className="w-44">
                    <DropdownMenuItem onSelect={() => onMove(p.id, 'top')} disabled={index === 0}>
                      <ArrowUpToLine /> Move to top
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(p.id, -1)} disabled={index === 0}>
                      <ArrowUp /> Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(p.id, 1)} disabled={index === palettes.length - 1}>
                      <ArrowDown /> Move down
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(p.id, 'last')} disabled={index === palettes.length - 1}>
                      <ArrowDownToLine /> Move to last
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDuplicate(p.id)}>
                      <CopyPlus /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => onRemove(p.id)}
                      disabled={p.locked}
                    >
                      {p.locked ? (
                        <>
                          <Lock /> Default palette
                        </>
                      ) : (
                        <>
                          <Trash2 /> Delete
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}

        <li className="mt-1">
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-sidebar-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" /> Add palette
          </button>
        </li>
      </ul>
    </nav>
  );
}
