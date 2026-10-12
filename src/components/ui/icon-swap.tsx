import * as React from "react";

import { cn } from "./utils";

const layer =
  "col-start-1 row-start-1 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]";
const shown = "opacity-100 scale-100 blur-[0px]";
const hidden = "opacity-0 scale-25 blur-[4px]";

/**
 * Cross-fades between two icons. Both stay mounted and stacked, so the swap is
 * interruptible and animates in both directions without a motion library.
 */
function IconSwap({
  active,
  on,
  off,
  className,
}: {
  active: boolean;
  on: React.ReactNode;
  off: React.ReactNode;
  className?: string;
}) {
  return (
    <span data-slot="icon-swap" className={cn("inline-grid place-items-center", className)}>
      <span aria-hidden={!active} className={cn(layer, active ? shown : hidden)}>
        {on}
      </span>
      <span aria-hidden={active} className={cn(layer, active ? hidden : shown)}>
        {off}
      </span>
    </span>
  );
}

export { IconSwap };
