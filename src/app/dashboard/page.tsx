import DashboardPageClient from "@/components/dashboard/page-client";
import { initialOrders, menuItems, initialClients } from "@/lib/data";

export default function DashboardPage() {
  return <DashboardPageClient initialOrders={initialOrders} menuItems={menuItems} />;
}
