
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import type { MenuItem, User } from "@/lib/types";
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
import { MoreHorizontal, PlusCircle, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { MenuFormDialog } from "@/components/menu/menu-form-dialog";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MenuPageClientProps {
  initialMenuItems: MenuItem[];
}

type SortKey = 'name' | 'code';

export default function MenuPageClient({ initialMenuItems: initialMenuItemsProp }: MenuPageClientProps) {
  const [user, setUser] = useState<User | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItemsProp);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { toast } = useToast();
  const supabase = createClient();
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });


  useEffect(() => {
    const fetchData = async () => {
        const { data, error } = await supabase.from('menu_items').select('*');
        if (data) {
          const formattedItems = data.map(item => ({ ...item, id: item.id || crypto.randomUUID(), code: item.code, imageUrl: item.image_url, lowStockThreshold: item.low_stock_threshold })) as unknown as MenuItem[];
          setMenuItems(formattedItems);
        }

        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser) {
           const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', supabaseUser.id).single();
           if(profile) {
             const { data: { user: supaUser } } = await supabase.auth.getUser();
              if(!supaUser) return;
             setUser({ id: supaUser.id, email: supaUser.email!, name: profile.name, role: profile.role });
           }
        }
    };

    fetchData();
  }, [supabase]);

  const sortedMenuItems = useMemo(() => {
    const sortableItems = [...menuItems];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const aValue = a[sortConfig.key as keyof MenuItem] || '';
            const bValue = b[sortConfig.key as keyof MenuItem] || '';

            // Ensure consistent type for comparison, especially for 'code' which can be null
            const valA = String(aValue).toLowerCase();
            const valB = String(bValue).toLowerCase();

            if (valA < valB) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
    return sortableItems;
  }, [menuItems, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  const handleSaveItem = async (item: MenuItem) => {
    
    if (!user) {
        toast({ variant: 'destructive', title: "Erro", description: "Você não está logado." });
        return;
    }

    if (selectedItem) { // Editing existing item
      const itemForDbUpdate = {
          name: item.name,
          code: item.code,
          description: item.description,
          price: item.price,
          category: item.category,
          image_url: item.imageUrl,
          stock: item.stock,
          low_stock_threshold: item.lowStockThreshold,
          unit: item.unit,
      };

      const { data, error } = await supabase
        .from('menu_items')
        .update(itemForDbUpdate)
        .eq('id', item.id)
        .select()
        .maybeSingle();
      
      if (error) {
        toast({ variant: 'destructive', title: "Erro ao atualizar", description: "Não foi possível atualizar o item: " + error.message });
      } else if (data) {
        const remappedData = { ...data, imageUrl: data.image_url, lowStockThreshold: data.low_stock_threshold, user_id: data.user_id };
        setMenuItems(menuItems.map(i => i.id === remappedData.id ? remappedData : i));
        toast({ title: "Sucesso!", description: "Item do cardápio atualizado." });
      }

    } else { // Adding new item
       const itemForDbInsert = {
          name: item.name,
          code: item.code,
          description: item.description,
          price: item.price,
          category: item.category,
          image_url: item.imageUrl,
          stock: item.stock,
          low_stock_threshold: item.lowStockThreshold,
          unit: item.unit,
          user_id: user.id,
      };

      const { data, error } = await supabase
        .from('menu_items')
        .insert(itemForDbInsert)
        .select()
        .single();

      if (error) {
        toast({ variant: 'destructive', title: "Erro ao adicionar", description: "Não foi possível adicionar o item: " + error.message });
      } else {
        const remappedData = { ...data, imageUrl: data.image_url, lowStockThreshold: data.low_stock_threshold, user_id: data.user_id };
        setMenuItems([remappedData, ...menuItems]);
        toast({ title: "Sucesso!", description: "Novo item adicionado ao cardápio." });
      }
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

  const handleDelete = async (itemId: string) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId);

    if (error) {
        toast({ variant: 'destructive', title: "Erro", description: "Não foi possível excluir o item." });
    } else {
        setMenuItems(menuItems.filter(i => i.id !== itemId));
        toast({ title: "Sucesso!", description: "Item excluído." });
    }
  };

  const renderSortArrow = (key: SortKey) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Gerenciar Cardápio</h2>
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Item
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Imagem</TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => requestSort('name')} className="px-0 hover:bg-transparent whitespace-nowrap">
                  Nome
                  {renderSortArrow('name')}
                </Button>
              </TableHead>
              <TableHead>
                 <Button variant="ghost" onClick={() => requestSort('code')} className="px-0 hover:bg-transparent whitespace-nowrap">
                  Código
                  {renderSortArrow('code')}
                </Button>
              </TableHead>
              <TableHead className="whitespace-nowrap">Categoria</TableHead>
              <TableHead className="whitespace-nowrap">Preço</TableHead>
              <TableHead className="w-[50px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMenuItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Image
                    src={item.imageUrl || "https://picsum.photos/seed/placeholder/64/64"}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="rounded-md object-cover w-16 h-16"
                    data-ai-hint="food drink"
                  />
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{item.name}</TableCell>
                <TableCell className="whitespace-nowrap">{item.code || "-"}</TableCell>
                <TableCell>
                    <Badge variant="secondary" className="whitespace-nowrap">{item.category}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">R$ {item.price.toFixed(2).replace('.', ',')}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={!user}>
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
      
      {isFormOpen && user && (
        <MenuFormDialog
            isOpen={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveItem}
            item={selectedItem}
            user={user}
        />
      )}
    </div>
  );
}

    