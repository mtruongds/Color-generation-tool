import { BookOpen, ListTree, type LucideIcon } from 'lucide-react';
import { cn } from '../ui/utils';

export type View = 'editor' | 'tokens' | 'docs';

/**
 * Title and view tabs for a foundation page. The tabs sit with the content they switch, so the rail
 * (which foundation) and the tabs (which view of it) read as one path, and the header never changes.
 */
export function PageHeader({
  title,
  blurb,
  view,
  onViewChange,
  editorIcon,
  actions,
}: {
  title: string;
  blurb: React.ReactNode;
  view: View;
  onViewChange: (view: View) => void;
  editorIcon: LucideIcon;
  /** Controls for this page, right of the tabs: format, background, settings on mobile. */
  actions?: React.ReactNode;
}) {
  const tabs: { value: View; label: string; icon: LucideIcon }[] = [
    { value: 'editor', label: 'Editor', icon: editorIcon },
    { value: 'tokens', label: 'Tokens', icon: ListTree },
    { value: 'docs', label: 'Docs', icon: BookOpen },
  ];
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{blurb}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b">
        <div role="tablist" aria-label="View" className="-mb-px flex items-center gap-1">
          {tabs.map(({ value, label, icon: Icon }) => {
            const on = view === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onViewChange(value)}
                className={cn(
                  'flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-sm transition-colors focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        {actions && <div className="flex items-center gap-2 pb-1.5">{actions}</div>}
      </div>
    </div>
  );
}
