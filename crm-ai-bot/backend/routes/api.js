const express = require('express');
const router = express.Router();
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { login, me, listarUsuarios, crearUsuario, eliminarUsuario, cambiarPassword } = require('../controllers/authController');
const {
  obtenerConversaciones, obtenerConversacion, obtenerLeads,
  obtenerEstadisticas, obtenerConfiguracion, actualizarConfiguracion
} = require('../controllers/conversationController');
const {
  obtenerEstadoBot, toggleBot, obtenerConversacionesPorPares,
  obtenerConocimiento, crearConocimiento, eliminarConocimiento, probarBot
} = require('../controllers/botController');

// Auth (rutas públicas)
router.post('/auth/login', login);
router.get('/auth/me', verificarToken, me);
// Gestión de usuarios (admin)
router.get('/auth/usuarios', verificarToken, soloAdmin, listarUsuarios);
router.post('/auth/usuarios', verificarToken, soloAdmin, crearUsuario);
router.delete('/auth/usuarios/:id', verificarToken, soloAdmin, eliminarUsuario);
router.patch('/auth/usuarios/:id/password', verificarToken, cambiarPassword);

// Todas las rutas siguientes requieren autenticación
router.use(verificarToken);

// Bot
router.get('/bot-status', obtenerEstadoBot);
router.post('/bot-toggle', toggleBot);
router.post('/bot-test', probarBot);

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
const { obtenerContactos, obtenerContacto, responderManual, sincronizarContactos } = require('../controllers/contactsController');
router.get('/contacts', obtenerContactos);
router.get('/contacts/:id', obtenerContacto);
router.post('/reply', responderManual);
router.post('/admin/sync-contacts', sincronizarContactos);

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

const { entrenarDesdeKommo, aprenderDeConversacionesDB } = require('../controllers/trainController');
const { obtenerAlertas, marcarLeida, marcarTodasLeidas } = require('../controllers/alertasController');
router.post('/admin/train-from-kommo', entrenarDesdeKommo);

// Alertas de intención de compra
router.get('/alertas', obtenerAlertas);
router.patch('/alertas/:id/leida', marcarLeida);
router.post('/alertas/leer-todas', marcarTodasLeidas);
router.post('/admin/learn-from-db', aprenderDeConversacionesDB);

module.exports = router;
