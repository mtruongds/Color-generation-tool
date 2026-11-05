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

/** Shorter names for the rail, where each label sits under its icon. */
const RAIL_LABELS: Partial<Record<NavKey, string>> = { typography: 'Type', grid: 'Grid' };

/**
 * Switches between foundations. `rail` is the always-visible labelled column on desktop;
 * `list` is the wider version used in the mobile drawer. Preview sits apart from the six
 * foundations because it shows them all, rather than editing one.
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
      <nav aria-label="Foundations" className="flex h-full w-[4.5rem] shrink-0 flex-col items-center gap-0.5 border-r bg-sidebar py-2.5">
        {NAV_ORDER.map((key, i) => {
          const { label, icon: Icon } = NAV_META[key];
          const isActive = key === active;
          return (
            <div key={key} className="contents">
              {key === 'preview' && <span aria-hidden className="my-1.5 h-px w-8 bg-border" />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onSelect(key)}
                    className={cn(
                      'group relative flex w-16 flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-1.5 text-muted-foreground transition-[background-color,color,scale] hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive && 'text-foreground',
                    )}
                  >
                    {/* Indicator sits on the rail's left edge, like a tab underline turned sideways */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-3 -left-1 h-5 w-[3px] rounded-r-full bg-foreground transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span
                      className={cn(
                        'relative flex h-7 w-10 items-center justify-center rounded-lg transition-colors group-hover:bg-sidebar-accent/70',
                        isActive && 'bg-sidebar-accent group-hover:bg-sidebar-accent',
                      )}
                    >
                      <Icon className="size-[1.125rem]" />
                    </span>
                    <span className={cn('text-[0.6875rem] leading-none', isActive && 'font-medium')}>{RAIL_LABELS[key] ?? label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {label}
                  <span className="ml-1.5 font-mono opacity-60 tabular">{summaries[key]}</span>
                  <span className="ml-2 rounded border border-current/20 px-1 font-mono text-[0.625rem] opacity-60">{i + 1}</span>
                </TooltipContent>
              </Tooltip>
            </div>
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
            <li key={key} className={cn(key === 'preview' && 'mt-1.5 border-t pt-1.5')}>
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
