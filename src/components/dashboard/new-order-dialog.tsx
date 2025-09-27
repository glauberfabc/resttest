"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
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
  onCreateOrder: (type: 'table' | 'name', identifier: string | number) => void;
  clients: Client[];
}

export function NewOrderDialog({ isOpen, onOpenChange, onCreateOrder, clients }: NewOrderDialogProps) {
  const [activeTab, setActiveTab] = useState<'table' | 'name'>('table');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  // State for Combobox
  const [open, setOpen] = useState(false)


  const handleSubmit = () => {
    if (activeTab === 'table' && tableNumber) {
      onCreateOrder('table', parseInt(tableNumber, 10));
    } else if (activeTab === 'name' && customerName) {
      onCreateOrder('name', customerName);
    }
  };

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
            <div className="space-y-2">
              <Label htmlFor="table-number">Número da Mesa</Label>
              <Input
                id="table-number"
                type="number"
                placeholder="Ex: 5"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
              />
            </div>
          </TabsContent>
          <TabsContent value="name" className="pt-4">
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
                    {customerName || "Selecione ou digite um nome..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar cliente por nome ou telefone..."
                      onValueChange={(search) => setCustomerName(search)}
                    />
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={`${client.name} ${client.phone}`}
                          onSelect={(currentValue) => {
                            const selectedClient = clients.find(c => `${c.name} ${c.phone}`.toLowerCase() === currentValue.toLowerCase());
                            setCustomerName(selectedClient ? selectedClient.name : currentValue)
                            setOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              customerName === client.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <p>{client.name}</p>
                            <p className="text-xs text-muted-foreground">{client.phone}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar Comanda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
