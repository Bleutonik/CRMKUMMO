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
const {
  obtenerEstadoBot,
  toggleBot,
  obtenerConversacionesPorPares,
  obtenerConocimiento,
  crearConocimiento,
  eliminarConocimiento
} = require('../controllers/botController');

// Bot control
router.get('/bot-status', obtenerEstadoBot);
router.post('/bot-toggle', toggleBot);

// Conversaciones (dashboard nuevo — pares cliente/bot)
router.get('/conversations', obtenerConversacionesPorPares);

// Knowledge base
router.get('/knowledge', obtenerConocimiento);
router.post('/knowledge', crearConocimiento);
router.delete('/knowledge/:id', eliminarConocimiento);

// Conversaciones detalladas (dashboard anterior)
router.get('/conversaciones', obtenerConversaciones);
router.get('/conversaciones/:id', obtenerConversacion);

// Leads
router.get('/leads', obtenerLeads);

// Estadísticas
router.get('/stats', obtenerEstadisticas);

// Configuración / Prompts
router.get('/configuracion', obtenerConfiguracion);
router.post('/prompts', actualizarConfiguracion);

// Admin — ejecutar scripts desde el navegador
const { importarHistorial, extraerConocimiento } = require('../controllers/adminController');
router.post('/admin/import-kommo', importarHistorial);
router.post('/admin/extract-knowledge', extraerConocimiento);

module.exports = router;
