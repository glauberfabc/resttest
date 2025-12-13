
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
import { startOfToday, format, startOfDay, isBefore } from 'date-fns';
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
} from "@/components/ui/alert-dialog";

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

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  const fetchData = useCallback(async (showToast: boolean = false) => {
    setIsFetching(true);

    const client = createClient();

    // Fetch all open/paying orders (critical for operations)
    const { data: openOrdersData } = await client
      .from('orders')
      .select(`*, items:order_items(*, menu_item:menu_items(*)), payments:order_payments(*)`)
      .neq('status', 'paid')
      .order('created_at', { ascending: false }) as { data: any[] | null };

    // Fetch recent paid orders (limited for performance)
    const { data: paidOrdersData } = await client
      .from('orders')
      .select(`*, items:order_items(*, menu_item:menu_items(*)), payments:order_payments(*)`)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false }) // Order by paid_at for history
      .limit(50) as { data: any[] | null };

    const ordersData = [...(openOrdersData || []), ...(paidOrdersData || [])];

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

      // Deduplicate just in case (though logic shouldn't overlap much)
      const uniqueOrders = Array.from(new Map(formattedOrders.map(item => [item.id, item])).values());
      setOrders(uniqueOrders);
    }

    const { data: menuItemsData } = await client.from('menu_items').select('*');
    if (menuItemsData) {
      const formattedItems = (menuItemsData as any[]).map(item => ({ ...item, id: item.id || crypto.randomUUID(), code: item.code, imageUrl: item.image_url, lowStockThreshold: item.low_stock_threshold })) as unknown as MenuItem[];
      setMenuItems(formattedItems);
    }

    const { data: clientsData } = await client.from('clients').select('*');
    if (clientsData) setClients(clientsData as Client[]);

    // Optimized: client_credits not fetched. Balance is in clients table.

    setIsFetching(false);
    if (showToast) {
      toast({ title: 'Dados atualizados!', description: 'As comandas foram sincronizadas.' });
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setSearchTerm(search);
    }
  }, [searchParams]);

  const handleRealtimeUpdate = useCallback(async (payload: any) => {
    console.log('Realtime event received:', payload);
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    const client = createClient();

    if (table === 'orders') {
      if (eventType === 'INSERT') {
        // Fetch the full order with relations to ensure consistency
        const { data: orderData } = await client
          .from('orders')
          .select(`*, items:order_items(*, menu_item:menu_items(*)), payments:order_payments(*)`)
          .eq('id', newRecord.id)
          .single() as { data: any };

        if (orderData) {
          const formattedOrder = {
            ...orderData,
            items: orderData.items.map((item: any) => ({
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
            created_at: new Date(orderData.created_at),
            paid_at: orderData.paid_at ? new Date(orderData.paid_at) : undefined,
            createdAt: new Date(orderData.created_at),
            paidAt: orderData.paid_at ? new Date(orderData.paid_at) : undefined,
          } as unknown as Order;

          setOrders(prev => {
            if (prev.find(o => o.id === formattedOrder.id)) return prev;
            return [formattedOrder, ...prev];
          });
        }
      } else if (eventType === 'UPDATE') {
        setOrders(prev => prev.map(order => {
          if (order.id === newRecord.id) {
            return {
              ...order,
              ...newRecord,
              created_at: new Date(newRecord.created_at),
              paid_at: newRecord.paid_at ? new Date(newRecord.paid_at) : undefined,
              createdAt: new Date(newRecord.created_at),
              paidAt: newRecord.paid_at ? new Date(newRecord.paid_at) : undefined,
            };
          }
          return order;
        }));
      } else if (eventType === 'DELETE') {
        setOrders(prev => prev.filter(order => order.id !== oldRecord.id));
      }
    } else if (table === 'order_items') {
      if (eventType === 'INSERT') {
        // Need to fetch the menu item details or look it up
        const menuItem = menuItems.find(i => i.id === newRecord.menu_item_id);
        if (!menuItem) return; // Should not happen if menuItems is up to date

        const newItem: OrderItem = {
          id: newRecord.id,
          quantity: newRecord.quantity,
          comment: newRecord.comment || '',
          menuItem: menuItem
        };

        setOrders(prev => prev.map(order => {
          if (order.id === newRecord.order_id) {
            return { ...order, items: [...order.items, newItem] };
          }
          return order;
        }));
      } else if (eventType === 'UPDATE') {
        setOrders(prev => prev.map(order => {
          if (order.id === newRecord.order_id) {
            return {
              ...order,
              items: order.items.map(item => {
                if (item.id === newRecord.id) {
                  return { ...item, quantity: newRecord.quantity, comment: newRecord.comment || '' };
                }
                return item;
              })
            };
          }
          return order;
        }));
      } else if (eventType === 'DELETE') {
        setOrders(prev => prev.map(order => {
          // We don't have order_id in oldRecord for DELETE sometimes, but usually we do if replica identity is set.
          // If not, we have to search all orders.
          // Assuming we can find it.
          if (order.items.some(i => i.id === oldRecord.id)) {
            return { ...order, items: order.items.filter(i => i.id !== oldRecord.id) };
          }
          return order;
        }));
      }
    } else if (table === 'order_payments') {
      if (eventType === 'INSERT') {
        setOrders(prev => prev.map(order => {
          if (order.id === newRecord.order_id) {
            const newPayment = { ...newRecord };
            return { ...order, payments: [...(order.payments || []), newPayment] };
          }
          return order;
        }));
      } else if (eventType === 'DELETE') {
        setOrders(prev => prev.map(order => {
          if (order.payments?.some(p => p.id === oldRecord.id)) {
            return { ...order, payments: order.payments.filter(p => p.id !== oldRecord.id) };
          }
          return order;
        }));
      }
    }
  }, [menuItems]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments' }, handleRealtimeUpdate)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Conectado ao canal de atualizações em tempo real.');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Erro no canal de tempo real.', err);
          toast({ variant: 'destructive', title: "Erro de Conexão", description: "A sincronização em tempo real foi perdida." });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, toast, handleRealtimeUpdate]);


  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    handleSetPrintedItems(order.id, order.items);
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const client = createClient();

    const { error: deleteError } = await client
      .from('order_items')
      .delete()
      .eq('order_id', updatedOrder.id);

    if (deleteError) {
      console.error("Error deleting old order items:", deleteError);
      toast({ variant: 'destructive', title: "Erro ao atualizar comanda", description: "Não foi possível remover os itens antigos." });
      await fetchData(false);
      return;
    }

    if (updatedOrder.items.length > 0) {
      const itemsToInsert = updatedOrder.items.map(item => ({
        order_id: updatedOrder.id,
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        comment: item.comment || null,
      }));

      const { error: insertError } = await (client.from('order_items') as any).insert(itemsToInsert);

      if (insertError) {
        console.error("Error inserting new order items:", insertError);
        toast({ variant: 'destructive', title: "Erro ao atualizar comanda", description: "Não foi possível adicionar os novos itens." });
        await fetchData(false);
        return;
      }
    }

    const { data: freshlyUpdatedOrderData } = await client
      .from('orders')
      .select(`*, items:order_items(*, menu_item:menu_items(*)), payments:order_payments(*)`)
      .eq('id', updatedOrder.id)
      .single() as { data: any };

    if (freshlyUpdatedOrderData) {
      const formattedOrder: Order = {
        ...freshlyUpdatedOrderData,
        items: freshlyUpdatedOrderData.items.map((item: any) => ({
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
        created_at: new Date(freshlyUpdatedOrderData.created_at),
        paid_at: freshlyUpdatedOrderData.paid_at ? new Date(freshlyUpdatedOrderData.paid_at) : undefined,
        createdAt: new Date(freshlyUpdatedOrderData.created_at),
        paidAt: freshlyUpdatedOrderData.paid_at ? new Date(freshlyUpdatedOrderData.paid_at) : undefined,
      };
      setSelectedOrder(formattedOrder);
    } else {
      setSelectedOrder(null);
    }
    await fetchData(false);
  };

  const handleCreateOrder = async (type: 'table' | 'name', identifier: string | number, customerName?: string, phone?: string, observation?: string) => {
    const finalIdentifier = typeof identifier === 'string' ? identifier.toUpperCase() : identifier;
    const client = createClient();

    if (!user) {
      toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado para criar uma comanda." });
      return;
    }

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

    if (type === 'name' && customerName) {
      const clientName = String(finalIdentifier);
      const clientExists = clients.some(c => c.name.toUpperCase() === clientName);

      if (!clientExists) {
        const { data: newClientData, error: clientError } = await (client
          .from('clients') as any)
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

    let insertData: any = {
      type,
      identifier: String(finalIdentifier),
      status: 'open',
      user_id: user.id,
    };

    if (type === 'name') {
      insertData.customer_name = customerName;
      insertData.observation = observation;
    } else {
      insertData.customer_name = customerName;
    }


    const { data: orderData, error: orderError } = await client
      .from('orders')
      .insert(insertData)
      .select()
      .single() as { data: any; error: any };

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
    const client = createClient();
    const orderToPay = orders.find((o) => o.id === orderId);
    if (!orderToPay || !user) return;

    let allOrdersForClient: Order[] = [];
    let totalClientDebt = 0;
    let isPayingFullDebt = false;

    if (orderToPay.type === 'name') {
      const clientName = (orderToPay.identifier as string).toUpperCase();
      allOrdersForClient = orders.filter(o => o.status !== 'paid' && o.type === 'name' && (o.identifier as string).toUpperCase() === clientName);


      // Optimized: Use client.balance from DB (Credits - Debts).
      // If balance is negative, they owe money. If positive, they have credit.
      // totalClientDebt is "how much they owe", so it is -balance.
      const clientRecord = clients.find(c => c.name.toUpperCase() === clientName);
      const clientBalance = clientRecord?.balance || 0;

      totalClientDebt = -clientBalance;

      // Safe check: if balance is positive (credit), debt is 0 (or negative in this var).
      // Only pay full debt if debt > 0.
      isPayingFullDebt = totalClientDebt > 0 && amount >= totalClientDebt - 0.01;
    }

    if (method === "Saldo Cliente") {
      const clientRecord = clients.find(c => c.name.toUpperCase() === (orderToPay.identifier as string).toUpperCase());
      if (clientRecord && user) {
        const { error: creditError } = await (client.from('client_credits') as any).insert({
          client_id: clientRecord.id,
          amount: -amount, // Deduct from balance
          method: "Consumo",
          user_id: user.id
        });
        if (creditError) {
          toast({ variant: 'destructive', title: "Erro no Saldo", description: "Não foi possível deduzir o valor do saldo do cliente." });
          return;
        }
      }
    }


    const { error: paymentError } = await (client
      .from('order_payments') as any)
      .insert({ order_id: orderId, amount, method });

    if (paymentError) {
      toast({ variant: 'destructive', title: "Erro no Pagamento", description: paymentError.message });
      return;
    }

    if (isPayingFullDebt && allOrdersForClient.length > 0) {
      const orderIdsToUpdate = allOrdersForClient.map(o => o.id);
      await (client
        .from('orders') as any)
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .in('id', orderIdsToUpdate);
      toast({ title: "Dívida Quitada!", description: `Todas as comandas de ${orderToPay.identifier} foram pagas.` });
    } else {
      const orderTotal = orderToPay.items.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
      const totalPaidForThisOrder = (orderToPay.payments?.reduce((sum, p) => sum + p.amount, 0) || 0) + amount;

      const isOrderNowPaid = totalPaidForThisOrder >= orderTotal - 0.01;

      if (isOrderNowPaid) {
        await (client
          .from('orders') as any)
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', orderId);
        toast({ title: "Comanda Paga!", description: `A comanda foi quitada.` });
      } else {
        await (client
          .from('orders') as any)
          .update({ status: 'paying' })
          .eq('id', orderId);
        toast({ title: "Pagamento recebido!", description: `R$ ${amount.toFixed(2)} recebidos.` });
      }
    }

    setSelectedOrder(null);
    await fetchData(false);
  };


  const handleDeleteOrder = async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;
    const client = createClient();

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

    await client.from('order_payments').delete().eq('order_id', orderId);
    await client.from('order_items').delete().eq('order_id', orderId);

    const { error } = await client
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

  const { openOrdersToday, notebookOrders } = useMemo(() => {
    const openOrders = filteredOrders.filter(o => o.status === 'open' || o.status === 'paying');

    const notebook = openOrders.filter(o => isBefore(new Date(o.created_at), todayStart));
    const today = openOrders.filter(o => !isBefore(new Date(o.created_at), todayStart));

    const todayWithCounts = today.map(order => {
      if (order.type === 'name') {
        const otherOpenOrders = openOrders.filter(
          other => other.id !== order.id && other.type === 'name' && other.identifier === order.identifier
        );
        return { ...order, otherOpenOrdersCount: otherOpenOrders.length };
      }
      return order;
    });

    return { openOrdersToday: todayWithCounts, notebookOrders: notebook };
  }, [filteredOrders, todayStart]);


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
        return (new Date(bDate).getTime() - new Date(aDate).getTime()) * direction;
      }
    });
  }, [paidOrders, sortConfig.fechadas]);


  const loadMorePaidOrders = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    const lastPaidOrder = paidOrders[paidOrders.length - 1];
    const lastPaidDate = lastPaidOrder ? (lastPaidOrder.paid_at || lastPaidOrder.created_at) : new Date().toISOString();

    const client = createClient();
    const { data: morePaidOrders } = await client
      .from('orders')
      .select(`*, items:order_items(*, menu_item:menu_items(*)), payments:order_payments(*)`)
      .eq('status', 'paid')
      .lt('paid_at', typeof lastPaidDate === 'string' ? lastPaidDate : new Date(lastPaidDate).toISOString())
      .order('paid_at', { ascending: false })
      .limit(50) as { data: any[] | null };

    if (morePaidOrders) {
      const formattedMoreOrders = morePaidOrders.map((order: any) => ({
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

      setOrders(prev => {
        const newOrders = formattedMoreOrders.filter(newO => !prev.some(prevO => prevO.id === newO.id));
        return [...prev, ...newOrders];
      });
    }
    setIsLoadingMore(false);
  };

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
                  onClick={() => handleSelectOrder(order)}
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
          <Button variant="outline" size="icon" onClick={() => fetchData(true)} disabled={isFetching}>
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
          placeholder="Buscar comanda por nome, mesa ou observação..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="abertas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="abertas">Abertas ({openOrdersToday.length})</TabsTrigger>
          <TabsTrigger value="caderneta" >Caderneta ({notebookOrders.length})</TabsTrigger>
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
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={loadMorePaidOrders} disabled={isLoadingMore}>
              {isLoadingMore ? 'Carregando...' : 'Carregar Mais Antigas'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>


      {selectedOrder && (
        <OrderDetailsSheet
          order={selectedOrder}
          allOrders={orders}
          allClients={clients}

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

        user={user}
      />
    </div>
  );
}
