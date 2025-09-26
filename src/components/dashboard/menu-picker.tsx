"use client";

import { useState } from "react";
import Image from "next/image";
import type { MenuItem, MenuItemCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";

interface MenuPickerProps {
  menuItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const categories: MenuItemCategory[] = [
  "Lanches", "Porções", "Bebidas", "Salgados", "Pratos Quentes", "Saladas", "Destilados", "Caipirinhas", "Bebidas Quentes", "Adicional"
];

export function MenuPicker({ menuItems, onAddItem, isOpen, onOpenChange }: MenuPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<MenuItemCategory | "Todos">("Todos");

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === "Todos" || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl">Adicionar Itens ao Pedido</DialogTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar no cardápio..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </DialogHeader>

        <div className="px-6">
            <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as MenuItemCategory | "Todos")}>
                <TabsList className="whitespace-nowrap">
                    <ScrollArea orientation="horizontal" className="w-full pb-2">
                        <div className="flex gap-2">
                            <TabsTrigger value="Todos">Todos</TabsTrigger>
                            {categories.map(cat => (
                                <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsList>
            </Tabs>
        </div>

        <ScrollArea className="flex-1 px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4">
                {filteredItems.map(item => (
                <div key={item.id} className="border rounded-lg p-3 flex flex-col items-start gap-2 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onAddItem(item)}>
                    <Image
                    src={item.imageUrl || 'https://placehold.co/200x200'}
                    alt={item.name}
                    width={200}
                    height={200}
                    className="w-full h-32 object-cover rounded-md"
                    data-ai-hint="food drink"
                    />
                    <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex justify-between items-center w-full mt-2">
                        <p className="font-bold text-primary">R$ {item.price.toFixed(2).replace('.', ',')}</p>
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onAddItem(item); }}>Adicionar</Button>
                    </div>
                </div>
                ))}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
