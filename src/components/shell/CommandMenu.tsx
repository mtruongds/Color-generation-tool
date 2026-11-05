import type { LucideIcon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '../ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

export interface CommandAction {
  id: string;
  group: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  disabled?: boolean;
  run: () => void;
}

/** ⌘K: every place and action by name, so nothing needs a mouse trip to the right panel. */
export function CommandMenu({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
}) {
  const groups = [...new Set(actions.map((a) => a.group))];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The last child is the dialog's close button; Escape closes this one */}
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <DialogDescription className="sr-only">Search for a place or an action</DialogDescription>
        <Command loop className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput placeholder="Go to, switch or run…" className="h-11" />
          <CommandList className="max-h-[min(24rem,60vh)] p-1.5">
            <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">Nothing matches</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g} heading={g}>
                {actions
                  .filter((a) => a.group === g)
                  .map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`${a.group} ${a.label}`}
                      keywords={a.keywords}
                      disabled={a.disabled}
                      onSelect={() => {
                        onOpenChange(false);
                        a.run();
                      }}
                      className="gap-2.5 py-2"
                    >
                      <a.icon className="size-4 text-muted-foreground" />
                      <span className="flex-1">{a.label}</span>
                      {a.shortcut && <CommandShortcut className="font-mono">{a.shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
