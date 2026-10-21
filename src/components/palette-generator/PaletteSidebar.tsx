import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownToLine, ArrowUpToLine, CopyPlus, GripVertical, MoreHorizontal, Plus, Tag, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import type { GeneratedPalette } from '../../lib/export-utils';
import { ROLE_LABELS, type ColorRole } from '../../lib/tokens';

/** Short role names for the row badge. */
const ROLE_BADGES: Record<ColorRole, string> = {
  brand: 'Brand',
  'brand-secondary': 'Brand 2',
  neutral: 'Neutral',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
};
/** Roles offered in the row menu: neutral fits gray palettes, the rest fit accents. */
const ACCENT_ROLES: ColorRole[] = ['brand', 'brand-secondary', 'info', 'success', 'warning', 'danger'];
const GRAY_ROLES: ColorRole[] = ['neutral'];

interface PaletteSidebarProps {
  palettes: GeneratedPalette[];
  activeId: string;
  collapsed?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  /** Moves a palette to the given index in the list. */
  onMove: (id: string, toIndex: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  /** Resolved token role of each palette. */
  roles: Map<string, { role?: ColorRole }>;
  /** Gives a palette a token role, swapping with the palette that holds it. */
  onSetRole: (id: string, role: ColorRole | 'none') => void;
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
  roles,
  onSetRole,
}: PaletteSidebarProps) {
  const sensors = useSensors(
    // A small distance keeps a click on the handle from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const toIndex = palettes.findIndex((p) => p.id === over.id);
    if (toIndex !== -1) onMove(String(active.id), toIndex);
  };

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={palettes.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {palettes.map((p, index) => (
              <SortablePaletteItem
                key={p.id}
                palette={p}
                active={p.id === activeId}
                isFirst={index === 0}
                isLast={index === palettes.length - 1}
                onSelect={() => onSelect(p.id)}
                onMoveToTop={() => onMove(p.id, 0)}
                onMoveToLast={() => onMove(p.id, palettes.length - 1)}
                onDuplicate={() => onDuplicate(p.id)}
                onRemove={() => onRemove(p.id)}
                canRemove={palettes.length > 1}
                role={roles.get(p.id)?.role}
                onSetRole={(role) => onSetRole(p.id, role)}
              />
            ))}
          </SortableContext>
        </DndContext>

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

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface SortablePaletteItemProps {
  palette: GeneratedPalette;
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveToTop: () => void;
  onMoveToLast: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
  role?: ColorRole;
  onSetRole: (role: ColorRole | 'none') => void;
}

function SortablePaletteItem({
  palette: p,
  active,
  isFirst,
  isLast,
  onSelect,
  onMoveToTop,
  onMoveToLast,
  onDuplicate,
  onRemove,
  canRemove,
  role,
  onSetRole,
}: SortablePaletteItemProps) {
  const badge = role && ROLE_BADGES[role];
  const menuRoles = p.role === 'gray' ? GRAY_ROLES : ACCENT_ROLES;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-20')}
    >
      <div
        className={cn(
          'group relative flex items-center gap-1 rounded-xl py-2 pr-2 pl-0.5 transition-[background-color,box-shadow]',
          active ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60',
          isDragging && 'bg-sidebar-accent shadow-lg',
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${p.name}`}
          className={cn(
            'relative z-10 flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground/70 transition-opacity hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
            'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
            isDragging && 'opacity-100 md:opacity-100',
          )}
        >
          <GripVertical className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={onSelect}
          aria-current={active}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          <span className="swatch-outline size-8 shrink-0 rounded-sm" style={{ backgroundColor: p.baseColor }} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium">{p.name || 'Untitled'}</span>
                {badge && (
                  <span className="shrink-0 rounded-full bg-foreground/10 px-1.5 py-px text-[0.625rem] font-medium text-foreground/80">
                    {badge}
                  </span>
                )}
              </span>
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
              className="relative z-10 size-7 shrink-0 text-muted-foreground after:absolute after:-inset-1.5 hover:text-foreground"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-56">
            <DropdownMenuItem onSelect={onMoveToTop} disabled={isFirst}>
              <ArrowUpToLine /> Move to top
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMoveToLast} disabled={isLast}>
              <ArrowDownToLine /> Move to last
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <CopyPlus /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag /> Token role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuRadioGroup value={role ?? ''} onValueChange={(v) => onSetRole(v as ColorRole | 'none')}>
                  {menuRoles.map((r) => (
                    <DropdownMenuRadioItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </DropdownMenuRadioItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove} disabled={!canRemove}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
