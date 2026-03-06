const axios = require('axios');
const { Pool } = require('pg');
const { enviarSmsTwilio } = require('../services/twilio/twilioService');

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
    timeout: 15000
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function kommoGet(http, url, params = {}, reintentos = 3) {
  for (let i = 0; i <= reintentos; i++) {
    try {
      return await http.get(url, { params });
    } catch (e) {
      if (e.response?.status === 429 && i < reintentos) {
        await sleep(1000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

async function asegurarTablaContactos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contactos_kommo (
      id SERIAL PRIMARY KEY,
      kommo_id INTEGER UNIQUE NOT NULL,
      nombre VARCHAR(255),
      telefono VARCHAR(100),
      email VARCHAR(255),
      empresa VARCHAR(255),
      responsable VARCHAR(255),
      leads_count INTEGER DEFAULT 0,
      creado_en TIMESTAMP,
      actualizado_en TIMESTAMP,
      sincronizado_en TIMESTAMP DEFAULT NOW()
    )
  `);
}

// GET /api/contacts?search=xxx&page=1
async function obtenerContactos(req, res) {
  try {
    const { search = '', page = 1 } = req.query;
    const http = kommoHttp();

    const params = { limit: 50, page: Number(page), with: 'leads' };
    if (search) params.query = search;

    const resp = await kommoGet(http, '/api/v4/contacts', params);
    const contactos = resp.data?._embedded?.contacts || [];
    const total = resp.data?.total_items || contactos.length;

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

    res.json({ contactos: resultado, total, hasMore: contactos.length === 50 });
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

    const [respContacto] = await Promise.allSettled([
      http.get(`/api/v4/contacts/${id}?with=leads`)
    ]);

    if (respContacto.status === 'rejected') {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    const c = respContacto.value.data;
    const campos = c.custom_fields_values || [];
    const telefono = campos.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null;
    const email    = campos.find(f => f.field_code === 'EMAIL')?.values?.[0]?.value || null;
    const leadsKommo = c._embedded?.leads || [];

    // Historial en DB
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

// POST /api/admin/sync-contacts — sincroniza todos los contactos de Kommo a la DB
async function sincronizarContactos(req, res) {
  await asegurarTablaContactos();
  const http = kommoHttp();
  let pagina = 1;
  let total = 0;

  console.log('[SYNC CONTACTOS] Iniciando sincronización...');

  try {
    while (true) {
      const resp = await kommoGet(http, '/api/v4/contacts', { limit: 250, page: pagina, with: 'leads' });
      const contactos = resp.data?._embedded?.contacts || [];
      if (contactos.length === 0) break;

      for (const c of contactos) {
        const campos = c.custom_fields_values || [];
        const telefono = campos.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null;
        const email    = campos.find(f => f.field_code === 'EMAIL')?.values?.[0]?.value || null;
        const empresa  = campos.find(f => f.field_code === 'COMPANY')?.values?.[0]?.value || null;
        const leads    = c._embedded?.leads || [];

        await pool.query(`
          INSERT INTO contactos_kommo (kommo_id, nombre, telefono, email, empresa, leads_count, creado_en, actualizado_en, sincronizado_en)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (kommo_id) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            telefono = EXCLUDED.telefono,
            email = EXCLUDED.email,
            empresa = EXCLUDED.empresa,
            leads_count = EXCLUDED.leads_count,
            actualizado_en = EXCLUDED.actualizado_en,
            sincronizado_en = NOW()
        `, [
          c.id,
          c.name,
          telefono,
          email,
          empresa,
          leads.length,
          c.created_at ? new Date(c.created_at * 1000) : null,
          c.updated_at ? new Date(c.updated_at * 1000) : null,
        ]);
        total++;
      }

      console.log(`[SYNC CONTACTOS] Página ${pagina}: ${contactos.length} contactos (total: ${total})`);
      if (contactos.length < 250) break;
      pagina++;
      await sleep(200);
    }

    console.log(`[SYNC CONTACTOS] Completado: ${total} contactos sincronizados`);
    res.json({ ok: true, total });
  } catch (err) {
    console.error('[SYNC CONTACTOS]', err.message);
    res.status(500).json({ error: 'Error sincronizando contactos: ' + err.message });
  }
}

// Obtiene el teléfono del cliente para un lead — múltiples fuentes
async function obtenerTelefonoLead(http, leadId) {
  // 1. Buscar en nuestra DB (guardado cuando el cliente envió el primer SMS)
  try {
    const { rows } = await pool.query(
      `SELECT contact_phone FROM conversations
       WHERE lead_id = $1 AND contact_phone IS NOT NULL
       ORDER BY timestamp DESC LIMIT 1`,
      [String(leadId)]
    );
    if (rows[0]?.contact_phone) {
      console.log(`[REPLY] Teléfono encontrado en DB: ${rows[0].contact_phone}`);
      return rows[0].contact_phone;
    }
  } catch (e) {
    console.log(`[REPLY] DB lookup error:`, e.message);
  }

  // 2. Buscar en el contacto de Kommo
  try {
    const respLead = await http.get(`/api/v4/leads/${leadId}?with=contacts`);
    const contactoId = respLead.data._embedded?.contacts?.[0]?.id;
    if (contactoId) {
      const respContacto = await http.get(`/api/v4/contacts/${contactoId}`);
      const campos = respContacto.data.custom_fields_values || [];
      const tel = campos.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null;
      if (tel) {
        console.log(`[REPLY] Teléfono encontrado en contacto Kommo: ${tel}`);
        return tel;
      }
    }
  } catch (e) {
    console.log(`[REPLY] Kommo contact lookup error:`, e.message);
  }

  console.log(`[REPLY] No se encontró teléfono para lead ${leadId}`);
  return null;
}

// POST /api/reply  { leadId, mensaje }
async function responderManual(req, res) {
  try {
    const { leadId, mensaje } = req.body;
    if (!leadId || !mensaje?.trim()) {
      return res.status(400).json({ error: 'leadId y mensaje son requeridos' });
    }

    const http = kommoHttp();
    const texto = mensaje.trim();

    // Obtener teléfono del cliente
    const telefono = await obtenerTelefonoLead(http, leadId);
    console.log(`[REPLY] lead ${leadId} — teléfono: ${telefono}`);

    if (telefono) {
      // Enviar SMS real via Twilio
      await enviarSmsTwilio(telefono, texto);
      // Registrar en Kommo como nota para que quede visible en el CRM
      await http.post(`/api/v4/leads/${leadId}/notes`, [{
        note_type: 'common',
        params: { text: `📱 SMS enviado:\n\n${texto}` }
      }]).catch(e => console.log('[REPLY] No se pudo registrar nota en Kommo:', e.message));
    } else {
      // Sin teléfono: nota común como fallback
      console.log(`[REPLY] Sin teléfono — usando nota común como fallback`);
      await http.post(`/api/v4/leads/${leadId}/notes`, [{
        note_type: 'common',
        params: { text: texto }
      }]);
    }

    await pool.query(
      `INSERT INTO conversations (lead_id, contact_name, mensaje_cliente, respuesta_bot, timestamp)
       VALUES ($1, $2, $3, $4, NOW())`,
      [String(leadId), null, '[Respuesta manual desde dashboard]', texto]
    );

    res.json({ ok: true, viaTwilio: !!telefono });
  } catch (err) {
    console.error('[REPLY]', err.message);
    res.status(500).json({ error: 'Error enviando respuesta: ' + err.message });
  }
}

module.exports = { obtenerContactos, obtenerContacto, responderManual, sincronizarContactos };
