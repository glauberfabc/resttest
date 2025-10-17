
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
import { MoreHorizontal, PlusCircle, Pencil, Trash2, DollarSign } from "lucide-react";
import { ClientFormDialog } from "@/components/dashboard/clients/client-form-dialog";
import { AddCreditDialog } from "@/components/dashboard/clients/add-credit-dialog";
import { supabase, getClients, getOrders, getClientCredits } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ClientsPageClientProps {
  initialClients: Client[];
  initialOrders: Order[];
  user: User;
}

export default function ClientsPageClient({ initialClients: initialClientsProp, initialOrders: initialOrdersProp, user }: ClientsPageClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClientsProp);
  const [orders, setOrders] = useState<Order[]>(initialOrdersProp);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreditFormOpen, setIsCreditFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const fetchData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) return;
    const [clientsData, ordersData, creditsData] = await Promise.all([
      getClients(),
      getOrders(currentUser),
      getClientCredits()
    ]);
    setClients(clientsData);
    setOrders(ordersData);
    setCredits(creditsData);
  }, []);

  useEffect(() => {
    if(user) {
      fetchData(user);
    }
  }, [user, fetchData]);

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
      setClients([ { ...data, user_id: data.user_id }, ...clients]);
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
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível adicionar o crédito." });
    } else {
        const newCredit = { ...data, created_at: new Date(data.created_at) } as ClientCredit;
        setCredits(prev => [newCredit, ...prev]);
        toast({ title: "Sucesso!", description: `Crédito de R$ ${amount.toFixed(2)} adicionado.` });
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Gerenciar Clientes</h2>
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Cliente
        </Button>
      </div>

       <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato (Telefone/Documento)</TableHead>
              <TableHead className="w-[150px] text-right">Saldo</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
                const balance = clientBalances.get(client.id) || 0;
                const balanceColor = balance > 0 ? "text-green-600" : balance < 0 ? "text-red-600" : "";
                return (
                    <TableRow key={client.id} className={balance < 0 ? "bg-destructive/10" : ""}>
                        <TableCell 
                            className="font-medium cursor-pointer hover:underline"
                            onClick={() => handleCreateOrderForClient(client.name)}
                        >
                            {client.name}
                        </TableCell>
                        <TableCell>{client.phone || client.document || "-"}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${balanceColor}`}>
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
                                    Adicionar Crédito
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
