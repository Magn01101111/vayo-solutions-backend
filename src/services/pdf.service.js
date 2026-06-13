const PDFDocument = require('pdfkit');

// ── Tema ──────────────────────────────────────────────────────────────────────
const COLORS = {
  brand: '#0c447c',
  brandSoft: '#e6f1fb',
  text: '#1a1a1a',
  muted: '#666666',
  border: '#d6d6d6',
  success: '#0f6e56',
  rowAlt: '#f8f8f7',
};

const PAGE_MARGIN = 45;

// ── Helpers de formato ────────────────────────────────────────────────────────
const formatCurrency = (value, currency = 'CLP') => {
  const n = Number(value) || 0;
  if (currency === 'CLP') {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(n);
  }
  if (currency === 'USD') return `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === 'UF') return `UF ${n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return String(n);
};

const formatDate = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const labelPayment = (t) =>
  ({ contado: 'Contado', '15-dias': '15 días', '30-dias': '30 días', '60-dias': '60 días' }[t] || t || '—');

const labelDelivery = (t) =>
  ({ pickup: 'Retiro en tienda', delivery: 'Despacho local', shipping: 'Envío nacional' }[t] || t || '—');

const safe = (v, def = '—') => (v === null || v === undefined || v === '' ? def : v);

const formatAddress = (a) => {
  if (!a || (!a.street && !a.city)) return '';
  const line1 = [a.street, a.number].filter(Boolean).join(' ');
  const line2 = [a.apt && `Of/Dpto ${a.apt}`, a.city, a.region].filter(Boolean).join(', ');
  const line3 = [a.zip && `CP ${a.zip}`, a.reference].filter(Boolean).join(' · ');
  return [line1, line2, line3].filter(Boolean).join('\n');
};

// ── Primitivos de dibujo ──────────────────────────────────────────────────────
const hr = (doc, y, color = COLORS.border) => {
  doc.save()
    .strokeColor(color)
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke()
    .restore();
};

const sectionTitle = (doc, label) => {
  doc.fillColor(COLORS.muted)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(label.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.3);
};

// ── Encabezado ────────────────────────────────────────────────────────────────
const drawHeader = (doc, quote, company = {}) => {
  const top = PAGE_MARGIN;

  const cName    = company.name    || 'VAYO Solutions';
  const cEmail   = company.email   || '';
  const cPhone   = company.phone   || '';
  const cAddress = typeof company.address === 'string' ? company.address : '';

  // Iniciales de la empresa (máx. 4 chars) dentro de un cuadro de marca
  const initials = cName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  doc.save()
    .roundedRect(PAGE_MARGIN, top, 50, 50, 6)
    .fill(COLORS.brand);

  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(initials.length > 2 ? 10 : 13)
    .text(initials, PAGE_MARGIN, top + 18, { width: 50, align: 'center' });
  doc.restore();

  // Datos de la empresa
  const brandX = PAGE_MARGIN + 62;
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
    .text(cName, brandX, top + 4);

  const contactLine = [cEmail, cPhone].filter(Boolean).join('  ·  ');
  let contactY = top + 22;
  if (contactLine) {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(contactLine, brandX, contactY);
    contactY += 11;
  }
  if (cAddress) {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(cAddress, brandX, contactY);
  }

  // Folio + fecha (derecha)
  const rightX = doc.page.width - PAGE_MARGIN - 200;
  doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(9)
    .text('COTIZACIÓN', rightX, top + 2, { width: 200, align: 'right' });

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(15)
    .text(`N° ${safe(quote.folio)}`, rightX, top + 16, { width: 200, align: 'right' });

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
    .text(`Emitida: ${formatDate(quote.metadata?.createdAt || quote.createdAt)}`,
      rightX, top + 36, { width: 200, align: 'right' })
    .text(`Válida hasta: ${formatDate(quote.validUntil)}`,
      rightX, top + 47, { width: 200, align: 'right' });

  // Línea de marca
  doc.save()
    .strokeColor(COLORS.brand)
    .lineWidth(2)
    .moveTo(PAGE_MARGIN, top + 65)
    .lineTo(doc.page.width - PAGE_MARGIN, top + 65)
    .stroke()
    .restore();

  doc.y = top + 80;
};

// ── Bloque de cliente y direcciones ───────────────────────────────────────────
// ── Bloque de cliente y direcciones ───────────────────────────────────────────
const drawClientBlock = (doc, quote) => {
  const startY = doc.y;
  const gap = 20;
  const colWidth = (doc.page.width - PAGE_MARGIN * 2 - gap) / 2;
  const col1X = PAGE_MARGIN;
  const col2X = PAGE_MARGIN + colWidth + gap;

  // Helper: imprime una línea en (x, y) con ancho fijo y devuelve la nueva Y.
  const writeLine = (text, x, y, opts = {}) => {
    const {
      font = 'Helvetica',
      size = 9,
      color = COLORS.muted,
      gapAfter = 1,
    } = opts;
    doc.font(font).fontSize(size).fillColor(color);
    doc.text(text, x, y, { width: colWidth, lineBreak: true });
    return doc.y + gapAfter;
  };

  const writeTitle = (label, x, y) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
    doc.text(label.toUpperCase(), x, y, {
      width: colWidth,
      characterSpacing: 1,
    });
    return doc.y + 4;
  };

  // ─ Columna 1: Cliente ────────────────────────────────────────────────────
  let y1 = startY;
  y1 = writeTitle('Cliente', col1X, y1);

  const c = quote.client || {};
  y1 = writeLine(safe(c.company || c.name), col1X, y1, {
    font: 'Helvetica-Bold',
    size: 10,
    color: COLORS.text,
    gapAfter: 2,
  });

  if (c.company && c.name) y1 = writeLine(`Contacto: ${c.name}`, col1X, y1);
  if (c.taxId) y1 = writeLine(`RUT: ${c.taxId}`, col1X, y1);
  if (c.email) y1 = writeLine(c.email, col1X, y1);
  if (c.phone) y1 = writeLine(c.phone, col1X, y1);
  if (c.businessActivity) y1 = writeLine(`Giro: ${c.businessActivity}`, col1X, y1);

  // ─ Columna 2: Direcciones ────────────────────────────────────────────────
  let y2 = startY;
  y2 = writeTitle('Dirección de facturación', col2X, y2);

  const billingTxt = formatAddress(quote.billingAddress);
  y2 = writeLine(billingTxt || 'No registrada', col2X, y2, {
    color: COLORS.text,
    gapAfter: 6,
  });

  if (quote.shippingAddress && !quote.shippingSameAsBilling) {
    const shipTxt = formatAddress(quote.shippingAddress);
    if (shipTxt) {
      y2 = writeTitle('Dirección de envío', col2X, y2);
      y2 = writeLine(shipTxt, col2X, y2, { color: COLORS.text });
    }
  } else {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted);
    doc.text('Envío en la misma dirección de facturación.', col2X, y2, {
      width: colWidth,
    });
    y2 = doc.y;
  }

  // Posición Y final = la mayor de ambas columnas + separador
  const endY = Math.max(y1, y2) + 14;
  hr(doc, endY);
  doc.x = PAGE_MARGIN;
  doc.y = endY + 12;
};

// ── Tabla de ítems ────────────────────────────────────────────────────────────
const drawItemsTable = (doc, quote) => {
  const currency = quote.currency || 'CLP';
  const tableX = PAGE_MARGIN;
  const tableWidth = doc.page.width - PAGE_MARGIN * 2;

  const cols = {
    num: { x: tableX, w: 25, align: 'left' },
    prod: { x: tableX + 25, w: 280, align: 'left' },
    qty: { x: tableX + 305, w: 40, align: 'center' },
    price: { x: tableX + 345, w: 80, align: 'right' },
    total: { x: tableX + 425, w: tableWidth - 425, align: 'right' },
  };

  const headerY = doc.y;
  doc.save()
    .rect(tableX, headerY, tableWidth, 22)
    .fill(COLORS.rowAlt);
  doc.restore();

  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8);
  const drawHeaderCell = (label, c) =>
    doc.text(label.toUpperCase(), c.x + 4, headerY + 7, { width: c.w - 8, align: c.align, characterSpacing: 1 });

  drawHeaderCell('#', cols.num);
  drawHeaderCell('Producto / SKU', cols.prod);
  drawHeaderCell('Cant.', cols.qty);
  drawHeaderCell('P. unitario', cols.price);
  drawHeaderCell('Total', cols.total);

  doc.y = headerY + 26;
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(9);

  const items = quote.items || [];
  items.forEach((item, idx) => {
    const rowTop = doc.y;

    // Salto de página si no cabe
    if (rowTop > doc.page.height - 200) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
    }

    const rowY = doc.y;

    // Producto + SKU + nota
    let prodText = item.name || '';
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text)
      .text(prodText, cols.prod.x + 4, rowY, { width: cols.prod.w - 8 });

    let cellBottom = doc.y;

    if (item.sku) {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
        .text(`SKU: ${item.sku}`, cols.prod.x + 4, cellBottom, { width: cols.prod.w - 8 });
      cellBottom = doc.y;
    }
    if (item.notes) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted)
        .text(`Nota: ${item.notes}`, cols.prod.x + 4, cellBottom, { width: cols.prod.w - 8 });
      cellBottom = doc.y;
    }

    const rowHeight = Math.max(cellBottom - rowY, 16);

    // Otras celdas (alineadas al top de la fila)
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text(String(idx + 1), cols.num.x + 4, rowY, { width: cols.num.w - 8, align: 'left' });
    doc.text(String(item.quantity || 0), cols.qty.x, rowY, { width: cols.qty.w, align: 'center' });
    doc.text(formatCurrency(item.price, currency), cols.price.x, rowY, { width: cols.price.w - 4, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9)
      .text(formatCurrency(item.total, currency), cols.total.x, rowY, { width: cols.total.w - 4, align: 'right' });

    // Línea separadora
    doc.save().strokeColor(COLORS.border).lineWidth(0.3)
      .moveTo(tableX, rowY + rowHeight + 4)
      .lineTo(tableX + tableWidth, rowY + rowHeight + 4)
      .stroke().restore();

    doc.y = rowY + rowHeight + 8;
  });

  doc.y += 8;
};

// ── Totales + términos comerciales ────────────────────────────────────────────
const drawTotalsAndTerms = (doc, quote) => {
  const currency = quote.currency || 'CLP';
  const startY = doc.y;
  const totals = quote.totals || {};

  const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 30) / 2;

  // ─ Términos (izq) ─
  doc.save();
  doc.x = PAGE_MARGIN;
  doc.y = startY;
  doc.rect(PAGE_MARGIN, startY, colWidth, 1).fillOpacity(0).stroke('white'); // reset
  doc.save()
    .roundedRect(PAGE_MARGIN, startY, colWidth, 110, 6)
    .fillOpacity(1).fill(COLORS.rowAlt).restore();

  const termsX = PAGE_MARGIN + 12;
  let ty = startY + 10;
  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8)
    .text('TÉRMINOS COMERCIALES', termsX, ty, { characterSpacing: 1 });
  ty += 14;

  const termRow = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.text)
      .text(`${label}:`, termsX, ty, { continued: true })
      .font('Helvetica').fillColor(COLORS.muted)
      .text(`  ${value}`);
    ty = doc.y + 2;
  };

  termRow('Pago', labelPayment(quote.paymentTerms));
  termRow('Entrega', labelDelivery(quote.deliveryTerms));
  if (quote.shipping?.methodLabel) {
    const ed = quote.shipping.estimatedDays ? ` (${quote.shipping.estimatedDays})` : '';
    termRow('Envío', `${quote.shipping.methodLabel}${ed}`);
  }
  termRow('Validez', `${quote.validityDays || 30} días`);
  termRow('Moneda', currency);
  doc.restore();

  // ─ Totales (der) ─
  const totalsX = PAGE_MARGIN + colWidth + 30;
  const totalsW = colWidth;
  let toy = startY + 4;

  const lineRow = (label, value, opts = {}) => {
    const { bold = false, color = COLORS.text, divider = false } = opts;
    if (divider) {
      doc.save().strokeColor(COLORS.border).lineWidth(0.5)
        .moveTo(totalsX, toy).lineTo(totalsX + totalsW, toy).stroke().restore();
      toy += 4;
    }
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 10 : 9)
      .fillColor(color)
      .text(label, totalsX, toy, { width: totalsW * 0.55, align: 'left' });
    doc.text(value, totalsX + totalsW * 0.55, toy, { width: totalsW * 0.45, align: 'right' });
    toy += bold ? 16 : 13;
  };

  lineRow('Subtotal', formatCurrency(totals.subtotal, currency));

  if ((totals.discount || 0) > 0) {
    const code = quote.coupon?.code ? ` (${quote.coupon.code})` : '';
    lineRow(`Descuento${code}`, `− ${formatCurrency(totals.discount, currency)}`, { color: COLORS.success });
  }

  const ivaPercent = totals.ivaPercent ?? 19;
  lineRow(`IVA (${ivaPercent}%)`, formatCurrency(totals.iva, currency));

  const shipCost = totals.shipping ?? quote.shipping?.cost ?? 0;
  lineRow('Envío', shipCost > 0 ? formatCurrency(shipCost, currency) : 'Sin costo');

  // Total final con barra
  doc.save()
    .strokeColor(COLORS.brand).lineWidth(1.5)
    .moveTo(totalsX, toy).lineTo(totalsX + totalsW, toy).stroke()
    .restore();
  toy += 6;

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text)
    .text(`TOTAL ${currency}`, totalsX, toy, { width: totalsW * 0.55, align: 'left' });
  doc.fillColor(COLORS.brand)
    .text(formatCurrency(totals.total, currency), totalsX + totalsW * 0.55, toy, { width: totalsW * 0.45, align: 'right' });
  toy += 22;

  doc.y = Math.max(toy, startY + 130);
};

// ── Notas generales ───────────────────────────────────────────────────────────
const drawGeneralNotes = (doc, quote) => {
  if (!quote.generalNotes) return;
  doc.moveDown(0.5);

  const x = PAGE_MARGIN;
  const w = doc.page.width - PAGE_MARGIN * 2;
  const startY = doc.y;

  // Fondo suave
  const tempDoc = doc;
  const noteText = quote.generalNotes;
  // Calcular altura aproximada
  doc.font('Helvetica').fontSize(9);
  const textH = doc.heightOfString(noteText, { width: w - 24 });
  const boxH = textH + 28;

  doc.save()
    .roundedRect(x, startY, w, boxH, 6)
    .fill(COLORS.brandSoft)
    .restore();

  doc.save()
    .rect(x, startY, 4, boxH)
    .fill(COLORS.brand)
    .restore();

  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8)
    .text('OBSERVACIONES', x + 14, startY + 8, { characterSpacing: 1 });

  doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
    .text(noteText, x + 14, startY + 22, { width: w - 24 });

  doc.y = startY + boxH + 8;
};

// ── Footer / Disclaimer ───────────────────────────────────────────────────────
const drawFooter = (doc, quote) => {
  const y = doc.page.height - PAGE_MARGIN - 40;
  doc.save()
    .strokeColor(COLORS.border).lineWidth(0.5)
    .moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).stroke()
    .restore();

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7)
    .text(
      `Esta cotización tiene una validez de ${quote.validityDays || 30} días desde su fecha de emisión. ` +
      `Los precios incluyen IVA según la legislación chilena vigente. ` +
      `Cualquier modificación posterior podrá afectar el valor final.`,
      PAGE_MARGIN, y + 8,
      { width: doc.page.width - PAGE_MARGIN * 2, align: 'center' }
    );
};

// ── Generador principal ───────────────────────────────────────────────────────
const generateQuotePDF = (quote, company = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      drawHeader(doc, quote, company);
      drawClientBlock(doc, quote);
      drawItemsTable(doc, quote);
      drawTotalsAndTerms(doc, quote);
      drawGeneralNotes(doc, quote);
      drawFooter(doc, quote);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateQuotePDF };
