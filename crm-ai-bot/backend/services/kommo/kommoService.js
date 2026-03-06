const axios = require('axios');

const _subdomain = process.env.KOMMO_SUBDOMAIN || '';
const BASE_URL = process.env.KOMMO_BASE_URL
  || (_subdomain.includes('.') ? `https://${_subdomain}` : `https://${_subdomain}.kommo.com`);
const TOKEN = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

const headers = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
});

async function agregarNotaLead(leadId, texto) {
  try {
    const respuesta = await axios.post(
      `${BASE_URL}/api/v4/leads/${leadId}/notes`,
      [{ note_type: 'common', params: { text: `🤖 Asistente IA:\n\n${texto}` } }],
      { headers: headers() }
    );
    console.log(`Nota agregada al lead ${leadId}`);
    return respuesta.data;
  } catch (error) {
    console.error('Error agregando nota a Kommo:', error.response?.data || error.message);
    throw error;
  }
}

// Sin parámetro 'with' para evitar 404 en Kommo
async function obtenerInfoLead(leadId) {
  try {
    const respuesta = await axios.get(
      `${BASE_URL}/api/v4/leads/${leadId}`,
      { headers: headers(), timeout: 8000 }
    );
    const lead = respuesta.data;
    return {
      nombre:   lead.name,
      pipeline: lead.pipeline_id,
    };
  } catch (error) {
    console.error('Error obteniendo info del lead:', error.response?.status, error.message);
    return {};
  }
}

async function obtenerContactoLead(leadId) {
  try {
    // 1. Obtener lead para conseguir el ID del contacto
    const respLead = await axios.get(
      `${BASE_URL}/api/v4/leads/${leadId}`,
      { headers: headers(), timeout: 8000 }
    );
    const contactos = respLead.data._embedded?.contacts;
    if (!contactos?.length) return {};

    // 2. Obtener datos del contacto
    const contactoId = contactos[0].id;
    const respContacto = await axios.get(
      `${BASE_URL}/api/v4/contacts/${contactoId}`,
      { headers: headers(), timeout: 8000 }
    );

    const contacto = respContacto.data;
    const campos = contacto.custom_fields_values || [];
    return {
      nombre:   contacto.name,
      email:    campos.find(c => c.field_code === 'EMAIL')?.values?.[0]?.value || null,
      telefono: campos.find(c => c.field_code === 'PHONE')?.values?.[0]?.value || null,
    };
  } catch (error) {
    console.error('Error obteniendo contacto:', error.response?.status, error.message);
    return {};
  }
}

// Envía un mensaje de texto real a través de Kommo Talk (SMS/canal de mensajería)
// note_type 103 = Talk outgoing — Kommo lo reenvía al cliente por el canal activo
async function enviarMensajeTalk(leadId, talkId, texto) {
  try {
    const params = { text: texto };
    if (talkId) params.talk_id = Number(talkId);
    const respuesta = await axios.post(
      `${BASE_URL}/api/v4/leads/${leadId}/notes`,
      [{ note_type: 103, params }],
      { headers: headers() }
    );
    console.log(`[KOMMO] Mensaje Talk (tipo 103) enviado al lead ${leadId}`);
    return respuesta.data;
  } catch (error) {
    console.error('[KOMMO] Error enviando Talk, usando nota común como fallback:', error.response?.data || error.message);
    return agregarNotaLead(leadId, texto);
  }
}

module.exports = { agregarNotaLead, enviarMensajeTalk, obtenerInfoLead, obtenerContactoLead };
