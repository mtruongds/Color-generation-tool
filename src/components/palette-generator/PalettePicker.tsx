import { type ComponentProps, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../ui/utils';
import { ROLE_LABELS } from '../../lib/tokens';
import { PaletteSidebar } from './PaletteSidebar';

type PalettePickerProps = Omit<ComponentProps<typeof PaletteSidebar>, 'collapsed'>;

/**
 * Dropdown that shows the active palette and opens the full palette list to switch, add, reorder
 * or manage palettes. Picking a palette closes it so its controls show below.
 */
export function PalettePicker(props: PalettePickerProps) {
  const { palettes, activeId, roles, onSelect, onAdd } = props;
  const [open, setOpen] = useState(false);
  const active = palettes.find((p) => p.id === activeId) ?? palettes[0];
  const role = active && roles.get(active.id)?.role;

  return (
    <div className="sticky top-0 z-10 border-b bg-sidebar/95 px-3 py-3 backdrop-blur">
      <div className="mb-1.5 px-2 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
        Palette <span className="ml-0.5 tabular text-muted-foreground/70">{palettes.length}</span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Switch palette"
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border bg-card px-2.5 py-2 text-left shadow-xs transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              open && 'bg-sidebar-accent/60',
            )}
          >
            {active && (
              <>
                <span className="swatch-outline size-8 shrink-0 rounded-sm" style={{ backgroundColor: active.baseColor }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{active.name || 'Untitled'}</span>
                      {role && (
                        <span className="shrink-0 truncate rounded-full bg-foreground/10 px-1.5 py-px text-[0.625rem] font-medium text-foreground/80">
                          {ROLE_LABELS[role]}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[0.6875rem] text-muted-foreground uppercase">
                      {active.baseColor.replace('#', '')}
                    </span>
                  </span>
                  <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full">
                    {active.scale.colors.map((c, i) => (
                      <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                </span>
              </>
            )}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex max-h-[min(30rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-72 flex-col overflow-hidden rounded-xl bg-sidebar p-0 [&>nav]:min-h-0"
        >
          <PaletteSidebar
            {...props}
            onSelect={(id) => {
              onSelect(id);
              setOpen(false);
            }}
            onAdd={() => {
              onAdd();
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
