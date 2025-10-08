
"use client";

import { useState, useEffect, useMemo } from "react";
import type { Order, MenuItem, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsSheet } from "@/components/dashboard/order-details-sheet";
import { NewOrderDialog } from "@/components/dashboard/new-order-dialog";
import { PlusCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase, getOrders, getMenuItems, getClients } from "@/lib/supabase";
import { useUser } from "@/context/user-context";
import { useToast } from "@/hooks/use-toast";
import { startOfToday } from 'date-fns';

const ITEMS_PER_PAGE = 20;

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
  const [searchTerm, setSearchTerm] = useState("");

  const [pagination, setPagination] = useState({
    abertas: { currentPage: 1 },
    caderneta: { currentPage: 1 },
    fechadas: { currentPage: 1 },
  });

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
      .channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
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
    const originalOrders = [...orders];
    // Optimistically update the local state
    const newOrders = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    setOrders(newOrders);
    if (selectedOrder?.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder);
    }
  
    // 1. Update the order status and paid_at timestamp
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: updatedOrder.status,
        paid_at: updatedOrder.paidAt,
      })
      .eq('id', updatedOrder.id);
  
    // 2. Delete all existing items for this order
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', updatedOrder.id);

    // 3. Consolidate and insert the updated items
    const consolidatedItems = new Map<string, { menuItemId: string; quantity: number; comment: string | null }>();

    for (const item of updatedOrder.items) {
      // Create a key from menu item ID and comment to group identical items
      const key = `${item.menuItem.id}-${item.comment || ''}`;
      const existing = consolidatedItems.get(key);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        consolidatedItems.set(key, {
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
            comment: item.comment || null,
        });
      }
    }
    
    const itemsToInsert = Array.from(consolidatedItems.values()).map(item => ({
      order_id: updatedOrder.id,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      comment: item.comment,
    }));

    let itemsError = null;
    if (itemsToInsert.length > 0) {
      const { error } = await supabase.from('order_items').insert(itemsToInsert);
      itemsError = error;
    }
  
    if (orderError || deleteError || itemsError) {
      console.error("Error updating order:", orderError || deleteError || itemsError);
      toast({ variant: 'destructive', title: "Erro ao atualizar comanda", description: "Não foi possível salvar as alterações." });
      setOrders(originalOrders); // Revert local state on error
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

    const newPayment = { ...paymentData, paidAt: paymentData.paid_at };
    let updatedOrder = {
      ...orderToPay,
      payments: [...(orderToPay.payments || []), newPayment] as any,
    };

    const orderTotal = updatedOrder.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
    const totalPaid = updatedOrder.payments.reduce((acc, p) => acc + p.amount, 0);
    
    const isFullyPaid = totalPaid >= orderTotal - 0.001;

    if (isFullyPaid) {
      updatedOrder = {
        ...updatedOrder,
        status: 'paid',
        paidAt: new Date().toISOString(),
      };
    } else {
        updatedOrder = {
            ...updatedOrder,
            status: 'paying',
        };
    }
    
    await handleUpdateOrder(updatedOrder); 
    
    if (isFullyPaid) {
      setSelectedOrder(updatedOrder); 
    } else {
      setSelectedOrder(updatedOrder);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm) {
      return orders;
    }
    return orders.filter(order =>
      order.type === 'name' &&
      String(order.identifier).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);


  const todayStart = startOfToday();

  const openOrders = filteredOrders.filter(o => o.status === 'open' || o.status === 'paying');
  const openOrdersToday = openOrders.filter(o => new Date(o.created_at) >= todayStart);
  const notebookOrders = openOrders.filter(o => new Date(o.created_at) < todayStart);
  const paidOrders = filteredOrders.filter(o => o.status === 'paid');

  const handlePageChange = (tab: 'abertas' | 'caderneta' | 'fechadas', direction: 'next' | 'prev') => {
    setPagination(prev => ({
      ...prev,
      [tab]: {
        currentPage: direction === 'next'
          ? prev[tab].currentPage + 1
          : prev[tab].currentPage - 1,
      },
    }));
  };

  const renderPaginatedOrders = (orderList: Order[], tab: 'abertas' | 'caderneta' | 'fechadas') => {
    const { currentPage } = pagination[tab];
    const totalPages = Math.ceil(orderList.length / ITEMS_PER_PAGE);
    const paginatedItems = orderList.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );

    return (
      <>
        {paginatedItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {paginatedItems.map((order) => (
              <OrderCard key={order.id} order={order} onSelectOrder={handleSelectOrder} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center mt-4">
            <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma comanda encontrada</h3>
            <p className="text-sm text-muted-foreground">Tente um termo de busca diferente ou crie uma nova comanda.</p>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button
              variant="outline"
              onClick={() => handlePageChange(tab, 'prev')}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>
            <span className="text-sm font-medium">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => handlePageChange(tab, 'next')}
              disabled={currentPage === totalPages}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </>
    );
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Comandas</h2>
        <Button onClick={() => setIsNewOrderDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Comanda
        </Button>
      </div>

      <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
              placeholder="Buscar comanda por nome..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      <Tabs defaultValue="abertas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="abertas">Abertas ({openOrdersToday.length})</TabsTrigger>
          <TabsTrigger value="caderneta">Caderneta ({notebookOrders.length})</TabsTrigger>
          <TabsTrigger value="fechadas">Fechadas ({paidOrders.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="abertas" className="mt-4">
           {renderPaginatedOrders(openOrdersToday, 'abertas')}
        </TabsContent>
         <TabsContent value="caderneta" className="mt-4">
           {renderPaginatedOrders(notebookOrders, 'caderneta')}
        </TabsContent>
        <TabsContent value="fechadas" className="mt-4">
            {renderPaginatedOrders(paidOrders, 'fechadas')}
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
