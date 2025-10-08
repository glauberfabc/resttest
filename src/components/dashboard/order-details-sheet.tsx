
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
}

export function OrderDetailsSheet({ order, menuItems, onOpenChange, onUpdateOrder, onProcessPayment }: OrderDetailsSheetProps) {
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
    const currentItemsMap = new Map<string, number>();
    order.items.forEach(item => {
      const key = `${item.menuItem.id}-${item.comment || ''}`;
      currentItemsMap.set(key, (currentItemsMap.get(key) || 0) + item.quantity);
    });

    const printedItemsMap = new Map<string, number>();
    printedKitchenItems.forEach(item => {
        const key = `${item.menuItem.id}-${item.comment || ''}`;
        printedItemsMap.set(key, (printedItemsMap.get(key) || 0) + item.quantity);
    });
    
    const newItems: OrderItem[] = [];
    currentItemsMap.forEach((quantity, key) => {
        const printedQuantity = printedItemsMap.get(key) || 0;
        if (quantity > printedQuantity) {
            const [menuItemId, comment] = key.split(/-(.*)/s)
            const menuItem = menuItems.find(mi => mi.id === menuItemId);
            if (menuItem) {
                 newItems.push({
                    id: `print-${key}`,
                    menuItem,
                    quantity: quantity - printedQuantity,
                    comment: comment || '',
                });
            }
        }
    });
    setItemsToPrint(newItems);
  }, [order.items, printedKitchenItems, menuItems]);


  const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const remainingAmount = total - paidAmount;
  const isPaid = order.status === 'paid';
  const timeZone = 'America/Sao_Paulo';
  
  // Consolidate items for display
  const groupedItems = Array.from(order.items.reduce((map, item) => {
    const key = `${item.menuItem.id}-${item.comment || ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      // Create a shallow copy and ensure it has a unique ID for React key
      map.set(key, { ...item, id: item.id || key });
    }
    return map;
  }, new Map<string, OrderItem>()).values());


  const updateItemQuantity = (itemGroup: OrderItem, delta: number) => {
    const updatedItems = [...order.items];

    if (delta > 0) { // Add a new instance of the item with a blank comment
      const newItem: OrderItem = {
        id: `new-${Date.now()}-${Math.random()}`,
        menuItem: itemGroup.menuItem,
        quantity: 1,
        comment: '',
      };
      updatedItems.push(newItem);
    } else { // Remove one unit of the specified item group
      // Find the last matching item instance to remove from
      const itemIndexToRemove = updatedItems.findLastIndex(
        i => i.menuItem.id === itemGroup.menuItem.id && i.comment === itemGroup.comment
      );
      if (itemIndexToRemove !== -1) {
        if (updatedItems[itemIndexToRemove].quantity > 1) {
          updatedItems[itemIndexToRemove].quantity -= 1;
        } else {
          updatedItems.splice(itemIndexToRemove, 1);
        }
      }
    }
    onUpdateOrder({ ...order, items: updatedItems });
  };
  
 const addItemToOrder = (menuItem: MenuItem) => {
    const comment = ''; // Always add with blank comment
    const updatedItems = [...order.items];

    // Instead of always adding, find an existing item with the same ID and blank comment
    const existingItemIndex = updatedItems.findLastIndex(
        i => i.menuItem.id === menuItem.id && i.comment === comment
    );

    if (existingItemIndex !== -1) {
        // If found, increment its quantity
        updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + 1,
        };
    } else {
        // If not found, add as a new item
        const newItem: OrderItem = {
            id: `new-${Date.now()}-${Math.random()}`,
            menuItem,
            quantity: 1,
            comment,
        };
        updatedItems.push(newItem);
    }
    onUpdateOrder({ ...order, items: updatedItems });
};
  
  const handleEditComment = (item: OrderItem) => {
    // Find the actual item instance in the original `order.items` array
    // This is important if there are multiple un-commented items of the same type
    const itemToEdit = order.items.find(i => i.id === item.id);
    setEditingItem(itemToEdit || item); // Fallback to the grouped item if not found
    setIsCommentDialogOpen(true);
  };
  
  const handleSaveComment = (newComment: string) => {
    if (!editingItem) return;

    let alreadyExists = false;
    const updatedItems = order.items.map(item => {
      // Check if another item with the same product and new comment already exists
      if (item.id !== editingItem.id && item.menuItem.id === editingItem.menuItem.id && item.comment === newComment) {
        alreadyExists = true;
      }
      return item;
    });

    if (alreadyExists) {
        toast({
            variant: "destructive",
            title: "Observação já existe",
            description: "Um item com essa observação já foi adicionado. Aumente a quantidade do item existente.",
        });
        return;
    }
  
    const finalItems = order.items.map(item => {
      // Use the temporary ID to find the specific item instance to update
      if (item.id === editingItem.id) {
        return { ...item, comment: newComment };
      }
      return item;
    });
  
    onUpdateOrder({ ...order, items: finalItems });
    setEditingItem(null);
  };

  const handleWhatsAppShare = () => {
    const header = `*Comanda ${order.type === 'table' ? 'Mesa' : ''} ${order.identifier}*\n\n`;
    const itemsText = groupedItems.map(item => 
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
                {groupedItems.length > 0 ? (
                  <div className="pr-4">
                    {groupedItems.map((item) => (
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
                             <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item, -1)}>
                              {item.quantity === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
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
