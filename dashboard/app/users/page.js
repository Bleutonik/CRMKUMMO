'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { isAdmin } from '../../lib/auth';

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function NuevoUsuarioModal({ onClose, onCreado }) {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'empleado' });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const crear = async (e) => {
    e.preventDefault();
    setCargando(true); setError(null);
    try {
      await api.crearUsuario(form);
      onCreado();
      onClose();
    } catch (e) { setError(e.message); }
    setCargando(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-5">Nuevo usuario</h3>
        <form onSubmit={crear} className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1.5">Nombre</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre completo" className="input w-full" required />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="correo@ejemplo.com" className="input w-full" required />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Contraseña</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres" className="input w-full" required minLength={6} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Rol</label>
            <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} className="input w-full">
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
            <button type="submit" disabled={cargando} className="btn-primary text-sm disabled:opacity-50">
              {cargando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CambiarPasswordModal({ usuario, onClose }) {
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async (e) => {
    e.preventDefault();
    setCargando(true); setError(null);
    try {
      await api.cambiarPassword(usuario.id, password);
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (e) { setError(e.message); }
    setCargando(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-1">Cambiar contraseña</h3>
        <p className="text-xs text-muted mb-4">{usuario.nombre} · {usuario.email}</p>
        <form onSubmit={guardar} className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Nueva contraseña" className="input w-full" required minLength={6} autoFocus />
          {ok    && <p className="text-success text-sm">Contraseña actualizada</p>}
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
            <button type="submit" disabled={cargando} className="btn-primary text-sm disabled:opacity-50">
              {cargando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalPass, setModalPass] = useState(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    setAdmin(isAdmin());
    cargar();
  }, []);

  const cargar = () => {
    setCargando(true);
    api.usuarios()
      .then(d => setUsuarios(d.usuarios || []))
      .catch(console.error)
      .finally(() => setCargando(false));
  };

  const eliminar = async (id, nombre) => {
    if (!confirm(`¿Desactivar acceso de ${nombre}?`)) return;
    await api.eliminarUsuario(id).catch(console.error);
    cargar();
  };

  if (!admin) return (
    <div className="flex items-center justify-center h-full text-muted">
      Acceso restringido a administradores.
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Usuarios</h1>
          <p className="text-sm text-muted mt-1">{cargando ? 'Cargando...' : `${usuarios.length} usuarios`}</p>
        </div>
        <button onClick={() => setModalNuevo(true)} className="btn-primary text-sm">
          + Nuevo usuario
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Usuario</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Rol</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Estado</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Creado</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Cargando...
                </div>
              </td></tr>
            )}
            {usuarios.map(u => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center">
                      {u.nombre[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-white">{u.nombre}</div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    u.rol === 'admin' ? 'bg-accent/15 text-accent' : 'bg-white/5 text-muted'
                  }`}>
                    {u.rol === 'admin' ? 'Admin' : 'Empleado'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${
                    u.activo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {u.activo ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td className="px-5 py-4 text-muted text-xs">{formatFecha(u.creado_en)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setModalPass(u)} className="text-xs text-muted hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors">
                      Contraseña
                    </button>
                    {u.activo && (
                      <button onClick={() => eliminar(u.id, u.nombre)} className="text-xs text-muted hover:text-danger px-2 py-1 rounded hover:bg-danger/10 transition-colors">
                        Desactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNuevo && <NuevoUsuarioModal onClose={() => setModalNuevo(false)} onCreado={cargar} />}
      {modalPass && <CambiarPasswordModal usuario={modalPass} onClose={() => setModalPass(null)} />}
    </div>
  );
}
