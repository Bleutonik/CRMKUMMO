export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('crm_token');
}

export function setToken(token) {
  localStorage.setItem('crm_token', token);
  // También en cookie para que el middleware de Next.js pueda leerla
  document.cookie = `crm_token=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
}

export function removeToken() {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  document.cookie = 'crm_token=; path=/; max-age=0';
}

export function getUsuario() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('crm_usuario') || 'null');
  } catch { return null; }
}

export function setUsuario(u) {
  localStorage.setItem('crm_usuario', JSON.stringify(u));
}

export function isAdmin() {
  return getUsuario()?.rol === 'admin';
}
