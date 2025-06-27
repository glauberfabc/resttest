"use client";

import { useState } from "react";
import type { Order, MenuItem, OrderItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsSheet } from "@/components/dashboard/order-details-sheet";
import { NewOrderDialog } from "@/components/dashboard/new-order-dialog";
import { PlusCircle } from "lucide-react";

interface DashboardPageClientProps {
  initialOrders: Order[];
  menuItems: MenuItem[];
}

export default function DashboardPageClient({ initialOrders, menuItems }: DashboardPageClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
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
    };
    setOrders([newOrder, ...orders]);
    setIsNewOrderDialogOpen(false);
    setSelectedOrder(newOrder);
  };
  
  const handleFinalizePayment = (orderId: string) => {
    const orderToPay = orders.find(o => o.id === orderId);
    if (orderToPay) {
      handleUpdateOrder({ ...orderToPay, status: 'paid', paidAt: new Date().toISOString() });
    }
    setSelectedOrder(null);
  }

  const openOrders = orders.filter(o => o.status === 'open' || o.status === 'paying');
  const paidOrders = orders.filter(o => o.status === 'paid');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Comandas Abertas</h2>
        <Button onClick={() => setIsNewOrderDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Comanda
        </Button>
      </div>

      {openOrders.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {openOrders.map((order) => (
            <OrderCard key={order.id} order={order} onSelectOrder={handleSelectOrder} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center">
            <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma comanda aberta</h3>
            <p className="text-sm text-muted-foreground">Crie uma nova comanda para começar.</p>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsSheet
          order={selectedOrder}
          menuItems={menuItems}
          onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}
          onUpdateOrder={handleUpdateOrder}
          onFinalizePayment={handleFinalizePayment}
        />
      )}

      <NewOrderDialog
        isOpen={isNewOrderDialogOpen}
        onOpenChange={setIsNewOrderDialogOpen}
        onCreateOrder={handleCreateOrder}
      />
    </div>
  );
}
