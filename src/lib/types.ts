
export type MenuItemCategory = "Lanches" | "Adicional" | "Porções" | "Salgados" | "Pratos Quentes" | "Saladas" | "Bebidas" | "Sucos" | "Bebidas Quentes" | "Cervejas" | "Caipirinhas" | "Destilados" | "Doces" | "Caldos";

export interface MenuItem {
  id: string;
  name: string;
  code?: string;
  description: string;
  price: number;
  category: MenuItemCategory;
  imageUrl?: string;
  stock?: number;
  lowStockThreshold?: number;
  unit?: string;
  user_id?: string;
}

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  comment: string;
}

export interface Payment {
    id: string;
    order_id: string;
    amount: number;
    method: string;
    paid_at: string;
}

export interface Order {
  id: string;
  type: 'table' | 'name';
  identifier: string | number;
  customer_name?: string | null;
  items: OrderItem[];
  status: 'open' | 'paying' | 'paid';
  created_at: Date;
  paid_at?: Date;
  payments?: Payment[];
  user_id: string;
  // Compatibility with frontend components that might use camelCase
  createdAt?: Date;
  paidAt?: Date;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  document?: string;
  user_id?: string;
}

export interface ClientCredit {
  id: string;
  client_id: string;
  amount: number;
  method: string;
  created_at: Date;
  user_id: string;
}

export type UserRole = 'admin' | 'collaborator';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
