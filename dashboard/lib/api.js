const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function req(ruta, opciones = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

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
    if (err.name === 'AbortError') throw new Error('El servidor no respondió. Verifica que el backend esté activo.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  botStatus:          ()               => req('/api/bot-status'),
  botToggle:          ()               => req('/api/bot-toggle', { method: 'POST' }),
  conversations:      ()               => req('/api/conversations'),
  knowledge:          ()               => req('/api/knowledge'),
  crearKnowledge:     (data)           => req('/api/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  eliminarKnowledge:  (id)             => req(`/api/knowledge/${id}`, { method: 'DELETE' }),
  stats:              ()               => req('/api/stats'),
  importarKommo:      ()               => req('/api/admin/import-kommo',     { method: 'POST' }),
  extraerKnowledge:   ()               => req('/api/admin/extract-knowledge', { method: 'POST' }),
  entrenarKommo:      ()               => req('/api/admin/train-from-kommo',  { method: 'POST' }),
  contacts:           (search, page)   => req(`/api/contacts?search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  contacto:           (id)             => req(`/api/contacts/${id}`),
  reply:              (leadId, mensaje) => req('/api/reply', { method: 'POST', body: JSON.stringify({ leadId, mensaje }) }),
};
