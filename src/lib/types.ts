export type MenuItemCategory = "Lanches" | "Porções" | "Bebidas" | "Salgados" | "Pratos Quentes" | "Saladas" | "Destilados" | "Caipirinhas" | "Bebidas Quentes" | "Adicional";

export interface MenuItem {
  id: string;
  name: string;
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
  menuItem: MenuItem;
  quantity: number;
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
