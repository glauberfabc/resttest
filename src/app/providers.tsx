"use client";

import { UserProvider } from "@/hooks/use-user";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
      <UserProvider>
        {children}
      </UserProvider>
  );
}
