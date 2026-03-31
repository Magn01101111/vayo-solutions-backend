const express = require('express');
const cors = require('cors');
/* const routes = require('./routes'); */
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => res.json({ ok: true }));
/* app.use('/api', routes); */
app.get('/', (req, res) => {
  res.json({ mensaje: 'Backend funcionando correctamente 🚀' });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
