import React from "react"
import { cva } from "class-variance-authority"
import { cn } from "./cn"
import { Spinner } from "./Spinner"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white shadow hover:bg-primary/90",
        destructive:
          "bg-error text-white shadow-sm hover:bg-error/90",
        outline:
          "border border-border bg-transparent shadow-sm hover:bg-surface hover:text-text-primary",
        secondary:
          "bg-secondary text-white shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-surface hover:text-text-primary text-text-secondary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
  const isDisabled = disabled || loading;

  if (asChild && React.isValidElement(children)) {
    const child = children;
    return React.cloneElement(child, {
      ...props,
      ...child.props,
      className: cn(buttonVariants({ variant, size }), className, child.props.className),
      ref: ref
    });
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size, className }), loading && "relative")}
      ref={ref}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <Spinner
          size={14}
          className={cn("shrink-0", children ? "mr-2" : "")}
        />
      )}
      {children}
    </button>
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
