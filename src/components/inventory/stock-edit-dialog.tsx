
"use client";

import { useState, useEffect } from "react";
import type { MenuItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StockEditDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (item: MenuItem) => void;
  item: MenuItem;
}

export function StockEditDialog({ isOpen, onOpenChange, onSave, item }: StockEditDialogProps) {
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    if (item) {
      setStock(item.stock?.toString() || "0");
      setThreshold(item.lowStockThreshold?.toString() || "0");
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedItem: MenuItem = {
      ...item,
      stock: parseInt(stock, 10) || 0,
      lowStockThreshold: parseInt(threshold, 10) || 0,
    };
    onSave(updatedItem);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Estoque</DialogTitle>
          <DialogDescription>
            Atualize a quantidade em estoque para: <span className="font-semibold">{item.name}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stock-quantity" className="text-right">
              Quantidade
            </Label>
            <Input
              id="stock-quantity"
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stock-threshold" className="text-right">
              Alerta de Mínimo
            </Label>
            <Input
              id="stock-threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="col-span-3"
            />
          </div>
           <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
