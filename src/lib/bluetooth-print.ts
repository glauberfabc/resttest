
// Types for Web Bluetooth API
declare global {
    interface BluetoothRemoteGATTCharacteristic {
        properties: {
            write: boolean;
            writeWithoutResponse: boolean;
        };
        writeValue(value: BufferSource): Promise<void>;
    }

    interface BluetoothRemoteGATTService {
        getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
    }

    interface BluetoothRemoteGATTServer {
        getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
        connect(): Promise<BluetoothRemoteGATTServer>;
    }

    interface BluetoothDevice {
        gatt?: BluetoothRemoteGATTServer;
    }

    interface RequestDeviceOptions {
        filters?: Array<BluetoothLEScanFilter>;
        optionalServices?: Array<BluetoothServiceUUID>;
        acceptAllDevices?: boolean;
    }

    type BluetoothLEScanFilter = {
        services?: Array<BluetoothServiceUUID>;
        name?: string;
        namePrefix?: string;
    };

    type BluetoothServiceUUID = string | number;

    interface Bluetooth {
        requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
        getDevices(): Promise<BluetoothDevice[]>;
    }

    interface Navigator {
        bluetooth?: Bluetooth;
    }
}

export async function connectBluetoothPrinter(): Promise<any | null> {
    try {
        if (typeof window === 'undefined' || !navigator.bluetooth) {
            throw new Error("Bluetooth não suportado neste navegador.");
        }

        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: ["000018f0-0000-1000-8000-00805f9b34fb"] }, // Common Generic Access for printers
                { services: ["0000ff00-0000-1000-8000-00805f9b34fb"] }  // Custom FF00
            ],
            optionalServices: [
                "000018f0-0000-1000-8000-00805f9b34fb",
                "49535157-fe7d-4ae5-8fa9-9fafd205e455",
                "0000ff00-0000-1000-8000-00805f9b34fb",
                "0000ae30-0000-1000-8000-00805f9b34fb"
            ]
        });

        const server = await device.gatt?.connect();
        if (!server) return null;

        const services = await server.getPrimaryServices();
        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                    return char;
                }
            }
        }

        throw new Error("Não foi possível encontrar uma característica de escrita na impressora.");
    } catch (error: any) {
        console.error("Erro Bluetooth:", error);
        throw error;
    }
}

export async function printEscPos(characteristic: any, text: string) {
    const encoder = new TextEncoder();
    const init = new Uint8Array([0x1b, 0x40]); // Initialize
    const clear = new Uint8Array([0x1b, 0x61, 0x00]); // Align Left

    const data = encoder.encode(text + "\n\n\n\n");
    const cut = new Uint8Array([0x1d, 0x56, 0x41, 0x00]); // Cut

    const fullData = new Uint8Array(init.length + clear.length + data.length + cut.length);
    fullData.set(init, 0);
    fullData.set(clear, init.length);
    fullData.set(data, init.length + clear.length);
    fullData.set(cut, init.length + clear.length + data.length);

    const CHUNK_SIZE = 20;
    for (let i = 0; i < fullData.length; i += CHUNK_SIZE) {
        const chunk = fullData.slice(i, i + CHUNK_SIZE);
        await characteristic.writeValue(chunk);
    }
}

export function formatOrderForEscPos(order: any, groupedItems: any[], dailyConsumption: number, totalDebt: number, paidAmount: number): string {
    const line = "--------------------------------\n";
    let text = "\x1B\x61\x01"; // Center
    text += "\x1B\x45\x01SNOOKER BAR ARAMACAN\x1B\x45\x00\n";
    text += "COMPROVANTE DE CONTA\n\n";

    text += "\x1B\x61\x00"; // Left
    text += `CLIENTE: ${order.identifier}\n`;
    if (order.customer_name) text += `OBS: ${order.customer_name}\n`;
    text += `DATA: ${new Date().toLocaleString('pt-BR')}\n`;
    text += line;

    groupedItems.forEach(item => {
        const name = item.menuItem.name.substring(0, 18);
        const qty = item.quantity.toString().padStart(2);
        const price = (item.menuItem.price * item.quantity).toFixed(2).replace('.', ',');
        text += `${qty}x ${name.padEnd(18)} R$ ${price.padStart(7)}\n`;
        if (item.comment) text += `   * ${item.comment}\n`;
    });

    text += line;
    text += `TOTAL DO DIA:       R$ ${dailyConsumption.toFixed(2).replace('.', ',').padStart(10)}\n`;

    if (paidAmount > 0) {
        text += `TOTAL PAGO HOJE:    R$ ${paidAmount.toFixed(2).replace('.', ',').padStart(10)}\n`;
    }

    const finalValue = Math.abs(totalDebt);
    text += `\x1B\x45\x01TOTAL GERAL:        R$ ${finalValue.toFixed(2).replace('.', ',').padStart(10)}\x1B\x45\x00\n`;

    text += "\n\n\n";
    return text;
}
