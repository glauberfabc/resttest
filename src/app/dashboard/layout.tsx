
'use server';

import DashboardLayoutClient from "@/components/dashboard/layout";
import { getCurrentUser } from "@/lib/user-actions";
import { redirect } from 'next/navigation';
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/');
  }

  return (
    <SidebarProvider>
      <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>
    </SidebarProvider>
  );
}
