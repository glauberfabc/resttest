
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
import { Plus, Minus, Trash2, Wallet, Share, PlusCircle, Printer, MessageSquarePlus, MessageSquareText, Bluetooth, BluetoothConnected, BluetoothSearching } from "lucide-react";
import { formatInTimeZone } from 'date-fns-tz';
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import { useToast } from "@/hooks/use-toast";

interface OrderDetailsSheetProps {
  order: Order;
  menuItems: MenuItem[];
  onOpenChange: (isOpen: boolean) => void;
  onUpdateOrder: (order: Order) => void;
  onProcessPayment: (orderId: string, amount: number, method: string) => void;
  onDeleteOrder: (orderId: string) => void;
}

export function OrderDetailsSheet({ order, menuItems, onOpenChange, onUpdateOrder, onProcessPayment, onDeleteOrder }: OrderDetailsSheetProps) {
  const [isMenuPickerOpen, setIsMenuPickerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);

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

  useEffect(() => {
    // Initialize printed items state when order changes
    setPrintedKitchenItems(order.items);
  }, [order.id, order.items]);

  useEffect(() => {
    // This effect calculates which items are new or have increased quantity
    const newItemsToPrint: OrderItem[] = [];

    // Group current items by a unique key (menuItem ID + comment) and sum quantities
    const currentItemsMap = new Map<string, { item: OrderItem, quantity: number }>();
    order.items.forEach(item => {
        const key = `${item.menuItem.id}-${item.comment || ''}`;
        const existing = currentItemsMap.get(key);
        if (existing) {
            existing.quantity += item.quantity;
        } else {
            currentItemsMap.set(key, { item: { ...item }, quantity: item.quantity });
        }
    });

    // Group printed items similarly
    const printedItemsMap = new Map<string, number>();
    printedKitchenItems.forEach(item => {
        const key = `${item.menuItem.id}-${item.comment || ''}`;
        printedItemsMap.set(key, (printedItemsMap.get(key) || 0) + item.quantity);
    });

    // Compare maps to find new items or increased quantities
    currentItemsMap.forEach(({ item, quantity }, key) => {
        const printedQuantity = printedItemsMap.get(key) || 0;
        if (quantity > printedQuantity) {
            newItemsToPrint.push({
                ...item,
                quantity: quantity - printedQuantity,
            });
        }
    });

    setItemsToPrint(newItemsToPrint);
  }, [order.items, printedKitchenItems]);


  const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const remainingAmount = total - paidAmount;
  const isPaid = order.status === 'paid';
  const timeZone = 'America/Sao_Paulo';
  
  // Consolidate items for display only
  const groupedItemsForDisplay = Array.from(order.items.reduce((map, item) => {
    const key = `${item.menuItem.id}-${item.comment || ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item, id: item.id || key, quantity: item.quantity });
    }
    return map;
  }, new Map<string, OrderItem>()).values());


  const updateItemQuantity = (itemToUpdate: OrderItem, delta: number) => {
    const updatedItems = [...order.items];
    const itemIndex = updatedItems.findIndex(i => i.menuItem.id === itemToUpdate.menuItem.id && i.comment === itemToUpdate.comment);
  
    if (itemIndex === -1) return;
    
    // Find one instance of the item to modify or remove
    const firstInstanceIndex = updatedItems.findIndex(i => i.menuItem.id === itemToUpdate.menuItem.id && i.comment === itemToUpdate.comment);

    if (delta > 0) {
        // Add a new instance of the item for the delta
        const newItem: OrderItem = {
            id: `new-${Date.now()}-${Math.random()}`,
            menuItem: itemToUpdate.menuItem,
            quantity: delta,
            comment: itemToUpdate.comment,
        };
        updatedItems.push(newItem);
    } else if (delta < 0 && firstInstanceIndex !== -1) {
        // Decrease quantity or remove
        const itemToRemoveOrUpdate = updatedItems[firstInstanceIndex];
        if (itemToRemoveOrUpdate.quantity > -delta) {
            itemToRemoveOrUpdate.quantity += delta; // delta is negative
        } else {
            updatedItems.splice(firstInstanceIndex, 1);
        }
    } else if (delta === 0) { // Special case to remove all
        const filteredItems = updatedItems.filter(i => !(i.menuItem.id === itemToUpdate.menuItem.id && i.comment === itemToUpdate.comment));
        onUpdateOrder({ ...order, items: filteredItems });
        return;
    }

    onUpdateOrder({ ...order, items: updatedItems });
  };
  
  const addItemToOrder = (menuItem: MenuItem) => {
    const newItem: OrderItem = {
        id: `new-${Date.now()}-${Math.random()}`, // Create a unique ID for the frontend
        menuItem,
        quantity: 1,
        comment: '',
    };
    const updatedItems = [...order.items, newItem];
    onUpdateOrder({ ...order, items: updatedItems });
  };
  
  const handleEditComment = (item: OrderItem) => {
    setEditingItem(item);
    setIsCommentDialogOpen(true);
  };
  
  const handleSaveComment = (newComment: string) => {
    if (!editingItem) return;
  
    const updatedItems = order.items.map(i => {
        // Use the composite key (id + comment) to find the correct item from the display list
        const key = `${i.menuItem.id}-${i.comment || ''}`;
        const editingKey = `${editingItem.menuItem.id}-${editingItem.comment || ''}`;
        if (key === editingKey) {
            return { ...i, comment: newComment };
        }
        return i;
    });
  
    onUpdateOrder({ ...order, items: updatedItems });
    setEditingItem(null);
  };

  const handleWhatsAppShare = () => {
    const header = `*Comanda ${order.type === 'table' ? 'Mesa' : ''} ${order.identifier}*\n\n`;
    const itemsText = groupedItemsForDisplay.map(item => 
      `${item.quantity}x ${item.menuItem.name}${item.comment ? ` (${item.comment})` : ''} - R$ ${(item.menuItem.price * item.quantity).toFixed(2).replace('.', ',')}`
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
    window.print();
    setPrintedKitchenItems([...order.items]); // Mark all current items as printed
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
    setPrintedKitchenItems([...order.items]); // Mark all current items as printed
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
                {groupedItemsForDisplay.length > 0 ? (
                  <div className="pr-4">
                    {groupedItemsForDisplay.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 py-3">
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
                           <p className="text-sm text-muted-foreground">R$ {(item.menuItem.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                           {item.comment ? (
                              <p className="text-sm text-primary font-medium flex items-center gap-1 cursor-pointer" onClick={() => handleEditComment(item)}>
                                <MessageSquareText className="w-3 h-3" />
                                {item.comment}
                              </p>
                            ) : (
                               <p className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer" onClick={() => handleEditComment(item)}>
                                <MessageSquarePlus className="w-3 h-3" />
                                Adicionar Obs.
                              </p>
                            )}
                        </div>
                          <div className="flex items-center gap-2">
                             <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item, 0)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item, -1)}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-bold w-6 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item, 1)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                      </div>
                    ))}
                  </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
                        <p className="text-muted-foreground">Nenhum item na comanda.</p>
                        <div className="flex gap-2">
                           <Button variant="outline" onClick={() => setIsMenuPickerOpen(true)}>Adicionar itens</Button>
                           <Button variant="destructive" size="icon" onClick={() => onDeleteOrder(order.id)}>
                             <Trash2 className="h-4 w-4"/>
                           </Button>
                        </div>
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
            {isCommentDialogOpen && editingItem && (
              <CommentDialog
                isOpen={isCommentDialogOpen}
                onOpenChange={setIsCommentDialogOpen}
                initialComment={editingItem.comment || ''}
                onSave={handleSaveComment}
              />
            )}
        </>
      )}
    </>
  );
}

    