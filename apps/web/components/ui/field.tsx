import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props} />
  );
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/field flex flex-col gap-2 data-[invalid]:text-red-600",
        className,
      )}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      className={cn("group-data-[invalid]/field:text-red-600", className)}
      {...props}
    />
  );
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-sm text-slate-500 group-data-[invalid]/field:text-red-600",
        className,
      )}
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldGroup, FieldLabel };
