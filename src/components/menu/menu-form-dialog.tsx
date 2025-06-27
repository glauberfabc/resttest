"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { MenuItem, MenuItemCategory } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface MenuFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (item: MenuItem) => void;
  item: MenuItem | null;
}

const categories: MenuItemCategory[] = [
  "Lanches", "Porções", "Bebidas", "Salgados", "Pratos Quentes", "Saladas", "Destilados", "Caipirinhas", "Bebidas Quentes"
];

export function MenuFormDialog({ isOpen, onOpenChange, onSave, item }: MenuFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<MenuItemCategory | ''>('');
  const [imageUrl, setImageUrl] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description);
      setPrice(String(item.price));
      setCategory(item.category);
      setImageUrl(item.imageUrl || '');
    } else {
        setName('');
        setDescription('');
        setPrice('');
        setCategory('');
        setImageUrl('');
    }
  }, [item]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024 * 2) { // 2MB limit
        toast({
            variant: 'destructive',
            title: 'Imagem muito grande',
            description: 'Por favor, selecione uma imagem com menos de 2MB.'
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !category) return;
    
    const savedItem: MenuItem = {
      id: item?.id || '', // ID will be generated in parent if new
      name,
      description,
      price: parseFloat(price),
      category,
      imageUrl,
    };
    onSave(savedItem);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item' : 'Adicionar Novo Item'}</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do item do cardápio.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nome</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Descrição</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">Preço</Label>
                <Input id="price" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="col-span-3" required/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">Categoria</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as MenuItemCategory)} required>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="image-upload" className="text-right">Imagem</Label>
                <Input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} className="col-span-3" />
            </div>
            {imageUrl && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <div/>
                    <div className="col-span-3">
                        <Image src={imageUrl} alt="Pré-visualização" width={100} height={100} className="rounded-md object-cover" />
                    </div>
                </div>
            )}
             <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
