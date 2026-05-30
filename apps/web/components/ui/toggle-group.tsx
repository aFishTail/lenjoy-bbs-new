import * as React from "react";

import { cn } from "@/lib/utils";

type ToggleGroupContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({});

type ToggleGroupProps = React.ComponentProps<"div"> & {
  type?: "single";
  value?: string;
  onValueChange?: (value: string) => void;
};

function ToggleGroup({
  className,
  type = "single",
  value,
  onValueChange,
  ...props
}: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange }}>
      <div
        data-type={type}
        className={cn("flex flex-wrap gap-2", className)}
        {...props}
      />
    </ToggleGroupContext.Provider>
  );
}

type ToggleGroupItemProps = React.ComponentProps<"button"> & {
  value: string;
};

function ToggleGroupItem({
  className,
  onClick,
  value,
  type = "button",
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext);
  const active = context.value === value;

  return (
    <button
      type={type}
      data-state={active ? "on" : "off"}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium transition-all outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-blue-600 data-[state=on]:bg-blue-50 data-[state=on]:text-blue-700",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.onValueChange?.(value);
        }
      }}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
