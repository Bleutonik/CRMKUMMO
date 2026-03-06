const axios = require('axios');

const _sub = process.env.KOMMO_SUBDOMAIN || '';
const BASE_URL = process.env.KOMMO_BASE_URL
  || (_sub.includes('.') ? `https://${_sub}` : `https://${_sub}.kommo.com`);
const TOKEN = process.env.KOMMO_ACCESS_TOKEN || process.env.KOMMO_TOKEN;

function http() {
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    timeout: 15000
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function kommoGet(client, url, params = {}, reintentos = 3) {
  for (let i = 0; i <= reintentos; i++) {
    try {
      return await client.get(url, { params });
    } catch (e) {
      if (e.response?.status === 429 && i < reintentos) {
        await sleep(1000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

// GET /api/leads-crm?search=&pipeline=&page=
async function obtenerLeadsCRM(req, res) {
  try {
    const { search = '', pipeline = '', page = 1 } = req.query;
    const client = http();
    const params = { limit: 250, page: Number(page), with: 'contacts,pipeline' };
    if (search)   params.query = search;
    if (pipeline) params.pipeline_id = pipeline;

    const r = await kommoGet(client, '/api/v4/leads', params);
    const leads = r.data?._embedded?.leads || [];
    const total = r.data?.total_items || leads.length;

    const resultado = leads.map(l => ({
      id:          l.id,
      nombre:      l.name,
      valor:       l.price || 0,
      status_id:   l.status_id,
      pipeline_id: l.pipeline_id,
      pipeline:    l._embedded?.pipelines?.[0]?.name || l._embedded?.pipeline?.name || null,
      contacto:    l._embedded?.contacts?.[0]?.name || null,
      contacto_id: l._embedded?.contacts?.[0]?.id   || null,
      creado_en:   l.created_at ? new Date(l.created_at * 1000).toISOString() : null,
      actualizado: l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null,
    }));

    console.log(`[LEADS] Página ${page}: ${resultado.length} leads (total: ${total})`);
    res.json({ leads: resultado, total, page: Number(page), hasMore: resultado.length === 250 });
  } catch (err) {
    console.error('[LEADS]', err.response?.status, err.message);
    res.status(500).json({ error: 'Error obteniendo leads: ' + err.message });
  }
}

// GET /api/pipelines
async function obtenerPipelines(req, res) {
  try {
    const client = http();
    // Try with=statuses inline first
    let pipelines = [];
    try {
      const r = await kommoGet(client, '/api/v4/leads/pipelines?with=statuses');
      pipelines = r.data?._embedded?.pipelines || [];
      console.log(`[PIPELINES] Got ${pipelines.length} pipelines with inline statuses`);
    } catch {
      const r = await kommoGet(client, '/api/v4/leads/pipelines');
      pipelines = r.data?._embedded?.pipelines || [];
      console.log(`[PIPELINES] Got ${pipelines.length} pipelines (no inline statuses)`);
    }

    const withStatuses = await Promise.all(pipelines.map(async (pip) => {
      // If statuses already embedded, use them
      if (pip._embedded?.statuses) {
        const statusMap = {};
        const statusArr = Array.isArray(pip._embedded.statuses)
          ? pip._embedded.statuses
          : Object.values(pip._embedded.statuses);
        statusArr.forEach(s => { statusMap[s.id] = s; });
        console.log(`[PIPELINES] Pipeline ${pip.id} "${pip.name}": ${statusArr.length} statuses inline`);
        return { ...pip, _embedded: { ...pip._embedded, statuses: statusMap } };
      }
      // Otherwise fetch separately
      try {
        const sr = await kommoGet(client, `/api/v4/leads/pipelines/${pip.id}/statuses`);
        const statuses = sr.data?._embedded?.statuses || [];
        const statusMap = {};
        statuses.forEach(s => { statusMap[s.id] = s; });
        console.log(`[PIPELINES] Pipeline ${pip.id} "${pip.name}": ${statuses.length} statuses fetched`);
        return { ...pip, _embedded: { ...pip._embedded, statuses: statusMap } };
      } catch (e) {
        console.log(`[PIPELINES] Pipeline ${pip.id} statuses failed: ${e.message}`);
        return pip;
      }
    }));

    res.json({ pipelines: withStatuses });
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[PIPELINES] HTTP ${status} — ${detail}`);
    res.status(500).json({ error: `Error obteniendo pipelines: HTTP ${status || '?'} — ${err.message}` });
  }
}

// GET /api/leads-crm/:id
async function obtenerLeadDetalle(req, res) {
  const id = req.params.id;
  const client = http();
  console.log(`[LEAD DETALLE] Fetching lead ${id}`);

  try {
    const leadR = await kommoGet(client, `/api/v4/leads/${id}`);
    const l = leadR.data;
    console.log(`[LEAD DETALLE] Lead ${id} ok: ${l.name}`);

    const [notasR, contactosR] = await Promise.allSettled([
      kommoGet(client, `/api/v4/leads/${id}/notes`, { limit: 50 }),
      l._embedded?.contacts?.[0]?.id
        ? kommoGet(client, `/api/v4/contacts/${l._embedded.contacts[0].id}`)
        : Promise.resolve(null)
    ]);

    const notas = (notasR.status === 'fulfilled'
      ? notasR.value.data?._embedded?.notes || []
      : []
    ).sort((a, b) => b.created_at - a.created_at)
     .map(n => {
       let texto = n.params?.text || null;
       if (typeof texto === 'string' && texto.startsWith('{')) {
         try { texto = JSON.parse(texto).content_summary || texto; } catch {}
       }
       return {
         id:        n.id,
         tipo:      n.note_type,
         texto,
         creado_en: n.created_at ? new Date(n.created_at * 1000).toISOString() : null,
       };
     }).filter(n => n.texto);

    let contacto = null;
    const contactoEmb = l._embedded?.contacts?.[0];
    if (contactoEmb) {
      contacto = { id: contactoEmb.id, nombre: contactoEmb.name, telefono: null, email: null };
      if (contactosR.status === 'fulfilled' && contactosR.value) {
        const cf = contactosR.value.data?.custom_fields_values || [];
        contacto.telefono = cf.find(f => f.field_code === 'PHONE')?.values?.[0]?.value || null;
        contacto.email    = cf.find(f => f.field_code === 'EMAIL')?.values?.[0]?.value  || null;
      }
    }

    res.json({
      id:          l.id,
      nombre:      l.name,
      valor:       l.price || 0,
      status_id:   l.status_id,
      pipeline_id: l.pipeline_id,
      contacto,
      creado_en:   l.created_at ? new Date(l.created_at * 1000).toISOString() : null,
      actualizado: l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null,
      notas,
    });

  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[LEAD DETALLE] Error lead ${id}: HTTP ${status} — ${detail}`);
    res.status(500).json({ error: `Error cargando lead: HTTP ${status || '?'} — ${err.message}` });
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
    console.error('[LEAD STATUS]', err.response?.status, err.message);
    res.status(500).json({ error: 'Error actualizando etapa' });
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
    res.status(500).json({ error: 'Error agregando nota' });
  }
}

module.exports = { obtenerLeadsCRM, obtenerPipelines, obtenerLeadDetalle, actualizarEtapa, agregarNota };
