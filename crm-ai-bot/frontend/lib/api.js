const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchAPI(ruta, opciones = {}) {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones
  });

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `Error ${respuesta.status}`);
  }

  return respuesta.json();
}

export const api = {
  stats: () => fetchAPI('/api/stats'),
  conversaciones: (pagina = 1) => fetchAPI(`/api/conversaciones?pagina=${pagina}`),
  conversacion: (id) => fetchAPI(`/api/conversaciones/${id}`),
  leads: (pagina = 1) => fetchAPI(`/api/leads?pagina=${pagina}`),
  configuracion: () => fetchAPI('/api/configuracion'),
  actualizarPrompt: (clave, valor) => fetchAPI('/api/prompts', {
    method: 'POST',
    body: JSON.stringify({ clave, valor })
  })
};
