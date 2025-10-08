
"use client";

import { useState, useEffect } from "react";
import type { OrderItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface CommentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (comment: string) => void;
  item: OrderItem;
}

export function CommentDialog({ isOpen, onOpenChange, onSave, item }: CommentDialogProps) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (item) {
      setComment(item.comment || "");
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(comment);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Observação</DialogTitle>
          <DialogDescription>
            Adicione uma observação para o item: <span className="font-semibold">{item.menuItem.name}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <Textarea 
                value={comment} 
                onChange={e => setComment(e.target.value)}
                placeholder="Ex: Sem gelo, com limão, ponto da carne..."
                rows={3}
            />
             <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
