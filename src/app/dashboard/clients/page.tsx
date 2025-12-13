
import { Suspense } from "react";
import ClientsPageClient from "@/components/dashboard/clients/page-client";
import { getClients, getOrders, getCurrentUser } from "@/lib/user-actions";

function ClientsPageContent() {
  const userPromise = getCurrentUser();
  const clientsPromise = getClients();
  const ordersPromise = userPromise.then(user => user ? getOrders(user, { status: 'open' }) : []);

  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ClientsPageLoader
        userPromise={userPromise}
        clientsPromise={clientsPromise}
        ordersPromise={ordersPromise}
      />
    </Suspense>
  );
}

async function ClientsPageLoader({ userPromise, clientsPromise, ordersPromise }: {
  userPromise: Promise<any>,
  clientsPromise: Promise<any>,
  ordersPromise: Promise<any>
}) {
  const user = await userPromise;
  if (!user) return null;
  const clients = await clientsPromise;
  const orders = await ordersPromise;

  return <ClientsPageClient initialClients={clients} initialOrders={orders} user={user} />;
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<div>Carregando página de clientes...</div>}>
      <ClientsPageContent />
    </Suspense>
  );
}
