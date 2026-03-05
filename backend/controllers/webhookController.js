const { pool } = require('../services/database/db');
const { generarRespuestaAI } = require('../services/ai/claudeService');
const { agregarNotaLead, obtenerInfoLead, obtenerContactoLead } = require('../services/kommo/kommoService');

async function manejarWebhook(req, res) {
  // Responder inmediatamente a Kommo (evitar timeout)
  res.status(200).json({ recibido: true });

  try {
    const cuerpo = req.body;
    console.log('[WEBHOOK] Datos recibidos:', JSON.stringify(cuerpo, null, 2));

    // Verificar si el bot está activo
    const estadoBot = await pool.query(
      "SELECT valor FROM configuracion WHERE clave = 'bot_activo'"
    );
    if (estadoBot.rows[0]?.valor !== 'true') {
      console.log('[WEBHOOK] Bot inactivo, ignorando mensaje');
      return;
    }

    // Extraer campos desde message.add[0]
    const msgObj = cuerpo?.message?.add?.[0];

    // Solo procesar mensajes entrantes (ignorar los que envía el bot)
    if (msgObj?.type !== 'incoming') {
      console.log(`[WEBHOOK] Mensaje tipo "${msgObj?.type}", ignorando`);
      return;
    }

    const textoMensaje = msgObj?.text;
    // Twilio usa element_id / entity_id — Kommo nativo usa lead_id
    const leadId = String(
      msgObj?.element_id || msgObj?.entity_id || msgObj?.lead_id ||
      cuerpo?.leads?.note?.[0]?.lead_id || ''
    );
    const contactId = String(msgObj?.contact_id || '');
    // Nombre del autor si viene en el payload (Twilio lo incluye)
    const autorNombre = msgObj?.author?.name || null;

    if (!textoMensaje) {
      console.log('[WEBHOOK] Sin mensaje en el payload, ignorando');
      return;
    }

    if (!leadId) {
      console.log('[WEBHOOK] Sin lead_id en el payload, ignorando');
      return;
    }

    console.log(`Mensaje recibido: ${textoMensaje}`);
    console.log(`[WEBHOOK] Lead ID: ${leadId} | Contact ID: ${contactId}`);

    // Obtener nombre del contacto (primero del payload, luego de Kommo API)
    let contactName = autorNombre;
    try {
      const infoContacto = await obtenerContactoLead(leadId);
      contactName = infoContacto.nombre || autorNombre || null;
    } catch {}

    // Insertar en tabla conversations (sin respuesta_bot todavía)
    const insertResult = await pool.query(`
      INSERT INTO conversations (lead_id, contact_name, mensaje_cliente, respuesta_bot)
      VALUES ($1, $2, $3, NULL)
      RETURNING id
    `, [leadId, contactName, textoMensaje]);

    const convId = insertResult.rows[0].id;

    // Obtener contexto del lead para el prompt
    let contexto = {};
    try {
      contexto = await obtenerInfoLead(leadId);
    } catch {}

    // Generar respuesta con IA
    const respuestaIA = await generarRespuestaAI(textoMensaje, {
      leadId,
      contactName,
      ...contexto
    });

    // Actualizar la fila con la respuesta del bot
    await pool.query(
      'UPDATE conversations SET respuesta_bot = $1 WHERE id = $2',
      [respuestaIA, convId]
    );

    // Enviar respuesta a Kommo como nota
    await agregarNotaLead(leadId, respuestaIA);

    console.log(`[WEBHOOK] Respuesta enviada al lead ${leadId}`);

  } catch (error) {
    console.error('[WEBHOOK] Error procesando webhook:', error);
  }
}

module.exports = { manejarWebhook };
