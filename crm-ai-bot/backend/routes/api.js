const express = require('express');
const router = express.Router();
const {
  obtenerConversaciones,
  obtenerConversacion,
  obtenerLeads,
  obtenerEstadisticas,
  obtenerConfiguracion,
  actualizarConfiguracion
} = require('../controllers/conversationController');

// Conversaciones
router.get('/conversaciones', obtenerConversaciones);
router.get('/conversaciones/:id', obtenerConversacion);

// Leads
router.get('/leads', obtenerLeads);

// Estadísticas
router.get('/stats', obtenerEstadisticas);

// Configuración / Prompts
router.get('/configuracion', obtenerConfiguracion);
router.post('/prompts', actualizarConfiguracion);

module.exports = router;
