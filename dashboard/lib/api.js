const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function req(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...opciones
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  botStatus:          ()         => req('/api/bot-status'),
  botToggle:          ()         => req('/api/bot-toggle', { method: 'POST' }),
  conversations:      ()         => req('/api/conversations'),
  knowledge:          ()         => req('/api/knowledge'),
  crearKnowledge:     (data)     => req('/api/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  eliminarKnowledge:  (id)       => req(`/api/knowledge/${id}`, { method: 'DELETE' }),
  stats:              ()         => req('/api/stats'),
  importarKommo:      ()         => req('/api/admin/import-kommo',      { method: 'POST' }),
  extraerKnowledge:   ()         => req('/api/admin/extract-knowledge',  { method: 'POST' })
};
