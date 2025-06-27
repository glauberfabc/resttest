"use client";

import type { Order } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Table2 } from "lucide-react";

interface OrderCardProps {
  order: Order;
  onSelectOrder: (order: Order) => void;
}

export function OrderCard({ order, onSelectOrder }: OrderCardProps) {
  const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const remainingAmount = total - paidAmount;
  const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);
  const isPartiallyPaid = paidAmount > 0 && remainingAmount > 0.01;
  const isPaid = order.status === 'paid';

  return (
    <Card 
        className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200 flex flex-col"
        onClick={() => onSelectOrder(order)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {order.type === 'table' ? <Table2 className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-muted-foreground" />}
          <span className="truncate">{order.identifier}</span>
        </CardTitle>
        <div className="flex flex-col items-end gap-1">
            {isPaid && <Badge variant="secondary">Pago</Badge>}
            {order.status === 'paying' && <Badge variant="destructive">Pagando</Badge>}
            {isPartiallyPaid && <Badge variant="outline">Parcial</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pb-2 flex-1">
        <div className="text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </div>
        {isPartiallyPaid && (
             <div className="text-xs text-muted-foreground mt-1">
                Pago R$ {paidAmount.toFixed(2).replace('.', ',')} de R$ {total.toFixed(2).replace('.', ',')}
            </div>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex flex-col w-full">
            {(isPartiallyPaid) && <p className="text-xs text-muted-foreground">Restante</p>}
            {isPaid && <p className="text-xs text-muted-foreground">Total Pago</p>}
            <div className="text-2xl font-bold">
              R$ {(isPaid ? total : remainingAmount).toFixed(2).replace('.', ',')}
            </div>
        </div>
      </CardFooter>
    </Card>
  );
}
