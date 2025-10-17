
import DashboardPageClient from "@/components/dashboard/page-client";
import { getOrders, getMenuItems, getClients } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/user-actions";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const orders = await getOrders(user);
  const menuItems = await getMenuItems();
  const clients = await getClients();

  return <DashboardPageClient initialOrders={orders} menuItems={menuItems} initialClients={clients} user={user} />;
}
