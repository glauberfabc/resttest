

export type MenuItemCategory = "Lanches" | "Porções" | "Bebidas" | "Sucos" | "Salgados" | "Pratos Quentes" | "Saladas" | "Destilados" | "Caipirinhas" | "Bebidas Quentes" | "Adicional" | "Água - Refrigerante" | "Cervejas";

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
  user_id: string;
}

export interface OrderItem {
  id?: string; // Unique identifier for the item within the order
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
  items: OrderItem[];
  status: 'open' | 'paying' | 'paid';
  created_at: string;
  paid_at?: string;
  payments?: Payment[];
  user_id: string;
  // Compatibility with frontend components that might use camelCase
  createdAt?: string;
  paidAt?: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  document?: string;
  user_id: string;
}

    