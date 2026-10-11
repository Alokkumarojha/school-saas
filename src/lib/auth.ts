import "server-only";
import { auth } from "@clerk/nextjs/server";

export async function requireUserId() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/app" });
  return userId;
}
