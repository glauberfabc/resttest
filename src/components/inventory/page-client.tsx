
"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { StockEditDialog } from "./stock-edit-dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface InventoryPageClientProps {
  initialMenuItems: MenuItem[];
}

export default function InventoryPageClient({ initialMenuItems }: InventoryPageClientProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { toast } = useToast();

  const getStockStatus = (item: MenuItem): { text: string; variant: "default" | "destructive" | "secondary" | "outline" } => {
    if (item.stock === undefined || (item.stock === 0 && (item.lowStockThreshold === undefined || item.lowStockThreshold === 0))) {
      return { text: "Não gerenciado", variant: "secondary" };
    }
    if (item.stock <= 0) {
      return { text: "Esgotado", variant: "destructive" };
    }
    if (item.lowStockThreshold && item.stock <= item.lowStockThreshold) {
      return { text: "Estoque Baixo", variant: "outline" };
    }
    return { text: "Em Estoque", variant: "default" };
  };

  const handleEdit = (item: MenuItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleSave = async (updatedItem: MenuItem) => {
    const { data, error } = await supabase
        .from('menu_items')
        .update({
            stock: updatedItem.stock,
            low_stock_threshold: updatedItem.lowStockThreshold,
        })
        .eq('id', updatedItem.id)
        .select()
        .single();
    
    if (error || !data) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível atualizar o estoque." });
    } else {
        const remappedData = { ...data, imageUrl: data.image_url, lowStockThreshold: data.low_stock_threshold };
        setMenuItems(menuItems.map(item => item.id === remappedData.id ? remappedData : item));
        toast({ title: "Sucesso", description: "Estoque atualizado."});
    }

    setIsFormOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Controle de Estoque</h2>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="w-[150px] text-right">Qtd. em Estoque</TableHead>
              <TableHead className="w-[100px]">Unidade</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {menuItems.map((item) => {
              const status = getStockStatus(item);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">
                    {item.stock !== undefined && status.variant !== 'secondary' ? item.stock : "-"}
                  </TableCell>
                  <TableCell>{item.unit || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.text}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {isFormOpen && selectedItem && (
        <StockEditDialog
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
          item={selectedItem}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
