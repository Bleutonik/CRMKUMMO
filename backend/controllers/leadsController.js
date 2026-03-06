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

// GET /api/leads-crm?search=&pipeline=&status=&page=
async function obtenerLeadsCRM(req, res) {
  try {
    const { search = '', pipeline = '', status = '', page = 1 } = req.query;
    const params = { limit: 50, page: Number(page), with: 'contacts,pipeline,loss_reason' };
    if (search)   params.query = search;
    if (pipeline) params.pipeline_id = pipeline;
    if (status)   params.status = status;

    const r = await http().get('/api/v4/leads', { params });
    const leads = r.data?._embedded?.leads || [];

    const resultado = leads.map(l => ({
      id:            l.id,
      nombre:        l.name,
      valor:         l.price || 0,
      status_id:     l.status_id,
      pipeline_id:   l.pipeline_id,
      pipeline:      l._embedded?.pipeline?.name || null,
      etapa:         l._embedded?.stages?.name || null,
      contacto:      l._embedded?.contacts?.[0]?.name || null,
      contacto_id:   l._embedded?.contacts?.[0]?.id || null,
      responsable:   l.responsible_user_id,
      creado_en:     l.created_at ? new Date(l.created_at * 1000).toISOString() : null,
      actualizado:   l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null,
      cerrado_en:    l.closed_at  ? new Date(l.closed_at  * 1000).toISOString() : null,
    }));

    res.json({ leads: resultado, total: resultado.length });
  } catch (err) {
    console.error('[LEADS]', err.message);
    res.status(500).json({ error: 'Error obteniendo leads' });
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
    const r = await http().get(`/api/v4/leads/${req.params.id}?with=contacts,pipeline,loss_reason`);
    const l = r.data;
    const notasR = await http().get(`/api/v4/leads/${req.params.id}/notes?limit=50`).catch(() => ({ data: null }));
    const notas = notasR.data?._embedded?.notes || [];

    const campos = l.custom_fields_values || [];
    const contactoId = l._embedded?.contacts?.[0]?.id;
    let contacto = null;
    if (contactoId) {
      const cr = await http().get(`/api/v4/contacts/${contactoId}`).catch(() => ({ data: null }));
      if (cr.data) {
        const cf = cr.data.custom_fields_values || [];
        contacto = {
          id:       cr.data.id,
          nombre:   cr.data.name,
          telefono: cf.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null,
          email:    cf.find(f => f.field_code === 'EMAIL')?.values?.[0]?.value  || null,
        };
      }
    }

    res.json({
      id:          l.id,
      nombre:      l.name,
      valor:       l.price || 0,
      status_id:   l.status_id,
      pipeline_id: l.pipeline_id,
      pipeline:    l._embedded?.pipeline?.name || null,
      etapa:       l._embedded?.stages?.name || null,
      contacto,
      creado_en:   l.created_at ? new Date(l.created_at * 1000).toISOString() : null,
      actualizado: l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null,
      notas: notas
        .sort((a, b) => b.created_at - a.created_at)
        .map(n => ({
          id:        n.id,
          tipo:      n.note_type,
          texto:     n.params?.text || null,
          creado_en: n.created_at ? new Date(n.created_at * 1000).toISOString() : null,
        })),
    });
  } catch (err) {
    console.error('[LEAD DETALLE]', err.message);
    res.status(500).json({ error: 'Error obteniendo lead' });
  }
}

// PATCH /api/leads-crm/:id/status  { status_id }
async function actualizarEtapa(req, res) {
  try {
    const { status_id, pipeline_id } = req.body;
    const payload = { status_id };
    if (pipeline_id) payload.pipeline_id = pipeline_id;
    await http().patch(`/api/v4/leads`, [{ id: Number(req.params.id), ...payload }]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[LEAD STATUS]', err.message);
    res.status(500).json({ error: 'Error actualizando etapa' });
  }
}

// POST /api/leads-crm/:id/note  { texto }
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
    res.status(500).json({ error: 'Error agregando nota' });
  }
}

module.exports = { obtenerLeadsCRM, obtenerPipelines, obtenerLeadDetalle, actualizarEtapa, agregarNota };
