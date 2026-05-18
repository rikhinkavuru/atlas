"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Logo } from "../common/Logo";
import { GithubIcon } from "../common/SocialIcons";
import { NavAuthChip } from "../auth/AuthChip";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function handleLogoClick(e: React.MouseEvent) {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="max-w-[1200px] mx-auto h-14 px-5 flex items-center gap-6">
        <Link href="/" onClick={handleLogoClick} className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-[13px] text-muted">
          <NavLink href="/#features">Features</NavLink>
          <NavLink href="/#moats">Moats</NavLink>
          <NavLink href="/reviewer-model">Reviewer Model</NavLink>
          <NavLink href="/verify">Verify</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/docs">Docs</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="size-4" strokeWidth={2} />
            ) : (
              <Moon className="size-4" strokeWidth={2} />
            )}
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            aria-label="GitHub"
          >
            <GithubIcon className="size-4" />
          </a>
          <NavAuthChip />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface-2"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface">
          <div className="px-5 py-3 flex flex-col text-[13px]">
            <NavLink href="/#features" onClick={() => setMobileOpen(false)}>
              Features
            </NavLink>
            <NavLink href="/#moats" onClick={() => setMobileOpen(false)}>
              Moats
            </NavLink>
            <NavLink href="/reviewer-model" onClick={() => setMobileOpen(false)}>
              Reviewer Model
            </NavLink>
            <NavLink href="/verify" onClick={() => setMobileOpen(false)}>
              Verify
            </NavLink>
            <NavLink href="/pricing" onClick={() => setMobileOpen(false)}>
              Pricing
            </NavLink>
            <NavLink href="/docs" onClick={() => setMobileOpen(false)}>
              Docs
            </NavLink>
            <button
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                setMobileOpen(false);
              }}
              className="mt-2 flex items-center gap-2 px-3 py-2 rounded text-foreground hover:bg-surface-2"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              <span>
                Switch to {theme === "dark" ? "light" : "dark"} mode
              </span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-3 py-2 rounded hover:text-foreground hover:bg-surface-2 transition-colors"
    >
      {children}
    </Link>
  );
}
