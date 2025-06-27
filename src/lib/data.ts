import type { MenuItem, Order } from './types';

export const menuItems: MenuItem[] = [
  { id: '1', name: 'X-Bacon', description: 'Pão, hambúrguer, queijo, bacon, alface e tomate.', price: 25.50, category: 'Lanches', imageUrl: 'https://placehold.co/100x100' },
  { id: '2', name: 'Batata Frita com Bacon', description: 'Porção generosa de batata frita com bacon e cheddar.', price: 35.00, category: 'Porções', imageUrl: 'https://placehold.co/100x100' },
  { id: '3', name: 'Coca-Cola 600ml', description: 'Refrigerante Coca-Cola, garrafa de 600ml.', price: 8.00, category: 'Bebidas', imageUrl: 'https://placehold.co/100x100' },
  { id: '4', name: 'Cerveja Heineken 600ml', description: 'Cerveja Pilsen, garrafa de 600ml.', price: 15.00, category: 'Bebidas', imageUrl: 'https://placehold.co/100x100' },
  { id: '5', name: 'Coxinha de Frango', description: 'Salgado frito com recheio de frango cremoso.', price: 7.50, category: 'Salgados', imageUrl: 'https://placehold.co/100x100' },
  { id: '6', name: 'Filé a Parmegiana', description: 'Bife à milanesa, coberto com molho de tomate e queijo.', price: 45.00, category: 'Pratos Quentes', imageUrl: 'https://placehold.co/100x100' },
  { id: '7', name: 'Salada Caesar', description: 'Alface, croutons, queijo parmesão e molho Caesar.', price: 28.00, category: 'Saladas', imageUrl: 'https://placehold.co/100x100' },
  { id: '8', name: 'Dose de Jack Daniel\'s', description: 'Whisky Jack Daniel\'s Old No. 7.', price: 22.00, category: 'Destilados', imageUrl: 'https://placehold.co/100x100' },
  { id: '9', name: 'Caipirinha de Limão', description: 'Cachaça, limão, açúcar e gelo.', price: 18.00, category: 'Caipirinhas', imageUrl: 'https://placehold.co/100x100' },
  { id: '10', name: 'Café Espresso', description: 'Café forte e encorpado.', price: 6.00, category: 'Bebidas Quentes', imageUrl: 'https://placehold.co/100x100' },
];

export const initialOrders: Order[] = [
  {
    id: 'order-1',
    type: 'table',
    identifier: 5,
    status: 'open',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    items: [
      { menuItem: menuItems.find(i => i.id === '1')!, quantity: 1 },
      { menuItem: menuItems.find(i => i.id === '3')!, quantity: 2 },
      { menuItem: menuItems.find(i => i.id === '2')!, quantity: 1 },
    ],
    payments: [],
  },
  {
    id: 'order-2',
    type: 'name',
    identifier: 'João Silva',
    status: 'open',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    items: [
      { menuItem: menuItems.find(i => i.id === '4')!, quantity: 4 },
      { menuItem: menuItems.find(i => i.id === '5')!, quantity: 2 },
    ],
    payments: [],
  },
  {
    id: 'order-3',
    type: 'table',
    identifier: 12,
    status: 'paying',
    createdAt: new Date().toISOString(),
    items: [
      { menuItem: menuItems.find(i => i.id === '9')!, quantity: 2 },
      { menuItem: menuItems.find(i => i.id === '8')!, quantity: 1 },
    ],
    payments: [],
  },
  {
    id: 'order-4',
    type: 'name',
    identifier: 'Ana Paula',
    status: 'paid',
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), // yesterday
    paidAt: new Date(Date.now() - 86400000 * 1 + 10000).toISOString(),
    items: [
      { menuItem: menuItems.find(i => i.id === '6')!, quantity: 1 },
      { menuItem: menuItems.find(i => i.id === '3')!, quantity: 1 },
    ],
    payments: [{ amount: 53.00, method: 'Crédito', paidAt: new Date(Date.now() - 86400000 * 1 + 10000).toISOString()}],
  },
  {
    id: 'order-5',
    type: 'table',
    identifier: 8,
    status: 'paid',
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    items: [
      { menuItem: menuItems.find(i => i.id === '1')!, quantity: 2 },
    ],
    payments: [{ amount: 51.00, method: 'Débito', paidAt: new Date().toISOString()}],
  },
  {
    id: 'order-6',
    type: 'table',
    identifier: 3,
    status: 'paid',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    paidAt: new Date(Date.now() - 86400000 * 5 + 10000).toISOString(),
    items: [
      { menuItem: menuItems.find(i => i.id === '7')!, quantity: 1 },
      { menuItem: menuItems.find(i => i.id === '9')!, quantity: 1 },
    ],
    payments: [{ amount: 46.00, method: 'Dinheiro', paidAt: new Date(Date.now() - 86400000 * 5 + 10000).toISOString()}],
  }
];
