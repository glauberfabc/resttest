
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

// Lista de UUIDs de serviço conhecidos para impressoras Bluetooth térmicas.
// Inclui o padrão SPP e outros comuns encontrados em vários modelos.
const PRINTER_SERVICE_UUIDS = [
  '00001101-0000-1000-8000-00805f9b34fb', // Padrão Serial Port Profile (SPP)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Comum em impressoras genéricas
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // Outro UUID genérico
  '49535343-fe7d-4ae5-8fa9-9fafd205e455'  // Usado por alguns modelos MTP
];

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
              acceptAllDevices: true,
              optionalServices: PRINTER_SERVICE_UUIDS
          });
          deviceCache = device;
          deviceCache.addEventListener('gattserverdisconnected', () => {
              setIsConnected(false);
              characteristicCache = null;
              deviceCache = null;
              toast({ title: 'Impressora Desconectada', description: 'A conexão com a impressora foi perdida.' });
          });
      }
      
      const server = await deviceCache.gatt?.connect();
      if (!server) throw new Error("Não foi possível conectar ao servidor GATT.");

      let primaryService = null;
      for (const uuid of PRINTER_SERVICE_UUIDS) {
        try {
          primaryService = await server.getPrimaryService(uuid);
          if (primaryService) break; // Encontrou um serviço válido
        } catch (error) {
           // Ignora o erro se o serviço não for encontrado, e tenta o próximo
        }
      }

      if (!primaryService) {
        throw new Error("Nenhum serviço de impressão compatível encontrado no dispositivo.");
      }

      const characteristics = await primaryService.getCharacteristics();
      const writableCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);

      if (!writableCharacteristic) {
        throw new Error("Nenhuma característica de escrita encontrada na impressora.");
      }
      
      characteristicCache = writableCharacteristic;
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
