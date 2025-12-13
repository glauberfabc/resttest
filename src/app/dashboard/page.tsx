
import DashboardPageClient from "@/components/dashboard/page-client";
import { getOrders, getMenuItems, getClients, getCurrentUser } from "@/lib/user-actions";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Optimize: fetch only open orders initially. Historical data can be loaded on demand or by the client component's internal logic if needed.
  // Actually dashboard page needs open orders for the main view.
  const orders = await getOrders(user, { status: 'open' });
  const menuItems = await getMenuItems();
  const clients = await getClients();

  return <DashboardPageClient initialOrders={orders} menuItems={menuItems} initialClients={clients} user={user} />;
}
