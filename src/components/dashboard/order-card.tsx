"use client";

import type { Order } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Table2 } from "lucide-react";

interface OrderCardProps {
  order: Order;
  onSelectOrder: (order: Order) => void;
}

export function OrderCard({ order, onSelectOrder }: OrderCardProps) {
  const total = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const itemCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Card 
        className="cursor-pointer hover:shadow-lg hover:border-primary transition-all duration-200"
        onClick={() => onSelectOrder(order)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {order.type === 'table' ? <Table2 className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-muted-foreground" />}
          <span className="truncate">{order.identifier}</span>
        </CardTitle>
        {order.status === 'paying' && <Badge variant="destructive">Pagando</Badge>}
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </div>
      </CardContent>
      <CardFooter>
        <div className="text-2xl font-bold">
          R$ {total.toFixed(2).replace('.', ',')}
        </div>
      </CardFooter>
    </Card>
  );
}
