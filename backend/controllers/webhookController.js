const { pool } = require('../services/database/db');
const { generarRespuesta } = require('../services/ai/claudeService');
const { agregarNotaLead, obtenerInfoLead, obtenerContactoLead } = require('../services/kommo/kommoService');

async function manejarWebhook(req, res) {
  // Responder inmediatamente a Kommo (evitar timeout)
  res.status(200).json({ recibido: true });

  try {
    const cuerpo = req.body;
    console.log('[WEBHOOK] Datos recibidos:', JSON.stringify(cuerpo, null, 2));

    // Extraer mensaje según formato de Kommo (message.add)
    const textoNota = cuerpo?.message?.add?.[0]?.text;

    if (!textoNota) {
      console.log('[WEBHOOK] Sin mensaje en el payload, ignorando');
      return;
    }

    console.log(`Mensaje recibido: ${textoNota}`);

    // Extraer lead_id desde message.add o fallback a leads.note
    const mensajeObj = cuerpo?.message?.add?.[0];
    const leadId = mensajeObj?.lead_id || cuerpo?.leads?.note?.[0]?.lead_id;

    if (!leadId) {
      console.log('[WEBHOOK] Sin lead_id en el payload, ignorando');
      return;
    }

    // Ignorar notas del propio bot
    if (textoNota.startsWith('🤖 Asistente IA:')) {
      console.log('[WEBHOOK] Nota del bot, ignorando para evitar bucle');
      return;
    }

    console.log(`[WEBHOOK] Procesando mensaje del lead ${leadId}: "${textoNota.substring(0, 100)}..."`);

    // Obtener o crear lead en la BD
    const lead = await obtenerOCrearLead(leadId);

    // Obtener o crear conversación
    const conversacion = await obtenerOCrearConversacion(lead.id, leadId);

    // Guardar mensaje del cliente
    await guardarMensaje(conversacion.id, leadId, 'cliente', textoNota);

    // Obtener info del lead para contexto
    const infoLead = await obtenerInfoLead(leadId);

    // Generar respuesta con IA
    const resultadoIA = await generarRespuesta(textoNota, leadId, infoLead);

    if (resultadoIA.error) {
      await guardarMensaje(conversacion.id, leadId, 'sistema', 'Error al generar respuesta', 0, 0, true, resultadoIA.detalleError);
      console.error('[WEBHOOK] Error en IA para lead', leadId);
      return;
    }

    // Guardar respuesta del asistente
    await guardarMensaje(
      conversacion.id,
      leadId,
      'asistente',
      resultadoIA.texto,
      resultadoIA.tokensUsados,
      resultadoIA.tiempoMs
    );

    // Actualizar contador de conversación
    await pool.query(`
      UPDATE conversaciones
      SET total_mensajes = total_mensajes + 2,
          ultimo_mensaje_en = NOW(),
          actualizado_en = NOW()
      WHERE id = $1
    `, [conversacion.id]);

    // Enviar respuesta a Kommo como nota
    await agregarNotaLead(leadId, resultadoIA.texto);

    console.log(`[WEBHOOK] Respuesta enviada al lead ${leadId} (${resultadoIA.tiempoMs}ms, ${resultadoIA.tokensUsados} tokens)`);

  } catch (error) {
    console.error('[WEBHOOK] Error procesando webhook:', error);
  }
}

async function obtenerOCrearLead(kommoLeadId) {
  // Buscar lead existente
  let resultado = await pool.query(
    'SELECT * FROM leads WHERE kommo_lead_id = $1',
    [kommoLeadId]
  );

  if (resultado.rows.length > 0) return resultado.rows[0];

  // Intentar obtener info del contacto
  let infoContacto = {};
  try {
    infoContacto = await obtenerContactoLead(kommoLeadId);
  } catch {}

  // Crear nuevo lead
  resultado = await pool.query(`
    INSERT INTO leads (kommo_lead_id, nombre, contacto_nombre, contacto_email, contacto_telefono)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    kommoLeadId,
    `Lead #${kommoLeadId}`,
    infoContacto.nombre || null,
    infoContacto.email || null,
    infoContacto.telefono || null
  ]);

  return resultado.rows[0];
}

async function obtenerOCrearConversacion(leadId, kommoLeadId) {
  let resultado = await pool.query(
    'SELECT * FROM conversaciones WHERE kommo_lead_id = $1 AND estado = $2',
    [kommoLeadId, 'activa']
  );

  if (resultado.rows.length > 0) return resultado.rows[0];

  resultado = await pool.query(`
    INSERT INTO conversaciones (lead_id, kommo_lead_id, ultimo_mensaje_en)
    VALUES ($1, $2, NOW())
    RETURNING *
  `, [leadId, kommoLeadId]);

  return resultado.rows[0];
}

async function guardarMensaje(conversacionId, kommoLeadId, rol, contenido, tokens = 0, tiempoMs = 0, esError = false, detalleError = null) {
  await pool.query(`
    INSERT INTO mensajes (conversacion_id, kommo_lead_id, rol, contenido, tokens_usados, tiempo_respuesta_ms, error, detalle_error)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [conversacionId, kommoLeadId, rol, contenido, tokens, tiempoMs, esError, detalleError]);
}

module.exports = { manejarWebhook };
