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

// Conversaciones
router.get('/conversations', obtenerConversacionesPorPares);

// Knowledge base
router.get('/knowledge', obtenerConocimiento);
router.post('/knowledge', crearConocimiento);
router.delete('/knowledge/:id', eliminarConocimiento);

// Conversaciones detalladas
router.get('/conversaciones', obtenerConversaciones);
router.get('/conversaciones/:id', obtenerConversacion);

// Leads
router.get('/leads', obtenerLeads);

// Estadísticas
router.get('/stats', obtenerEstadisticas);

// Configuración / Prompts
router.get('/configuracion', obtenerConfiguracion);
router.post('/prompts', actualizarConfiguracion);

// Contactos (Kommo)
const { obtenerContactos, obtenerContacto, responderManual } = require('../controllers/contactsController');
router.get('/contacts', obtenerContactos);
router.get('/contacts/:id', obtenerContacto);

// Respuesta manual desde dashboard
router.post('/reply', responderManual);

// Admin
const { importarHistorial, extraerConocimiento } = require('../controllers/adminController');
router.post('/admin/import-kommo', importarHistorial);
router.post('/admin/extract-knowledge', extraerConocimiento);

const { entrenarDesdeKommo } = require('../controllers/trainController');
router.post('/admin/train-from-kommo', entrenarDesdeKommo);

module.exports = router;
