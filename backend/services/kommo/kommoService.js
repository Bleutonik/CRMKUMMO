const axios = require('axios');

const BASE_URL = process.env.KOMMO_BASE_URL; // ej: https://tudominio.kommo.com
const TOKEN = process.env.KOMMO_TOKEN;

const headers = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
});

async function agregarNotaLead(leadId, texto) {
  try {
    const respuesta = await axios.post(
      `${BASE_URL}/api/v4/leads/${leadId}/notes`,
      [{
        note_type: 'common',
        params: {
          text: `🤖 Asistente IA:\n\n${texto}`
        }
      }],
      { headers: headers() }
    );
    console.log(`Nota agregada al lead ${leadId}`);
    return respuesta.data;
  } catch (error) {
    console.error('Error agregando nota a Kommo:', error.response?.data || error.message);
    throw error;
  }
}

async function obtenerInfoLead(leadId) {
  try {
    const respuesta = await axios.get(
      `${BASE_URL}/api/v4/leads/${leadId}?with=contacts,pipeline,loss_reason`,
      { headers: headers() }
    );
    const lead = respuesta.data;

    return {
      nombre: lead.name,
      etapa: lead._embedded?.stages?.name,
      pipeline: lead._embedded?.pipeline?.name,
      responsable: lead.responsible_user_id
    };
  } catch (error) {
    console.error('Error obteniendo info del lead:', error.response?.data || error.message);
    return {};
  }
}

async function obtenerContactoLead(leadId) {
  try {
    const respuesta = await axios.get(
      `${BASE_URL}/api/v4/leads/${leadId}?with=contacts`,
      { headers: headers() }
    );

    const contactos = respuesta.data._embedded?.contacts;
    if (!contactos || contactos.length === 0) return {};

    const contactoId = contactos[0].id;
    const respContacto = await axios.get(
      `${BASE_URL}/api/v4/contacts/${contactoId}`,
      { headers: headers() }
    );

    const contacto = respContacto.data;
    const campos = contacto.custom_fields_values || [];

    const email = campos.find(c => c.field_code === 'EMAIL')?.values?.[0]?.value;
    const telefono = campos.find(c => c.field_code === 'PHONE')?.values?.[0]?.value;

    return {
      nombre: contacto.name,
      email,
      telefono
    };
  } catch (error) {
    console.error('Error obteniendo contacto:', error.response?.data || error.message);
    return {};
  }
}

module.exports = { agregarNotaLead, obtenerInfoLead, obtenerContactoLead };
