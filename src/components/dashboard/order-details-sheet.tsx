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
import { KitchenReceipt } from "@/components/dashboard/kitchen-receipt";
import { CommentDialog } from "@/components/dashboard/comment-dialog";
import { Plus, Minus, Trash2, Wallet, Share, PlusCircle, Printer, MessageSquarePlus, MessageSquareText } from "lucide-react";
import { format, isToday, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useToast } from "@/hooks/use-toast";
import { renderToString } from 'react-dom/server';


// Helper function to group items by key (menuItem.id + comment)
const groupOrderItems = (items: OrderItem[]): Map<string, OrderItem> => {
  const grouped = new Map<string, OrderItem>();
  if (!Array.isArray(items)) {
    return grouped;
  }
  items.forEach(item => {
    // Ensure item and menuItem are valid objects before accessing properties
    if (item && item.menuItem) {
        const key = `${item.menuItem.id}-${item.comment || ''}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.quantity += item.quantity;
        } else {
            // Ensure we're creating a new object to avoid mutation issues
            grouped.set(key, { ...item, quantity: item.quantity }); 
        }
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

  const getGroupedItems = (items: OrderItem[]): OrderItem[] => {
    const groupedMap = new Map<string, OrderItem>();
    if (!Array.isArray(items)) return [];
  
    items.forEach(item => {
        if (item && item.menuItem) {
            const key = `${item.menuItem.id}-${item.comment || ''}`;
            const existing = groupedMap.get(key);
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                groupedMap.set(key, { ...item });
            }
        }
    });
  
    return Array.from(groupedMap.values());
  };

  useEffect(() => {
    const currentGrouped = getGroupedItems(order.items);
    const printedGrouped = getGroupedItems(printedKitchenItems);
    const newItems: OrderItem[] = [];

    currentGrouped.forEach(currentItem => {
      const printedItem = printedGrouped.find(pItem => 
        pItem.menuItem.id === currentItem.menuItem.id && 
        (pItem.comment || '') === (currentItem.comment || '')
      );
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
    const consumption = total;

    if (order.type === 'name') {
        const clientName = (order.identifier as string).toUpperCase();
        const client = allClients.find(c => c.name.toUpperCase() === clientName);
        
        if (client) {
            const clientCreditsAndDebits = allCredits
                .filter(c => c.client_id === client.id)
                .reduce((sum, c) => sum + c.amount, 0);

            const allOtherOrdersDebt = allOrders
                .filter(o => 
                    o.id !== order.id &&
                    o.type === 'name' &&
                    o.status !== 'paid' &&
                    (o.identifier as string).toUpperCase() === clientName
                )
                .reduce((sum, o) => {
                    const orderTotal = o.items.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);
                    const orderPaid = o.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
                    return sum + (orderTotal - orderPaid);
                }, 0);
            
            debt = clientCreditsAndDebits - allOtherOrdersDebt;
        }
    }
    
    return {
      previousDebt: debt,
      dailyConsumption: consumption
    };
}, [order, allOrders, allClients, allCredits, total]);

  
  const groupedItemsForDisplay = useMemo(() => {
    return Array.from(groupOrderItems(order.items).values());
  }, [order.items]);


  const updateItemQuantity = (itemToUpdate: OrderItem, delta: number) => {
    let updatedItems = [...order.items];
    const keyToUpdate = `${itemToUpdate.menuItem.id}-${itemToUpdate.comment || ''}`;

    if (delta === 0) { // Remove all items of this kind
        updatedItems = updatedItems.filter(item => `${item.menuItem.id}-${item.comment || ''}` !== keyToUpdate);
    } else {
        const itemIndexes = updatedItems.map((item, index) => `${item.menuItem.id}-${item.comment || ''}` === keyToUpdate ? index : -1).filter(index => index !== -1);
        
        if (itemIndexes.length > 0) {
            const firstIndex = itemIndexes[0];
            const newQuantity = updatedItems[firstIndex].quantity + delta;

            if (newQuantity > 0) {
                const newUpdatedItems = updatedItems.filter(item => `${item.menuItem.id}-${item.comment || ''}` !== keyToUpdate);
                newUpdatedItems.push({ ...updatedItems[firstIndex], quantity: newQuantity });
                updatedItems = newUpdatedItems;
            } else {
                updatedItems = updatedItems.filter(item => `${item.menuItem.id}-${item.comment || ''}` !== keyToUpdate);
            }
        }
    }
    
    onUpdateOrder({ ...order, items: updatedItems });
};
  
  const addItemToOrder = useCallback((menuItem: MenuItem) => {
    let items = [...order.items];
    const key = `${menuItem.id}-`; // Key for item without comment
    const existingItemIndex = items.findIndex(i => i.menuItem && `${i.menuItem.id}-${i.comment || ''}` === key);

    if (existingItemIndex > -1) {
        items = items.map((item, index) => 
            index === existingItemIndex 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
    } else {
        items.push({
            id: crypto.randomUUID(),
            menuItem: menuItem,
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

    let items = [...order.items];
    const oldKey = `${editingItem.menuItem.id}-${editingItem.comment || ''}`;
    const newKey = `${editingItem.menuItem.id}-${newComment || ''}`;
    
    const itemsToMove = items.filter(i => `${i.menuItem.id}-${i.comment || ''}` === oldKey);
    const totalQuantityToMove = itemsToMove.reduce((sum, i) => sum + i.quantity, 0);

    items = items.filter(i => `${i.menuItem.id}-${i.comment || ''}` !== oldKey);
    
    const existingWithNewCommentIndex = items.findIndex(i => `${i.menuItem.id}-${i.comment || ''}` === newKey);

    if (existingWithNewCommentIndex > -1) {
      items[existingWithNewCommentIndex].quantity += totalQuantityToMove;
    } else {
      items.push({
        ...editingItem,
        comment: newComment,
        quantity: totalQuantityToMove,
      });
    }
  
    onUpdateOrder({ ...order, items: items });
    setEditingItem(null);
  };

  const handleWhatsAppShare = () => {
    let message = '';
    const totalDebtValue = (previousDebt > 0 ? 0 : previousDebt) - dailyConsumption;
    
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
        message += `\n*DÍVIDA TOTAL: R$ ${Math.abs(totalDebtValue).toFixed(2).replace('.', ',')}*`;

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

        const totalToPayValue = Math.abs(totalDebtValue);
        message += `\n*Total: R$ ${totalToPayValue.toFixed(2).replace('.', ',')}*`;


        if (paidAmount > 0) {
            message += `\n*Pago: R$ ${paidAmount.toFixed(2).replace('.', ',')}*`;
            if (!isPaid) {
                message += `\n*Restante: R$ ${(totalToPayValue - paidAmount).toFixed(2).replace('.', ',')}*`;
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

    const receiptContent = renderToString(
        <KitchenReceipt identifier={order.identifier} type={order.type} itemsToPrint={itemsToPrint} />
    );

    const printWindow = window.open('', '_blank', 'width=' + window.screen.width + ',height=' + window.screen.height + ',scrollbars=yes');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Pedido</title>
                    <style>
                        @page { margin: 0; size: auto; }
                        body { margin: 0; font-family: 'Courier New', Courier, monospace; }
                        .kitchen-receipt {
                            width: 280px;
                            font-weight: 700;
                            color: black;
                            background: none;
                            padding: 0;
                            margin: 0;
                            border: none;
                            box-shadow: none;
                            white-space: pre-wrap;
                            font-size: 14px;
                            text-transform: uppercase;
                        }
                        .kitchen-receipt .text-center { text-align: center; }
                        .kitchen-receipt .space-y-1 > * + * { margin-top: 0.25rem; }
                        .kitchen-receipt .text-lg { font-size: 1.125rem; }
                        .kitchen-receipt .font-bold { font-weight: 700; }
                        .kitchen-receipt .text-sm { font-size: 0.875rem; }
                        .kitchen-receipt .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
                        .kitchen-receipt .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
                        .kitchen-receipt .flex { display: flex; }
                        .kitchen-receipt .justify-between { justify-content: space-between; }
                        .kitchen-receipt .pr-2 { padding-right: 0.5rem; }
                        .kitchen-receipt .text-right { text-align: right; }
                        .kitchen-receipt .pl-6 { padding-left: 1.5rem; }
                        .kitchen-receipt .font-semibold { font-weight: 600; }
                    </style>
                </head>
                <body>
                    ${receiptContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        // Timeout needed for the content to render before printing
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
            onSetPrintedItems(getGroupedItems(order.items));
        }, 250);
    } else {
        toast({ variant: 'destructive', title: 'Erro de Impressão', description: 'Não foi possível abrir a janela de impressão. Verifique se os pop-ups estão bloqueados.' });
    }
};

  const printCustomerReceipt = () => {
    const receiptText = generateCustomerReceiptText();
    const printWindow = window.open('', '_blank', 'width=' + window.screen.width + ',height=' + window.screen.height + ',scrollbars=yes');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Comprovante</title>
                    <style>
                        @page { margin: 0; size: auto; }
                        body { margin: 0; }
                        .text-receipt {
                            width: 280px;
                            font-family: 'Courier New', Courier, monospace;
                            font-weight: 700;
                            color: black;
                            background: white;
                            padding: 10px;
                            box-sizing: border-box;
                            font-size: 10px;
                            line-height: 1.4;
                            white-space: pre-wrap;
                        }
                    </style>
                </head>
                <body>
                    <pre class="text-receipt">${receiptText}</pre>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    } else {
        toast({ variant: 'destructive', title: 'Erro de Impressão', description: 'Não foi possível abrir a janela de impressão. Verifique se os pop-ups estão bloqueados.' });
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

  const {displayIdentifier, displayObservation} = useMemo(() => {
    if (order.type === 'table') {
        return { displayIdentifier: `Mesa ${order.identifier}`, displayObservation: order.customer_name };
    }
    
    return { displayIdentifier: order.identifier, displayObservation: order.observation };
  }, [order]);


  const sheetTitle = () => {
    let baseTitle = 'Comanda';
    if (isFromBeforeToday) baseTitle = 'Caderneta';
    
    let finalTitle = `${baseTitle}: ${displayIdentifier}`;

    if (isFromBeforeToday && !isPaid) {
      finalTitle += ` - ${format(new Date(order.created_at), 'dd/MM/yyyy')}`;
    }

    return finalTitle;
  };
  
  const totalDebt = (previousDebt > 0 ? 0 : previousDebt) - dailyConsumption;
  const totalToPay = Math.abs(totalDebt) - paidAmount;

  const generateCustomerReceiptText = () => {
    const LINE_LENGTH = 40;
    const line = '-'.repeat(LINE_LENGTH);
    
    const center = (text: string) => text.padStart(text.length + Math.floor((LINE_LENGTH - text.length) / 2), ' ').padEnd(LINE_LENGTH, ' ');
    const twoColsSimple = (left: string, right: string) => left.padEnd(LINE_LENGTH - right.length, ' ') + right;

    let text = `${center('CUPOM FISCAL')}\n`;
    text += `${center('SNOOKER BAR ARAMAÇAN')}\n\n`;
    
    const identifierText = order.type === 'table' ? `Mesa ${order.identifier}` : `${order.identifier}`;
    text += `${twoColsSimple('COMANDA:', identifierText)}\n`;
    text += `${twoColsSimple('DATA:', formatInTimeZone(order.paid_at || new Date(), timeZone, 'dd/MM/yyyy HH:mm'))}\n`;
    text += `${line}\n`;
    text += `${twoColsSimple('QTD | ITEM', 'VALOR')}\n`;
    text += `${line}\n`;

    groupedItemsForDisplay.forEach(item => {
        const itemPrice = item.menuItem.price * item.quantity;
        const itemTotal = `R$ ${itemPrice.toFixed(2).replace(',', '.')}`.padStart(10);
        const itemName = `${item.quantity}x`.padEnd(5) + `| ${item.menuItem.name.substring(0, 22)}`;
        text += `${twoColsSimple(itemName, itemTotal)}\n`;
        if (item.comment) {
            text += `    Obs: ${item.comment}\n`;
        }
    });

    text += `${line}\n`;
    text += `${twoColsSimple('TOTAL:', `R$ ${total.toFixed(2).replace('.', ',')}`.padStart(10))}\n`;
    if (paidAmount > 0) {
      text += `${twoColsSimple('PAGO:', `R$ ${paidAmount.toFixed(2).replace('.', ',')}`.padStart(10))}\n`;
    }
    const paymentMethods = order.payments?.map(p => p.method).join(', ') || '';
    if(paymentMethods){
      text += `${twoColsSimple('PAGAMENTO:', paymentMethods.padStart(10))}\n`;
    }

    return text;
};

  return (
    <>
      <Sheet open={true} onOpenChange={onOpenChange}>
        <SheetContent className={`w-full sm:max-w-lg flex flex-col`}>
          {!isPaid ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl">
                  {sheetTitle()}
                </SheetTitle>
                <SheetDescription>
                  {displayObservation ? <span className="italic">{displayObservation}</span> : 'Visualize, adicione ou remova itens da comanda.'}
                </SheetDescription>
              </SheetHeader>
              <Separator/>
              
              <div className="flex-1 overflow-y-auto my-4">
                  {groupedItemsForDisplay.length > 0 ? (
                  <div className="pr-6">
                      {groupedItemsForDisplay.map((item, index) => (
                      <div key={`${item.menuItem.id}-${item.comment}-${index}`} className="flex items-center gap-4 py-3">
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
              </div>
              
              <div>
                  <Separator />
                  <div className="py-4">
                      <Button variant="outline" onClick={() => setIsMenuPickerOpen(true)} className="w-full">
                          <PlusCircle className="mr-2 h-4 w-4"/>
                          Adicionar Itens
                      </Button>
                  </div>

                  <SheetFooter className="mt-auto pt-4 border-t">
                      <div className="w-full space-y-4">
                          {previousDebt < 0 && (
                              <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">Saldo Anterior</span>
                                  <span className={"font-medium text-destructive"}>
                                      R$ {previousDebt.toFixed(2).replace('.', ',')}
                                  </span>
                              </div>
                          )}
                          {dailyConsumption > 0 && (
                          <>
                              <div className="flex justify-between items-center text-sm text-muted-foreground">
                              <span>Consumo do Dia</span>
                              <span className="text-destructive font-medium">
                                  - R$ {dailyConsumption.toFixed(2).replace('.', ',')}
                              </span>
                              </div>
                          </>
                          )}
                          {paidAmount > 0 && order.type !== 'name' && (
                              <div className="flex justify-between items-center text-sm text-muted-foreground">
                              <span>Total Pago Hoje</span>
                              <span className="font-medium text-green-600">+ R$ {paidAmount.toFixed(2).replace('.', ',')}</span>
                              </div>
                          )}
                          {(previousDebt !== 0 || dailyConsumption > 0 || (paidAmount > 0 && order.type !== 'name')) && <Separator />}
                          <div className="flex justify-between items-center text-xl font-bold">
                              <span>{'Total Geral'}</span>
                              <span>R$ {totalToPay.toFixed(2).replace('.', ',')}</span>
                          </div>
                          
                          <div className="flex gap-2">
                              <Button variant="outline" size="icon" onClick={handleWhatsAppShare}>
                                  <Share className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" onClick={handleKitchenPrint} disabled={itemsToPrint.length === 0}>
                                  <Printer className="h-4 w-4" />
                              </Button>
                              <Button className="w-full" onClick={() => setIsPaymentDialogOpen(true)} disabled={totalToPay < 0.01}>
                                  <Wallet className="mr-2 h-4 w-4" />
                                  Pagar
                              </Button>
                          </div>
                      </div>
                  </SheetFooter>
              </div>
            </>
            ) : (
                <div className="flex flex-col h-full">
                  <div className="flex-1 py-4 overflow-y-auto">
                      <div className="bg-white text-black p-4 rounded-md shadow-md h-full">
                        <pre className="text-receipt">
                            {generateCustomerReceiptText()}
                        </pre>
                      </div>
                  </div>
                  <SheetFooter className="mt-auto flex-col sm:flex-col sm:space-x-0 gap-2 border-t pt-4">
                      <Button variant="outline" className="w-full" onClick={printCustomerReceipt}>
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
                </div>
            )}
        </SheetContent>
      </Sheet>

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
                total={totalToPay}
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
                initialComment={editingItem.comment}
                onSave={handleSaveComment}
              />
            )}
          </>
      )}
    </>
  );
}

interface OrderDetailsSheetProps {
    order: Order;
    allOrders: Order[];
    allClients: Client[];
    allCredits: ClientCredit[];
    menuItems: MenuItem[];
    onOpenChange: (isOpen: boolean) => void;
    onUpdateOrder: (updatedOrder: Order) => void;
    onProcessPayment: (orderId: string, amount: number, method: string) => void;
    onDeleteOrder: (orderId: string) => void;
    printedKitchenItems: OrderItem[];
    onSetPrintedItems: (items: OrderItem[]) => void;
}
