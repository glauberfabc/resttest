
import type { Order } from "@/lib/types";
import { formatInTimeZone } from 'date-fns-tz';

interface KitchenReceiptProps {
  order: Order;
}

export function KitchenReceipt({ order }: KitchenReceiptProps) {
  const timeZone = 'America/Sao_Paulo'; // GMT-3
  const receiptDate = new Date();
  const formattedTime = formatInTimeZone(receiptDate, timeZone, 'HH:mm');
  const line = "----------------------------------------";

  return (
    <div className="kitchen-receipt">
        <div className="text-center space-y-1">
            <h2 className="text-lg font-bold uppercase">
                {order.type === 'table' ? `Mesa ${order.identifier}` : order.identifier}
            </h2>
            <p className="text-xs">Pedido às {formattedTime}</p>
        </div>
        
        <p className="break-words my-2">{line}</p>
        
        <div className="space-y-1 my-1 text-sm">
            {order.items.map(({ menuItem, quantity }) => (
                <div key={menuItem.id} className="flex justify-between text-base">
                    <span className="font-bold pr-2">{quantity}x</span>
                    <span>{menuItem.name}</span>
                </div>
            ))}
        </div>
    </div>
  );
}

    