
"use client";

import { useState, useEffect } from "react";
import type { User } from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserFormDialog } from "@/components/dashboard/users/user-form-dialog";

interface UsersPageClientProps {
  initialUsers: User[];
  currentUser: User;
}

export default function UsersPageClient({ initialUsers, currentUser }: UsersPageClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

   useEffect(() => {
    const fetchUsers = async () => {
        const { data, error } = await supabase.from('profiles').select('*');
        if (data) {
            setUsers(data as User[]);
        }
    };
    fetchUsers();
  }, [supabase]);

  const handleSaveUser = async (userData: Partial<User>, password?: string) => {
    if (selectedUser) { // Editing
        const { error } = await supabase
            .from('profiles')
            .update({ name: userData.name, role: userData.role })
            .eq('id', selectedUser.id);
        
        if (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o usuário.' });
        } else {
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, name: userData.name!, role: userData.role! } : u));
            toast({ title: 'Sucesso', description: 'Usuário atualizado.' });
        }
    } else { // Creating
        if (!userData.email || !password) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Email e senha são obrigatórios para criar um novo usuário.' });
            return;
        }
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: userData.email,
            password: password,
            options: {
                data: {
                    name: userData.name,
                    role: userData.role,
                }
            }
        });

        if (authError) {
            toast({ variant: 'destructive', title: 'Erro de Autenticação', description: authError.message });
            return;
        }

        if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    name: userData.name!,
                    role: userData.role!,
                    email: userData.email,
                });
            
            if (profileError) {
                toast({ variant: 'destructive', title: 'Erro de Perfil', description: 'Não foi possível criar o perfil para o novo usuário.' });
            } else {
                setUsers([...users, { id: authData.user.id, email: userData.email, name: userData.name!, role: userData.role! }]);
                toast({ title: 'Sucesso!', description: 'Novo usuário criado.' });
            }
        }
    }
    setIsFormOpen(false);
    setSelectedUser(null);
  };


  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (userId: string) => {
    // This is a complex operation and requires admin privileges on the Supabase project to delete users.
    // For this example, we will just delete the profile, which will orphan the auth user.
    // A better approach would be a serverless function.
     toast({
      variant: "destructive",
      title: "Função não implementada",
      description: "A exclusão de usuários deve ser feita no painel do Supabase para garantir a integridade.",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Gerenciar Usuários</h2>
        <Button onClick={handleAddNew} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Usuário
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Nome</TableHead>
              <TableHead className="whitespace-nowrap">Email</TableHead>
              <TableHead className="whitespace-nowrap">Função</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium whitespace-nowrap">{user.name}</TableCell>
                <TableCell className="whitespace-nowrap">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.id === currentUser.id}>
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(user.id)}>
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
        <UserFormDialog
          isOpen={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSave={handleSaveUser}
          user={selectedUser}
        />
      )}
    </div>
  );
}

    