const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('crm_token');
}

async function req(ruta, opciones = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const token = getToken();
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      signal: controller.signal,
      ...opciones
    });
    if (res.status === 401) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_usuario');
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }
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
  botTest:          (msg)           => req('/api/bot-test', { method: 'POST', body: JSON.stringify({ mensaje: msg }) }, 45000),
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
  aprenderDB:       ()              => req('/api/admin/learn-from-db',      { method: 'POST' }),
  syncContactos:    ()              => req('/api/admin/sync-contacts',      { method: 'POST' }),
  // Auth
  login:            (email, pass)   => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) }),
  authMe:           ()              => req('/api/auth/me'),
  usuarios:         ()              => req('/api/auth/usuarios'),
  crearUsuario:     (d)             => req('/api/auth/usuarios', { method: 'POST', body: JSON.stringify(d) }),
  eliminarUsuario:  (id)            => req(`/api/auth/usuarios/${id}`, { method: 'DELETE' }),
  cambiarPassword:  (id, pass)      => req(`/api/auth/usuarios/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password: pass }) }),
};
