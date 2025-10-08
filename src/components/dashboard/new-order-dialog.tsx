
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react"

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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

  const [open, setOpen] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const isNewCustomer = useMemo(() => {
    if (!customerName) return false;
    return !clients.some(client => client.name.toUpperCase() === customerName.toUpperCase());
  }, [customerName, clients]);
  
  useEffect(() => {
    if (!isOpen) {
        setTimeout(() => {
            setTableNumber('');
            setCustomerName('');
            setPhone('');
            setActiveTab('table');
        }, 200);
    }
  }, [isOpen]);
  
  const handleNameChange = (search: string) => {
    setCustomerName(search.toUpperCase());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'table' && tableNumber) {
      onCreateOrder('table', parseInt(tableNumber, 10));
    } else if (activeTab === 'name' && customerName) {
      onCreateOrder('name', customerName, phone);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Find if the current typed name is an existing client
      const existingClient = clients.find(c => c.name.toUpperCase() === customerName.toUpperCase());
      if (existingClient) {
          onCreateOrder('name', existingClient.name);
          setOpen(false);
          onOpenChange(false);
      } else if (isNewCustomer && customerName) {
        setOpen(false);
        setTimeout(() => phoneInputRef.current?.focus(), 50);
      } else {
        handleSubmit(e as any);
      }
    }
  };
  
  const filteredClients = useMemo(() => {
    if (!customerName) {
      return clients.slice(0, 5);
    }
    const lowercasedFilter = customerName.toLowerCase();
    return clients
      .filter(client => client.name.toLowerCase().includes(lowercasedFilter))
      .slice(0, 5);
  }, [clients, customerName]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir Nova Comanda</DialogTitle>
          <DialogDescription>
            Escolha abrir por mesa ou por nome do cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'table' | 'name')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table">Por Mesa</TabsTrigger>
                <TabsTrigger value="name">Por Nome</TabsTrigger>
            </TabsList>
            <TabsContent value="table" className="pt-4">
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
            </TabsContent>
            <TabsContent value="name" className="pt-4">
                <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="customer-name">Nome do Cliente</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal"
                        >
                        <span className="truncate">{customerName || "Selecione ou digite um nome..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                        <CommandInput 
                            placeholder="Buscar cliente..."
                            onValueChange={handleNameChange}
                            value={customerName}
                            onKeyDown={handleKeyDown}
                        />
                        <CommandEmpty>Nenhum cliente encontrado. Crie um novo.</CommandEmpty>
                        <CommandList>
                            <CommandGroup>
                            {filteredClients.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.name}
                                  onSelect={() => {
                                    onCreateOrder('name', client.name);
                                    setOpen(false);
                                    onOpenChange(false);
                                  }}
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
                    </PopoverContent>
                    </Popover>
                </div>

                {isNewCustomer && customerName && (
                    <div className="space-y-2 animate-in fade-in-0 duration-300">
                    <Label htmlFor="phone">Telefone (Novo Cliente)</Label>
                    <Input
                        ref={phoneInputRef}
                        id="phone"
                        placeholder="Telefone para contato (opcional)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                    </div>
                )}
                </div>
            </TabsContent>
            </Tabs>
            <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={(activeTab === 'table' && !tableNumber) || (activeTab === 'name' && !customerName)}>Criar Comanda</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
