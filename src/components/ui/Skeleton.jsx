import React from "react"
import { cn } from "./cn"

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }