
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CreditCard, Landmark, CircleDollarSign, QrCode, WalletCards } from "lucide-react";
import type { Client, ClientCredit, Order } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";


interface PaymentDialogProps {
  order: Order;
  total: number; // This 'total' now represents the full amount to be paid (current + previous debt)
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirmPayment: (amount: number, method: string) => void;
  clients: Client[];
  credits: ClientCredit[];
}

export function PaymentDialog({ order, total: totalAmountDue, isOpen, onOpenChange, onConfirmPayment, clients, credits }: PaymentDialogProps) {
    const { toast } = useToast();
    
    // Note: 'totalAmountDue' is the remaining amount passed as a prop, including any previous debt.
    const [paymentAmount, setPaymentAmount] = useState(totalAmountDue.toFixed(2));

    useEffect(() => {
        setPaymentAmount(totalAmountDue.toFixed(2));
    }, [totalAmountDue]);

    const clientBalance = useMemo(() => {
        if (order.type !== 'name') return 0;
        const client = clients.find(c => c.name.toUpperCase() === (order.identifier as string).toUpperCase());
        if (!client) return 0;

        return credits
            .filter(c => c.client_id === client.id)
            .reduce((sum, c) => sum + c.amount, 0);
    }, [order, clients, credits]);

    const handlePayment = (method: string) => {
        const amount = parseFloat(paymentAmount.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            toast({ variant: 'destructive', title: "Valor inválido", description: "Por favor, insira um valor de pagamento positivo." });
            return;
        }
        if (amount > totalAmountDue + 0.001) { // Tolerance for float issues
             toast({ variant: 'destructive', title: "Valor muito alto", description: "O valor a pagar não pode ser maior que o saldo devedor." });
            return;
        }
        onConfirmPayment(amount, method);
        onOpenChange(false);
    };


    const paymentMethods = [
        { name: "Débito", icon: CreditCard },
        { name: "Crédito", icon: CreditCard },
        { name: "PIX", icon: QrCode },
        { name: "Dinheiro", icon: CircleDollarSign },
    ]

    // Only show "Pagar com Saldo" if it's a client order and they have a positive balance
    if (order.type === 'name' && clientBalance > 0.001) {
        paymentMethods.push({ name: "Saldo Cliente", icon: WalletCards });
    }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Pagamento</DialogTitle>
          <DialogDescription>
            Comanda {order.type === 'table' ? 'Mesa' : ''} {order.identifier}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center space-y-2">
                <p className="text-muted-foreground">Valor a pagar</p>
                <p className="text-5xl font-bold tracking-tighter">R$ {totalAmountDue.toFixed(2).replace('.', ',')}</p>
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="payment-amount">Valor do Pagamento</Label>
                <div className="flex gap-2">
                    <Input
                        id="payment-amount"
                        type="text"
                        inputMode="decimal"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0,00"
                    />
                    <Button variant="secondary" onClick={() => setPaymentAmount(totalAmountDue.toFixed(2))}>Total</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
                {paymentMethods.map(method => (
                    <Button key={method.name} variant="outline" className="h-20 flex-col gap-2" onClick={() => handlePayment(method.name)}>
                        <method.icon className="h-6 w-6"/>
                        <span>{method.name}</span>
                    </Button>
                ))}
            </div>
        </div>
        
        <DialogFooter className="mt-4">
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Voltar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
