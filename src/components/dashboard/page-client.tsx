
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Order, MenuItem, Client, OrderItem, ClientCredit, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsSheet } from "@/components/dashboard/order-details-sheet";
import { NewOrderDialog } from "@/components/dashboard/new-order-dialog";
import { PlusCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { startOfToday } from 'date-fns';

const ITEMS_PER_PAGE = 20;

interface DashboardPageClientProps {
  initialOrders: Order[];
  menuItems: MenuItem[];
  initialClients: Client[];
  user: User;
}

export default function DashboardPageClient({ initialOrders: initialOrdersProp, menuItems: menuItemsProp, initialClients: initialClientsProp, user }: DashboardPageClientProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>(initialOrdersProp);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(menuItemsProp);
  const [clients, setClients] = useState<Client[]>(initialClientsProp);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [pagination, setPagination] = useState({
    abertas: { currentPage: 1 },
    caderneta: { currentPage: 1 },
    fechadas: { currentPage: 1 },
  });

  const fetchData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) return;
    
    // In a client component, we fetch directly using the supabase client instance
    const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`*, items:order_items(*, menu_item:menu_items(*)), payments:order_payments(*)`)
        .order('created_at', { ascending: false });

    if (ordersData) {
        const formattedOrders = ordersData.map(order => ({
            ...order,
            items: order.items.map((item: any) => ({
                id: item.id || crypto.randomUUID(),
                quantity: item.quantity,
                comment: item.comment || '',
                menuItem: {
                    ...item.menu_item,
                    id: item.menu_item.id || crypto.randomUUID(),
                    imageUrl: item.menu_item.image_url,
                    lowStockThreshold: item.menu_item.low_stock_threshold,
                }
            })),
            created_at: new Date(order.created_at),
            paid_at: order.paid_at ? new Date(order.paid_at) : undefined,
            createdAt: new Date(order.created_at),
            paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
        })) as unknown as Order[];
        setOrders(formattedOrders);
    }
    
    const { data: menuItemsData } = await supabase.from('menu_items').select('*');
    if (menuItemsData) {
        const formattedItems = menuItemsData.map(item => ({ ...item, id: item.id || crypto.randomUUID(), code: item.code, imageUrl: item.image_url, lowStockThreshold: item.low_stock_threshold })) as unknown as MenuItem[];
        setMenuItems(formattedItems);
    }

    const { data: clientsData } = await supabase.from('clients').select('*');
    if (clientsData) setClients(clientsData as Client[]);

    const { data: creditsData } = await supabase.from('client_credits').select('*').order('created_at', { ascending: false });
    if (creditsData) setCredits(creditsData.map(c => ({...c, created_at: new Date(c.created_at)})) as ClientCredit[]);
  }, []);

  useEffect(() => {
    if (user) {
      fetchData(user);
    }
  }, [user, fetchData]);


  useEffect(() => {
    if (!user) return;

    const handleRealtimeUpdate = (payload: any) => {
      fetchData(user); // Refetch all data for simplicity and consistency
      // Optionally, you can implement more granular updates based on payload
    };

    const channel = supabase
      .channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, handleRealtimeUpdate)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Conectado ao canal de atualizações em tempo real.');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Erro no canal de tempo real:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);


  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const originalOrders = [...orders];
    const originalOrder = originalOrders.find(o => o.id === updatedOrder.id);
  
    // Optimistically update local state for a responsive UI
    const newOrders = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    setOrders(newOrders);
    if (selectedOrder?.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder);
    }
  
    const wasInNotebook = originalOrder && originalOrder.created_at < startOfToday();
    const originalTotalQuantity = originalOrder?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const updatedTotalQuantity = updatedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
    const itemWasAddedOrQuantityIncreased = updatedTotalQuantity > originalTotalQuantity;
    
    let finalOrderDataForUpdate: Partial<Order> = {
      status: updatedOrder.status,
      paid_at: updatedOrder.paidAt,
    };
  
    if (wasInNotebook && itemWasAddedOrQuantityIncreased) {
      finalOrderDataForUpdate.created_at = new Date();
    }
  
    const { error: orderError } = await supabase
      .from('orders')
      .update(finalOrderDataForUpdate)
      .eq('id', updatedOrder.id);
  
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', updatedOrder.id);
  
    const itemsToInsert = updatedOrder.items.map(item => ({
      order_id: updatedOrder.id,
      menu_item_id: item.menuItem.id,
      quantity: item.quantity,
      comment: item.comment || null,
    }));
  
    let itemsError = null;
    if (itemsToInsert.length > 0) {
      const { error } = await supabase.from('order_items').insert(itemsToInsert);
      itemsError = error;
    }
  
    if (orderError || deleteError || itemsError) {
      console.error("Error updating order:", orderError || deleteError || itemsError);
      toast({ variant: 'destructive', title: "Erro ao atualizar comanda", description: "Não foi possível salvar as alterações." });
      setOrders(originalOrders); 
      if (selectedOrder?.id === updatedOrder.id) {
        setSelectedOrder(originalOrders.find(o => o.id === updatedOrder.id) || null);
      }
    } 
  };
  
const handleCreateOrder = async (type: 'table' | 'name', identifier: string | number, phone?: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado para criar uma comanda." });
        return;
    }

    const finalIdentifier = typeof identifier === 'string' ? identifier.toUpperCase() : identifier;

    if (type === 'name' && phone !== undefined) {
        const clientName = String(finalIdentifier);
        const clientExists = clients.some(c => c.name.toUpperCase() === clientName);

        if (!clientExists) {
            const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert({ name: clientName, phone: phone || null, user_id: user.id })
                .select()
                .single();
            
            if (clientError || !newClient) {
                console.error("Error creating new client:", clientError);
                toast({ variant: 'destructive', title: "Erro ao criar cliente", description: "Não foi possível salvar o novo cliente." });
                return;
            }
            setClients(prev => [newClient, ...prev]);
        }
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({ 
        type, 
        identifier: String(finalIdentifier), 
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
    
    // The realtime subscription will handle adding the new order to the state
    setIsNewOrderDialogOpen(false);
    // Let's select it after a small delay to allow the state to update
    setTimeout(async () => {
        if (!user) return;
        const allOrders = await getOrders(user);
        const newOrder = allOrders.find(o => o.id === data.id);
        if (newOrder) setSelectedOrder(newOrder);
    }, 500);
  };
  
  const handleProcessPayment = async (orderId: string, amount: number, method: string) => {
    const orderToPay = orders.find((o) => o.id === orderId);
    if (!orderToPay || !user) return;
    
    if (method === "Saldo Cliente") {
        const client = clients.find(c => c.name.toUpperCase() === (orderToPay.identifier as string).toUpperCase());
        if (!client) {
            toast({ variant: 'destructive', title: "Erro", description: "Cliente não encontrado para pagamento com saldo." });
            return;
        }

        const { data: creditData, error: creditError } = await supabase
            .from('client_credits')
            .insert({
                client_id: client.id,
                amount: -amount, // Use negative amount for debit
                method: `Pagamento Comanda #${orderToPay.id.substring(0, 4)}`,
                user_id: user.id,
            })
            .select()
            .single();

        if (creditError) {
            toast({ variant: 'destructive', title: "Erro no Pagamento", description: "Não foi possível debitar do saldo do cliente." });
            return;
        }
    }


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

    const newPayment = { ...paymentData, paid_at: paymentData.paid_at };
    let updatedOrder: Order = {
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
        paid_at: new Date(),
        paidAt: new Date(),
      };
    } else {
        updatedOrder = {
            ...updatedOrder,
            status: 'paying',
        };
    }
    
    await handleUpdateOrder(updatedOrder); 
    
    if (isFullyPaid) {
      setSelectedOrder(null); 
    } else {
      setSelectedOrder(updatedOrder);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    // Prevent deletion if there are items or payments
    if (orderToDelete.items.length > 0 || (orderToDelete.payments && orderToDelete.payments.length > 0)) {
        toast({ 
            variant: 'destructive', 
            title: "Ação não permitida", 
            description: "Não é possível excluir comandas que já possuem itens ou pagamentos." 
        });
        return;
    }

    const originalOrders = [...orders];
    setOrders(orders.filter(o => o.id !== orderId));
    setSelectedOrder(null); 

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error("Error deleting order:", error);
      toast({ variant: 'destructive', title: "Erro ao excluir comanda", description: "Não foi possível remover a comanda." });
      setOrders(originalOrders);
    } else {
      toast({ title: "Comanda excluída", description: "A comanda vazia foi removida." });
    }
  };


  const filteredOrders = useMemo(() => {
    if (!searchTerm) {
      return orders;
    }
    return orders.filter(order =>
      String(order.identifier).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);


  const todayStart = startOfToday();

  const openOrders = filteredOrders.filter(o => o.status === 'open' || o.status === 'paying');
  const openOrdersToday = openOrders.filter(o => new Date(o.created_at) >= todayStart);
  const notebookOrders = openOrders.filter(o => new Date(o.created_at) < todayStart && o.items.length > 0);
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
              placeholder="Buscar comanda por nome ou mesa..."
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
          onDeleteOrder={handleDeleteOrder}
        />
      )}

      <NewOrderDialog
        isOpen={isNewOrderDialogOpen}
        onOpenChange={setIsNewOrderDialogOpen}
        onCreateOrder={handleCreateOrder}
        clients={clients}
        user={user}
      />
    </div>
  );
}
