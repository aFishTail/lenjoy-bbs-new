import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-all focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/20",
        className,
      )}
      {...props}
    />
  );
});

Select.displayName = "Select";

export { Select };
