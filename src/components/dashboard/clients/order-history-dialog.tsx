import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { Client, Order } from "@/lib/types";

interface OrderHistoryDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    client: Client;
}

export function OrderHistoryDialog({ isOpen, onOpenChange, client }: OrderHistoryDialogProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (isOpen && client) {
            fetchHistory();
        }
    }, [isOpen, client]);

    const fetchHistory = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                items:order_items (
                    id,
                    quantity,
                    menu_item:menu_items (
                        name,
                        price
                    )
                ),
                payments:order_payments (
                    amount,
                    method
                )
            `)
            .eq('type', 'name')
            .ilike('identifier', client.name) // Use ilike for case-insensitive match
            .eq('status', 'paid')
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Cast properly or map to ensure types match if needed, for now trusting the structure
            // We need to map dates because Supabase returns strings
            const formattedOrders = data.map((order: any) => ({
                ...order,
                created_at: new Date(order.created_at),
                paid_at: order.paid_at ? new Date(order.paid_at) : undefined,
                items: order.items.map((item: any) => ({
                    ...item,
                    menuItem: item.menu_item
                }))
            })) as Order[];
            setOrders(formattedOrders);
        }
        setIsLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Histórico de Comandas - {client.name}</DialogTitle>
                    <DialogDescription>
                        Visualizando comandas já pagas/finalizadas.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhuma comanda antiga encontrada.
                    </div>
                ) : (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Itens</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Pagamento</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => {
                                    const total = order.items.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);

                                    return (
                                        <TableRow key={order.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {format(order.created_at!, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 text-sm">
                                                    {order.items.slice(0, 3).map((item, idx) => (
                                                        <span key={idx}>{item.quantity}x {item.menuItem.name}</span>
                                                    ))}
                                                    {order.items.length > 3 && (
                                                        <span className="text-muted-foreground text-xs">+{order.items.length - 3} itens...</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold">
                                                R$ {total.toFixed(2).replace('.', ',')}
                                            </TableCell>
                                            <TableCell>
                                                {/* Show Paid Time if available */}
                                                {order.paid_at && (
                                                    <span className="text-xs text-muted-foreground block">
                                                        Pago em {format(order.paid_at, "dd/MM HH:mm", { locale: ptBR })}
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
