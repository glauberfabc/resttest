"use client";

import { useState } from "react";
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

interface NewOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCreateOrder: (type: 'table' | 'name', identifier: string | number) => void;
}

export function NewOrderDialog({ isOpen, onOpenChange, onCreateOrder }: NewOrderDialogProps) {
  const [activeTab, setActiveTab] = useState<'table' | 'name'>('table');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

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
              <Input
                id="customer-name"
                placeholder="Ex: João Silva"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
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
