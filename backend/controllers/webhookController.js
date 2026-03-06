const { pool } = require('../services/database/db');
const { generarRespuestaAI } = require('../services/ai/claudeService');
const { agregarNotaLead, obtenerInfoLead, obtenerContactoLead } = require('../services/kommo/kommoService');

async function manejarWebhook(req, res) {
  // Responder inmediatamente a Kommo (evitar timeout)
  res.status(200).json({ recibido: true });

  try {
    const cuerpo = req.body;
    console.log('[WEBHOOK] Datos recibidos:', JSON.stringify(cuerpo, null, 2));

    // --- Formato 1: Twilio / WhatsApp (message.add) ---
    const msgTwilio = cuerpo?.message?.add?.[0];

    // --- Formato 2: Nota Kommo (leads.note) ---
    const notaKommo = cuerpo?.leads?.note?.[0]?.note;

    let textoMensaje = null;
    let leadId = '';
    let autorNombre = null;

    if (msgTwilio) {
      // Ignorar mensajes salientes del bot
      if (msgTwilio.type === 'outgoing') {
        console.log('[WEBHOOK] Mensaje saliente del bot, ignorando');
        return;
      }
      textoMensaje = msgTwilio.text;
      leadId = String(msgTwilio.element_id || msgTwilio.entity_id || msgTwilio.lead_id || '');
      autorNombre = msgTwilio.author?.name || null;
      console.log('[WEBHOOK] Formato Twilio detectado');

    } else if (notaKommo) {
      const tipo = String(notaKommo.note_type);

      // Tipos SALIENTES — ignorar para no crear bucles de respuesta
      // 26 = WhatsApp/SMS saliente, 103 = Kommo Talk saliente
      const SALIENTES = ['26', '103'];
      if (SALIENTES.includes(tipo)) {
        console.log(`[WEBHOOK] Mensaje saliente tipo ${tipo}, ignorando`);
        return;
      }

      // Tipos ENTRANTES aceptados:
      //  4  = nota común (agente escribe manualmente — ignorar para no auto-responder notas internas)
      // 25  = mensaje entrante (WhatsApp, SMS, cualquier canal externo)
      // 102 = Kommo Talk / SMS entrante
      // Si en el futuro aparece otro tipo entrante con texto, se aceptará igual
      const ENTRANTES_ACEPTADOS = ['25', '102'];
      if (!ENTRANTES_ACEPTADOS.includes(tipo)) {
        console.log(`[WEBHOOK] Nota tipo ${tipo} no es mensaje entrante de cliente, ignorando`);
        return;
      }

      textoMensaje = notaKommo.text || notaKommo.params?.text;
      leadId = String(notaKommo.element_id || '');
      console.log(`[WEBHOOK] Mensaje entrante tipo ${tipo} detectado`);

    } else {
      console.log('[WEBHOOK] Formato de payload no reconocido, ignorando');
      return;
    }

    if (!textoMensaje) {
      console.log('[WEBHOOK] Sin texto en el mensaje, ignorando');
      return;
    }

    if (!leadId) {
      console.log('[WEBHOOK] Sin lead_id en el payload, ignorando');
      return;
    }

    console.log(`Mensaje recibido: ${textoMensaje}`);
    console.log(`[WEBHOOK] Lead ID: ${leadId}`);

    // Obtener datos completos del contacto
    let contactName = autorNombre;
    let contactEmail = null;
    let contactTelefono = null;
    try {
      const infoContacto = await obtenerContactoLead(leadId);
      contactName   = infoContacto.nombre   || autorNombre || null;
      contactEmail  = infoContacto.email    || null;
      contactTelefono = infoContacto.telefono || null;
    } catch {}

    // SIEMPRE guardar el mensaje (independiente del estado del bot)
    const insertResult = await pool.query(`
      INSERT INTO conversations (lead_id, contact_name, mensaje_cliente, respuesta_bot)
      VALUES ($1, $2, $3, NULL)
      RETURNING id
    `, [leadId, contactName, textoMensaje]);

    const convId = insertResult.rows[0].id;
    console.log(`[WEBHOOK] Mensaje guardado en conversations (id: ${convId})`);

    // Verificar si el bot debe responder automáticamente
    const estadoBot = await pool.query(
      "SELECT valor FROM configuracion WHERE clave = 'bot_activo'"
    );
    const botActivo = estadoBot.rows[0]?.valor === 'true';

    if (!botActivo) {
      console.log('[WEBHOOK] Bot inactivo — mensaje guardado, sin respuesta automática');
      return;
    }

    // Obtener contexto del lead para el prompt
    let contexto = {};
    try {
      contexto = await obtenerInfoLead(leadId);
    } catch {}

    // Generar respuesta con IA
    const respuestaIA = await generarRespuestaAI(textoMensaje, {
      leadId,
      contactName,
      email:    contactEmail,
      telefono: contactTelefono,
      ...contexto
    });

    // Actualizar la fila con la respuesta del bot
    await pool.query(
      'UPDATE conversations SET respuesta_bot = $1 WHERE id = $2',
      [respuestaIA, convId]
    );

    // Enviar respuesta a Kommo como nota
    await agregarNotaLead(leadId, respuestaIA);

    console.log(`[WEBHOOK] Respuesta automática enviada al lead ${leadId}`);

  } catch (error) {
    console.error('[WEBHOOK] Error procesando webhook:', error);
  }
}

module.exports = { manejarWebhook };
