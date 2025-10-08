
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface CommentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (comment: string) => void;
  initialComment: string;
}

export function CommentDialog({ isOpen, onOpenChange, onSave, initialComment }: CommentDialogProps) {
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    setComment(initialComment);
  }, [initialComment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(comment);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar/Editar Observação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: sem cebola, ponto da carne, etc."
            className="min-h-[100px]"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
