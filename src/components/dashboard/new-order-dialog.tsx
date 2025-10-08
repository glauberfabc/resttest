
"use client";

import { useState, useMemo, useEffect } from "react";
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Client } from "@/lib/types";

interface NewOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCreateOrder: (type: 'table' | 'name', identifier: string | number, phone?: string) => void;
  clients: Client[];
}

export function NewOrderDialog({ isOpen, onOpenChange, onCreateOrder, clients }: NewOrderDialogProps) {
  const [activeTab, setActiveTab] = useState<'table' | 'name'>('table');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');

  const isNewCustomer = useMemo(() => {
    if (!customerName) return false;
    return !clients.some(client => client.name.toUpperCase() === customerName.toUpperCase());
  }, [customerName, clients]);
  
  useEffect(() => {
    if (!isOpen) {
        // Reset state when dialog closes
        setTimeout(() => {
            setTableNumber('');
            setCustomerName('');
            setPhone('');
            setActiveTab('table');
        }, 200);
    }
  }, [isOpen]);

  const handleSelectClient = (clientName: string) => {
    // This function is now the single source of truth for creating an order from the list.
    onCreateOrder('name', clientName);
  };
  
  const filteredClients = useMemo(() => {
    const lowercasedFilter = customerName.toLowerCase();
    if (!lowercasedFilter) {
      // Don't show any clients if search is empty to keep UI clean
      return [];
    }
    return clients
      .filter(client => client.name.toLowerCase().includes(lowercasedFilter))
      .slice(0, 5);
  }, [clients, customerName]);

  const handleManualSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (activeTab === 'table' && tableNumber) {
      onCreateOrder('table', parseInt(tableNumber, 10));
    } else if (activeTab === 'name' && customerName) {
      // This handles creating a new customer or one that was typed manually
      onCreateOrder('name', customerName.toUpperCase(), phone);
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir Nova Comanda</DialogTitle>
          <DialogDescription>
            Escolha abrir por mesa ou por nome do cliente.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'table' | 'name')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="table">Por Mesa</TabsTrigger>
            <TabsTrigger value="name">Por Nome</TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="pt-4">
            <form onSubmit={handleManualSubmit}>
                <div className="space-y-2">
                    <Label htmlFor="table-number">Número da Mesa</Label>
                    <Input
                        id="table-number"
                        type="number"
                        placeholder="Ex: 5"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        autoFocus
                    />
                </div>
                <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!tableNumber}>Criar Comanda</Button>
                </DialogFooter>
            </form>
        </TabsContent>
        <TabsContent value="name" className="pt-4">
            <Command shouldFilter={false} className="overflow-visible">
                <div className="space-y-2">
                    <Label htmlFor="customer-name">Nome do Cliente</Label>
                    <CommandInput
                        id="customer-name" 
                        placeholder="Buscar ou criar cliente..."
                        onValueChange={setCustomerName}
                        value={customerName}
                        autoFocus
                    />
                </div>
                <CommandList className="mt-2 max-h-[180px] overflow-y-auto border rounded-md">
                    <CommandEmpty>
                      {customerName && isNewCustomer ? 'Nenhum cliente encontrado. Continue para criar um novo.' : 'Nenhum cliente encontrado.'}
                    </CommandEmpty>
                    <CommandGroup>
                    {filteredClients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.name}
                          onSelect={() => handleSelectClient(client.name)}
                          className="cursor-pointer"
                        >
                          <Check
                              className={cn(
                              "mr-2 h-4 w-4",
                              customerName.toUpperCase() === client.name.toUpperCase() ? "opacity-100" : "opacity-0"
                              )}
                          />
                          <div>
                              <p>{client.name}</p>
                              <p className="text-xs text-muted-foreground">{client.phone}</p>
                          </div>
                        </CommandItem>
                    ))}
                    </CommandGroup>
                </CommandList>
            </Command>

            <form onSubmit={handleManualSubmit}>
                {isNewCustomer && customerName && (
                    <div className="space-y-2 animate-in fade-in-0 duration-300 mt-4">
                        <Label htmlFor="phone">Telefone (Novo Cliente)</Label>
                        <Input
                            id="phone"
                            placeholder="Telefone para contato (opcional)"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                )}
                <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!customerName}>
                      {isNewCustomer ? 'Criar Cliente e Abrir' : 'Abrir Comanda'}
                    </Button>
                </DialogFooter>
            </form>
        </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
