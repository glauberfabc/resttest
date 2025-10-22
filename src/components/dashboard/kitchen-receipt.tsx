
import type { OrderItem } from "@/lib/types";
import { formatInTimeZone } from 'date-fns-tz';

interface KitchenReceiptProps {
  identifier: string | number;
  type: 'table' | 'name';
  itemsToPrint: OrderItem[];
}

export function KitchenReceipt({ identifier, type, itemsToPrint }: KitchenReceiptProps) {
  const timeZone = 'America/Sao_Paulo'; // GMT-3
  const receiptDate = new Date();
  const formattedTime = formatInTimeZone(receiptDate, timeZone, 'HH:mm');
  const line = "----------------------------------------";

  if (itemsToPrint.length === 0) {
    return null; // Don't render anything if there's nothing new to print
  }

  const identifierText = typeof identifier === 'string' ? identifier.toUpperCase() : identifier;

  return (
    <div className="kitchen-receipt uppercase">
        <div className="text-center space-y-1">
            <h2 className="text-lg font-bold">
                {type === 'table' ? `Mesa ${identifierText}` : identifierText}
            </h2>
            <p className="text-sm">Pedido às {formattedTime}</p>
        </div>
        
        <p className="break-words my-2">{line}</p>
        
        <div className="space-y-1 my-1">
            {itemsToPrint.map(({ menuItem, quantity, comment }, index) => (
                <div key={`${menuItem.id}-${index}`} className="text-base font-bold">
                    <div className="flex justify-between">
                        <span className="pr-2">{quantity}x</span>
                        <span className="text-right">{menuItem.name}</span>
                    </div>
                    {comment && (
                        <p className="text-sm pl-6 font-semibold">
                            Obs: {comment}
                        </p>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
}
