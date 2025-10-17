
'use server';

import DashboardLayoutClient from "@/components/dashboard/layout";
import { getCurrentUser } from "@/lib/user-actions";
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/');
  }

  return <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>;
}
