
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
    // A função getCurrentUser já tem um redirect, mas esta é uma segurança adicional.
    redirect('/');
  }

  return <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>;
}
