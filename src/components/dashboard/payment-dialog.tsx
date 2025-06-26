"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CreditCard, Landmark, CircleDollarSign, QrCode } from "lucide-react";
import type { Order } from "@/lib/types";

interface PaymentDialogProps {
  order: Order;
  total: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirmPayment: () => void;
}

export function PaymentDialog({ order, total, isOpen, onOpenChange, onConfirmPayment }: PaymentDialogProps) {

    const paymentMethods = [
        { name: "Débito", icon: CreditCard },
        { name: "Crédito", icon: CreditCard },
        { name: "PIX", icon: QrCode },
        { name: "Dinheiro", icon: CircleDollarSign },
    ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Pagamento</DialogTitle>
          <DialogDescription>
            Comanda {order.type === 'table' ? 'Mesa' : ''} {order.identifier}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-2 py-8">
            <p className="text-muted-foreground">Total a pagar</p>
            <p className="text-5xl font-bold tracking-tighter">R$ {total.toFixed(2).replace('.', ',')}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
            {paymentMethods.map(method => (
                <Button key={method.name} variant="outline" className="h-20 flex-col gap-2" onClick={onConfirmPayment}>
                    <method.icon className="h-6 w-6"/>
                    <span>{method.name}</span>
                </Button>
            ))}
        </div>
        
        <DialogFooter className="mt-4">
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Voltar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
