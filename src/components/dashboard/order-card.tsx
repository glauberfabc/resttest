
"use client";

import type { Order } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Table2 } from "lucide-react";
import { formatInTimeZone } from 'date-fns-tz';


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
  const paymentMethods = order.payments?.map(p => p.method).filter((v, i, a) => a.indexOf(v) === i).join(', ');

  const getFormattedPaidAt = () => {
    const paidAt = order.paidAt || order.paid_at;
    if (!paidAt) return '';
    try {
        const paidDate = new Date(paidAt);
        const timeZone = 'America/Sao_Paulo'; // GMT-3
        const date = formatInTimeZone(paidDate, timeZone, 'dd/MM/yy');
        const time = formatInTimeZone(paidDate, timeZone, 'HH:mm');
        return `${date} às ${time}`;
    } catch (error) {
        console.error("Error formatting date:", error);
        return 'Data inválida';
    }
  };

  const displayAmount = isPaid ? total : remainingAmount;

  return (
    <Card 
        className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200 flex flex-col"
        onClick={() => onSelectOrder(order)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {order.type === 'table' ? <Table2 className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-muted-foreground" />}
          <span className="break-words">{order.identifier}</span>
        </CardTitle>
        <div className="flex flex-col items-end gap-1 text-right">
            {isPaid && <Badge variant="secondary">Pago</Badge>}
            {order.status === 'paying' && <Badge variant="destructive">Pagando</Badge>}
            {isPartiallyPaid && <Badge variant="outline">Parcial</Badge>}
            {isPaid && paymentMethods && (
                <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={paymentMethods}>{paymentMethods}</span>
            )}
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </div>
        {isPartiallyPaid && (
             <div className="text-xs text-muted-foreground mt-1">
                Pago R$ {paidAmount.toFixed(2).replace('.', ',')} de R$ {total.toFixed(2).replace('.', ',')}
            </div>
        )}
        {isPaid && (order.paidAt || order.paid_at) && (
             <div className="text-xs text-muted-foreground mt-1">
                {getFormattedPaidAt()}
            </div>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex flex-col w-full">
            {(isPartiallyPaid || order.status === 'open' || order.status === 'paying') && !isPaid && <p className="text-xs text-muted-foreground">Restante</p>}
            {isPaid && <p className="text-xs text-muted-foreground">Total Pago</p>}
            <div className="text-2xl font-bold">
              R$ {displayAmount.toFixed(2).replace('.', ',')}
            </div>
        </div>
      </CardFooter>
    </Card>
  );
}
