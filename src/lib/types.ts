export type MenuItemCategory = "Lanches" | "Porções" | "Bebidas" | "Salgados" | "Pratos Quentes" | "Saladas" | "Destilados" | "Caipirinhas" | "Bebidas Quentes";

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
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface Payment {
    amount: number;
    method: string;
    paidAt: string;
}

export interface Order {
  id: string;
  type: 'table' | 'name';
  identifier: string | number;
  items: OrderItem[];
  status: 'open' | 'paying' | 'paid';
  createdAt: string;
  paidAt?: string;
  payments?: Payment[];
}
