
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Order, MenuItem, Client, OrderItem, ClientCredit, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsSheet } from "@/components/dashboard/order-details-sheet";
import { NewOrderDialog } from "@/components/dashboard/new-order-dialog";
import { PlusCircle, Search, ChevronLeft, ChevronRight, RefreshCw, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startOfToday, format, startOfDay } from 'date-fns';
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const ITEMS_PER_PAGE = 20;

type SortKey = 'identifier' | 'date';
type SortDirection = 'asc' | 'desc';

interface DashboardPageClientProps {
  initialOrders: Order[];
  menuItems: MenuItem[];
  initialClients: Client[];
  user: User;
}

export default function DashboardPageClient({ initialOrders: initialOrdersProp, menuItems: menuItemsProp, initialClients: initialClientsProp, user }: DashboardPageClientProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>(initialOrdersProp);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(menuItemsProp);
  const [clients, setClients] = useState<Client[]>(initialClientsProp);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  const [printedItemsMap, setPrintedItemsMap] = useState<Map<string, OrderItem[]>>(new Map());

  const [sortConfig, setSortConfig] = useState({
    caderneta: { key: 'identifier' as SortKey, direction: 'asc' as SortDirection },
    fechadas: { key: 'date' as SortKey, direction: 'desc' as SortDirection },
  });

  const [pagination, setPagination] = useState({
    abertas: { currentPage: 1 },
    caderneta: { currentPage: 1 },
    fechadas: { currentPage: 1 },
  });

  const fetchData = useCallback(async (currentUser: User | null, showToast: boolean = false) => {
    if (!currentUser) return;
    setIsFetching(true);
    
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

    setIsFetching(false);
    if (showToast) {
        toast({ title: 'Dados atualizados!', description: 'As comandas foram sincronizadas.'});
    }
  }, [supabase, toast]);

  useEffect(() => {
    const search = searchParams.get('search');
    if(search) {
        setSearchTerm(search);
    }
  }, [searchParams]);

  const handleRealtimeUpdate = useCallback(() => {
    fetchData(user, false);
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments' }, handleRealtimeUpdate)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Conectado ao canal de atualizações em tempo real.');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Erro no canal de tempo real. Pode ser devido à inatividade. O erro foi:', err);
          toast({ variant: 'destructive', title: "Erro de Conexão", description: "A sincronização em tempo real foi perdida. Atualize a página se necessário." });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, toast, handleRealtimeUpdate]);


  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const originalOrders = [...orders];
    const originalOrder = originalOrders.find(o => o.id === updatedOrder.id);
  
    const newOrders = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
    setOrders(newOrders);
    if (selectedOrder?.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder);
    }
  
    const wasInNotebook = originalOrder && new Date(originalOrder.created_at) < startOfToday();
    const originalTotalQuantity = originalOrder?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const updatedTotalQuantity = updatedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
    const itemWasAddedOrQuantityIncreased = updatedTotalQuantity > originalTotalQuantity;
    
    let finalOrderDataForUpdate: Partial<Order> = {
      status: updatedOrder.status,
      paid_at: updatedOrder.paidAt,
      customer_name: updatedOrder.customer_name,
    };
  
    if (wasInNotebook && itemWasAddedOrQuantityIncreased) {
      finalOrderDataForUpdate.created_at = new Date().toISOString();
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
  
const handleCreateOrder = async (type: 'table' | 'name', identifier: string | number, customerName?: string, phone?: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado para criar uma comanda." });
        return;
    }

    const finalIdentifier = typeof identifier === 'string' ? identifier.toUpperCase() : identifier;

    // Check for existing open orders FOR TODAY for the same identifier
    const openOrdersToday = orders.filter(o => o.status !== 'paid' && new Date(o.created_at) >= startOfToday());
    const existingOrderToday = openOrdersToday.find(o => 
        o.type === type && String(o.identifier).toUpperCase() === String(finalIdentifier).toUpperCase()
    );

    if (existingOrderToday) {
        toast({ title: "Comanda já existe", description: `Abrindo a comanda existente para ${identifier}.` });
        handleSelectOrder(existingOrderToday);
        setIsNewOrderDialogOpen(false);
        return;
    }

    if (type === 'name' && phone !== undefined) {
        const clientName = String(finalIdentifier);
        const clientExists = clients.some(c => c.name.toUpperCase() === clientName);

        if (!clientExists) {
            const { data: newClientData, error: clientError } = await supabase
                .from('clients')
                .insert({ name: clientName, phone: phone || null, user_id: user.id })
                .select()
                .single();
            
            if (clientError || !newClientData) {
                console.error("Error creating new client:", clientError);
                toast({ variant: 'destructive', title: "Erro ao criar cliente", description: "Não foi possível salvar o novo cliente." });
                return;
            }
            setClients(prev => [...prev, newClientData as Client]);
        }
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({ 
        type, 
        identifier: String(finalIdentifier),
        customer_name: customerName,
        status: 'open',
        user_id: user.id,
       })
      .select()
      .single();

    if (orderError || !orderData) {
        console.error("Error creating order:", orderError);
        toast({ variant: 'destructive', title: "Erro ao criar comanda", description: "Tente novamente." });
        return;
    }

    const newOrder: Order = {
        ...(orderData as any),
        items: [],
        payments: [],
        created_at: new Date(orderData.created_at),
        createdAt: new Date(orderData.created_at),
    };
    
    setOrders(prevOrders => [newOrder, ...prevOrders]);
    handleSelectOrder(newOrder);
    setIsNewOrderDialogOpen(false);
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
                amount: -amount,
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
        .insert({ order_id: orderId, amount, method })
        .select()
        .single();

    if (paymentError || !paymentData) {
        console.error("Error processing payment:", paymentError);
        toast({ variant: 'destructive', title: "Erro no pagamento", description: "Não foi possível registrar o pagamento." });
        return;
    }

    // This is the order currently open in the sheet
    const currentOrderTotal = orderToPay.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
    const currentOrderTotalPaid = (orderToPay.payments?.reduce((acc, p) => acc + p.amount, 0) || 0) + amount;

    const isCurrentOrderFullyPaid = currentOrderTotalPaid >= currentOrderTotal - 0.001;
    let finalStatus = isCurrentOrderFullyPaid ? 'paid' : 'paying';

    // If it's a client order, check if this payment settles the ENTIRE debt
    if (orderToPay.type === 'name') {
        const clientName = (orderToPay.identifier as string).toUpperCase();
        const clientOpenOrders = orders.filter(o => o.type === 'name' && (o.identifier as string).toUpperCase() === clientName && o.status !== 'paid');
        const totalDebt = clientOpenOrders.reduce((sum, o) => {
            const orderTotal = o.items.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);
            const orderPaid = o.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
            return sum + (orderTotal - orderPaid);
        }, 0);

        const clientCreditBalance = credits
            .filter(c => clients.find(cl => cl.name.toUpperCase() === clientName)?.id === c.client_id)
            .reduce((sum, c) => sum + c.amount, 0);

        const netDebt = totalDebt - clientCreditBalance;
        
        if (amount >= netDebt - 0.001) { // Payment covers all debt
            const paidAt = new Date().toISOString();
            const orderIdsToUpdate = clientOpenOrders.map(o => o.id);
            
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'paid', paid_at: paidAt })
                .in('id', orderIdsToUpdate);

            if (updateError) {
                console.error("Error closing client orders:", updateError);
                toast({ variant: 'destructive', title: "Erro ao fechar comandas", description: "O pagamento foi registrado, mas não foi possível fechar todas as comandas antigas." });
            } else {
                 toast({ title: "Dívida quitada!", description: `Todas as comandas de ${clientName} foram pagas.` });
                 finalStatus = 'paid';
            }
        }
    }

    const { error: updateError } = await supabase
        .from('orders')
        .update({ status: finalStatus, paid_at: finalStatus === 'paid' ? new Date().toISOString() : null })
        .eq('id', orderId);

    if (updateError) {
         toast({ variant: 'destructive', title: "Erro ao atualizar comanda", description: "O pagamento foi salvo, mas o status da comanda não foi atualizado." });
    }

    await fetchData(user, false);
    
    if (finalStatus === 'paid') {
        setSelectedOrder(null);
    } else {
        const updatedOrder = orders.find(o => o.id === orderId);
        if (updatedOrder) {
            setSelectedOrder({
                ...updatedOrder,
                status: 'paying',
                payments: [...(updatedOrder.payments || []), paymentData] as any,
            });
        }
    }
};


  const handleDeleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    const isEmpty = orderToDelete.items.length === 0;
    const isPaid = orderToDelete.status === 'paid';

    if (!isPaid && !isEmpty) {
        toast({ 
            variant: 'destructive', 
            title: "Ação não permitida", 
            description: "Apenas comandas pagas ou vazias podem ser excluídas." 
        });
        return;
    }

    const originalOrders = [...orders];
    setOrders(orders.filter(o => o.id !== orderId));
    setSelectedOrder(null);

    await supabase.from('order_payments').delete().eq('order_id', orderId);
    await supabase.from('order_items').delete().eq('order_id', orderId);

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error("Error deleting order:", error);
      toast({ variant: 'destructive', title: "Erro ao excluir comanda", description: "Não foi possível remover a comanda." });
      setOrders(originalOrders);
    } else {
      toast({ title: "Comanda excluída", description: "A comanda foi removida com sucesso." });
    }
  };

  const handleSetPrintedItems = useCallback((orderId: string, items: OrderItem[]) => {
      setPrintedItemsMap(prev => new Map(prev).set(orderId, items));
  }, []);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) {
      return orders;
    }
    return orders.filter(order =>
      String(order.identifier).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name && String(order.customer_name).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [orders, searchTerm]);


  const todayStart = startOfToday();

  const openOrders = filteredOrders.filter(o => o.status === 'open' || o.status === 'paying');
  const openOrdersToday = openOrders.filter(o => new Date(o.created_at) >= todayStart);
  
  const notebookOrders = useMemo(() => {
    return openOrders.filter(o => o.type === 'name' && new Date(o.created_at) < todayStart && o.items.length > 0);
  }, [openOrders]);


  const paidOrders = filteredOrders.filter(o => o.status === 'paid');

  const sortedNotebookOrders = useMemo(() => {
    return [...notebookOrders].sort((a, b) => {
        const key = sortConfig.caderneta.key;
        const direction = sortConfig.caderneta.direction === 'asc' ? 1 : -1;
        if (key === 'identifier') {
            const nameCompare = a.identifier.toString().localeCompare(b.identifier.toString());
            if (nameCompare !== 0) return nameCompare * direction;
            return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else { // date
            return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction;
        }
    });
  }, [notebookOrders, sortConfig.caderneta]);

  const sortedPaidOrders = useMemo(() => {
    return [...paidOrders].sort((a, b) => {
        const key = sortConfig.fechadas.key;
        const direction = sortConfig.fechadas.direction === 'asc' ? 1 : -1;
        const aDate = a.paid_at || a.created_at;
        const bDate = b.paid_at || b.created_at;
        if (key === 'identifier') {
            return a.identifier.toString().localeCompare(b.identifier.toString()) * direction;
        } else { // date
            return (new Date(aDate).getTime() - new Date(bDate).getTime()) * direction;
        }
    });
  }, [paidOrders, sortConfig.fechadas]);


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

  const handleSortChange = (tab: 'caderneta' | 'fechadas', key: SortKey) => {
    setSortConfig(prev => {
        const currentDirection = prev[tab].direction;
        const newDirection = prev[tab].key === key && currentDirection === 'asc' ? 'desc' : 'asc';
        return {
            ...prev,
            [tab]: { key, direction: newDirection },
        };
    });
  };

  const handleNotebookClick = (order: Order) => {
    const clientName = order.identifier as string;
    router.push(`/dashboard/clients?search=${encodeURIComponent(clientName)}`);
  };

  const renderPaginatedOrders = (orderList: Order[], tab: 'abertas' | 'caderneta' | 'fechadas') => {
    const { currentPage } = pagination[tab];
    const totalPages = Math.ceil(orderList.length / ITEMS_PER_PAGE);
    const paginatedItems = orderList.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
    
    const getPaymentStatus = (order: Order) => {
        const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
        const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
        const remainingAmount = total - paidAmount;
        const isPartiallyPaid = paidAmount > 0 && remainingAmount > 0.01;

        if (order.status === 'paid') return { text: 'Pago', variant: 'secondary' as const };
        if (isPartiallyPaid) return { text: 'Parcial', variant: 'outline' as const };
        if (order.status === 'paying') return { text: 'Pagando', variant: 'destructive' as const };
        return { text: 'Aberto', variant: 'default' as const };
    };

    const renderSortArrow = (currentTab: 'caderneta' | 'fechadas', key: SortKey) => {
        const config = sortConfig[currentTab];
        if (config.key !== key) return null;
        return config.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const renderOrderList = (ordersToRender: Order[], tabName: 'caderneta' | 'fechadas') => (
        <div className="border rounded-lg mt-4 overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="whitespace-nowrap">
                        <Button variant="ghost" onClick={() => handleSortChange(tabName, 'identifier')} className="px-0 hover:bg-transparent">
                            Comanda
                            {renderSortArrow(tabName, 'identifier')}
                        </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                        <Button variant="ghost" onClick={() => handleSortChange(tabName, 'date')} className="px-0 hover:bg-transparent">
                            Data
                            {renderSortArrow(tabName, 'date')}
                        </Button>
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">Itens</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                    {tabName === 'fechadas' && <TableHead className="w-[50px]">Ações</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ordersToRender.map((order) => {
                         const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
                         const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
                         const remainingAmount = total - paidAmount;
                         const displayAmount = order.status === 'paid' ? total : remainingAmount;
                         const paymentStatus = getPaymentStatus(order);
                         const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);
                         const dateToDisplay = order.status === 'paid' && order.paid_at ? order.paid_at : order.created_at;

                        return (
                            <TableRow 
                                key={order.id} 
                                onClick={() => tabName === 'caderneta' ? handleNotebookClick(order) : handleSelectOrder(order)} 
                                className="cursor-pointer"
                            >
                                <TableCell className="font-medium whitespace-nowrap">
                                    {order.type === 'table' ? `Mesa ${order.identifier}` : order.identifier}
                                    {order.customer_name && <span className="text-xs text-muted-foreground block">{order.customer_name}</span>}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">{format(new Date(dateToDisplay), 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell className="text-center whitespace-nowrap">{itemCount}</TableCell>
                                <TableCell>
                                    <Badge variant={paymentStatus.variant}>{paymentStatus.text}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium whitespace-nowrap">R$ {displayAmount.toFixed(2).replace('.', ',')}</TableCell>
                                {tabName === 'fechadas' && (
                                    <TableCell>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir Comprovante?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação removerá permanentemente o comprovante da lista. A venda já foi registrada e não será afetada.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }}>
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                )}
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );

    return (
      <>
        {paginatedItems.length > 0 ? (
            tab === 'abertas' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mt-4">
                    {paginatedItems.map((order) => (
                    <OrderCard key={order.id} order={order} onSelectOrder={handleSelectOrder} onDeleteOrder={handleDeleteOrder} />
                    ))}
                </div>
            ) : (
                renderOrderList(paginatedItems, tab as 'caderneta' | 'fechadas')
            )
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center mt-4">
            <h3 className="text-lg font-semibold text-muted-foreground">Nenhuma comanda encontrada</h3>
            <p className="text-sm text-muted-foreground">Tente um termo de busca diferente ou crie uma nova comanda.</p>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 md:gap-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(tab, 'prev')}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Anterior</span>
            </Button>
            <span className="text-sm font-medium">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(tab, 'next')}
              disabled={currentPage === totalPages}
            >
              <span className="hidden md:inline">Próximo</span>
              <ChevronRight className="h-4 w-4 md:ml-2" />
            </Button>
          </div>
        )}
      </>
    );
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Comandas</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="icon" onClick={() => fetchData(user, true)} disabled={isFetching}>
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button onClick={() => setIsNewOrderDialogOpen(true)} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Comanda
            </Button>
        </div>
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
           {renderPaginatedOrders(sortedNotebookOrders, 'caderneta')}
        </TabsContent>
        <TabsContent value="fechadas" className="mt-4">
            {renderPaginatedOrders(sortedPaidOrders, 'fechadas')}
        </TabsContent>
      </Tabs>


      {selectedOrder && (
        <OrderDetailsSheet
          order={selectedOrder}
          allOrders={orders}
          allClients={clients}
          allCredits={credits}
          menuItems={menuItems}
          printedKitchenItems={printedItemsMap.get(selectedOrder.id) || []}
          onSetPrintedItems={(items) => handleSetPrintedItems(selectedOrder.id, items)}
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
        orders={orders}
        credits={credits}
        user={user}
      />
    </div>
  );
}
