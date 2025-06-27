
import type { Order } from "@/lib/types";

interface PrintableReceiptProps {
  order: Order;
  total: number;
  paidAmount: number;
  remainingAmount: number;
}

export function PrintableReceipt({ order, total, paidAmount, remainingAmount }: PrintableReceiptProps) {
  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const now = new Date();
  const formattedDate = now.toLocaleDateString('pt-BR');
  const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const paymentMethods = order.payments?.map(p => p.method).join(', ') || 'Pendente';

  const line = "----------------------------------------";

  return (
    <div className="printable-receipt hidden">
        <div className="text-center space-y-1">
            <h2 className="text-base font-bold uppercase">Cupom Fiscal</h2>
            <p className="font-bold">Lanchonete Bar Sinuca</p>
        </div>
        
        <div className="my-2 text-sm">
            <p>Comanda: {order.type === 'table' ? `Mesa ${order.identifier}` : order.identifier}</p>
            <p>Data: {formattedDate} Hora: {formattedTime}</p>
        </div>
        
        <p className="break-words">{line}</p>
        <div className="flex justify-between font-bold text-sm">
            <span>QTD | ITEM</span>
            <span className="text-right">VALOR</span>
        </div>
        <p className="break-words">{line}</p>
        
        <div className="space-y-1 my-1 text-sm">
            {order.items.map(({ menuItem, quantity }) => (
                <div key={menuItem.id} className="flex justify-between">
                    <span className="pr-2 truncate">{quantity}x {menuItem.name}</span>
                    <span className="text-right flex-shrink-0">{formatCurrency(menuItem.price * quantity)}</span>
                </div>
            ))}
        </div>

        <p className="break-words">{line}</p>
        
        <div className="space-y-1 text-sm">
            <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span>
                <span>{formatCurrency(total)}</span>
            </div>

            {paidAmount > 0.001 && (
              <>
                <div className="flex justify-between">
                    <span>Total Pago</span>
                    <span>{formatCurrency(paidAmount)}</span>
                </div>
                {remainingAmount > 0.001 && (
                    <div className="flex justify-between font-bold">
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
        
        <div className="text-center mt-4 text-sm">
            <p>Obrigado e volte sempre!</p>
        </div>
    </div>
  );
}
