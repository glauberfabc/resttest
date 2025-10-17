import DashboardLayoutClient from "@/components/dashboard/layout";
import { getCurrentUser } from "@/lib/user-actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    // This case should be handled by getCurrentUser redirecting,
    // but as a fallback, we can return null or a loading indicator.
    return null;
  }

  return <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>;
}
