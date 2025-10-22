
"use client";

import { useState, useMemo, useEffect } from "react";
import { Check, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button";
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
import type { Client, User } from "@/lib/types";

interface NewOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCreateOrder: (type: 'table' | 'name', identifier: string | number, phone?: string) => void;
  clients: Client[];
  user: User;
}

export function NewOrderDialog({ isOpen, onOpenChange, onCreateOrder, clients }: NewOrderDialogProps) {
  const [activeTab, setActiveTab] = useState<'table' | 'name'>('table');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  useEffect(() => {
    if (!isOpen) {
        // Reset state when dialog closes
        setTimeout(() => {
            setTableNumber('');
            setCustomerName('');
            setPhone('');
            setActiveTab('table');
            setShowResults(false);
            setSelectedClient(null);
        }, 200);
    }
  }, [isOpen]);

  const handleSelectClient = (client: Client) => {
    setCustomerName(client.name.toUpperCase());
    setPhone(client.phone || '');
    setSelectedClient(client);
    setShowResults(false);
  };
  
  const filteredClients = useMemo(() => {
    const lowercasedFilter = customerName.toLowerCase().trim();
    if (!lowercasedFilter) {
      return [];
    }
    return clients
      .filter(client => 
        client.name.toLowerCase().includes(lowercasedFilter) ||
        (client.phone && client.phone.replace(/\D/g, '').includes(lowercasedFilter.replace(/\D/g, '')))
      )
      .slice(0, 5);
  }, [clients, customerName]);


  const handleTableSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (tableNumber) {
      onCreateOrder('table', parseInt(tableNumber, 10));
    }
  }

  const handleNameOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerName) {
        const identifier = selectedClient ? selectedClient.name.toUpperCase() : customerName.toUpperCase();
        onCreateOrder('name', identifier, phone);
    }
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerName(value);
    setSelectedClient(null); // Clear selected client when typing
    if (value.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }

  const isNewCustomer = useMemo(() => {
    if (!customerName) return false;
    return !clients.some(client => client.name.toUpperCase() === customerName.toUpperCase());
  }, [customerName, clients]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          // Prevent closing the dialog when clicking inside the results list
          if (target.closest('[data-results-list]')) {
            e.preventDefault();
          }
        }}
      >
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
            <form onSubmit={handleTableSubmit}>
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
             <form onSubmit={handleNameOrderSubmit}>
                <div className="space-y-2">
                    <Label htmlFor="customer-name">Nome do Cliente</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="customer-name" 
                          placeholder="Buscar cliente ou digitar novo nome..."
                          onChange={handleInputChange}
                          value={customerName}
                          autoFocus
                          className="pl-10"
                          onBlur={() => setTimeout(() => setShowResults(false), 150)}
                          onFocus={() => customerName && setShowResults(true)}
                      />
                    </div>
                </div>

                {showResults && filteredClients.length > 0 && (
                  <div data-results-list className="relative">
                    <div className="absolute top-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                        {filteredClients.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="flex items-center p-2 hover:bg-accent cursor-pointer text-sm"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-xs text-muted-foreground">{client.phone}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {customerName && isNewCustomer && !selectedClient && (
                    <>
                        <div className="space-y-2 animate-in fade-in-0 duration-300 mt-4">
                            <Label htmlFor="phone">Telefone (Novo Cliente)</Label>
                            <Input
                                id="phone"
                                placeholder="Telefone para contato (opcional)"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </>
                )}

                <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!customerName}>
                        {isNewCustomer && !selectedClient ? 'Criar Cliente e Abrir' : 'Abrir Comanda'}
                    </Button>
                </DialogFooter>
                 
            </form>
        </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
