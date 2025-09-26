
import ClientsPageClient from "@/components/dashboard/clients/page-client";
import { initialClients, initialOrders } from "@/lib/data";
import type { Client, Order } from "@/lib/types";

async function getClients(): Promise<Client[]> {
    // In a real app, you would fetch this from a database
    return Promise.resolve(initialClients);
}

async function getOrders(): Promise<Order[]> {
    // In a real app, you would fetch this from a database
    return Promise.resolve(initialOrders);
}


export default async function ClientsPage() {
  const clients = await getClients();
  const orders = await getOrders();
  return <ClientsPageClient initialClients={clients} initialOrders={orders} />;
}
