import { useState } from 'react';
import { Check, ChevronDown, Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';
import type { Product } from '../../lib/tokens';
import type { EditMode } from '../../lib/edit-mode';

/**
 * What every edit applies to: the product (a mode of the Color collection, with its own fonts) and
 * light or dark. Both stay in view in the header, so it's always clear which tokens you're changing.
 */
export function ContextBar({
  products,
  activeProductId,
  onSelectProduct,
  onAddProduct,
  onRenameProduct,
  onRemoveProduct,
  mode,
  onModeChange,
}: {
  products: Product[];
  activeProductId: string;
  onSelectProduct: (id: string) => void;
  onAddProduct: () => void;
  onRenameProduct: (id: string, name: string) => void;
  onRemoveProduct: (id: string) => void;
  mode: EditMode;
  onModeChange: (mode: EditMode) => void;
}) {
  const active = products.find((p) => p.id === activeProductId) ?? products[0];
  const isFirst = active.id === products[0].id;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    if (draft.trim()) onRenameProduct(active.id, draft.trim());
    setRenaming(false);
  };

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-background/60 p-0.5" role="group" aria-label="Editing context">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 max-w-44 gap-1.5 px-2 text-xs font-medium" aria-label={`Product: ${active.name}`}>
                <span className="text-muted-foreground max-xl:hidden">Product</span>
                <span className="truncate">{active.name}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Product whose roles and fonts you're editing · exported as a mode of Color</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Products</DropdownMenuLabel>
          {products.map((p, i) => (
            <DropdownMenuItem key={p.id} onSelect={() => onSelectProduct(p.id)}>
              <Check className={cn(p.id === active.id ? 'opacity-100' : 'opacity-0')} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {i === 0 && <span className="text-[0.6875rem] text-muted-foreground">default</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAddProduct}>
            <Plus /> Add product
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setDraft(active.name);
              setRenaming(true);
            }}
          >
            <Pencil /> Rename “{active.name}”…
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={isFirst} onSelect={() => onRemoveProduct(active.id)}>
            <Trash2 /> Delete “{active.name}”
          </DropdownMenuItem>
          {isFirst && products.length > 1 && (
            <p className="px-2 pt-1 pb-1.5 text-[0.6875rem] leading-snug text-muted-foreground">
              The default product can't be deleted. Other products inherit any role or font they leave alone from it.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <span aria-hidden className="h-4 w-px bg-border" />

      <div role="radiogroup" aria-label="Mode being edited" className="flex items-center">
        {(['light', 'dark'] as const).map((m) => {
          const Icon = m === 'light' ? Sun : Moon;
          const on = mode === m;
          return (
            <Tooltip key={m}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onModeChange(m)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'bg-card font-medium text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="max-md:sr-only">{m === 'light' ? 'Light' : 'Dark'}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Edit {m} tokens <span className="ml-1 font-mono opacity-60">⇧D</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename product</DialogTitle>
            <DialogDescription>Becomes the mode name in Figma and the data-product value in CSS.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            <Input autoFocus aria-label="Product name" value={draft} onChange={(e) => setDraft(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={commit} disabled={!draft.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
