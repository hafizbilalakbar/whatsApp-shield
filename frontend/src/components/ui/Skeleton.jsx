import React from "react"
import { cn } from "./cn"

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-border/50", className)}
      {...props}
    />
  )
}

export { Skeleton }
