// ESC/POS Bluetooth Thermal Printer Service
// Compatible with: Xprinter XP-58IIK BT, Rongta RPP300, most cheap 58mm BLE printers

const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5b3-f393-e0a9-e50e24dcca9e',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
];
const WRITE_CHAR_UUIDS = [
  '000018f1-0000-1000-8000-00805f9b34fb',
  '6e400002-b5b3-f393-e0a9-e50e24dcca9e',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff01-0000-1000-8000-00805f9b34fb',
];

// 58mm paper = 32 printable chars at normal font
const LINE_WIDTH = 32;

// ESC/POS bytes
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const cmd  = (...bytes) => new Uint8Array(bytes);
const INIT        = cmd(ESC, 0x40);
const CENTER      = cmd(ESC, 0x61, 0x01);
const LEFT        = cmd(ESC, 0x61, 0x00);
const BOLD_ON     = cmd(ESC, 0x45, 0x01);
const BOLD_OFF    = cmd(ESC, 0x45, 0x00);
const DOUBLE_SIZE = cmd(GS,  0x21, 0x11);
const NORMAL_SIZE = cmd(GS,  0x21, 0x00);
const FEED_CUT    = cmd(GS,  0x56, 0x42, 0x05);
const FEED_LINES  = (n) => cmd(ESC, 0x64, n);

const enc = new TextEncoder();
const text  = (s) => enc.encode(s + '\n');
const dash  = () => text('-'.repeat(LINE_WIDTH));

// Left + right on same line, padded to LINE_WIDTH
const justify = (left, right) => {
  const l = String(left).substring(0, LINE_WIDTH - String(right).length - 1);
  const pad = LINE_WIDTH - l.length - String(right).length;
  return text(l + ' '.repeat(Math.max(1, pad)) + right);
};

// Truncate string to max length
const trunc = (s, max) => String(s).length > max ? String(s).substring(0, max - 1) + '.' : String(s);

// Merge Uint8Arrays
const merge = (...arrays) => {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
};

// ─── Logo → ESC/POS raster bitmap ───────────────────────────────────────────
// Converts any image URL (including base64 data URLs) to GS v 0 raster command
// targetWidth: dots wide on paper. 58mm printer = max 384 dots, use 160-192
const imageToEscPos = (url, targetWidth = 160) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const scale = targetWidth / img.width;
    const w = targetWidth;
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // White background first (transparent PNGs become white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    const byteWidth = Math.ceil(w / 8);
    const bytes = new Uint8Array(byteWidth * h);

    // Atkinson dithering for clean B&W output (looks much better than threshold)
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = (0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]) / 255;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const old = gray[idx];
        const nw  = old < 0.5 ? 0 : 1;
        const err = (old - nw) / 8;
        gray[idx] = nw;
        if (nw === 0) { // dark dot → set bit
          bytes[y * byteWidth + Math.floor(x / 8)] |= (0x80 >> (x % 8));
        }
        // Spread error to neighbours (clamped to [0,1] to prevent artifacts)
        const spread = [[1,0],[2,0],[-1,1],[0,1],[1,1],[0,2]];
        for (const [dx, dy] of spread) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny < h) {
            gray[ny * w + nx] = Math.min(1, Math.max(0, gray[ny * w + nx] + err));
          }
        }
      }
    }

    const xL = byteWidth & 0xFF, xH = byteWidth >> 8;
    const yL = h & 0xFF,         yH = h >> 8;
    const header = cmd(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    resolve(merge(header, bytes));
  };
  img.onerror = () => { console.warn('ShopSaathi: logo failed to load for thermal print — printing without logo'); resolve(new Uint8Array(0)); };
  img.src = url;
});

// ─── Build ESC/POS receipt ───────────────────────────────────────────────────
export const buildReceipt = async (bill) => {
  const {
    shopName    = 'ShopSaathi Store',
    shopAddress = '',
    shopPhone   = '',
    shopLogo    = '',
    shopUpi     = '',
    gstNumber   = '',
    billNumber,
    customerName,
    customerPhone,
    paymentMode  = 'cash',
    items        = [],
    subtotal     = 0,
    cgst         = 0,
    sgst         = 0,
    gstEnabled   = false,
    gstRate      = 18,
    total        = 0,
    date         = new Date(),
  } = bill;

  const dateStr = new Date(date).toLocaleDateString('en-GB');
  const timeStr = new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Logo (async, fails silently) ──
  let logoPart = new Uint8Array(0);
  if (shopLogo) {
    try {
      const bitmap = await imageToEscPos(shopLogo, 160);
      logoPart = merge(CENTER, bitmap, cmd(LF));
    } catch {}
  }

  // ── Header ──
  const headerParts = [
    INIT,
    logoPart,
    CENTER,
    BOLD_ON, text(trunc(shopName.toUpperCase(), LINE_WIDTH)), BOLD_OFF,
  ];
  if (shopAddress) {
    // Wrap long address across two lines
    const addr = String(shopAddress);
    if (addr.length <= LINE_WIDTH) {
      headerParts.push(text(addr));
    } else {
      headerParts.push(text(addr.substring(0, LINE_WIDTH)));
      headerParts.push(text(addr.substring(LINE_WIDTH)));
    }
  }
  if (shopPhone)  headerParts.push(text('Ph: ' + shopPhone));
  if (gstNumber)  headerParts.push(text('GSTIN: ' + gstNumber));
  headerParts.push(dash());

  // ── Bill info ──
  const infoParts = [
    LEFT,
    text(`Bill No: #${billNumber}   ${dateStr}`),
    text(`Time: ${timeStr}`),
    text(`Customer: ${trunc(customerName || 'Guest', 24)}`),
  ];
  if (customerPhone) infoParts.push(text(`Phone: ${customerPhone}`));
  infoParts.push(BOLD_ON, text(`Paid by: ${paymentMode.toUpperCase()}`), BOLD_OFF);
  infoParts.push(dash());

  // ── Items header ──
  const itemHeaderParts = [
    text(
      trunc('ITEM', 18).padEnd(18) +
      'QTY'.padStart(6) +
      'AMT'.padStart(8)
    ),
    dash(),
  ];

  // ── Item rows ──
  const itemParts = [];
  for (const item of items) {
    const name   = trunc(item.name || '', 30);
    const qty    = `${item.billingQty}${item.billingUnit || item.unit || ''}`;
    const amt    = `Rs.${item.price}`;
    const rate   = `@Rs.${item.sellingPrice}/${item.unit || 'pc'}`;

    // Line 1: item name
    itemParts.push(text(name));
    // Line 2: qty + rate on left, amount on right — indented 2 spaces
    itemParts.push(justify('  ' + trunc(qty + ' ' + rate, LINE_WIDTH - amt.length - 3), amt));
  }
  itemParts.push(dash());

  // ── Totals ──
  const totalParts = [justify('Subtotal:', `Rs.${subtotal}`)];
  if (gstEnabled && cgst > 0) {
    totalParts.push(justify(`  CGST (${gstRate/2}%):`, `Rs.${cgst}`));
    totalParts.push(justify(`  SGST (${gstRate/2}%):`, `Rs.${sgst}`));
  }
  totalParts.push(dash());

  // ── Grand total (double size) ──
  const grandTotalParts = [
    CENTER, BOLD_ON, DOUBLE_SIZE,
    text(`TOTAL Rs.${total}`),
    NORMAL_SIZE, BOLD_OFF,
    dash(),
  ];

  // ── UPI ──
  const upiParts = [];
  if (shopUpi) {
    upiParts.push(CENTER, text('Pay via UPI:'), BOLD_ON, text(shopUpi), BOLD_OFF, dash());
  }

  // ── Footer ──
  const footerParts = [
    CENTER,
    text('Thank you! Visit Again!'),
    text('Powered by ShopSaathi'),
    FEED_LINES(3),
    FEED_CUT,
  ];

  return merge(
    ...headerParts,
    ...infoParts,
    ...itemHeaderParts,
    ...itemParts,
    ...totalParts,
    ...grandTotalParts,
    ...upiParts,
    ...footerParts,
  );
};

// ─── Bluetooth connection ────────────────────────────────────────────────────
// 20 bytes is the BLE GATT minimum MTU payload — safe for all printers including budget ones
const sendChunked = async (char, data, chunkSize = 20) => {
  for (let i = 0; i < data.length; i += chunkSize) {
    await char.writeValue(data.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 30));
  }
};

export const connectPrinter = async () => {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported. Use Chrome on Android.');

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  const server = await device.gatt.connect();
  let writeChar = null;

  for (const svcUuid of PRINTER_SERVICE_UUIDS) {
    try {
      const svc = await server.getPrimaryService(svcUuid);
      for (const charUuid of WRITE_CHAR_UUIDS) {
        try {
          const c = await svc.getCharacteristic(charUuid);
          if (c.properties.write || c.properties.writeWithoutResponse) { writeChar = c; break; }
        } catch {}
      }
      if (writeChar) break;
    } catch {}
  }

  // Fallback: scan all services
  if (!writeChar) {
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) { writeChar = c; break; }
        }
        if (writeChar) break;
      } catch {}
    }
  }

  if (!writeChar) throw new Error('No writable characteristic found on this printer.');

  return {
    deviceName: device.name || 'Bluetooth Printer',
    print: async (data) => await sendChunked(writeChar, data),
    disconnect: () => device.gatt.disconnect(),
  };
};

export const getSavedPrinterName = () => localStorage.getItem('pairedPrinterName') || null;
export const savePrinterName    = (name) => localStorage.setItem('pairedPrinterName', name);
export const clearPrinterName   = () => localStorage.removeItem('pairedPrinterName');
