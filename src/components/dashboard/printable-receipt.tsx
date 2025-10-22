
import type { Order, Payment, OrderItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from 'date-fns-tz';


interface PrintableReceiptProps {
  order: Order;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  className?: string;
}

export function PrintableReceipt({ order, total, paidAmount, remainingAmount, className }: PrintableReceiptProps) {
  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const timeZone = 'America/Sao_Paulo'; // GMT-3

  const receiptDate = order.paid_at ? new Date(order.paid_at) : new Date();
  const formattedDate = formatInTimeZone(receiptDate, timeZone, 'dd/MM/yyyy');
  const formattedTime = formatInTimeZone(receiptDate, timeZone, 'HH:mm');

  const paymentMethods = order.payments?.map(p => p.method).join(', ') || 'Pendente';

  const line = "----------------------------------------";

  const groupedItems = Array.from(order.items.reduce((map, item) => {
    const key = `${item.menuItem.id}-${item.comment || ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
    return map;
  }, new Map<string, OrderItem>()).values());

  return (
    <div className={cn("printable-receipt hidden", className)}>
        <div className="text-center space-y-1">
            <h2 className="uppercase">Cupom Fiscal</h2>
            <p>Snooker Bar</p>
        </div>
        
        <div className="my-2">
            <p>Comanda: {order.type === 'table' ? `Mesa ${order.identifier}` : order.identifier}</p>
            <p>Data: {formattedDate} Hora: {formattedTime}</p>
        </div>
        
        <p className="break-words">{line}</p>
        <div className="flex justify-between">
            <span>QTD | ITEM</span>
            <span className="text-right">VALOR</span>
        </div>
        <p className="break-words">{line}</p>
        
        <div className="space-y-1 my-1">
            {groupedItems.map(({ menuItem, quantity, comment }, index) => (
                <div key={`${menuItem.id}-${index}`}>
                    <div className="flex justify-between">
                        <span className="pr-2 truncate">{quantity}x {menuItem.name}</span>
                        <span className="text-right flex-shrink-0">{formatCurrency(menuItem.price * quantity)}</span>
                    </div>
                     {comment && (
                        <p className="pl-2">
                            - {comment}
                        </p>
                    )}
                </div>
            ))}
        </div>

        <p className="break-words">{line}</p>
        
        <div className="space-y-1">
            <div className="flex justify-between text-base">
                <span>TOTAL</span>
                <span>{formatCurrency(total)}</span>
            </div>

            {paidAmount > 0.001 && (
              <>
                {(order.payments as Payment[]).map((p) => (
                    <div className="flex justify-between" key={p.id}>
                        <span>Pago ({p.method})</span>
                        <span>- {formatCurrency(p.amount)}</span>
                    </div>
                ))}
                {remainingAmount > 0.001 && (
                    <div className="flex justify-between">
                        <span>Restante</span>
                        <span>{formatCurrency(remainingAmount)}</span>
                    </div>
                )}
              </>
            )}

            <div className="flex justify-between">
                <span>Forma de Pagamento:</span>
                <span className="text-right">{paymentMethods}</span>
            </div>
        </div>
    </div>
  );
}
