import { type ComponentProps, useRef, useState } from 'react';
import { ChevronsUpDown, CornerDownRight, MoreHorizontal, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import { ROLE_LABELS, type ColorRole, type Product } from '../../lib/tokens';
import { PaletteSidebar } from './PaletteSidebar';

type PalettePickerProps = Omit<ComponentProps<typeof PaletteSidebar>, 'collapsed'> & {
  products: Product[];
  activeProductId: string;
  onSelectProduct: (id: string) => void;
  onAddProduct: () => void;
  onRenameProduct: (id: string, name: string) => void;
  onRemoveProduct: (id: string) => void;
  /** Every role of the active product and the palette filling it, inherited from the first product or not. */
  productRoles: Map<ColorRole, { paletteId: string; inherited: boolean }>;
};

const BRAND_ROLES: ColorRole[] = ['brand', 'brand-secondary'];

/**
 * Dropdown that shows the active palette and opens the full palette list to switch, add, reorder
 * or manage palettes. Picking a palette closes it so its controls show below. Above it, the product
 * whose roles the list edits.
 */
export function PalettePicker({
  products,
  activeProductId,
  onSelectProduct,
  onAddProduct,
  onRenameProduct,
  onRemoveProduct,
  productRoles,
  ...props
}: PalettePickerProps) {
  const { palettes, activeId, roles, onSelect, onAdd } = props;
  const [open, setOpen] = useState(false);
  const active = palettes.find((p) => p.id === activeId) ?? palettes[0];
  const role = active && roles.get(active.id)?.role;
  const productIndex = Math.max(0, products.findIndex((p) => p.id === activeProductId));
  const product = products[productIndex];
  const isExtra = productIndex > 0;

  return (
    <div className="sticky top-0 z-10 border-b bg-sidebar/95 px-3 py-3 backdrop-blur">
      <ProductSwitcher
        products={products}
        activeId={product.id}
        onSelect={onSelectProduct}
        onAdd={onAddProduct}
        onRename={onRenameProduct}
        onRemove={onRemoveProduct}
      />

      <div className="mt-3 mb-1.5 px-2 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
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

      {isExtra && (
        <ProductRoles
          product={product}
          first={products[0]}
          roles={productRoles}
          palettes={palettes}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

/** Chips for each product, the active one with a menu to rename or delete it. */
export function ProductSwitcher({
  products,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onRemove,
}: {
  products: Product[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  /** Set when Rename is picked from the menu, so closing the menu doesn't pull focus off the name field. */
  const renamingFromMenu = useRef(false);
  const activeIndex = products.findIndex((p) => p.id === activeId);
  const active = products[activeIndex];

  const startRename = (p: Product) => {
    setDraft(p.name);
    setEditing(p.id);
  };
  const commit = () => {
    if (editing && draft.trim()) onRename(editing, draft.trim());
    setEditing(null);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-2">
        <span className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">Product</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${active?.name} options`}
              className="relative -my-1 size-6 text-muted-foreground after:absolute after:-inset-1 hover:text-foreground"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48"
            onCloseAutoFocus={(e) => {
              if (!renamingFromMenu.current) return;
              renamingFromMenu.current = false;
              e.preventDefault();
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                if (!active) return;
                renamingFromMenu.current = true;
                startRename(active);
              }}
            >
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAdd}>
              <Plus /> Add product
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={activeIndex <= 0} onSelect={() => active && onRemove(active.id)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Product">
        {products.map((p) =>
          editing === p.id ? (
            <Input
              key={p.id}
              autoFocus
              aria-label="Product name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(null);
              }}
              className="h-7 w-32 rounded-full px-2.5 text-xs"
            />
          ) : (
            <button
              key={p.id}
              type="button"
              // Clicking the selected product again renames it
              onClick={() => (p.id === activeId ? startRename(p) : onSelect(p.id))}
              onDoubleClick={() => startRename(p)}
              aria-pressed={p.id === activeId}
              title={p.id === activeId ? 'Click to rename' : `Switch to ${p.name} · double-click to rename`}
              className={cn(
                'max-w-36 truncate rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                p.id === activeId ? 'border-foreground/40 bg-sidebar-accent font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {p.name}
            </button>
          ),
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 rounded-full text-muted-foreground" onClick={onAdd} aria-label="Add product">
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add product · exported as a mode of Color</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/** The roles of an extra product: its own palettes, and the ones it still takes from the first product. */
function ProductRoles({
  product,
  first,
  roles,
  palettes,
  onSelect,
}: {
  product: Product;
  first: Product;
  roles: Map<ColorRole, { paletteId: string; inherited: boolean }>;
  palettes: ComponentProps<typeof PaletteSidebar>['palettes'];
  onSelect: (id: string) => void;
}) {
  const byId = new Map(palettes.map((p) => [p.id, p]));
  const warnings = [...roles].filter(([r, h]) => h.inherited && BRAND_ROLES.includes(r)).length;

  return (
    <div className="mt-3 rounded-xl border bg-card/60 p-1.5">
      <div className="flex items-center justify-between gap-2 px-1.5 pt-0.5 pb-1.5 text-[0.6875rem] text-muted-foreground">
        <span className="font-medium tracking-wide uppercase">Roles in {product.name}</span>
        {warnings > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-3" />
            {warnings} brand {warnings === 1 ? 'role' : 'roles'} inherited
          </span>
        )}
      </div>
      <ul className="flex flex-col">
        {[...roles].map(([r, { paletteId, inherited }]) => {
          const p = byId.get(paletteId);
          if (!p) return null;
          const warn = inherited && BRAND_ROLES.includes(r);
          return (
            <li key={r}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className={cn('swatch-outline size-3 shrink-0 rounded-full', inherited && 'opacity-60')}
                  style={{ backgroundColor: p.baseColor }}
                />
                <span className={cn('min-w-0 flex-1 truncate', inherited ? 'text-muted-foreground' : 'font-medium')}>{p.name}</span>
                <span className="shrink-0 text-muted-foreground">{ROLE_LABELS[r]}</span>
                {inherited ? (
                  <span
                    className={cn('flex shrink-0 items-center', warn ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/70')}
                    title={`From ${first.name}${warn ? ': pick a palette for this brand role' : ''}`}
                  >
                    {warn ? <TriangleAlert className="size-3" /> : <CornerDownRight className="size-3" />}
                  </span>
                ) : (
                  <span className="size-3 shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-1.5 pt-1.5 pb-0.5 text-[0.6875rem] leading-snug text-muted-foreground">
        Open a palette's menu › Token role to fill a role for {product.name}. Roles left alone come from {first.name}.
      </p>
    </div>
  );
}
