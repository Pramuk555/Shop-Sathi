// ESC/POS Bluetooth Thermal Printer Service
// Works with: Xprinter XP-58IIK BT, Rongta RPP300, most cheap BLE thermal printers

const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common thermal printer service
  '6e400001-b5b3-f393-e0a9-e50e24dcca9e', // Nordic UART (used by many BLE printers)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip BM70
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic serial
];

const WRITE_CHAR_UUIDS = [
  '000018f1-0000-1000-8000-00805f9b34fb',
  '6e400002-b5b3-f393-e0a9-e50e24dcca9e',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff01-0000-1000-8000-00805f9b34fb',
];

// ESC/POS command helpers
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const cmd = (...bytes) => new Uint8Array(bytes);

const INIT        = cmd(ESC, 0x40);
const CENTER      = cmd(ESC, 0x61, 0x01);
const LEFT        = cmd(ESC, 0x61, 0x00);
const BOLD_ON     = cmd(ESC, 0x45, 0x01);
const BOLD_OFF    = cmd(ESC, 0x45, 0x00);
const DOUBLE_SIZE = cmd(GS,  0x21, 0x11); // 2x width + 2x height
const NORMAL_SIZE = cmd(GS,  0x21, 0x00);
const FEED_CUT    = cmd(GS,  0x56, 0x42, 0x05); // Feed 5mm and cut
const FEED_3      = cmd(ESC, 0x64, 0x03); // Feed 3 lines

const encodeText = (text) => {
  const encoder = new TextEncoder();
  return encoder.encode(text + '\n');
};

const DASH_LINE = () => encodeText('--------------------------------');
const DOT_LINE  = () => encodeText('- - - - - - - - - - - - - - - -');

// Format a left+right justified line (32 chars wide for 58mm)
const justifyLine = (left, right, width = 32) => {
  const spaces = width - left.length - right.length;
  return encodeText(left + ' '.repeat(Math.max(1, spaces)) + right);
};

// Merge multiple Uint8Arrays into one
const merge = (...arrays) => {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
};

// Build the full ESC/POS receipt
export const buildReceipt = (bill) => {
  const {
    shopName = 'ShopSaathi Store',
    shopAddress = '',
    shopPhone = '',
    shopUpi = '',
    gstNumber = '',
    billNumber,
    customerName,
    customerPhone,
    paymentMode = 'cash',
    items = [],
    subtotal = 0,
    cgst = 0,
    sgst = 0,
    gstEnabled = false,
    gstRate = 18,
    total = 0,
    date = new Date(),
  } = bill;

  const dateStr = new Date(date).toLocaleDateString('en-GB');
  const timeStr = new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const parts = [
    INIT,
    CENTER,
    BOLD_ON,
    encodeText(shopName.toUpperCase()),
    BOLD_OFF,
    shopAddress ? encodeText(shopAddress) : new Uint8Array(0),
    shopPhone   ? encodeText('Ph: ' + shopPhone) : new Uint8Array(0),
    gstNumber   ? encodeText('GSTIN: ' + gstNumber) : new Uint8Array(0),
    DOT_LINE(),

    LEFT,
    encodeText(`Bill No: #${billNumber}  ${dateStr} ${timeStr}`),
    encodeText(`Customer: ${customerName || 'Guest'}`),
    customerPhone ? encodeText(`Phone: ${customerPhone}`) : new Uint8Array(0),
    BOLD_ON,
    encodeText(`Paid by: ${paymentMode.toUpperCase()}`),
    BOLD_OFF,
    DASH_LINE(),

    // Items header
    justifyLine('ITEM', 'AMT'),
    DASH_LINE(),
  ];

  // Items
  for (const item of items) {
    const itemName = (item.name || '').substring(0, 20);
    const qtyStr = `${item.billingQty}${item.billingUnit || item.unit || ''}`;
    const rateStr = `@${item.sellingPrice}/${item.unit || 'pc'}`;
    const amtStr = `Rs.${item.price}`;
    parts.push(encodeText(itemName));
    parts.push(justifyLine(`  ${qtyStr} ${rateStr}`, amtStr));
  }

  parts.push(DASH_LINE());

  // Totals
  parts.push(justifyLine('Subtotal:', `Rs.${subtotal}`));
  if (gstEnabled && cgst > 0) {
    parts.push(justifyLine(`CGST (${gstRate / 2}%):`, `Rs.${cgst}`));
    parts.push(justifyLine(`SGST (${gstRate / 2}%):`, `Rs.${sgst}`));
  }
  parts.push(DASH_LINE());

  // Total — big
  parts.push(CENTER, BOLD_ON, DOUBLE_SIZE);
  parts.push(encodeText(`TOTAL: Rs.${total}`));
  parts.push(NORMAL_SIZE, BOLD_OFF);
  parts.push(DASH_LINE());

  // UPI
  if (shopUpi) {
    parts.push(CENTER);
    parts.push(encodeText('Pay via UPI:'));
    parts.push(BOLD_ON, encodeText(shopUpi), BOLD_OFF);
    parts.push(DASH_LINE());
  }

  // Footer
  parts.push(CENTER);
  parts.push(encodeText('Thank you! Visit Again!'));
  parts.push(encodeText('Powered by ShopSaathi'));
  parts.push(FEED_3);
  parts.push(FEED_CUT);

  return merge(...parts);
};

// Send data to BLE printer in chunks (BLE MTU is usually 20 bytes)
const sendChunked = async (characteristic, data, chunkSize = 100) => {
  for (let i = 0; i < data.length; i += chunkSize) {
    await characteristic.writeValue(data.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 30)); // small delay between chunks
  }
};

// Connect to a Bluetooth printer and return a print function
export const connectPrinter = async () => {
  if (!navigator.bluetooth) {
    throw new Error('Web Bluetooth not supported. Use Chrome on Android.');
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  const server = await device.gatt.connect();

  // Try each service UUID until one works
  let writeChar = null;
  for (const svcUuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(svcUuid);
      for (const charUuid of WRITE_CHAR_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        } catch {}
      }
      if (writeChar) break;
    } catch {}
  }

  // Fallback: try all services and find any writable characteristic
  if (!writeChar) {
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      } catch {}
    }
  }

  if (!writeChar) {
    throw new Error('Could not find a writable characteristic on this printer.');
  }

  return {
    deviceName: device.name || 'Bluetooth Printer',
    print: async (data) => await sendChunked(writeChar, data),
    disconnect: () => device.gatt.disconnect(),
  };
};

// Save/load paired printer name in localStorage
export const getSavedPrinterName = () => localStorage.getItem('pairedPrinterName') || null;
export const savePrinterName = (name) => localStorage.setItem('pairedPrinterName', name);
export const clearPrinterName = () => localStorage.removeItem('pairedPrinterName');
