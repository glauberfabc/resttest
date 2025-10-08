
"use client";

import { useState } from "react";
import type { Client } from "@/lib/types";
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
}

const paymentMethods = [
    { name: "Débito", icon: CreditCard },
    { name: "Crédito", icon: CreditCard },
    { name: "PIX", icon: QrCode },
    { name: "Dinheiro", icon: CircleDollarSign },
]

export function AddCreditDialog({ isOpen, onOpenChange, onSave, client }: AddCreditDialogProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast({ variant: 'destructive', title: "Valor inválido", description: "Insira um valor positivo." });
      return;
    }
    if (!method) {
      toast({ variant: 'destructive', title: "Método de pagamento", description: "Selecione a forma de pagamento." });
      return;
    }
    onSave(client.id, numericAmount, method);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Crédito</DialogTitle>
          <DialogDescription>
            Adicionar saldo para o cliente: <span className="font-semibold">{client.name}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Valor (R$)</Label>
                <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="col-span-3"
                    required
                    autoFocus
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="method" className="text-right">Forma de Pag.</Label>
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
                <Button type="submit">Adicionar Crédito</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
