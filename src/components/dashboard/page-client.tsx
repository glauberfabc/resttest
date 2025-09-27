
"use client";

import { useState } from "react";
import type { Order, MenuItem, OrderItem, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsSheet } from "@/components/dashboard/order-details-sheet";
import { NewOrderDialog } from "@/components/dashboard/new-order-dialog";
import { PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialClients } from "@/lib/data";

interface DashboardPageClientProps {
  initialOrders: Order[];
  menuItems: MenuItem[];
}

export default function DashboardPageClient({ initialOrders, menuItems }: DashboardPageClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    if (selectedOrder?.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder);
    }
  };
  
  const handleCreateOrder = (type: 'table' | 'name', identifier: string | number) => {
    const newOrder: Order = {
      id: `order-${Date.now()}`,
      type,
      identifier,
      items: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      payments: [],
    };
    setOrders([newOrder, ...orders]);
    setIsNewOrderDialogOpen(false);
    setSelectedOrder(newOrder);
  };
  
  const handleProcessPayment = (orderId: string, amount: number, method: string) => {
    const orderToPay = orders.find((o) => o.id === orderId);
    if (!orderToPay) return;

    const newPayment = { amount, method, paidAt: new Date().toISOString() };
    const updatedPayments = [...(orderToPay.payments || []), newPayment];

    const orderTotal = orderToPay.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
    const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
    
    const isFullyPaid = totalPaid >= orderTotal - 0.001;

    if (isFullyPaid && orderToPay.type === 'table') {
        // Remove the paid table order from the list
        setOrders(orders.filter(o => o.id !== orderId));
        setSelectedOrder(null);
        return;
    }

    const updatedOrder: Order = {
      ...orderToPay,
      payments: updatedPayments,
      status: isFullyPaid ? 'paid' : 'open',
      paidAt: isFullyPaid ? new Date().toISOString() : undefined,
    };

    handleUpdateOrder(updatedOrder);
    
    if (isFullyPaid) {
      // For 'name' orders, keep it selected to show the receipt.
      setSelectedOrder(updatedOrder); 
    }
  };


  const openOrders = orders.filter(o => o.status === 'open' || o.status === 'paying');
  const paidOrders = orders.filter(o => o.status === 'paid' && o.type === 'name');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Comandas</h2>
        <Button onClick={() => setIsNewOrderDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Comanda
        </Button>
      </div>

      <Tabs defaultValue="abertas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="abertas">Abertas ({openOrders.length})</TabsTrigger>
          <TabsTrigger value="fechadas">Fechadas ({paidOrders.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="abertas" className="mt-4">
           {openOrders.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {openOrders.map((order) => (
                <OrderCard key={order.id} order={order} onSelectOrder={handleSelectOrder} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center mt-4">
                <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma comanda aberta</h3>
                <p className="text-sm text-muted-foreground">Crie uma nova comanda para começar.</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="fechadas" className="mt-4">
            {paidOrders.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {paidOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onSelectOrder={handleSelectOrder} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center mt-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma comanda fechada</h3>
                  <p className="text-sm text-muted-foreground">As comandas pagas por nome aparecerão aqui.</p>
              </div>
            )}
        </TabsContent>
      </Tabs>


      {selectedOrder && (
        <OrderDetailsSheet
          order={selectedOrder}
          menuItems={menuItems}
          onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}
          onUpdateOrder={handleUpdateOrder}
          onProcessPayment={handleProcessPayment}
        />
      )}

      <NewOrderDialog
        isOpen={isNewOrderDialogOpen}
        onOpenChange={setIsNewOrderDialogOpen}
        onCreateOrder={handleCreateOrder}
        clients={clients}
      />
    </div>
  );
}
