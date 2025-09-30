
"use client";

import { useState, useEffect } from "react";
import type { Client } from "@/lib/types";
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

interface ClientFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (clientData: Omit<Client, 'id' | 'user_id'>) => void;
  client: Client | null;
}

export function ClientFormDialog({ isOpen, onOpenChange, onSave, client }: ClientFormDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [documentValue, setDocumentValue] = useState('');

  useEffect(() => {
    if (client) {
      setName(client.name);
      setPhone(client.phone || '');
      setDocumentValue(client.document || '');
    } else {
      setName('');
      setPhone('');
      setDocumentValue('');
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    onSave({
      name,
      phone,
      document: documentValue,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nome</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Telefone</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="document" className="text-right">Documento</Label>
                <Input id="document" value={documentValue} onChange={e => setDocumentValue(e.target.value)} className="col-span-3" />
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
