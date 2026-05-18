"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useSettings } from "@/lib/settings";
import { authEnabled, AFTER_SIGN_IN, AFTER_SIGN_UP } from "@/lib/auth";

/** Wraps children in ClerkProvider only when keys are configured; otherwise
 *  passes through so the app runs key-less in dev / preview.
 *  Inherits Atlas's theme (dark / light) and applies it to Clerk's modals.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettings((s) => s.theme);
  if (!authEnabled) return <>{children}</>;

  return (
    <ClerkProvider
      signInFallbackRedirectUrl={AFTER_SIGN_IN}
      signUpFallbackRedirectUrl={AFTER_SIGN_UP}
      appearance={{
        variables: {
          colorPrimary: theme === "light" ? "#4d7c0f" : "#c6f24e",
          colorBackground: theme === "light" ? "#ffffff" : "#111111",
          colorText: theme === "light" ? "#0a0a0a" : "#f5f5f5",
          colorTextSecondary: theme === "light" ? "#525252" : "#a1a1a1",
          colorInputBackground: theme === "light" ? "#fafafa" : "#161616",
          colorInputText: theme === "light" ? "#0a0a0a" : "#f5f5f5",
          colorNeutral: theme === "light" ? "#0a0a0a" : "#f5f5f5",
          fontFamily:
            'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
          borderRadius: "8px",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
