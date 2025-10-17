import ClientsPageClient from "@/components/dashboard/clients/page-client";
import { getClients, getOrders } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/user-actions";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  const clients = await getClients();
  const orders = await getOrders(user);
  return <ClientsPageClient initialClients={clients} initialOrders={orders} />;
}
