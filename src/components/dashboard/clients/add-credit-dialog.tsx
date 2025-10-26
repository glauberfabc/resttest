
"use client";

import { useState } from "react";
import type { Client, User } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, QrCode, CircleDollarSign } from "lucide-react";


interface AddCreditDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (clientId: string, amount: number, method: string) => void;
  client: Client;
  user: User;
}

const paymentMethods = [
    { name: "Débito", icon: CreditCard },
    { name: "Crédito", icon: CreditCard },
    { name: "PIX", icon: QrCode },
    { name: "Dinheiro", icon: CircleDollarSign },
    { name: "Ajuste", icon: CircleDollarSign },
]

export function AddCreditDialog({ isOpen, onOpenChange, onSave, client }: AddCreditDialogProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedAmount = amount.replace(',', '.');
    const numericAmount = parseFloat(formattedAmount);

    if (isNaN(numericAmount) || numericAmount === 0) {
      toast({ variant: 'destructive', title: "Valor inválido", description: "Insira um valor diferente de zero." });
      return;
    }
    if (!method) {
      toast({ variant: 'destructive', title: "Método de pagamento", description: "Selecione a forma de pagamento/ajuste." });
      return;
    }
    onSave(client.id, numericAmount, method);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Crédito / Débito</DialogTitle>
          <DialogDescription>
            Adicionar saldo (positivo) ou dívida (negativo) para: <span className="font-semibold">{client.name}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Valor (R$)</Label>
                <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="col-span-3"
                    required
                    autoFocus
                    placeholder="Use - para valor negativo"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="method" className="text-right">Forma</Label>
                <Select value={method} onValueChange={setMethod} required>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                        {paymentMethods.map(pm => (
                             <SelectItem key={pm.name} value={pm.name}>{pm.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit">Adicionar Saldo</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
