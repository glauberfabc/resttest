
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { Order, MenuItem, OrderItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MenuPicker } from "@/components/dashboard/menu-picker";
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import { PrintableReceipt } from "@/components/dashboard/printable-receipt";
import { KitchenReceipt } from "@/components/dashboard/kitchen-receipt";
import { CommentDialog } from "@/components/dashboard/comment-dialog";
import { Plus, Minus, Trash2, Wallet, Share, PlusCircle, Printer, Bluetooth, BluetoothConnected, BluetoothSearching, MessageSquarePlus } from "lucide-react";
import { formatInTimeZone } from 'date-fns-tz';
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import { useToast } from "@/hooks/use-toast";

interface OrderDetailsSheetProps {
  order: Order;
  menuItems: MenuItem[];
  onOpenChange: (isOpen: boolean) => void;
  onUpdateOrder: (order: Order) => void;
  onProcessPayment: (orderId: string, amount: number, method: string) => void;
}

export function OrderDetailsSheet({ order, menuItems, onOpenChange, onUpdateOrder, onProcessPayment }: OrderDetailsSheetProps) {
  const [isMenuPickerOpen, setIsMenuPickerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedItemForComment, setSelectedItemForComment] = useState<OrderItem | null>(null);
  
  // State to track items already sent to the kitchen printer
  const [printedKitchenItems, setPrintedKitchenItems] = useState<OrderItem[]>([]);
  const [itemsToPrint, setItemsToPrint] = useState<OrderItem[]>([]);
  
  const { toast } = useToast();
  const {
    isConnecting,
    isConnected,
    isSupported,
    connect,
    disconnect,
    print,
  } = useBluetoothPrinter();

  // When the order details are opened, initialize the printed items state
  // to the current state of the order, assuming they were already handled.
  useEffect(() => {
    setPrintedKitchenItems([...order.items]);
  }, [order.id]); // Only runs when a new order is selected

  // Recalculate what needs to be printed every time the order items change
  useEffect(() => {
    const newItemsToPrint: OrderItem[] = [];
    order.items.forEach(currentItem => {
      const printedItem = printedKitchenItems.find(pItem => pItem.menuItem.id === currentItem.menuItem.id && pItem.comment === currentItem.comment);
      
      if (!printedItem) {
        // This is a completely new item or an item with a new comment
        newItemsToPrint.push(currentItem);
      } else if (currentItem.quantity > printedItem.quantity) {
        // The quantity has increased
        newItemsToPrint.push({
          ...currentItem,
          quantity: currentItem.quantity - printedItem.quantity
        });
      }
    });
    setItemsToPrint(newItemsToPrint);
  }, [order.items, printedKitchenItems]);


  const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const remainingAmount = total - paidAmount;
  const isPaid = order.status === 'paid';
  const timeZone = 'America/Sao_Paulo'; // GMT-3

  const updateQuantity = (itemId: string, delta: number, comment?: string) => {
    const updatedItems = order.items.map(item => {
      if (item.menuItem.id === itemId && item.comment === comment) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
      }
      return item;
    }).filter(Boolean) as OrderItem[];
    onUpdateOrder({ ...order, items: updatedItems });
  };

  const addItemToOrder = (menuItem: MenuItem) => {
    const existingItem = order.items.find(item => item.menuItem.id === menuItem.id && !item.comment);
    if (existingItem) {
      updateQuantity(menuItem.id, 1, undefined);
    } else {
      const updatedItems = [...order.items, { menuItem, quantity: 1, comment: '' }];
      onUpdateOrder({ ...order, items: updatedItems });
    }
  };

  const handleOpenCommentDialog = (item: OrderItem) => {
    setSelectedItemForComment(item);
    setIsCommentDialogOpen(true);
  };

  const handleSaveComment = (comment: string) => {
    if (!selectedItemForComment) return;

    const oldItem = selectedItemForComment;
    const itemsWithoutOld = order.items.filter(item => !(item.menuItem.id === oldItem.menuItem.id && item.comment === oldItem.comment));
    
    const newItem = { ...oldItem, comment };

    // Check if an item with the new comment already exists
    const existingItemWithNewComment = itemsWithoutOld.find(item => item.menuItem.id === newItem.menuItem.id && item.comment === newItem.comment);

    if (existingItemWithNewComment) {
        // Merge quantities
        const mergedItems = itemsWithoutOld.map(item => {
            if (item.menuItem.id === existingItemWithNewComment.menuItem.id && item.comment === existingItemWithNewComment.comment) {
                return { ...item, quantity: item.quantity + oldItem.quantity };
            }
            return item;
        });
        onUpdateOrder({ ...order, items: mergedItems });
    } else {
        // Just add the item with the new comment
        onUpdateOrder({ ...order, items: [...itemsWithoutOld, newItem] });
    }

    setIsCommentDialogOpen(false);
    setSelectedItemForComment(null);
  };
  
  const handleWhatsAppShare = () => {
    const header = `*Comanda ${order.type === 'table' ? 'Mesa' : ''} ${order.identifier}*\n\n`;
    const itemsText = order.items.map(item => 
      `${item.quantity}x ${item.menuItem.name} - R$ ${(item.menuItem.price * item.quantity).toFixed(2).replace('.', ',')}` +
      (item.comment ? `\n  - ${item.comment}` : '')
    ).join('\n');
    const totalText = `\n\n*Total: R$ ${total.toFixed(2).replace('.', ',')}*`;
    const paidText = paidAmount > 0 ? `\n*Pago: R$ ${paidAmount.toFixed(2).replace('.', ',')}*` : '';
    const remainingText = paidAmount > 0 && !isPaid ? `\n*Restante: R$ ${remainingAmount.toFixed(2).replace('.', ',')}*` : '';
    
    const message = encodeURIComponent(header + itemsText + totalText + paidText + remainingText);
    window.open(`https://wa.me/?text=${message}`);
  };

  const handlePayment = (amount: number, method: string) => {
    onProcessPayment(order.id, amount, method);
  };
  
  const handleKitchenPrint = () => {
    if (itemsToPrint.length === 0) {
      toast({ title: 'Nada para imprimir', description: 'Nenhum item novo foi adicionado à comanda.' });
      return;
    }
    // This will trigger the print-area to re-render with only the new items
    window.print();
    // After printing, update the baseline of printed items to the current state
    setPrintedKitchenItems([...order.items]);
  };
  
  const handleBluetoothPrint = () => {
     if (itemsToPrint.length === 0) {
      toast({ title: 'Nada para imprimir', description: 'Nenhum item novo foi adicionado à comanda.' });
      return;
    }

    const receiptDate = new Date();
    const formattedTime = formatInTimeZone(receiptDate, timeZone, 'HH:mm');
    const line = "--------------------------------\n";

    let text = `Comanda: ${order.type === 'table' ? `Mesa ${order.identifier}` : order.identifier}\n`;
    text += `Pedido as: ${formattedTime}\n`;
    text += line;
    itemsToPrint.forEach(item => {
        text += `${item.quantity}x ${item.menuItem.name}\n`;
        if (item.comment) {
            text += `  Obs: ${item.comment}\n`;
        }
    });
    text += line;

    print(text);
    // After sending to printer, update the baseline
    setPrintedKitchenItems([...order.items]);
  };

  const getFormattedPaidAt = () => {
    const paidAt = order.paidAt || order.paid_at;
    if (!paidAt) return '';
    try {
        const paidDate = new Date(paidAt);
        const date = formatInTimeZone(paidDate, timeZone, 'dd/MM/yyyy');
        const time = formatInTimeZone(paidDate, timeZone, 'HH:mm');
        return `Pago em ${date} às ${time}`;
    } catch (error) {
        console.error("Error formatting date:", error);
        return 'Pago em data inválida';
    }
  };

  const PrinterStatusIcon = () => {
    if (isConnecting) return <BluetoothSearching className="h-4 w-4" />;
    if (isConnected) return <BluetoothConnected className="h-4 w-4" />;
    return <Bluetooth className="h-4 w-4" />;
  };

  return (
    <>
      <Sheet open={true} onOpenChange={onOpenChange}>
        <SheetContent className={`sm:max-w-${isPaid ? 'md' : 'lg'} w-full flex flex-col`}>
          <SheetHeader>
            <SheetTitle className="text-2xl">
              {isPaid ? 'Comprovante' : 'Comanda'}: {order.type === 'table' ? 'Mesa' : ''} {order.identifier}
            </SheetTitle>
            <SheetDescription>
              {isPaid ? getFormattedPaidAt() : 'Visualize, adicione ou remova itens da comanda.'}
            </SheetDescription>
          </SheetHeader>
          
          {isPaid ? (
            <>
                <div className="flex-1 my-4 p-4 border rounded-md bg-white text-black overflow-y-auto font-mono">
                    <PrintableReceipt order={order} total={total} paidAmount={paidAmount} remainingAmount={remainingAmount} className="!block !relative !w-full !p-0 !text-black !bg-white !shadow-none !border-none !text-sm" />
                </div>
                <SheetFooter className="mt-auto">
                    <Button variant="outline" className="w-full" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Comprovante
                    </Button>
                </SheetFooter>
            </>
          ) : (
            <>
              <Separator />
              <ScrollArea className="flex-1">
                {order.items.length > 0 ? (
                  <div className="pr-4">
                    {order.items.map((item, index) => (
                      <div key={`${item.menuItem.id}-${index}`} className="flex items-center gap-4 py-3">
                        <Image
                          src={item.menuItem.imageUrl || 'https://picsum.photos/seed/placeholder/64/64'}
                          alt={item.menuItem.name}
                          width={64}
                          height={64}
                          className="rounded-md object-contain"
                          data-ai-hint="food drink"
                        />
                        <div className="flex-1">
                          <p className="font-semibold">{item.menuItem.name}</p>
                          {item.comment && (
                            <p className="text-sm text-muted-foreground italic">Obs: {item.comment}</p>
                          )}
                          <p className="text-sm text-muted-foreground">R$ {item.menuItem.price.toFixed(2).replace('.', ',')}</p>
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => handleOpenCommentDialog(item)}>
                            <MessageSquarePlus className="mr-1 h-3 w-3"/>
                            {item.comment ? 'Editar Obs.' : 'Adicionar Obs.'}
                          </Button>
                        </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.menuItem.id, -1, item.comment)}>
                              {item.quantity === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                            </Button>
                            <span className="font-bold w-6 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.menuItem.id, 1, item.comment)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                      </div>
                    ))}
                  </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <p className="text-muted-foreground">Nenhum item na comanda.</p>
                        <Button variant="link" className="mt-2" onClick={() => setIsMenuPickerOpen(true)}>Adicionar itens</Button>
                    </div>
                )}
              </ScrollArea>
              
              <Separator />
              <Button variant="outline" onClick={() => setIsMenuPickerOpen(true)} className="w-full mt-2">
                  <PlusCircle className="mr-2 h-4 w-4"/>
                  Adicionar Itens
              </Button>

              <SheetFooter className="mt-auto pt-4">
                <div className="w-full space-y-4">
                    {paidAmount > 0 && (
                      <>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>Total Original</span>
                          <span>R$ {total.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>Total Pago</span>
                          <span className="font-medium">- R$ {paidAmount.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <Separator />
                      </>
                    )}
                    <div className="flex justify-between items-center text-xl font-bold">
                        <span>{paidAmount > 0 ? 'Restante' : 'Total'}</span>
                        <span>R$ {remainingAmount.toFixed(2).replace('.', ',')}</span>
                    </div>

                    {isSupported && (
                      <div className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                        <div className="flex items-center gap-2 text-sm">
                            <PrinterStatusIcon />
                            <span>Impressora Bluetooth</span>
                        </div>
                        {isConnected ? (
                          <Button size="sm" variant="destructive" onClick={disconnect}>Desconectar</Button>
                        ) : (
                          <Button size="sm" onClick={connect} disabled={isConnecting}>
                            {isConnecting ? 'Conectando...' : 'Conectar'}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={handleWhatsAppShare}>
                            <Share className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleKitchenPrint}>
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button className="w-full" onClick={() => setIsPaymentDialogOpen(true)} disabled={order.items.length === 0 || remainingAmount < 0.01}>
                            <Wallet className="mr-2 h-4 w-4" />
                            Pagar
                        </Button>
                    </div>
                     {isConnected && (
                        <Button variant="secondary" className="w-full" onClick={handleBluetoothPrint} disabled={itemsToPrint.length === 0}>
                            <Bluetooth className="mr-2 h-4 w-4" /> Imprimir Cozinha (Bluetooth)
                        </Button>
                    )}
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <div className="print-area">
        <KitchenReceipt identifier={order.identifier} type={order.type} itemsToPrint={itemsToPrint} />
        {isPaid && <PrintableReceipt order={order} total={total} paidAmount={paidAmount} remainingAmount={remainingAmount} />}
      </div>


      {!isPaid && (
          <>
            {isMenuPickerOpen && (
                <MenuPicker
                menuItems={menuItems}
                onAddItem={addItemToOrder}
                isOpen={isMenuPickerOpen}
                onOpenChange={setIsMenuPickerOpen}
                />
            )}
            
            {isPaymentDialogOpen && (
                <PaymentDialog
                order={order}
                total={total}
                isOpen={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                onConfirmPayment={handlePayment}
                />
            )}
             {isCommentDialogOpen && selectedItemForComment && (
                <CommentDialog
                    isOpen={isCommentDialogOpen}
                    onOpenChange={setIsCommentDialogOpen}
                    onSave={handleSaveComment}
                    item={selectedItemForComment}
                />
            )}
        </>
      )}
    </>
  );
}
