"use client";

import { useState } from "react";
import Image from "next/image";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Pencil, Trash2 } from "lucide-react";
import { MenuFormDialog } from "@/components/menu/menu-form-dialog";
import { Badge } from "@/components/ui/badge";

interface MenuPageClientProps {
  initialMenuItems: MenuItem[];
}

export default function MenuPageClient({ initialMenuItems }: MenuPageClientProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const handleSaveItem = (item: MenuItem) => {
    if (selectedItem) {
      setMenuItems(menuItems.map(i => i.id === item.id ? item : i));
    } else {
      setMenuItems([{ ...item, id: `item-${Date.now()}` }, ...menuItems]);
    }
    setSelectedItem(null);
    setIsFormOpen(false);
  };

  const handleEdit = (item: MenuItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };
  
  const handleAddNew = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  }

  const handleDelete = (itemId: string) => {
    setMenuItems(menuItems.filter(i => i.id !== itemId));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Gerenciar Cardápio</h2>
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Item
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Imagem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead className="w-[50px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {menuItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Image
                    src={item.imageUrl || "https://placehold.co/64x64"}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="rounded-md"
                    data-ai-hint="food drink"
                  />
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                    <Badge variant="secondary">{item.category}</Badge>
                </TableCell>
                <TableCell>R$ {item.price.toFixed(2).replace('.', ',')}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(item)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {isFormOpen && (
        <MenuFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveItem}
            item={selectedItem}
        />
      )}
    </div>
  );
}
