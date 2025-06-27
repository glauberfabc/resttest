
import type { Order } from "@/lib/types";

interface PrintableReceiptProps {
  order: Order;
  total: number;
  paidAmount: number;
  remainingAmount: number;
}

export function PrintableReceipt({ order, total, paidAmount, remainingAmount }: PrintableReceiptProps) {
  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  return (
    <div className="printable-receipt hidden">
        <div className="text-center space-y-1 p-4 border-b border-dashed">
            <h1 className="text-lg font-bold">ComandaZap</h1>
            <p>Rua Fictícia, 123 - Bairro Imaginário</p>
            <p>CNPJ: 00.000.000/0001-00</p>
            <p>{new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        <div className="p-4 border-b border-dashed">
            <h2 className="text-center font-bold mb-2">CUPOM NÃO FISCAL</h2>
            <p className="font-bold">Comanda: {order.type === 'table' ? 'Mesa' : 'Nome'} {order.identifier}</p>
        </div>

        <div className="p-4 print-no-break">
            <table className="w-full text-left">
                <thead>
                    <tr>
                        <th className="w-1/2 pb-1">Item</th>
                        <th className="text-center pb-1">Qtd</th>
                        <th className="text-right pb-1">Unit.</th>
                        <th className="text-right pb-1">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {order.items.map(({ menuItem, quantity }) => (
                        <tr key={menuItem.id}>
                            <td>{menuItem.name}</td>
                            <td className="text-center">{quantity}</td>
                            <td className="text-right">{formatCurrency(menuItem.price)}</td>
                            <td className="text-right">{formatCurrency(menuItem.price * quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        <div className="p-4 border-t border-dashed space-y-2 print-no-break">
             <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
            </div>
            
            {paidAmount > 0 && (
                 <div className="flex justify-between">
                    <span>Pago</span>
                    <span>{formatCurrency(paidAmount)}</span>
                </div>
            )}
           
            <div className="flex justify-between font-bold text-lg">
                <span>{paidAmount > 0 ? 'Restante' : 'Total'}</span>
                <span>{formatCurrency(remainingAmount)}</span>
            </div>

            {order.payments && order.payments.length > 0 && (
                <div className="pt-2">
                    <h3 className="font-bold">Pagamentos:</h3>
                    {order.payments.map((p, index) => (
                        <div key={index} className="flex justify-between">
                            <span>{p.method}</span>
                            <span>{formatCurrency(p.amount)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="text-center p-4 border-t border-dashed">
            <p>Obrigado pela preferência!</p>
        </div>
    </div>
  );
}
