const PDFDocument = require('pdfkit');

const generateQuotePDF = (quote) => {
  const doc = new PDFDocument({ margin: 50 });

  const buffers = [];

  doc.on('data', buffers.push.bind(buffers));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // 🔹 HEADER
    doc.fontSize(20).text('VAYO Solutions', { align: 'left' });
    doc.fontSize(14).text('Cotización', { align: 'left' });

    doc.moveDown();

    doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString()}`);

    doc.moveDown();

    // 🔹 CLIENTE
    doc.fontSize(12).text('Cliente:', { underline: true });
    doc.text(quote.client.name);
    doc.text(quote.client.email);
    doc.text(quote.client.phone);

    doc.moveDown();

    // 🔹 TABLA (simple)
    doc.text('Productos:', { underline: true });

    quote.items.forEach((item) => {
      doc.text(
        `${item.name} | ${item.quantity} x $${item.price} = $${item.total}`
      );
    });

    doc.moveDown();

    // 🔹 TOTALES
    doc.text(`Subtotal: $${quote.totals.subtotal}`);
    doc.text(`IVA: $${quote.totals.iva}`);
    doc.text(`Total: $${quote.totals.total}`);

    doc.end();
  });
};

module.exports = {
  generateQuotePDF,
};