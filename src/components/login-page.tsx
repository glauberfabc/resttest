"use client";

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
import { ComandaZapLogo } from "@/components/icons";

export function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#D0BCFF_1px,transparent_1px),linear-gradient(to_bottom,#D0BCFF_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20"></div>
      
      <div className="mb-8 flex items-center gap-3 text-2xl font-bold text-primary">
        <ComandaZapLogo className="h-10 w-10" />
        <h1 className="text-3xl font-bold">ComandaZap</h1>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Entre com suas credenciais de funcionário ou administrador.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                defaultValue="admin@comandazap.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                defaultValue="123456"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">
              Entrar
            </Button>
            <Button variant="outline" className="w-full">
              Entrar com Google
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
