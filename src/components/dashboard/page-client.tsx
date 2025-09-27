
"use client";

import { useState } from "react";
import type { Order, MenuItem, OrderItem, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsSheet } from "@/components/dashboard/order-details-sheet";
import { NewOrderDialog } from "@/components/dashboard/new-order-dialog";
import { PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/context/user-context";
import { useToast } from "@/hooks/use-toast";

interface DashboardPageClientProps {
  initialOrders: Order[];
  menuItems: MenuItem[];
  initialClients: Client[];
}

export default function DashboardPageClient({ initialOrders, menuItems, initialClients }: DashboardPageClientProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    
    // 1. Update local state immediately for snappy UI
    const originalOrders = orders;
    const newOrders = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    setOrders(newOrders);
    if (selectedOrder?.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder);
    }
    
    // 2. Persist changes to the database
    const { error: orderError } = await supabase
      .from('orders')
      .update({ 
          status: updatedOrder.status,
          paid_at: updatedOrder.paidAt,
       })
      .eq('id', updatedOrder.id)
    
    // 3. Upsert order items
    const orderItems = updatedOrder.items.map(item => ({
        order_id: updatedOrder.id,
        menu_item_id: item.menuItem.id,
        quantity: item.quantity
    }));

    // Delete items that are no longer in the order
    const currentItemIds = orderItems.map(i => i.menu_item_id);
    const originalOrder = originalOrders.find(o => o.id === updatedOrder.id);
    const itemsToDelete = originalOrder?.items.filter(i => !currentItemIds.includes(i.menuItem.id)) || [];

    for (const item of itemsToDelete) {
        await supabase.from('order_items').delete().match({ order_id: updatedOrder.id, menu_item_id: item.menuItem.id });
    }

    const { error: itemsError } = await supabase
        .from('order_items')
        .upsert(orderItems, { onConflict: 'order_id,menu_item_id' });


    if (orderError || itemsError) {
        console.error("Error updating order:", orderError || itemsError);
        toast({ variant: 'destructive', title: "Erro ao atualizar comanda", description: "Não foi possível salvar as alterações." });
        // Revert local state on error
        setOrders(originalOrders);
        if (selectedOrder?.id === updatedOrder.id) {
          setSelectedOrder(originalOrders.find(o => o.id === updatedOrder.id) || null);
        }
    }
  };
  
  const handleCreateOrder = async (type: 'table' | 'name', identifier: string | number) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado para criar uma comanda." });
        return;
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({ 
        type, 
        identifier: String(identifier), 
        status: 'open',
        user_id: user.id,
       })
      .select()
      .single();

    if (error || !data) {
        console.error("Error creating order:", error);
        toast({ variant: 'destructive', title: "Erro ao criar comanda", description: "Tente novamente." });
        return;
    }

    const newOrder: Order = {
        ...data,
        items: [],
        payments: [],
        createdAt: data.created_at,
        paidAt: data.paid_at,
    };

    setOrders([newOrder, ...orders]);
    setIsNewOrderDialogOpen(false);
    setSelectedOrder(newOrder);
  };
  
  const handleProcessPayment = async (orderId: string, amount: number, method: string) => {
    const orderToPay = orders.find((o) => o.id === orderId);
    if (!orderToPay) return;
    
    // 1. Add payment to database
    const { data: paymentData, error: paymentError } = await supabase
        .from('order_payments')
        .insert({
            order_id: orderId,
            amount,
            method,
        })
        .select()
        .single();
    
    if (paymentError || !paymentData) {
         console.error("Error processing payment:", paymentError);
        toast({ variant: 'destructive', title: "Erro no pagamento", description: "Não foi possível registrar o pagamento." });
        return;
    }

    // 2. Update local state
    const newPayment = { ...paymentData, paidAt: paymentData.paid_at };
    const updatedPayments = [...(orderToPay.payments || []), newPayment];

    const orderTotal = orderToPay.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
    const totalPaid = updatedPayments.reduce((acc, p) => acc.amount + p.amount, {amount: 0}).amount;
    
    const isFullyPaid = totalPaid >= orderTotal - 0.001;

    // 3. If fully paid for a table, delete it. Otherwise, update status.
    if (isFullyPaid && orderToPay.type === 'table') {
        const originalOrders = orders;
        setOrders(orders.filter(o => o.id !== orderId));
        setSelectedOrder(null);

        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) {
            console.error("Error deleting paid table order:", error);
            toast({ variant: 'destructive', title: "Erro ao remover comanda", description: "A comanda foi paga, mas não pode ser removida da lista." });
            setOrders(originalOrders);
        }
        return;
    }

    const updatedOrder: Order = {
      ...orderToPay,
      payments: updatedPayments as any, //TODO: fix types
      status: isFullyPaid ? 'paid' : 'open',
      paidAt: isFullyPaid ? new Date().toISOString() : undefined,
    };
    
    // This will update local state and persist the final order status to DB
    await handleUpdateOrder(updatedOrder); 
    
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
