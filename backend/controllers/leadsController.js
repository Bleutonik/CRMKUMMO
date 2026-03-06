const axios = require('axios');

const _sub = process.env.KOMMO_SUBDOMAIN || '';
const BASE_URL = process.env.KOMMO_BASE_URL
  || (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`);
const TOKEN = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

function http() {
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    timeout: 10000
  });
}

// GET /api/leads-crm?search=&pipeline=&page=
async function obtenerLeadsCRM(req, res) {
  try {
    const { search = '', pipeline = '', page = 1 } = req.query;
    const params = { limit: 50, page: Number(page), with: 'contacts,pipeline' };
    if (search)   params.query = search;
    if (pipeline) params.pipeline_id = pipeline;

    const r = await http().get('/api/v4/leads', { params });
    const leads = r.data?._embedded?.leads || [];

    const resultado = leads.map(l => ({
      id:          l.id,
      nombre:      l.name,
      valor:       l.price || 0,
      status_id:   l.status_id,
      pipeline_id: l.pipeline_id,
      pipeline:    l._embedded?.pipelines?.[0]?.name || l._embedded?.pipeline?.name || null,
      contacto:    l._embedded?.contacts?.[0]?.name || null,
      contacto_id: l._embedded?.contacts?.[0]?.id || null,
      creado_en:   l.created_at ? new Date(l.created_at * 1000).toISOString() : null,
      actualizado: l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null,
    }));

    res.json({ leads: resultado, total: resultado.length });
  } catch (err) {
    console.error('[LEADS]', err.message);
    res.status(500).json({ error: 'Error obteniendo leads: ' + err.message });
  }
}

// GET /api/pipelines
async function obtenerPipelines(req, res) {
  try {
    const r = await http().get('/api/v4/pipelines?with=statuses');
    const pipelines = r.data?._embedded?.pipelines || [];
    res.json({ pipelines });
  } catch (err) {
    console.error('[PIPELINES]', err.message);
    res.status(500).json({ error: 'Error obteniendo pipelines' });
  }
}

// GET /api/leads-crm/:id
async function obtenerLeadDetalle(req, res) {
  try {
    const id = req.params.id;
    const client = http();

    // Obtener lead y notas en paralelo
    const [leadR, notasR] = await Promise.all([
      client.get(`/api/v4/leads/${id}`, { params: { with: 'contacts,pipeline' } }),
      client.get(`/api/v4/leads/${id}/notes`, { params: { limit: 50 } }).catch(() => ({ data: null }))
    ]);

    const l = leadR.data;
    const notas = (notasR.data?._embedded?.notes || [])
      .sort((a, b) => b.created_at - a.created_at)
      .map(n => {
        let textoNota = n.params?.text || null;
        // Si es JSON (email tipo 15), extraer resumen
        if (typeof textoNota === 'string' && textoNota.startsWith('{')) {
          try { textoNota = JSON.parse(textoNota).content_summary || textoNota; } catch {}
        }
        return {
          id:        n.id,
          tipo:      n.note_type,
          texto:     textoNota,
          creado_en: n.created_at ? new Date(n.created_at * 1000).toISOString() : null,
        };
      })
      .filter(n => n.texto);

    // Datos del contacto embebido (sin llamada extra)
    const contactoEmb = l._embedded?.contacts?.[0] || null;

    // Intentar obtener teléfono/email del contacto (opcional, no bloquea)
    let contacto = contactoEmb ? { id: contactoEmb.id, nombre: contactoEmb.name, telefono: null, email: null } : null;
    if (contactoEmb?.id) {
      try {
        const cr = await client.get(`/api/v4/contacts/${contactoEmb.id}`);
        const cf = cr.data?.custom_fields_values || [];
        contacto.telefono = cf.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null;
        contacto.email    = cf.find(f => f.field_code === 'EMAIL')?.values?.[0]?.value  || null;
      } catch {}
    }

    res.json({
      id:          l.id,
      nombre:      l.name,
      valor:       l.price || 0,
      status_id:   l.status_id,
      pipeline_id: l.pipeline_id,
      pipeline:    l._embedded?.pipelines?.[0]?.name || l._embedded?.pipeline?.name || null,
      contacto,
      creado_en:   l.created_at ? new Date(l.created_at * 1000).toISOString() : null,
      actualizado: l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null,
      notas,
    });
  } catch (err) {
    console.error('[LEAD DETALLE]', err.message);
    res.status(500).json({ error: 'Error cargando lead: ' + err.message });
  }
}

// PATCH /api/leads-crm/:id/status
async function actualizarEtapa(req, res) {
  try {
    const { status_id, pipeline_id } = req.body;
    const payload = [{ id: Number(req.params.id), status_id }];
    if (pipeline_id) payload[0].pipeline_id = pipeline_id;
    await http().patch('/api/v4/leads', payload);
    res.json({ ok: true });
  } catch (err) {
    console.error('[LEAD STATUS]', err.message);
    res.status(500).json({ error: 'Error actualizando etapa: ' + err.message });
  }
}

// POST /api/leads-crm/:id/note
async function agregarNota(req, res) {
  try {
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ error: 'texto requerido' });
    await http().post(`/api/v4/leads/${req.params.id}/notes`, [{
      note_type: 'common',
      params: { text: texto.trim() }
    }]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[NOTA]', err.message);
    res.status(500).json({ error: 'Error agregando nota: ' + err.message });
  }
}

module.exports = { obtenerLeadsCRM, obtenerPipelines, obtenerLeadDetalle, actualizarEtapa, agregarNota };
