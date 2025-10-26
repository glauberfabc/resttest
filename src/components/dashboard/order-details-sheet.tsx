
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import type { Order, MenuItem, OrderItem, Client, ClientCredit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MenuPicker } from "@/components/dashboard/menu-picker";
import { PaymentDialog } from "@/components/dashboard/payment-dialog";
import { PrintableReceipt } from "@/components/dashboard/printable-receipt";
import { KitchenReceipt } from "@/components/dashboard/kitchen-receipt";
import { CommentDialog } from "@/components/dashboard/comment-dialog";
import { Plus, Minus, Trash2, Wallet, Share, PlusCircle, Printer, MessageSquarePlus, MessageSquareText } from "lucide-react";
import { format, isToday, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useToast } from "@/hooks/use-toast";

interface OrderDetailsSheetProps {
  order: Order;
  allOrders: Order[];
  allClients: Client[];
  allCredits: ClientCredit[];
  menuItems: MenuItem[];
  onOpenChange: (isOpen: boolean) => void;
  onUpdateOrder: (order: Order) => void;
  onProcessPayment: (orderId: string, amount: number, method: string) => void;
  onDeleteOrder: (orderId: string) => void;
  printedKitchenItems: OrderItem[];
  onSetPrintedItems: (items: OrderItem[]) => void;
}

// Helper function to group items by key (menuItem.id + comment)
const groupOrderItems = (items: OrderItem[]): Map<string, OrderItem> => {
  const grouped = new Map<string, OrderItem>();
  if (!Array.isArray(items)) {
    return grouped;
  }
  items.forEach(item => {
    const key = `${item.menuItem.id}-${item.comment || ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      // Ensure we're creating a new object to avoid mutation issues
      grouped.set(key, { ...item, quantity: item.quantity }); 
    }
  });
  return grouped;
};


export function OrderDetailsSheet({ order, allOrders, allClients, allCredits, menuItems, onOpenChange, onUpdateOrder, onProcessPayment, onDeleteOrder, printedKitchenItems, onSetPrintedItems }: OrderDetailsSheetProps) {
  const [isMenuPickerOpen, setIsMenuPickerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);

  const [itemsToPrint, setItemsToPrint] = useState<OrderItem[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    const currentGrouped = groupOrderItems(order.items);
    const printedGrouped = groupOrderItems(printedKitchenItems);
    const newItems: OrderItem[] = [];

    currentGrouped.forEach((currentItem, key) => {
        const printedItem = printedGrouped.get(key);
        const printedQuantity = printedItem ? printedItem.quantity : 0;
        
        if (currentItem.quantity > printedQuantity) {
            newItems.push({
                ...currentItem,
                quantity: currentItem.quantity - printedQuantity,
            });
        }
    });

    setItemsToPrint(newItems);
  }, [order.items, printedKitchenItems]);


  const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const isPaid = order.status === 'paid';
  const timeZone = 'America/Sao_Paulo';
  
  const isFromBeforeToday = !isToday(new Date(order.created_at));

  const { previousDebt, dailyConsumption } = useMemo(() => {
    let debt = 0;
    const consumption = isToday(new Date(order.created_at)) ? total : 0;

    if (order.type === 'name') {
        const clientName = (order.identifier as string).toUpperCase();
        const client = allClients.find(c => c.name.toUpperCase() === clientName);
        
        if (client) {
            // Sum all credits for the client
            const clientCredits = allCredits
                .filter(c => c.client_id === client.id)
                .reduce((sum, c) => sum + c.amount, 0);
            
            // Sum debt from all open orders for this client, excluding the current one
            const otherOpenOrdersDebt = allOrders
                .filter(o => 
                    o.type === 'name' &&
                    o.status !== 'paid' &&
                    o.id !== order.id &&
                    (o.identifier as string).toUpperCase() === clientName
                )
                .reduce((sum, o) => {
                    const orderTotal = o.items.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);
                    const orderPaid = o.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
                    return sum + (orderTotal - orderPaid);
                }, 0);
            
            // If the current order is old, its value is part of the previous debt
            const currentOrderDebtContribution = !isToday(new Date(order.created_at)) ? (total - paidAmount) : 0;

            debt = otherOpenOrdersDebt - clientCredits + currentOrderDebtContribution;
        }
    }
    
    return {
      previousDebt: debt,
      dailyConsumption: consumption
    };
  }, [order, allOrders, allClients, allCredits, total, paidAmount]);

  
  const groupedItemsForDisplay = useMemo(() => {
    return Array.from(groupOrderItems(order.items).values());
  }, [order.items]);


  const updateItemQuantity = (itemToUpdate: OrderItem, delta: number) => {
    const keyToUpdate = `${itemToUpdate.menuItem.id}-${itemToUpdate.comment || ''}`;
    let updatedItems = [...order.items];
    let itemFound = false;

    // First, try to find an exact match to update quantity or remove
    updatedItems = updatedItems.map(item => {
        if (`${item.menuItem.id}-${item.comment || ''}` === keyToUpdate) {
            itemFound = true;
            return { ...item, quantity: item.quantity + delta };
        }
        return item;
    }).filter(item => item.quantity > 0);

    // If adding a new item and it wasn't found, push it to the array
    if (!itemFound && delta > 0) {
        updatedItems.push({
            id: crypto.randomUUID(), // Ensure a unique ID for each new item instance
            menuItem: itemToUpdate.menuItem,
            quantity: delta,
            comment: itemToUpdate.comment || '',
        });
    }

    // Special case to remove all of a kind (e.g., trash icon)
    if (delta === 0) {
        updatedItems = order.items.filter(item => `${item.menuItem.id}-${item.comment || ''}` !== keyToUpdate);
    }
    
    onUpdateOrder({ ...order, items: updatedItems });
};
  
  const addItemToOrder = useCallback((menuItem: MenuItem) => {
    const key = `${menuItem.id}-`; // Key for item without comment
    let items = [...order.items];
    const existingItemIndex = items.findIndex(i => `${i.menuItem.id}-${i.comment || ''}` === key);

    if (existingItemIndex > -1) {
        items[existingItemIndex] = {
            ...items[existingItemIndex],
            quantity: items[existingItemIndex].quantity + 1
        };
    } else {
        items.push({
            id: crypto.randomUUID(),
            menuItem,
            quantity: 1,
            comment: '',
        });
    }
    onUpdateOrder({ ...order, items });
}, [order, onUpdateOrder]);
  
  const handleEditComment = (item: OrderItem) => {
    setEditingItem(item);
    setIsCommentDialogOpen(true);
  };
  
  const handleSaveComment = (newComment: string) => {
    if (!editingItem) return;

    let itemsWithoutOld = order.items.filter(i => {
        const oldKey = `${editingItem.menuItem.id}-${editingItem.comment || ''}`;
        const currentKey = `${i.menuItem.id}-${i.comment || ''}`;
        return oldKey !== currentKey;
    });

    const keyWithNewComment = `${editingItem.menuItem.id}-${newComment || ''}`;
    const existingItemIndexWithNewComment = itemsWithoutOld.findIndex(i => `${i.menuItem.id}-${i.comment || ''}` === keyWithNewComment);
    
    let finalItems = [];

    if (existingItemIndexWithNewComment > -1) {
        itemsWithoutOld[existingItemIndexWithNewComment].quantity += editingItem.quantity;
        finalItems = itemsWithoutOld;
    } else {
        const updatedItemWithNewComment = { ...editingItem, comment: newComment };
        finalItems = [...itemsWithoutOld, updatedItemWithNewComment];
    }
  
    onUpdateOrder({ ...order, items: finalItems });
    setEditingItem(null);
  };

  const handleWhatsAppShare = () => {
    let message = '';
    const totalDebt = previousDebt + dailyConsumption;
    
    if (isFromBeforeToday) {
        const dateStr = format(new Date(order.created_at), 'dd/MM/yyyy');
        message += `*Resumo de Conta - ${order.identifier}*\n`;
        message += `*Consumo do dia ${dateStr}:*\n`;
        message += groupedItemsForDisplay.map(item => 
          `${item.quantity}x ${item.menuItem.name}${item.comment ? ` (${item.comment})` : ''} - R$ ${(item.menuItem.price * item.quantity).toFixed(2).replace('.', ',')}`
        ).join('\n');
        message += `\n\n*Valor do Dia: R$ ${total.toFixed(2).replace('.', ',')}*`;
        const balanceBeforeThisOrder = previousDebt;
        if (balanceBeforeThisOrder < 0) {
            message += `\n*Saldo Anterior: R$ ${balanceBeforeThisOrder.toFixed(2).replace('.', ',')}*`;
        }
        message += `\n*DÍVIDA TOTAL: R$ ${(totalDebt).toFixed(2).replace('.', ',')}*`;

    } else {
        const headerIdentifier = order.type === 'table' && order.customer_name
            ? `Mesa ${order.identifier} (${order.customer_name})`
            : `${order.type === 'table' ? 'Mesa ' : ''}${order.identifier}`;
        
        message += `*Comanda ${headerIdentifier}*\n\n`;

        if (dailyConsumption > 0) {
          message += `*Consumo do dia:*\n`;
          message += groupedItemsForDisplay.map(item => 
              `${item.quantity}x ${item.menuItem.name}${item.comment ? ` (${item.comment})` : ''} - R$ ${(item.menuItem.price * item.quantity).toFixed(2).replace('.', ',')}`
          ).join('\n');
        }

        if (previousDebt < 0) {
             message += `\n\n*Saldo Anterior: R$ ${previousDebt.toFixed(2).replace('.', ',')}*`;
        }

        const totalToPay = dailyConsumption + previousDebt;
        message += `\n*Total: R$ ${totalToPay.toFixed(2).replace('.', ',')}*`;


        if (paidAmount > 0) {
            message += `\n*Pago: R$ ${paidAmount.toFixed(2).replace('.', ',')}*`;
            if (!isPaid) {
                message += `\n*Restante: R$ ${(totalToPay - paidAmount).toFixed(2).replace('.', ',')}*`;
            }
        }
    }
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`);
  };


  const handlePayment = (amount: number, method: string) => {
    onProcessPayment(order.id, amount, method);
  };
  
  const handleKitchenPrint = () => {
    if (itemsToPrint.length === 0) {
      toast({ title: 'Nada para imprimir', description: 'Nenhum item novo foi adicionado à comanda.' });
      return;
    }
    const printArea = document.querySelector('.print-area');
    if (printArea) {
      const clonedPrintArea = printArea.cloneNode(true);
      document.body.appendChild(clonedPrintArea);
      window.print();
      document.body.removeChild(clonedPrintArea);
      onSetPrintedItems(Array.from(groupOrderItems(order.items).values()));
    }
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

  const sheetTitle = () => {
    let baseTitle = isPaid ? 'Comprovante' : 'Comanda';
    if (isFromBeforeToday && !isPaid) baseTitle = 'Caderneta';
    
    const identifier = order.type === 'table' && order.customer_name
      ? `Mesa ${order.identifier} (${order.customer_name})`
      : `${order.type === 'table' ? 'Mesa ' : ''}${order.identifier}`;
      
    let finalTitle = `${baseTitle}: ${identifier}`;

    if (isFromBeforeToday && !isPaid) {
      finalTitle += ` - ${format(new Date(order.created_at), 'dd/MM/yyyy')}`;
    }

    return finalTitle;
  };

  const totalToDisplay = previousDebt + dailyConsumption - paidAmount;


  return (
    <>
      <Sheet open={true} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-2xl">
              {sheetTitle()}
            </SheetTitle>
            <SheetDescription>
              {isPaid ? getFormattedPaidAt() : 'Visualize, adicione ou remova itens da comanda.'}
            </SheetDescription>
          </SheetHeader>
          
          {isPaid ? (
            <>
                <div className="flex-1 my-4 p-4 border rounded-md bg-white text-black overflow-y-auto font-mono">
                    <PrintableReceipt order={order} total={total} paidAmount={paidAmount} remainingAmount={total - paidAmount} className="!block !relative !w-full !p-0 !text-black !bg-white !shadow-none !border-none !text-sm" />
                </div>
                <SheetFooter className="mt-auto flex-col sm:flex-col sm:space-x-0 gap-2">
                    <Button variant="outline" className="w-full" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Comprovante
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Comprovante
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente a comanda e todos os seus dados.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteOrder(order.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </SheetFooter>
            </>
          ) : (
            <>
              <Separator />
              <ScrollArea className="flex-1 -mr-6">
                {groupedItemsForDisplay.length > 0 ? (
                  <div className="pr-6">
                    {groupedItemsForDisplay.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="flex items-center gap-4 py-3">
                        <Image
                          src={item.menuItem.imageUrl || 'https://picsum.photos/seed/placeholder/64/64'}
                          alt={item.menuItem.name}
                          width={64}
                          height={64}
                          className="rounded-md object-contain w-12 h-12 sm:w-16 sm:h-16"
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
                          <div className="flex items-center gap-1 sm:gap-2">
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
                           <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="h-4 w-4 mr-2"/>
                                        Excluir Comanda
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Comandas vazias podem ser excluídas. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteOrder(order.id)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
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
                    {previousDebt !== 0 && (
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Saldo Anterior</span>
                            <span className={previousDebt < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                                R$ {previousDebt.toFixed(2).replace('.', ',')}
                            </span>
                        </div>
                    )}
                    {dailyConsumption > 0 && (
                      <>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>Consumo do Dia</span>
                          <span>
                              R$ {dailyConsumption.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </>
                    )}
                    {paidAmount > 0 && (
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Total Pago Hoje</span>
                        <span className="font-medium text-green-600">R$ {paidAmount.toFixed(2).replace('.', ',')}</span>
                        </div>
                    )}
                    {(previousDebt !== 0 || dailyConsumption > 0 || paidAmount > 0) && <Separator />}
                    <div className="flex justify-between items-center text-xl font-bold">
                        <span>{'Total Geral'}</span>
                        <span>R$ {totalToDisplay.toFixed(2).replace('.', ',')}</span>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={handleWhatsAppShare}>
                            <Share className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleKitchenPrint} disabled={itemsToPrint.length === 0}>
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button className="w-full" onClick={() => setIsPaymentDialogOpen(true)} disabled={order.items.length === 0 || totalToDisplay < 0.01}>
                            <Wallet className="mr-2 h-4 w-4" />
                            Pagar
                        </Button>
                    </div>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <div className="print-area">
        <KitchenReceipt identifier={order.identifier} type={order.type} itemsToPrint={itemsToPrint} />
        {isPaid && <PrintableReceipt order={order} total={total} paidAmount={paidAmount} remainingAmount={total - paidAmount} />}
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
                total={totalToDisplay}
                isOpen={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                onConfirmPayment={handlePayment}
                clients={allClients}
                credits={allCredits}
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

    