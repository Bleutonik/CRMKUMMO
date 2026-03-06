const { pool } = require('../services/database/db');
const { generarRespuestaAI, extraerIntento } = require('../services/ai/claudeService');
const { agregarNotaLead, obtenerInfoLead, obtenerContactoLead } = require('../services/kommo/kommoService');
const { enviarSmsTwilio } = require('../services/twilio/twilioService');

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
    let talkId = null;

    if (msgTwilio) {
      // Mensaje saliente desde Kommo (agente humano respondiendo) — guardar en DB, NO responder con bot
      if (msgTwilio.type === 'outgoing') {
        const lId = String(msgTwilio.element_id || msgTwilio.entity_id || msgTwilio.lead_id || '');
        const texto = msgTwilio.text;
        if (lId && texto) {
          await pool.query(
            `INSERT INTO conversations (lead_id, contact_name, mensaje_cliente, respuesta_bot, timestamp) VALUES ($1, $2, NULL, $3, NOW())`,
            [lId, msgTwilio.author?.name || null, texto]
          ).catch(() => {});
          console.log(`[WEBHOOK] Mensaje saliente de agente guardado en DB — lead ${lId}: "${texto.slice(0,50)}"`);
        }
        return;
      }
      textoMensaje = msgTwilio.text;
      leadId = String(msgTwilio.element_id || msgTwilio.entity_id || msgTwilio.lead_id || '');
      autorNombre = msgTwilio.author?.name || null;
      talkId = msgTwilio.talk_id || msgTwilio.params?.talk_id || null;
      console.log('[WEBHOOK] Formato Twilio detectado');

    } else if (notaKommo) {
      const tipo = String(notaKommo.note_type);

      // Detectar si la nota la creó nuestro bot (para evitar bucles)
      let esDelBot = false;
      try {
        const meta = JSON.parse(notaKommo.metadata || '{}');
        esDelBot = meta?.event_source?.author_name === 'AI CRM Bot';
      } catch {}
      const textoNota = notaKommo.text || notaKommo.params?.text || '';
      if (!esDelBot && textoNota.startsWith('📱 ')) esDelBot = true; // nuestro reply manual
      if (!esDelBot && textoNota.startsWith('🤖 Asistente IA:')) esDelBot = true;

      // SALIENTES (26/103) y notas internas (4) de agentes humanos — guardar en DB, NO responder
      const SALIENTES_Y_NOTAS = ['26', '103', '4'];
      if (SALIENTES_Y_NOTAS.includes(tipo)) {
        if (esDelBot) {
          console.log(`[WEBHOOK] Nota tipo ${tipo} del bot, ignorando`);
          return;
        }
        // Es un mensaje enviado por un agente humano desde Kommo — guardarlo en el dashboard
        const lId = String(notaKommo.element_id || '');
        if (lId && textoNota) {
          await pool.query(
            `INSERT INTO conversations (lead_id, mensaje_cliente, respuesta_bot, timestamp) VALUES ($1, NULL, $2, NOW())`,
            [lId, textoNota]
          ).catch(() => {});
          console.log(`[WEBHOOK] Mensaje de agente (tipo ${tipo}) guardado en DB para lead ${lId}`);
        }
        return;
      }

      // ENTRANTES de cliente: 25 = WhatsApp/SMS entrante, 102 = Kommo Talk entrante
      const ENTRANTES_ACEPTADOS = ['25', '102'];
      if (!ENTRANTES_ACEPTADOS.includes(tipo)) {
        console.log(`[WEBHOOK] Nota tipo ${tipo} ignorada`);
        return;
      }

      textoMensaje = notaKommo.text || notaKommo.params?.text;
      leadId = String(notaKommo.element_id || '');
      talkId = notaKommo.params?.talk_id || notaKommo.talk_id || null;
      console.log(`[WEBHOOK] Mensaje entrante tipo ${tipo} detectado, talk_id: ${talkId}`);

    } else {
      // Intentar capturar mensajes salientes de agentes via talk.update
      const talkUpdate = cuerpo?.talk?.update?.[0];
      if (talkUpdate) {
        const entityId = String(talkUpdate.entity_id || '');
        const chatId   = talkUpdate.chat_id || null;
        console.log(`[WEBHOOK] talk.update — lead: ${entityId}, chat_id: ${chatId}`);

        if (entityId && chatId) {
          // Buscar el último mensaje saliente en este chat via Kommo Chats API
          try {
            const axios = require('axios');
            const _sub = process.env.KOMMO_SUBDOMAIN || '';
            const BASE = process.env.KOMMO_BASE_URL || (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`);
            const TOKEN = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

            const resp = await axios.get(`${BASE}/api/v4/chats/${chatId}/messages`, {
              headers: { Authorization: `Bearer ${TOKEN}` },
              params: { limit: 5 },
              timeout: 8000
            });
            const mensajes = resp.data?._embedded?.messages || [];
            console.log(`[TALK] Chat ${chatId}: ${mensajes.length} mensajes recientes`);

            // Guardar mensajes salientes de agentes que no hayamos guardado ya
            for (const msg of mensajes) {
              if (msg.type !== 'outgoing') continue;
              const texto = msg.content?.text || msg.text || null;
              if (!texto) continue;
              // Evitar duplicar mensajes del bot
              if (texto.startsWith('🤖 Asistente IA:') || texto.startsWith('📱 ')) continue;

              const existe = await pool.query(
                `SELECT id FROM conversations WHERE lead_id=$1 AND respuesta_bot=$2 AND timestamp > NOW() - INTERVAL '5 minutes'`,
                [entityId, texto]
              );
              if (existe.rows.length === 0) {
                await pool.query(
                  `INSERT INTO conversations (lead_id, mensaje_cliente, respuesta_bot, timestamp) VALUES ($1, NULL, $2, NOW())`,
                  [entityId, texto]
                );
                console.log(`[TALK] Mensaje saliente guardado para lead ${entityId}: "${texto.slice(0,60)}"`);
              }
            }
          } catch (e) {
            console.log(`[TALK] Error obteniendo mensajes del chat ${chatId}: ${e.response?.status} ${e.message}`);
          }
        }
        return;
      }

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

    // SIEMPRE guardar el mensaje con el teléfono del cliente para poder responder después
    const insertResult = await pool.query(`
      INSERT INTO conversations (lead_id, contact_name, contact_phone, mensaje_cliente, respuesta_bot)
      VALUES ($1, $2, $3, $4, NULL)
      RETURNING id
    `, [leadId, contactName, contactTelefono, textoMensaje]);

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

    // Detectar intención de compra y limpiar el tag de la respuesta
    const { texto: respuestaLimpia, tieneIntento } = extraerIntento(respuestaIA);

    // Guardar alerta si hay intención de compra
    if (tieneIntento) {
      await pool.query(
        'INSERT INTO alertas (lead_id, contact_name, mensaje_cliente, respuesta_bot, tipo) VALUES ($1,$2,$3,$4,$5)',
        [leadId, contactName, textoMensaje, respuestaLimpia, 'intencion_compra']
      );
      console.log(`[WEBHOOK] ⚡ Alerta de intención de compra guardada — lead ${leadId}`);
    }

    // Actualizar la fila con la respuesta limpia (sin el tag)
    await pool.query(
      'UPDATE conversations SET respuesta_bot = $1 WHERE id = $2',
      [respuestaLimpia, convId]
    );

    // Enviar SMS real via Twilio al número del cliente
    if (contactTelefono) {
      await enviarSmsTwilio(contactTelefono, respuestaLimpia);
      // Registrar en Kommo para que quede visible en el CRM
      await agregarNotaLead(leadId, respuestaLimpia);
    } else {
      // Sin teléfono: nota común como fallback
      console.log('[WEBHOOK] Sin teléfono — usando nota común como fallback');
      await agregarNotaLead(leadId, respuestaLimpia);
    }

    console.log(`[WEBHOOK] Respuesta automática enviada al lead ${leadId}`);

  } catch (error) {
    console.error('[WEBHOOK] Error procesando webhook:', error);
  }
}

module.exports = { manejarWebhook };
