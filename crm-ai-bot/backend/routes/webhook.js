const express = require('express');
const router = express.Router();
const { manejarWebhook } = require('../controllers/webhookController');

// POST /webhook — recibe eventos de Kommo
router.post('/', manejarWebhook);

// GET /webhook — verificación de salud
router.get('/', (req, res) => {
  res.json({ estado: 'Webhook activo', timestamp: new Date().toISOString() });
});

module.exports = router;
