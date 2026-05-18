import { NextResponse, type NextRequest } from "next/server";

const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clerkHandler: ((req: NextRequest) => Promise<Response> | Response) | null = null;
if (hasClerk) {
  // Require lazily so we only pull Clerk into the middleware bundle when configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clerkMiddleware } = require("@clerk/nextjs/server");
  clerkHandler = clerkMiddleware();
}

export default function middleware(req: NextRequest) {
  if (clerkHandler) return clerkHandler(req);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals + static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
