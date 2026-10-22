import { Eye, Layers, LayoutGrid, Palette, Ruler, SquareRoundCorner, Type, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../ui/utils';
import type { FoundationKey } from '../../lib/foundations';

export const FOUNDATION_META: Record<FoundationKey, { label: string; icon: LucideIcon; title: string; blurb: string }> = {
  color: { label: 'Color', icon: Palette, title: 'Color scales', blurb: '12-step scales with alpha, contrast and surface tokens' },
  typography: { label: 'Typography', icon: Type, title: 'Typography', blurb: 'A responsive type scale from a base size and a ratio' },
  spacing: { label: 'Spacing', icon: Ruler, title: 'Spacing', blurb: 'One base unit, every gap and padding' },
  radius: { label: 'Radius', icon: SquareRoundCorner, title: 'Radius', blurb: 'Corner radii scaled from one base value' },
  shadow: { label: 'Shadow', icon: Layers, title: 'Shadow & elevation', blurb: 'Layered, tintable shadows for light and dark' },
  grid: { label: 'Layout grid', icon: LayoutGrid, title: 'Layout grid', blurb: 'Breakpoints, columns, gutters and a content cap' },
};

export const FOUNDATION_ORDER: FoundationKey[] = ['color', 'typography', 'spacing', 'radius', 'shadow', 'grid'];

/** A rail destination: one of the foundations, or the Preview section that shows them all together. */
export type NavKey = FoundationKey | 'preview';

export const NAV_META: Record<NavKey, { label: string; icon: LucideIcon; title: string; blurb: string }> = {
  ...FOUNDATION_META,
  preview: { label: 'Preview', icon: Eye, title: 'Preview', blurb: 'Every foundation together in real pages' },
};

export const NAV_ORDER: NavKey[] = [...FOUNDATION_ORDER, 'preview'];

/**
 * Switches between foundations. `rail` is the always-visible icon column on desktop;
 * `list` is the labelled version used in the mobile drawer.
 */
export function FoundationNav({
  active,
  summaries,
  variant = 'list',
  footer,
  onSelect,
}: {
  active: NavKey;
  /** Short count for each item, e.g. "10". */
  summaries: Record<NavKey, string>;
  variant?: 'rail' | 'list';
  /** Pinned to the bottom of the rail. */
  footer?: React.ReactNode;
  onSelect: (key: NavKey) => void;
}) {
  if (variant === 'rail') {
    return (
      <nav aria-label="Foundations" className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3">
        {NAV_ORDER.map((key) => {
          const { label, icon: Icon } = NAV_META[key];
          const isActive = key === active;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelect(key)}
                  className={cn(
                    'relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-sidebar-accent/70 hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'bg-sidebar-accent text-foreground',
                  )}
                >
                  {/* Indicator sits on the rail's left edge, like a tab underline turned sideways */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-1/2 -left-2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-foreground transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <Icon className="size-[1.125rem]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {label}
                <span className="ml-1.5 font-mono opacity-60 tabular">{summaries[key]}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {footer && <div className="mt-auto">{footer}</div>}
      </nav>
    );
  }

  return (
    <nav aria-label="Foundations" className="px-2 pt-3 pb-2">
      <h2 className="flex h-7 items-center px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Foundations</h2>
      <ul className="mt-1 flex flex-col gap-0.5">
        {NAV_ORDER.map((key) => {
          const { label, icon: Icon } = NAV_META[key];
          const isActive = key === active;
          return (
            <li key={key}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(key)}
                className={cn(
                  'flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'bg-sidebar-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                <span className="font-mono text-[0.6875rem] text-muted-foreground/80 tabular">{summaries[key]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
