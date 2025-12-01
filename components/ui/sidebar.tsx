"use client";
import { cn } from "@/lib/utils";
import React, {
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { AnimatePresence, motion } from "motion/react";

// Inline SVG icons to avoid external dependencies
const MenuIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = useCallback(
    (value: boolean) => {
      if (setOpenProp) {
        setOpenProp(value);
      } else {
        setOpenState(value);
      }
    },
    [setOpenProp]
  );

  const contextValue = useMemo(
    () => ({ open, setOpen, animate }),
    [open, setOpen, animate]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();

  const handleMouseEnter = useCallback(() => setOpen(true), [setOpen]);
  const handleMouseLeave = useCallback(() => setOpen(false), [setOpen]);

  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col bg-zinc-900/80 shrink-0 overflow-hidden",
        className
      )}
      initial={false}
      animate={{
        width: animate ? (open ? 200 : 60) : 200,
      }}
      transition={{
        duration: 0.2,
        ease: "easeOut",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();

  const toggleOpen = useCallback(() => setOpen(!open), [open, setOpen]);

  return (
    <div
      className={cn(
        "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-zinc-900/80 w-full"
      )}
      {...props}
    >
      <div className="flex justify-end z-20 w-full">
        <button
          className="text-neutral-200 cursor-pointer"
          onClick={toggleOpen}
        >
          <MenuIcon />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{
              duration: 0.2,
              ease: "easeOut",
            }}
            className={cn(
              "fixed h-full w-full inset-0 bg-zinc-950 p-10 z-100 flex flex-col justify-between",
              className
            )}
          >
            <button
              className="absolute right-10 top-10 z-50 text-neutral-200 cursor-pointer"
              onClick={toggleOpen}
            >
              <CloseIcon />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  return (
    <a
      href={link.href}
      className={cn(
        "flex items-center justify-start gap-2 group/sidebar h-9",
        className
      )}
      {...props}
    >
      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
        {link.icon}
      </div>
      <motion.span
        initial={false}
        animate={{
          opacity: animate ? (open ? 1 : 0) : 1,
          width: animate ? (open ? "auto" : 0) : "auto",
        }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="text-zinc-400 text-sm group-hover/sidebar:translate-x-1 transition-transform duration-150 whitespace-nowrap overflow-hidden"
      >
        {link.label}
      </motion.span>
    </a>
  );
};
