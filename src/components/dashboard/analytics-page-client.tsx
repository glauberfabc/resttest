
"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Order, MenuItem } from "@/lib/types";
import { addDays, format, startOfDay, endOfDay, eachDayOfInterval, parseISO } from "date-fns";
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
import { Calendar as CalendarIcon, DollarSign, ListOrdered, FileClock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/user-context";
import { SalesChart } from "./sales-chart";


interface AnalyticsPageClientProps {
  orders: Order[];
  menuItems: MenuItem[];
}

export default function AnalyticsPageClient({ orders, menuItems }: AnalyticsPageClientProps) {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  const [date, setDate] = useState<DateRange | undefined>(
    isAdmin
      ? { from: addDays(new Date(), -30), to: new Date() }
      : { from: startOfDay(new Date()), to: endOfDay(new Date()) }
  );

  const lowStockItems = menuItems.filter(
    (item) => item.stock !== undefined && item.lowStockThreshold !== undefined && item.stock > 0 && item.stock <= item.lowStockThreshold
  );

  const outOfStockItems = menuItems.filter(
    (item) => item.stock !== undefined && item.stock === 0
  );

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

  const allPaidOrders = orders.filter(o => o.status === 'paid');

  const paidOrdersInDateRange = allPaidOrders.filter(
    (o) => {
        if (!o.paidAt) return false;
        const paidDate = new Date(o.paidAt);
        const fromDate = date?.from ? new Date(new Date(date.from).setHours(0,0,0,0)) : null;
        const toDate = date?.to ? new Date(new Date(date.to).setHours(23,59,59,999)) : null;
        if (fromDate && paidDate < fromDate) return false;
        if (toDate && paidDate > toDate) return false;
        return true;
    }
  );

  const totalSales = paidOrdersInDateRange.reduce((total, order) => {
    const orderTotal = order.items.reduce(
      (acc, item) => acc + item.menuItem.price * item.quantity,
      0
    );
    return total + orderTotal;
  }, 0);

  const salesByDay = React.useMemo(() => {
    if (!date?.from || !date?.to) {
        return [];
    }

    const interval = eachDayOfInterval({
        start: date.from,
        end: date.to,
    });

    const dailySales = interval.map(day => ({
        date: format(day, 'dd/MM'),
        total: 0,
    }));

    paidOrdersInDateRange.forEach(order => {
        if (order.paidAt) {
            const orderDateStr = format(parseISO(order.paidAt), 'dd/MM');
            const dayData = dailySales.find(d => d.date === orderDateStr);
            if (dayData) {
                const orderTotal = order.items.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
                dayData.total += orderTotal;
            }
        }
    });

    return dailySales;
  }, [paidOrdersInDateRange, date]);


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Painel Geral</h2>
        {isAdmin && (
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
        )}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {paidOrdersInDateRange.length} {paidOrdersInDateRange.length === 1 ? 'venda no período' : 'vendas no período'}
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
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Alertas de Estoque
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems.length + outOfStockItems.length}</div>
            <Link href="/dashboard/inventory">
                <p className="text-xs text-muted-foreground hover:underline">
                  {lowStockItems.length} em alerta, {outOfStockItems.length} esgotados
                </p>
            </Link>
          </CardContent>
        </Card>
      </div>
      {isAdmin && (
        <Card>
            <CardHeader>
                <CardTitle>Vendas por Dia</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <SalesChart data={salesByDay} />
            </CardContent>
        </Card>
      )}
    </div>
  );
}
