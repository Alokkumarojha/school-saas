import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";

const clerk = clerkMiddleware();
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    return new NextResponse(
      "Authentication is not configured. Set the Clerk environment variables to access organizations.",
      { status: 503 },
    );
  }
  // Clerk establishes identity here. Resource-level server checks enforce access.
  return clerk(request, event);
}

export const config = {
  matcher: ["/app/:path*", "/sign-in/:path*", "/sign-up/:path*", "/join/accept/:path*"],
};
