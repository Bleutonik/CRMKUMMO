'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Avatar({ nombre }) {
  const iniciales = (nombre || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const colores = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-pink-500', 'bg-amber-500', 'bg-cyan-500'];
  const color = colores[iniciales.charCodeAt(0) % colores.length];
  return (
    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
      {iniciales}
    </div>
  );
}

function ContactoDetalle({ contacto, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start gap-4">
          <Avatar nombre={contacto.nombre} />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">{contacto.nombre || 'Sin nombre'}</h2>
            <div className="flex flex-wrap gap-4 mt-2">
              {contacto.telefono && (
                <a href={`tel:${contacto.telefono}`} className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {contacto.telefono}
                </a>
              )}
              {contacto.email && (
                <a href={`mailto:${contacto.email}`} className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {contacto.email}
                </a>
              )}
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Contacto desde {formatFecha(contacto.creado_en)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white p-1 rounded transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conversaciones */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-xs text-muted uppercase tracking-wider mb-3">
            Historial de conversaciones ({contacto.conversaciones?.length || 0})
          </div>
          {(!contacto.conversaciones || contacto.conversaciones.length === 0) ? (
            <div className="text-sm text-muted text-center py-8">Sin conversaciones registradas</div>
          ) : (
            <div className="space-y-3">
              {contacto.conversaciones.map((conv, i) => (
                <div key={i} className="bg-base rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded">#{conv.lead_id}</span>
                    <span className="text-xs text-muted">{formatFecha(conv.timestamp)}</span>
                  </div>
                  {conv.mensaje_cliente && (
                    <div>
                      <div className="text-xs text-muted mb-1">Cliente</div>
                      <div className="text-sm text-slate-300 leading-relaxed">{conv.mensaje_cliente}</div>
                    </div>
                  )}
                  {conv.respuesta_bot && (
                    <div>
                      <div className="text-xs text-success mb-1">Respuesta</div>
                      <div className="text-sm text-slate-400 leading-relaxed">{conv.respuesta_bot}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const buscar = useCallback((q) => {
    setCargando(true);
    setError(null);
    api.contacts(q)
      .then(data => setContactos(data.contactos || []))
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { buscar(''); }, [buscar]);

  useEffect(() => {
    const t = setTimeout(() => buscar(busqueda), 400);
    return () => clearTimeout(t);
  }, [busqueda, buscar]);

  const abrirContacto = async (id) => {
    setCargandoDetalle(true);
    try {
      const data = await api.contacto(id);
      setSeleccionado(data);
    } catch (e) {
      setError(e.message);
    }
    setCargandoDetalle(false);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Contactos</h1>
          <p className="text-sm text-muted mt-1">
            {cargando ? 'Buscando...' : `${contactos.length} contactos`}
          </p>
        </div>
        <div className="relative w-80">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-5 py-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Grid de contactos */}
      {cargando ? (
        <div className="flex items-center justify-center py-24 text-muted gap-3">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Buscando contactos...
        </div>
      ) : contactos.length === 0 ? (
        <div className="text-center py-24 text-muted">
          <div className="text-4xl mb-3">👤</div>
          <div className="text-sm">{busqueda ? 'Sin resultados para esta búsqueda' : 'No hay contactos'}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contactos.map(c => (
            <button
              key={c.id}
              onClick={() => abrirContacto(c.id)}
              className="card text-left hover:border-accent/40 transition-all hover:bg-white/2 group"
            >
              <div className="flex items-start gap-3">
                <Avatar nombre={c.nombre} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors truncate">
                    {c.nombre || 'Sin nombre'}
                  </div>
                  {c.telefono && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {c.telefono}
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted truncate">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                </div>
                {c.leads_count > 0 && (
                  <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full flex-shrink-0">
                    {c.leads_count} lead{c.leads_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
                <span className="text-xs text-muted">Desde {formatFecha(c.creado_en)}</span>
                <span className="text-xs text-muted group-hover:text-accent transition-colors">Ver detalle →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {cargandoDetalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {seleccionado && !cargandoDetalle && (
        <ContactoDetalle contacto={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  );
}
