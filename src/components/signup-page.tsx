
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SnookerBarLogo } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: "Erro", description: "As senhas não coincidem." });
      return;
    }
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: signUpError.message });
      setLoading(false);
      return;
    }
    
    if (signUpData.user) {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: signUpData.user.id,
                name: name,
                role: 'collaborator' // Default role
            });

        if (profileError) {
            toast({ variant: 'destructive', title: 'Erro Crítico', description: 'A conta foi criada, mas o perfil não. Contate o suporte.' });
            // Optionally, delete the user if profile creation fails
            await supabase.auth.signOut(); 
        } else {
            toast({ title: 'Cadastro realizado!', description: 'Faça o login para continuar.' });
            router.push("/");
        }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#D0BCFF_1px,transparent_1px),linear-gradient(to_bottom,#D0BCFF_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>
      
      <div className="mb-8 flex items-center gap-3 text-2xl font-bold text-primary">
        <SnookerBarLogo className="h-10 w-10" />
        <h1 className="text-3xl font-bold">Snooker Bar</h1>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Cadastro</CardTitle>
          <CardDescription>
            Crie sua conta para começar.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
            <div className="text-center text-sm">
                Já tem uma conta?{" "}
                <Link href="/" className="underline">
                    Faça Login
                </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
