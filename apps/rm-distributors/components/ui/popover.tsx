"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const PopoverContext = React.createContext<PopoverContextType | null>(null);

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Popover({ open: controlledOpen, onOpenChange, defaultOpen = false, children }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerRef = React.useRef<HTMLDivElement | null>(null);

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </PopoverContext.Provider>
  );
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children: React.ReactNode;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ asChild, children, onClick, className, ...props }, forwardedRef) => {
    const context = React.useContext(PopoverContext);
    if (!context) {
      throw new Error("PopoverTrigger must be used within a Popover");
    }

    const { open, setOpen, triggerRef } = context;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) {
        setOpen(!open);
      }
    };

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return (
        <div ref={triggerRef} className="inline-block">
          {React.cloneElement(child, {
            onClick: (e: React.MouseEvent) => {
              child.props.onClick?.(e);
              if (!e.defaultPrevented) {
                setOpen(!open);
              }
            },
            "aria-expanded": open,
            "data-state": open ? "open" : "closed",
          })}
        </div>
      );
    }

    return (
      <div ref={triggerRef} className="inline-block">
        <button
          ref={forwardedRef}
          type="button"
          aria-expanded={open}
          data-state={open ? "open" : "closed"}
          onClick={handleClick}
          className={className}
          {...props}
        >
          {children}
        </button>
      </div>
    );
  }
);
PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "center", sideOffset = 4, style, children, ...props }, forwardedRef) => {
    const context = React.useContext(PopoverContext);
    if (!context) {
      throw new Error("PopoverContent must be used within a Popover");
    }

    const { open, setOpen, triggerRef } = context;
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    // Close on click outside and Escape key
    React.useEffect(() => {
      if (!open) return;

      const handlePointerDown = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node;
        if (
          contentRef.current &&
          !contentRef.current.contains(target) &&
          triggerRef.current &&
          !triggerRef.current.contains(target)
        ) {
          setOpen(false);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      };

      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("touchstart", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [open, setOpen, triggerRef]);

    if (!open) return null;

    let alignClass = "left-1/2 -translate-x-1/2";
    if (align === "start") alignClass = "left-0";
    if (align === "end") alignClass = "right-0";

    return (
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        tabIndex={-1}
        data-state={open ? "open" : "closed"}
        style={{ marginTop: `${sideOffset}px`, ...style }}
        className={cn(
          "absolute top-full z-50 w-auto rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl outline-none transition-all",
          alignClass,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
