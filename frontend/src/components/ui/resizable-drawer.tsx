"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type DrawerSide = "left" | "right";

interface ResizableDrawerProps {
  open: boolean;
  side?: DrawerSide;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange: (width: number) => void;
  className?: string;
  children: React.ReactNode;
}

export function ResizableDrawer({
  open,
  side = "right",
  width,
  minWidth = 340,
  maxWidth = 760,
  onWidthChange,
  className,
  children,
}: ResizableDrawerProps) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onMove = (event: PointerEvent) => {
      const delta = side === "right" ? startX.current - event.clientX : event.clientX - startX.current;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      onWidthChange(nextWidth);
    };

    const onUp = () => setDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, maxWidth, minWidth, onWidthChange, side]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className={cn("relative h-full border-l bg-background", className)}
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "absolute top-0 z-20 h-full w-2 cursor-col-resize",
          side === "right" ? "-left-1" : "-right-1"
        )}
        onPointerDown={(event) => {
          startX.current = event.clientX;
          startWidth.current = width;
          setDragging(true);
        }}
      >
        <div className={cn("mx-auto h-full w-px bg-border", dragging && "bg-primary")} />
      </div>
      <div className="h-full">{children}</div>
    </aside>
  );
}
