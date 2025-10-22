
"use client";

import { useState, useEffect } from "react";
import type { Client, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stringSimilarity } from "@/lib/utils";

interface ClientFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (clientData: Omit<Client, 'id' | 'user_id'>, forceSave?: boolean) => void;
  client: Client | null;
  user: User;
  existingClients: Client[];
}

export function ClientFormDialog({ isOpen, onOpenChange, onSave, client, existingClients }: ClientFormDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [documentValue, setDocumentValue] = useState('');
  const [similarClient, setSimilarClient] = useState<Client | null>(null);

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

    const typedName = name.trim().toUpperCase();

    // Check for similarities only when creating a new client
    if (!client) {
        let bestMatch: Client | null = null;
        let highestSimilarity = 0.7; // Threshold to consider a name "similar"

        existingClients.forEach(c => {
            const similarity = stringSimilarity(typedName, c.name.toUpperCase());
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = c;
            }
        });

        if (bestMatch) {
            setSimilarClient(bestMatch);
            return; // Stop submission and show confirmation dialog
        }
    }
    
    // Proceed with saving if no similar client is found or if editing
    forceSave();
  };
  
  const forceSave = () => {
    if (!name) return;
    onSave({
      name,
      phone,
      document: documentValue,
    });
    setSimilarClient(null);
  };

  const handleConfirmSave = () => {
    onSave({
      name,
      phone,
      document: documentValue,
    }, true);
    setSimilarClient(null);
  };

  const handleCancelSave = () => {
    setSimilarClient(null);
  }

  return (
    <>
        <Dialog open={isOpen && !similarClient} onOpenChange={onOpenChange}>
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

        <AlertDialog open={!!similarClient} onOpenChange={() => setSimilarClient(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cliente com nome parecido encontrado</AlertDialogTitle>
                    <AlertDialogDescription>
                        Já existe um cliente chamado <span className="font-bold">"{similarClient?.name}"</span>. O nome que você digitou, <span className="font-bold">"{name}"</span>, é muito parecido.
                        <br /><br />
                        Você tem certeza que deseja criar um novo cliente?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancelSave}>Não, cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmSave}>Sim, criar mesmo assim</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
