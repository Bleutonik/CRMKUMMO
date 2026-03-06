const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const _sub = process.env.KOMMO_SUBDOMAIN || '';
const BASE_URL = process.env.KOMMO_BASE_URL
  || (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`);
const TOKEN = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

function kommoHttp() {
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: 10000
  });
}

// GET /api/contacts?search=xxx&page=1
async function obtenerContactos(req, res) {
  try {
    const { search = '', page = 1 } = req.query;
    const http = kommoHttp();

    const params = { limit: 50, page: Number(page), with: 'leads' };
    if (search) params.query = search;

    const resp = await http.get('/api/v4/contacts', { params });
    const contactos = resp.data?._embedded?.contacts || [];

    const resultado = contactos.map(c => {
      const campos = c.custom_fields_values || [];
      const telefono = campos.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null;
      const email    = campos.find(f => f.field_code === 'EMAIL')?.values?.[0]?.value || null;
      const leads    = c._embedded?.leads || [];

      return {
        id:           c.id,
        nombre:       c.name,
        telefono,
        email,
        leads_count:  leads.length,
        lead_id:      leads[0]?.id || null,
        creado_en:    c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
        actualizado:  c.updated_at ? new Date(c.updated_at * 1000).toISOString() : null,
      };
    });

    res.json({ contactos: resultado, total: resultado.length });
  } catch (err) {
    console.error('[CONTACTS]', err.message);
    res.status(500).json({ error: 'Error obteniendo contactos de Kommo' });
  }
}

// GET /api/contacts/:id
async function obtenerContacto(req, res) {
  try {
    const http = kommoHttp();
    const { id } = req.params;

    const [respContacto, respLeads] = await Promise.all([
      http.get(`/api/v4/contacts/${id}?with=leads`),
      http.get(`/api/v4/contacts/${id}/leads?limit=20`).catch(() => ({ data: null }))
    ]);

    const c = respContacto.data;
    const campos = c.custom_fields_values || [];
    const telefono = campos.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null;
    const email    = campos.find(f => f.field_code === 'EMAIL')?.values?.[0]?.value || null;
    const leadsKommo = c._embedded?.leads || [];

    // Historial de conversaciones de este contacto en nuestra DB
    const leadIds = leadsKommo.map(l => String(l.id));
    let conversaciones = [];
    if (leadIds.length > 0) {
      const placeholders = leadIds.map((_, i) => `$${i + 1}`).join(',');
      const { rows } = await pool.query(
        `SELECT * FROM conversations WHERE lead_id IN (${placeholders}) ORDER BY timestamp DESC LIMIT 50`,
        leadIds
      );
      conversaciones = rows;
    }

    res.json({
      id: c.id,
      nombre: c.name,
      telefono,
      email,
      leads: leadsKommo.map(l => ({ id: l.id })),
      conversaciones,
      creado_en:   c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      actualizado: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : null,
    });
  } catch (err) {
    console.error('[CONTACTS] detalle:', err.message);
    res.status(500).json({ error: 'Error obteniendo contacto' });
  }
}

// POST /api/reply  { leadId, mensaje }
async function responderManual(req, res) {
  try {
    const { leadId, mensaje } = req.body;
    if (!leadId || !mensaje?.trim()) {
      return res.status(400).json({ error: 'leadId y mensaje son requeridos' });
    }

    const http = kommoHttp();

    // Agregar nota en Kommo
    await http.post(`/api/v4/leads/${leadId}/notes`, [{
      note_type: 'common',
      params: { text: mensaje.trim() }
    }]);

    // Guardar en nuestra DB como respuesta manual
    await pool.query(
      `INSERT INTO conversations (lead_id, contact_name, mensaje_cliente, respuesta_bot, timestamp)
       VALUES ($1, $2, $3, $4, NOW())`,
      [String(leadId), null, '[Respuesta manual desde dashboard]', mensaje.trim()]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[REPLY]', err.message);
    res.status(500).json({ error: 'Error enviando respuesta: ' + err.message });
  }
}

module.exports = { obtenerContactos, obtenerContacto, responderManual };
