
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Client, Order, ClientCredit, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Pencil, Trash2, DollarSign, ArrowUp, ArrowDown, Search } from "lucide-react";
import { ClientFormDialog } from "@/components/dashboard/clients/client-form-dialog";
import { AddCreditDialog } from "@/components/dashboard/clients/add-credit-dialog";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface ClientsPageClientProps {
  initialClients: Client[];
  initialOrders: Order[];
  user: User;
}

export default function ClientsPageClient({ initialClients: initialClientsProp, initialOrders: initialOrdersProp, user }: ClientsPageClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>(initialClientsProp);
  const [orders, setOrders] = useState<Order[]>(initialOrdersProp);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreditFormOpen, setIsCreditFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState("");


  const fetchData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) return;
    
    const { data: clientsData } = await supabase.from('clients').select('*');
    if (clientsData) setClients(clientsData as Client[]);

    const { data: creditsData } = await supabase.from('client_credits').select('*').order('created_at', { ascending: false });
    if (creditsData) setCredits(creditsData.map(c => ({...c, created_at: new Date(c.created_at)})) as ClientCredit[]);

    const { data: ordersData } = await supabase
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
  }, [supabase]);

  useEffect(() => {
    if(user) {
      fetchData(user);
    }
  }, [user, fetchData]);
  
  const sortedClients = useMemo(() => {
    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filteredClients.sort((a, b) => {
        if (sortOrder === 'asc') {
            return a.name.localeCompare(b.name);
        } else {
            return b.name.localeCompare(a.name);
        }
    });
  }, [clients, searchTerm, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(currentOrder => (currentOrder === 'asc' ? 'desc' : 'asc'));
  };

  const clientBalances = useMemo(() => {
    const balanceMap = new Map<string, number>();

    // Initialize all clients with 0 balance
    clients.forEach(client => {
      balanceMap.set(client.id, 0);
    });

    // Add credits
    credits.forEach(credit => {
      balanceMap.set(credit.client_id, (balanceMap.get(credit.client_id) || 0) + credit.amount);
    });

    // Subtract debts from open orders
    const openNameOrders = orders.filter(o => o.type === 'name' && o.status !== 'paid');
    openNameOrders.forEach(order => {
      const client = clients.find(c => c.name.toUpperCase() === (order.identifier as string).toUpperCase());
      if (client) {
        const orderTotal = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
        const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
        const remainingDebt = orderTotal - paidAmount;
        balanceMap.set(client.id, (balanceMap.get(client.id) || 0) - remainingDebt);
      }
    });

    return balanceMap;
  }, [orders, clients, credits]);


  const handleSaveClient = async (clientData: Omit<Client, 'id' | 'user_id'>) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado." });
        return;
    }

    const finalClientData = {
        ...clientData,
        name: clientData.name.toUpperCase(),
    };

    if (selectedClient) { // Editing existing client
      const { data, error } = await supabase
        .from('clients')
        .update({ name: finalClientData.name, phone: finalClientData.phone, document: finalClientData.document })
        .eq('id', selectedClient.id)
        .select()
        .single();
        
      if (error || !data) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível atualizar o cliente." });
        return;
      }
      setClients(clients.map(c => c.id === data.id ? { ...data, user_id: data.user_id } : c));

    } else { // Adding new client
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...finalClientData, user_id: user.id })
        .select()
        .single();

      if (error || !data) {
        console.error("Error adding client:", error);
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível adicionar o cliente." });
        return;
      }
      setClients([...clients, { ...data, user_id: data.user_id }]);
    }
    
    setSelectedClient(null);
    setIsFormOpen(false);
  };
  
  const handleAddCredit = async (clientId: string, amount: number, method: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado." });
        return;
    }

    const { data, error } = await supabase
        .from('client_credits')
        .insert({
            client_id: clientId,
            amount,
            method,
            user_id: user.id,
        })
        .select()
        .single();
    
    if (error || !data) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível adicionar o crédito/débito." });
    } else {
        const newCredit = { ...data, created_at: new Date(data.created_at) } as ClientCredit;
        setCredits(prev => [newCredit, ...prev]);
        const action = amount > 0 ? 'adicionado' : 'debitado';
        toast({ title: "Sucesso!", description: `Valor de R$ ${Math.abs(amount).toFixed(2)} ${action}.` });
    }

    setIsCreditFormOpen(false);
    setSelectedClient(null);
  };

  const handleCreateOrderForClient = async (clientName: string) => {
    if (!user) {
        toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado para criar uma comanda." });
        return;
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({ 
        type: 'name', 
        identifier: clientName.toUpperCase(), 
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

    toast({ title: "Comanda aberta!", description: `Nova comanda aberta para ${clientName}.` });
    router.push('/dashboard');
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleOpenCreditDialog = (client: Client) => {
    setSelectedClient(client);
    setIsCreditFormOpen(true);
  }

  const handleAddNew = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (clientId: string) => {
    const balance = clientBalances.get(clientId) || 0;
    if (balance !== 0) {
        toast({ variant: 'destructive', title: "Ação não permitida", description: "Não é possível excluir clientes com saldo ou débitos pendentes." });
        return;
    }
    
    const { error } = await supabase.from('clients').delete().eq('id', clientId);

    if (error) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível excluir o cliente." });
    } else {
        setClients(clients.filter(c => c.id !== clientId));
        toast({ title: "Sucesso", description: "Cliente excluído." });
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Gerenciar Clientes</h2>
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Cliente
        </Button>
      </div>

      <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
              placeholder="Buscar cliente por nome..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

       <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">
                 <Button variant="ghost" onClick={toggleSortOrder} className="px-0 hover:bg-transparent">
                    Nome
                    {sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />}
                 </Button>
              </TableHead>
              <TableHead className="whitespace-nowrap">Contato (Telefone/Documento)</TableHead>
              <TableHead className="w-[150px] text-right whitespace-nowrap">Saldo</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedClients.map((client) => {
                const balance = clientBalances.get(client.id) || 0;
                const balanceColor = balance > 0 ? "text-green-600" : balance < 0 ? "text-red-600" : "";
                return (
                    <TableRow key={client.id} className={balance < 0 ? "bg-destructive/10" : ""}>
                        <TableCell 
                            className="font-medium cursor-pointer hover:underline whitespace-nowrap"
                            onClick={() => handleCreateOrderForClient(client.name)}
                        >
                            {client.name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{client.phone || client.document || "-"}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold whitespace-nowrap ${balanceColor}`}>
                            {balance !== 0 ? `R$ ${balance.toFixed(2).replace('.', ',')}` : "-"}
                        </TableCell>
                        <TableCell>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Abrir menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenCreditDialog(client)}>
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Adicionar Crédito/Débito
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(client)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(client.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                )
            })}
          </TableBody>
        </Table>
      </div>
      
      {isFormOpen && (
        <ClientFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveClient}
            client={selectedClient}
            user={user}
            existingClients={clients}
        />
      )}
      {isCreditFormOpen && selectedClient && (
        <AddCreditDialog
            isOpen={isCreditFormOpen}
            onOpenChange={setIsCreditFormOpen}
            onSave={handleAddCredit}
            client={selectedClient}
            user={user}
        />
      )}
    </div>
  );
}

    