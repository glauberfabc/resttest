
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

// Standard Bluetooth Service UUIDs for serial port profile (common in printers)
const PRINTER_SERVICE_UUID = '00001101-0000-1000-8000-00805f9b34fb';

let deviceCache: BluetoothDevice | null = null;
let characteristicCache: BluetoothRemoteGATTCharacteristic | null = null;

export function useBluetoothPrinter() {
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'bluetooth' in navigator) {
      setIsSupported(true);
      if (deviceCache && deviceCache.gatt?.connected) {
          setIsConnected(true);
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (!isSupported) {
      toast({ variant: 'destructive', title: 'Não suportado', description: 'O seu navegador não suporta Bluetooth.' });
      return;
    }

    setIsConnecting(true);
    try {
      if (!deviceCache) {
          const device = await navigator.bluetooth.requestDevice({
              filters: [{ services: [PRINTER_SERVICE_UUID] }],
              optionalServices: [PRINTER_SERVICE_UUID]
          });
          deviceCache = device;
          deviceCache.addEventListener('gattserverdisconnected', () => {
              setIsConnected(false);
              characteristicCache = null;
              toast({ title: 'Impressora Desconectada', description: 'A conexão com a impressora foi perdida.' });
          });
      }
      
      const server = await deviceCache.gatt?.connect();
      if (!server) throw new Error("Não foi possível conectar ao servidor GATT.");

      const services = await server.getPrimaryServices();
       if (!services.length) {
        throw new Error("Nenhum serviço encontrado na impressora.");
      }

      let foundWritableCharacteristic = false;
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        const writableCharacteristic = characteristics.find(c => c.properties.writeWithoutResponse || c.properties.write);

        if (writableCharacteristic) {
          characteristicCache = writableCharacteristic;
          foundWritableCharacteristic = true;
          break; // Exit loop once we find a writable characteristic
        }
      }

      if (!foundWritableCharacteristic) {
        throw new Error("Nenhuma característica de escrita encontrada na impressora.");
      }
      
      setIsConnected(true);
      toast({ title: 'Impressora Conectada!', description: `Conectado a ${deviceCache.name || 'dispositivo'}.` });
    } catch (error: any) {
      console.error('Erro ao conectar Bluetooth:', error);
      toast({ variant: 'destructive', title: 'Erro de Conexão', description: error.message });
      deviceCache = null;
      characteristicCache = null;
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isSupported, toast]);

  const disconnect = useCallback(() => {
    if (deviceCache && deviceCache.gatt?.connected) {
      deviceCache.gatt.disconnect();
      deviceCache = null;
      characteristicCache = null;
      setIsConnected(false);
      toast({ title: 'Impressora Desconectada' });
    }
  }, [toast]);

  const print = useCallback(async (text: string) => {
    if (!isConnected || !characteristicCache) {
      toast({ variant: 'destructive', title: 'Não conectado', description: 'Conecte-se a uma impressora primeiro.' });
      return;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text + '\n\n\n'); // Add some newlines to eject the paper
      
      const CHUNK_SIZE = 100; // Chunk size for splitting data
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        // Use writeWithoutResponse if available, otherwise fall back to write
        if (characteristicCache.properties.writeWithoutResponse) {
            await characteristicCache.writeValueWithoutResponse(chunk);
        } else {
            await characteristicCache.writeValue(chunk);
        }
      }
      
      toast({ title: 'Imprimindo...', description: 'Dados enviados para a impressora.' });
    } catch (error: any) {
      console.error('Erro ao imprimir:', error);
      toast({ variant: 'destructive', title: 'Erro de Impressão', description: error.message });
    }
  }, [isConnected, toast]);
  

  return { isSupported, isConnecting, isConnected, connect, disconnect, print };
}
