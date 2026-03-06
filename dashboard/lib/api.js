const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function req(ruta, opciones = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
      ...opciones
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('El servidor no respondió.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  // Bot
  botStatus:        ()              => req('/api/bot-status'),
  botToggle:        ()              => req('/api/bot-toggle', { method: 'POST' }),
  // Conversaciones
  conversations:    ()              => req('/api/conversations'),
  reply:            (leadId, msg)   => req('/api/reply', { method: 'POST', body: JSON.stringify({ leadId, mensaje: msg }) }),
  // Knowledge
  knowledge:        ()              => req('/api/knowledge'),
  crearKnowledge:   (d)             => req('/api/knowledge', { method: 'POST', body: JSON.stringify(d) }),
  eliminarKnowledge:(id)            => req(`/api/knowledge/${id}`, { method: 'DELETE' }),
  // Stats
  stats:            ()              => req('/api/stats'),
  // Contactos
  contacts:         (q, p)          => req(`/api/contacts?search=${encodeURIComponent(q||'')}&page=${p||1}`),
  contacto:         (id)            => req(`/api/contacts/${id}`),
  // Leads CRM
  leadsCRM:         (q, pip, p)     => req(`/api/leads-crm?search=${encodeURIComponent(q||'')}&pipeline=${pip||''}&page=${p||1}`),
  leadDetalle:      (id)            => req(`/api/leads-crm/${id}`),
  actualizarEtapa:  (id, sid, pid)  => req(`/api/leads-crm/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status_id: sid, pipeline_id: pid }) }),
  agregarNota:      (id, texto)     => req(`/api/leads-crm/${id}/note`, { method: 'POST', body: JSON.stringify({ texto }) }),
  pipelines:        ()              => req('/api/pipelines'),
  // Admin / Training
  importarKommo:    ()              => req('/api/admin/import-kommo',     { method: 'POST' }),
  extraerKnowledge: ()              => req('/api/admin/extract-knowledge', { method: 'POST' }),
  entrenarKommo:    ()              => req('/api/admin/train-from-kommo',  { method: 'POST' }),
  syncContactos:    ()              => req('/api/admin/sync-contacts',      { method: 'POST' }),
};
