const express = require('express');
const router = express.Router();
const {
  obtenerConversaciones, obtenerConversacion, obtenerLeads,
  obtenerEstadisticas, obtenerConfiguracion, actualizarConfiguracion
} = require('../controllers/conversationController');
const {
  obtenerEstadoBot, toggleBot, obtenerConversacionesPorPares,
  obtenerConocimiento, crearConocimiento, eliminarConocimiento
} = require('../controllers/botController');

// Bot
router.get('/bot-status', obtenerEstadoBot);
router.post('/bot-toggle', toggleBot);

// Conversaciones
router.get('/conversations', obtenerConversacionesPorPares);
router.get('/conversaciones', obtenerConversaciones);
router.get('/conversaciones/:id', obtenerConversacion);

// Knowledge
router.get('/knowledge', obtenerConocimiento);
router.post('/knowledge', crearConocimiento);
router.delete('/knowledge/:id', eliminarConocimiento);

// Stats / Config
router.get('/leads', obtenerLeads);
router.get('/stats', obtenerEstadisticas);
router.get('/configuracion', obtenerConfiguracion);
router.post('/prompts', actualizarConfiguracion);

// Contactos
const { obtenerContactos, obtenerContacto, responderManual } = require('../controllers/contactsController');
router.get('/contacts', obtenerContactos);
router.get('/contacts/:id', obtenerContacto);
router.post('/reply', responderManual);

// Leads CRM (Kommo)
const { obtenerLeadsCRM, obtenerPipelines, obtenerLeadDetalle, actualizarEtapa, agregarNota } = require('../controllers/leadsController');
router.get('/leads-crm', obtenerLeadsCRM);
router.get('/pipelines', obtenerPipelines);
router.get('/leads-crm/:id', obtenerLeadDetalle);
router.patch('/leads-crm/:id/status', actualizarEtapa);
router.post('/leads-crm/:id/note', agregarNota);

// Admin
const { importarHistorial, extraerConocimiento } = require('../controllers/adminController');
router.post('/admin/import-kommo', importarHistorial);
router.post('/admin/extract-knowledge', extraerConocimiento);

const { entrenarDesdeKommo } = require('../controllers/trainController');
router.post('/admin/train-from-kommo', entrenarDesdeKommo);

module.exports = router;
