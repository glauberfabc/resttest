
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type UserRole = 'admin' | 'collaborator';

interface User {
  email: string;
  name: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  login: (credentials: { email: string; password?: string }) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const mockUsers = {
  "admin@comandazap.com": { name: "Administrador", role: "admin" as UserRole },
  "colab@comandazap.com": { name: "Colaborador", role: "collaborator" as UserRole },
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    // On mount, check if user data exists in sessionStorage
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // If no user and not on the login page, redirect
      if (window.location.pathname !== '/') {
        router.push('/');
      }
    }
  }, [router]);

  const login = (credentials: { email: string; password?: string }) => {
    // This is a mock login. In a real app, you'd validate credentials.
    const foundUser = mockUsers[credentials.email as keyof typeof mockUsers];
    if (foundUser) {
      const userData: User = {
        email: credentials.email,
        name: foundUser.name,
        role: foundUser.role,
      };
      setUser(userData);
      sessionStorage.setItem('user', JSON.stringify(userData));
    } else {
      // Handle failed login
      console.error("Login failed: User not found");
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    router.push('/');
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
