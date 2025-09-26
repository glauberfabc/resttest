
"use client";

import { useState, useMemo } from "react";
import type { Client, Order } from "@/lib/types";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Pencil, Trash2 } from "lucide-react";
import { ClientFormDialog } from "@/components/dashboard/clients/client-form-dialog";

interface ClientsPageClientProps {
  initialClients: Client[];
  initialOrders: Order[];
}

export default function ClientsPageClient({ initialClients, initialOrders }: ClientsPageClientProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const debtors = useMemo(() => {
    const openNameOrders = orders.filter(o => o.type === 'name' && o.status !== 'paid');
    const debtorMap = new Map<string, { client: Client | null, totalDebt: number }>();

    openNameOrders.forEach(order => {
        const clientName = order.identifier as string;
        const client = clients.find(c => c.name === clientName) || null;
        
        const orderTotal = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
        const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
        const remainingAmount = orderTotal - paidAmount;

        if (remainingAmount > 0) {
            const existingDebtor = debtorMap.get(clientName) || { client, totalDebt: 0 };
            existingDebtor.totalDebt += remainingAmount;
            debtorMap.set(clientName, existingDebtor);
        }
    });

    return Array.from(debtorMap.values());
  }, [orders, clients]);

  const handleSaveClient = (client: Client) => {
    if (selectedClient) {
      setClients(clients.map(c => c.id === client.id ? client : c));
    } else {
      setClients([{ ...client, id: `client-${Date.now()}` }, ...clients]);
    }
    setSelectedClient(null);
    setIsFormOpen(false);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleDelete = (clientId: string) => {
    // Ideally, check if client has pending debts before deleting
    setClients(clients.filter(c => c.id !== clientId));
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
              <TableHead>Contato (Telefone/Email)</TableHead>
              <TableHead className="w-[150px] text-right">Dívida Ativa</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
                const debtorInfo = debtors.find(d => d.client?.id === client.id);
                const debt = debtorInfo ? debtorInfo.totalDebt : 0;
                return (
                    <TableRow key={client.id} className={debt > 0 ? "bg-destructive/10" : ""}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.phone || client.email || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                            {debt > 0 ? `R$ ${debt.toFixed(2).replace('.', ',')}` : "-"}
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
                                <DropdownMenuItem onClick={() => handleEdit(client)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
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
        />
      )}
    </div>
  );
}
