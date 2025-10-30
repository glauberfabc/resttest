
"use client";

import type { Order } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Table2, Trash2 } from "lucide-react";
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useMemo } from "react";


interface OrderCardProps {
  order: Order;
  onSelectOrder: (order: Order) => void;
  onDeleteOrder: (orderId: string) => void;
}

export function OrderCard({ order, onSelectOrder, onDeleteOrder }: OrderCardProps) {
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Impede que o onSelectOrder seja chamado
    onDeleteOrder(order.id);
  };

  const displayAmount = isPaid ? total : remainingAmount;

  const {displayIdentifier, displayObservation} = useMemo(() => {
    if (order.type === 'table') {
        return { displayIdentifier: order.identifier, displayObservation: order.customer_name };
    }
    // For 'name' type
    const match = order.customer_name?.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
        return { displayIdentifier: match[1], displayObservation: match[2] };
    }
    return { displayIdentifier: order.identifier, displayObservation: null };
}, [order.customer_name, order.identifier, order.type]);

  const cardTitle = order.type === 'table' && displayObservation
    ? `${order.identifier} - ${displayObservation}`
    : displayIdentifier;


  return (
    <Card 
        className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200 flex flex-col group"
        onClick={() => onSelectOrder(order)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {order.type === 'table' ? <Table2 className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-muted-foreground" />}
          <span className="break-all">{cardTitle}</span>
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
        {displayObservation && order.type === 'name' && (
            <div className="text-xs italic text-muted-foreground mt-1 truncate">
                Obs: {displayObservation}
            </div>
        )}
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
      <CardFooter className="relative mt-auto">
        <div className="flex flex-col w-full">
            {(isPartiallyPaid || order.status === 'open' || order.status === 'paying') && !isPaid && <p className="text-xs text-muted-foreground">Restante</p>}
            {isPaid && <p className="text-xs text-muted-foreground">Total Pago</p>}
            <div className="text-2xl font-bold">
              R$ {displayAmount.toFixed(2).replace('.', ',')}
            </div>
        </div>
         {isPaid && (
            <AlertDialog>
                <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                     <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 bottom-2 h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação removerá o comprovante da lista. Isso não pode ser desfeito.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteClick}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}

    