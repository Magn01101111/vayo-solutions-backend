const PDFDocument = require('pdfkit');

// ── Tema ──────────────────────────────────────────────────────────────────────
const COLORS = {
  brand:     '#0c447c',
  brandSoft: '#e6f1fb',
  text:      '#1a1a1a',
  muted:     '#666666',
  border:    '#d6d6d6',
  success:   '#0f6e56',
  rowAlt:    '#f8f8f7',
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
  if (currency === 'UF')  return `UF ${n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
const drawHeader = (doc, quote) => {
  const top = PAGE_MARGIN;

  // Logo simple (cuadro con texto)
  doc.save()
    .roundedRect(PAGE_MARGIN, top, 50, 50, 6)
    .fill(COLORS.brand);

  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('VAYO', PAGE_MARGIN, top + 18, { width: 50, align: 'center' });
  doc.restore();

  // Datos de la empresa
  const brandX = PAGE_MARGIN + 62;
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
    .text('VAYO Solutions SpA', brandX, top + 4);

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
    .text('contacto@vayo.cl  ·  +56 2 2345 6789', brandX, top + 22)
    .text('Av. Providencia 1234, Santiago, Chile', brandX, top + 33);

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
const drawClientBlock = (doc, quote) => {
  const startY = doc.y;
  const colWidth = (doc.page.width - PAGE_MARGIN * 2 - 20) / 2;

  // Columna 1: Cliente
  doc.save();
  sectionTitle(doc, 'Cliente');
  const c = quote.client || {};
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
    .text(safe(c.company || c.name), { width: colWidth });

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
  if (c.company && c.name) doc.text(`Contacto: ${c.name}`, { width: colWidth });
  if (c.taxId)            doc.text(`RUT: ${c.taxId}`, { width: colWidth });
  if (c.email)            doc.text(c.email, { width: colWidth });
  if (c.phone)            doc.text(c.phone, { width: colWidth });
  if (c.businessActivity) doc.text(`Giro: ${c.businessActivity}`, { width: colWidth });
  doc.restore();

  const col1End = doc.y;

  // Columna 2: Direcciones
  const col2X = PAGE_MARGIN + colWidth + 20;
  doc.save();
  doc.x = col2X;
  doc.y = startY;

  sectionTitle(doc, 'Dirección de facturación');
  const billingTxt = formatAddress(quote.billingAddress);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
    .text(billingTxt || 'No registrada', { width: colWidth });

  if (quote.shippingAddress && !quote.shippingSameAsBilling) {
    const shipTxt = formatAddress(quote.shippingAddress);
    if (shipTxt) {
      doc.moveDown(0.5);
      sectionTitle(doc, 'Dirección de envío');
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
        .text(shipTxt, { width: colWidth });
    }
  } else {
    doc.moveDown(0.3);
    doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(8)
      .text('Envío en la misma dirección de facturación.', { width: colWidth });
  }
  doc.restore();

  doc.y = Math.max(col1End, doc.y) + 14;
  hr(doc, doc.y);
  doc.y += 12;
};

// ── Tabla de ítems ────────────────────────────────────────────────────────────
const drawItemsTable = (doc, quote) => {
  const currency = quote.currency || 'CLP';
  const tableX = PAGE_MARGIN;
  const tableWidth = doc.page.width - PAGE_MARGIN * 2;

  const cols = {
    num:  { x: tableX,                  w: 25,  align: 'left'  },
    prod: { x: tableX + 25,             w: 280, align: 'left'  },
    qty:  { x: tableX + 305,            w: 40,  align: 'center'},
    price:{ x: tableX + 345,            w: 80,  align: 'right' },
    total:{ x: tableX + 425,            w: tableWidth - 425, align: 'right' },
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

  termRow('Pago',     labelPayment(quote.paymentTerms));
  termRow('Entrega',  labelDelivery(quote.deliveryTerms));
  if (quote.shipping?.methodLabel) {
    const ed = quote.shipping.estimatedDays ? ` (${quote.shipping.estimatedDays})` : '';
    termRow('Envío', `${quote.shipping.methodLabel}${ed}`);
  }
  termRow('Validez',  `${quote.validityDays || 30} días`);
  termRow('Moneda',   currency);
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

  lineRow('IVA (19%)', formatCurrency(totals.iva, currency));

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
const generateQuotePDF = (quote) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      drawHeader(doc, quote);
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
