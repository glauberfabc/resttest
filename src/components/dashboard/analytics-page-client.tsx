"use client";

import { useState } from "react";
import type { Order } from "@/lib/types";
import { addDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, DollarSign, ListOrdered, FileClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsPageClientProps {
  orders: Order[];
}

export default function AnalyticsPageClient({ orders }: AnalyticsPageClientProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const openOrders = orders.filter(
    (o) => o.status === "open" || o.status === "paying"
  );
  
  const receivableAmount = openOrders.reduce((total, order) => {
    const orderTotal = order.items.reduce(
      (acc, item) => acc + item.menuItem.price * item.quantity,
      0
    );
    return total + orderTotal;
  }, 0);

  const paidOrders = orders.filter(
    (o) => {
        if (o.status !== 'paid' || !o.paidAt) return false;
        const paidDate = new Date(o.paidAt);
        const fromDate = date?.from ? new Date(new Date(date.from).setHours(0,0,0,0)) : null;
        const toDate = date?.to ? new Date(new Date(date.to).setHours(23,59,59,999)) : null;
        if (fromDate && paidDate < fromDate) return false;
        if (toDate && paidDate > toDate) return false;
        return true;
    }
  );

  const totalSales = paidOrders.reduce((total, order) => {
    const orderTotal = order.items.reduce(
      (acc, item) => acc + item.menuItem.price * item.quantity,
      0
    );
    return total + orderTotal;
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard de Vendas</h2>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[260px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd/MM/y")} -{" "}
                      {format(date.to, "dd/MM/y")}
                    </>
                  ) : (
                    format(date.from, "dd/MM/y")
                  )
                ) : (
                  <span>Selecione o período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Vendas
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalSales.toFixed(2).replace('.', ',')}</div>
            <p className="text-xs text-muted-foreground">
              {paidOrders.length} {paidOrders.length === 1 ? 'venda no período' : 'vendas no período'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comandas Abertas</CardTitle>
            <ListOrdered className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando fechamento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valores a Receber</CardTitle>
            <FileClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {receivableAmount.toFixed(2).replace('.', ',')}</div>
            <p className="text-xs text-muted-foreground">
              Total em comandas abertas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
