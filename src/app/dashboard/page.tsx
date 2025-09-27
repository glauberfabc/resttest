import DashboardPageClient from "@/components/dashboard/page-client";
import { getOrders, getMenuItems, getClients } from "@/lib/supabase";

export default async function DashboardPage() {
  const orders = await getOrders();
  const menuItems = await getMenuItems();
  const clients = await getClients();

  return <DashboardPageClient initialOrders={orders} menuItems={menuItems} initialClients={clients} />;
}
