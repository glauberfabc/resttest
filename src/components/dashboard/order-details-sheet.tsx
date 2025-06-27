"use client";

import { useState } from "react";
import Image from "next/image";
import type { Order, MenuItem, OrderItem, Payment } from "@/lib/types";
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
import { Plus, Minus, Trash2, Wallet, Share, PlusCircle } from "lucide-react";

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

  const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const paidAmount = order.payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  const remainingAmount = total - paidAmount;

  const updateQuantity = (itemId: string, delta: number) => {
    const updatedItems = order.items.map(item => {
      if (item.menuItem.id === itemId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
      }
      return item;
    }).filter(Boolean) as OrderItem[];
    onUpdateOrder({ ...order, items: updatedItems });
  };

  const addItemToOrder = (menuItem: MenuItem) => {
    const existingItem = order.items.find(item => item.menuItem.id === menuItem.id);
    if (existingItem) {
      updateQuantity(menuItem.id, 1);
    } else {
      const updatedItems = [...order.items, { menuItem, quantity: 1 }];
      onUpdateOrder({ ...order, items: updatedItems });
    }
  };
  
  const handleWhatsAppShare = () => {
    const header = `*Comanda ${order.type === 'table' ? 'Mesa' : ''} ${order.identifier}*\n\n`;
    const itemsText = order.items.map(item => 
      `${item.quantity}x ${item.menuItem.name} - R$ ${(item.menuItem.price * item.quantity).toFixed(2).replace('.', ',')}`
    ).join('\n');
    const totalText = `\n\n*Total: R$ ${total.toFixed(2).replace('.', ',')}*`;
    const paidText = paidAmount > 0 ? `\n*Pago: R$ ${paidAmount.toFixed(2).replace('.', ',')}*` : '';
    const remainingText = paidAmount > 0 ? `\n*Restante: R$ ${remainingAmount.toFixed(2).replace('.', ',')}*` : '';
    
    const message = encodeURIComponent(header + itemsText + totalText + paidText + remainingText);
    window.open(`https://wa.me/?text=${message}`);
  };

  const handlePayment = (amount: number, method: string) => {
    onProcessPayment(order.id, amount, method);
    setIsPaymentDialogOpen(false);
  };

  return (
    <>
      <Sheet open={true} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-2xl">
              Comanda: {order.type === 'table' ? 'Mesa' : ''} {order.identifier}
            </SheetTitle>
            <SheetDescription>
              Visualize, adicione ou remova itens da comanda.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          
          <ScrollArea className="flex-1">
            {order.items.length > 0 ? (
              <div className="pr-4">
                {order.items.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="flex items-center gap-4 py-3">
                    <Image
                      src={menuItem.imageUrl || 'https://placehold.co/64x64'}
                      alt={menuItem.name}
                      width={64}
                      height={64}
                      className="rounded-md object-cover"
                      data-ai-hint="food drink"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{menuItem.name}</p>
                      <p className="text-sm text-muted-foreground">R$ {menuItem.price.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(menuItem.id, -1)}>
                        {quantity === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                      </Button>
                      <span className="font-bold w-6 text-center">{quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(menuItem.id, 1)}>
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
                      <span className="font-medium text-green-600">- R$ {paidAmount.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="flex justify-between items-center text-xl font-bold">
                    <span>{paidAmount > 0 ? 'Restante' : 'Total'}</span>
                    <span>R$ {remainingAmount.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={handleWhatsAppShare}>
                        <Share className="h-4 w-4" />
                    </Button>
                    <Button className="w-full" onClick={() => setIsPaymentDialogOpen(true)} disabled={order.items.length === 0 || remainingAmount < 0.01}>
                        <Wallet className="mr-2 h-4 w-4" />
                        Pagar
                    </Button>
                </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
    </>
  );
}
