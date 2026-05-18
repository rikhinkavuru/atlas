/** Whether Clerk is configured with real keys. Evaluated at build time on the
 *  server and re-evaluated client-side via the NEXT_PUBLIC_ prefix.
 */
export const authEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length > 0,
);

/** Stable redirect-after-sign-in/up. */
export const AFTER_SIGN_IN = "/app";
export const AFTER_SIGN_UP = "/app";
