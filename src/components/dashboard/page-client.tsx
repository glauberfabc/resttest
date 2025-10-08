
"use client";

import { useState, useEffect } from "react";
import type { Order, MenuItem, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsSheet } from "@/components/dashboard/order-details-sheet";
import { NewOrderDialog } from "@/components/dashboard/new-order-dialog";
import { PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase, getOrders, getMenuItems, getClients } from "@/lib/supabase";
import { useUser } from "@/context/user-context";
import { useToast } from "@/hooks/use-toast";

interface DashboardPageClientProps {
  initialOrders: Order[];
  menuItems: MenuItem[];
  initialClients: Client[];
}

export default function DashboardPageClient({ initialOrders: initialOrdersProp, menuItems: menuItemsProp, initialClients: initialClientsProp }: DashboardPageClientProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);

  const fetchData = async () => {
    const [ordersData, menuItemsData, clientsData] = await Promise.all([
      getOrders(),
      getMenuItems(),
      getClients()
    ]);
    setOrders(ordersData);
    setMenuItems(menuItemsData);
    setClients(clientsData);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        console.log('Change received for orders!', payload);
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, payload => {
        console.log('Change received for order_items!', payload);
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments' }, payload => {
        console.log('Change received for order_payments!', payload);
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    
    // 2. Persist order status changes to the database
    const { error: orderError } = await supabase
      .from('orders')
      .update({ 
          status: updatedOrder.status,
          paid_at: updatedOrder.paidAt,
       })
      .eq('id', updatedOrder.id)
    
    // 3. Synchronize order items by deleting and re-inserting
    
    // 3a. Delete all existing items for this order
    const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', updatedOrder.id);

    // 3b. Prepare the new items to be inserted, EXCLUDING the comment field for now
    const newOrderItems = updatedOrder.items.map(item => ({
        order_id: updatedOrder.id,
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        // comment: item.comment, // Temporarily removed until DB schema is updated
    }));

    // 3c. Insert the new state of items, but only if there are any
    let itemsError = null;
    if (newOrderItems.length > 0) {
        const { error } = await supabase
            .from('order_items')
            .insert(newOrderItems);
        itemsError = error;
    }


    if (orderError || deleteError || itemsError) {
        console.error("Error updating order:", orderError || deleteError || itemsError);
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

    // 2. Update local state with new payment
    const newPayment = { ...paymentData, paidAt: paymentData.paid_at };
    let updatedOrder = {
      ...orderToPay,
      payments: [...(orderToPay.payments || []), newPayment] as any, //TODO: fix types
    };

    const orderTotal = updatedOrder.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
    const totalPaid = updatedOrder.payments.reduce((acc, p) => acc + p.amount, 0);
    
    const isFullyPaid = totalPaid >= orderTotal - 0.001;

    // 3. Update order status if fully paid
    if (isFullyPaid) {
      updatedOrder = {
        ...updatedOrder,
        status: 'paid',
        paidAt: new Date().toISOString(),
      };
    }
    
    // 4. This will update local state and persist the final order status to DB
    await handleUpdateOrder(updatedOrder); 
    
    // 5. Update UI
    if (isFullyPaid) {
      setSelectedOrder(updatedOrder); 
    } else {
      // If partially paid, just update the selected order with new payment info
      setSelectedOrder(updatedOrder);
    }
  };


  const openOrders = orders.filter(o => o.status === 'open' || o.status === 'paying');
  const paidOrders = orders.filter(o => o.status === 'paid');

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
                  <p className="text-sm text-muted-foreground">As comandas pagas aparecerão aqui.</p>
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

    