const Quote = require('../models/quote.model');
const { generateQuotePDF } = require('../services/pdf.service');

const downloadQuotePDF = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    const pdfBuffer = await generateQuotePDF(quote);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=quote-${quote._id}.pdf`
    );

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF ERROR:', error); // 🔥 ESTO
    res.status(500).json({ message: 'Error generando PDF' });
  }
};

// 🔹 Crear cotización
const createQuote = async (req, res) => {
  try {
    const quote = new Quote(req.body);
    const savedQuote = await quote.save();

    res.status(201).json(savedQuote);
  } catch (error) {
    console.error('Error creando cotización:', error);
    res.status(500).json({ message: 'Error creando cotización' });
  }
};

// 🔹 Obtener todas
const getQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 });
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo cotizaciones' });
  }
};

// 🔹 Obtener por ID
const getQuoteById = async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo cotización' });
  }
};

module.exports = {
  createQuote,
  getQuotes,
  getQuoteById,
  downloadQuotePDF
};