"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { ArrowRight, LogIn } from "lucide-react";
import { authEnabled } from "@/lib/auth";
import { cn } from "@/lib/cn";

/** Landing nav: sign-in / sign-up CTAs that swap to UserButton when signed in. */
export function NavAuthChip() {
  if (!authEnabled) {
    return <FallbackCTA />;
  }
  return <ClerkAwareNavChip />;
}

function ClerkAwareNavChip() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="size-8 rounded-md bg-surface-2 border border-border animate-pulse" />
    );
  }
  if (isSignedIn) {
    return (
      <>
        <Link
          href="/app"
          className="hidden sm:inline-flex btn h-8 text-[12px] text-muted"
        >
          Open workspace
        </Link>
        <UserButton
          appearance={{
            elements: { avatarBox: "size-7" },
          }}
        />
      </>
    );
  }
  return (
    <>
      <Link
        href="/sign-in"
        className="hidden sm:inline-flex btn h-8 text-[12px] text-muted"
      >
        Sign in
      </Link>
      <Link href="/sign-up" className="btn btn-primary h-8 text-[12px]">
        Try Atlas free
        <ArrowRight className="size-3.5" />
      </Link>
    </>
  );
}

function FallbackCTA() {
  return (
    <Link href="/app" className={cn("btn btn-primary h-8 text-[12px]")}>
      Try Atlas free
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

/** Workspace top bar: small UserButton when signed in, Sign-in link when not.
 * When Clerk is not configured we render nothing — a passive "no auth" tag
 * adds noise without value. The TopBar's left wordmark + divider already
 * implies "this is your local workspace". */
export function WorkspaceAuthChip() {
  if (!authEnabled) return null;
  return <ClerkAwareWorkspaceChip />;
}

function ClerkAwareWorkspaceChip() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return <div className="size-6 rounded-full bg-surface-2 animate-pulse" />;
  }
  if (isSignedIn) {
    return (
      <UserButton
        appearance={{ elements: { avatarBox: "size-6" } }}
      />
    );
  }
  return (
    <Link
      href="/sign-in"
      className="btn btn-ghost h-7 text-[11px] text-muted"
    >
      <LogIn className="size-3.5" />
      Sign in
    </Link>
  );
}
