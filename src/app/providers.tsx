
"use client";

import { UserProvider } from "@/context/user-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
      <UserProvider>
        {children}
      </UserProvider>
  );
}
