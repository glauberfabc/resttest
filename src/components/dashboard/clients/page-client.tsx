
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { MoreHorizontal, PlusCircle, Pencil, Trash2, DollarSign, ArrowUp, ArrowDown, Search, Clock } from "lucide-react";
import { ClientFormDialog } from "@/components/dashboard/clients/client-form-dialog";
import { AddCreditDialog } from "@/components/dashboard/clients/add-credit-dialog";
import { OrderHistoryDialog } from "@/components/dashboard/clients/order-history-dialog";
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
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>(initialClientsProp);
  const [orders, setOrders] = useState<Order[]>(initialOrdersProp);
  const [credits, setCredits] = useState<ClientCredit[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreditFormOpen, setIsCreditFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positive' | 'negative'>('all');


  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
    }
  }, [searchParams]);

  const fetchData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) return;

    const { data: clientsData } = await supabase.from('clients').select('*');
    if (clientsData) setClients(clientsData as Client[]);

    // Optimized: No longer fetching all credits and orders. Balance is now in clients table.
  }, [supabase]);

  useEffect(() => {
    if (user) {
      fetchData(user);
    }
  }, [user, fetchData]);

  const clientBalances = useMemo(() => {
    const balanceMap = new Map<string, number>();
    clients.forEach(client => {
      balanceMap.set(client.id, client.balance || 0);
    });
    return balanceMap;
  }, [clients]);


  const sortedClients = useMemo(() => {
    const filteredByBalance = clients.filter(client => {
      const balance = clientBalances.get(client.id) || 0;
      if (balanceFilter === 'positive') return balance > 0;
      if (balanceFilter === 'negative') return balance < 0;
      return true; // 'all'
    });

    const filteredBySearch = filteredByBalance.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filteredBySearch.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.name.localeCompare(b.name);
      } else {
        return b.name.localeCompare(a.name);
      }
    });
  }, [clients, searchTerm, sortOrder, balanceFilter, clientBalances]);

  const toggleSortOrder = () => {
    setSortOrder(currentOrder => (currentOrder === 'asc' ? 'desc' : 'asc'));
  };


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
      const { error: updateError, data } = await (supabase
        .from('clients') as any)
        .update({
          name: clientData.name,
          document: clientData.document,
          phone: clientData.phone
        })
        .eq('id', selectedClient.id) // Assuming editingClient was a typo and should be selectedClient
        .select()
        .single();

      if (updateError || !data) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível atualizar o cliente." });
        return;
      }
      setClients(clients.map(c => c.id === data.id ? { ...data, user_id: data.user_id } : c));

    } else { // Adding new client
      const { data, error } = await (supabase
        .from('clients') as any)
        .insert({
          user_id: user.id,
          name: finalClientData.name,
          phone: finalClientData.phone,
          document: finalClientData.document,
          created_at: new Date(),
          balance: 0
        })
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

    const { data, error } = await (supabase
      .from('client_credits') as any)
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
      toast({ title: "Sucesso!", description: `Valor de R$ ${Math.abs(amount).toFixed(2).replace('.', ',')} ${action}.` });
    }

    setIsCreditFormOpen(false);
    setSelectedClient(null);
  };

  const handleCreateOrderForClient = async (clientName: string) => {
    if (!user) {
      toast({ variant: 'destructive', title: "Erro", description: "Você precisa estar logado para criar uma comanda." });
      return;
    }

    const { data, error } = await (supabase
      .from('orders') as any)
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

  const handleOpenHistory = (client: Client) => {
    setSelectedClient(client);
    setIsHistoryOpen(true);
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

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente por nome..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={balanceFilter === 'all' ? 'default' : 'outline'} onClick={() => setBalanceFilter('all')}>Todos</Button>
          <Button size="sm" variant={balanceFilter === 'negative' ? 'default' : 'outline'} onClick={() => setBalanceFilter('negative')}>Com Saldo Devedor</Button>
          <Button size="sm" variant={balanceFilter === 'positive' ? 'default' : 'outline'} onClick={() => setBalanceFilter('positive')}>Com Saldo Positivo</Button>
        </div>
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
                    {balance.toFixed(2) !== '0.00' ? `R$ ${balance.toFixed(2).replace('.', ',')}` : "-"}
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
                        <DropdownMenuItem onClick={() => handleOpenHistory(client)}>
                          <Clock className="mr-2 h-4 w-4" />
                          Ver Histórico
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
      {isHistoryOpen && selectedClient && (
        <OrderHistoryDialog
          isOpen={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          client={selectedClient}
        />
      )}
    </div>
  );
}

