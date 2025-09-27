import ClientsPageClient from "@/components/dashboard/clients/page-client";
import { getClients, getOrders } from "@/lib/supabase";

export default async function ClientsPage() {
  const clients = await getClients();
  const orders = await getOrders();
  return <ClientsPageClient initialClients={clients} initialOrders={orders} />;
}
