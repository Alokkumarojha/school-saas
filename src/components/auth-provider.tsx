"use client";
import { ClerkProvider } from "@clerk/nextjs";
import { useTheme } from "next-themes";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      appearance={{
        variables: {
          colorPrimary: resolvedTheme === "dark" ? "#8ed4b8" : "#215b4b",
          colorBackground: resolvedTheme === "dark" ? "#192420" : "#ffffff",
          colorForeground: resolvedTheme === "dark" ? "#e6eeeb" : "#202b3b",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
