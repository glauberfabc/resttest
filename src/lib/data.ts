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
    items: [
      { menuItem: menuItems.find(i => i.id === '1')!, quantity: 1 },
      { menuItem: menuItems.find(i => i.id === '3')!, quantity: 2 },
      { menuItem: menuItems.find(i => i.id === '2')!, quantity: 1 },
    ],
  },
  {
    id: 'order-2',
    type: 'name',
    identifier: 'João Silva',
    status: 'open',
    items: [
      { menuItem: menuItems.find(i => i.id === '4')!, quantity: 4 },
      { menuItem: menuItems.find(i => i.id === '5')!, quantity: 2 },
    ],
  },
  {
    id: 'order-3',
    type: 'table',
    identifier: 12,
    status: 'paying',
    items: [
      { menuItem: menuItems.find(i => i.id === '9')!, quantity: 2 },
      { menuItem: menuItems.find(i => i.id === '8')!, quantity: 1 },
    ],
  }
];
