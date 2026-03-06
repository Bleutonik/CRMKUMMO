'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { getUsuario, removeToken, isAdmin } from '../lib/auth';
import { api } from '../lib/api';

const nav = [
  {
    href: '/bot',
    label: 'Bot Control',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    ),
  },
  {
    href: '/pipeline',
    label: 'Pipeline',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    href: '/leads',
    label: 'Leads',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/contacts',
    label: 'Contactos',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/conversations',
    label: 'Conversaciones',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: '/training',
    label: 'Entrenamiento',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

function tiempoRelativo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return new Date(ts).toLocaleDateString('es-ES');
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const usuario = getUsuario();

  const [alertas, setAlertas] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const panelRef = useRef(null);

  // Polling cada 20 segundos
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await api.alertas();
        setAlertas(data.alertas || []);
        setNoLeidas(data.noLeidas || 0);
      } catch {}
    };
    cargar();
    const interval = setInterval(cargar, 20000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelAbierto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const marcarLeida = async (id) => {
    try {
      await api.marcarLeida(id);
      setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a));
      setNoLeidas(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const leerTodas = async () => {
    try {
      await api.leerTodas();
      setAlertas(prev => prev.map(a => ({ ...a, leida: true })));
      setNoLeidas(0);
    } catch {}
  };

  const logout = () => {
    removeToken();
    router.push('/login');
  };

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col relative" style={{
      background: 'linear-gradient(180deg, #0a1628 0%, #07101f 100%)',
      borderRight: '1px solid rgba(255,255,255,.06)',
    }}>

      {/* Logo + campana */}
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5b95f9, #3a6fd8)', boxShadow: '0 4px 12px rgba(79,142,247,.4)' }}>
            K
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-none">CRM AI Bot</div>
            <div className="text-[11px] text-muted mt-0.5 leading-none">Fix A Trip</div>
          </div>
        </div>

        {/* Campana de alertas */}
        <div ref={panelRef} className="relative">
          <button
            onClick={() => setPanelAbierto(v => !v)}
            className="relative p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors"
            title="Alertas de intención de compra"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {noLeidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse"
                style={{ background: '#ef4444' }}>
                {noLeidas > 9 ? '9+' : noLeidas}
              </span>
            )}
          </button>

          {/* Panel de alertas */}
          {panelAbierto && (
            <div className="absolute left-0 top-10 w-80 rounded-xl border shadow-2xl z-50 overflow-hidden"
              style={{ background: '#0f1c2e', borderColor: '#182840', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>

              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#182840' }}>
                <div>
                  <div className="text-sm font-semibold text-white">Posibles ventas</div>
                  <div className="text-xs text-muted">Clientes con intención de compra</div>
                </div>
                {noLeidas > 0 && (
                  <button onClick={leerTodas} className="text-xs text-accent hover:text-white transition-colors">
                    Marcar todas leídas
                  </button>
                )}
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
                {alertas.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted">
                    Sin alertas por ahora
                  </div>
                ) : (
                  alertas.map(alerta => (
                    <div key={alerta.id}
                      className="px-4 py-3 border-b transition-colors"
                      style={{
                        borderColor: '#182840',
                        background: alerta.leida ? 'transparent' : 'rgba(79,142,247,.06)'
                      }}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          {!alerta.leida && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#ef4444' }} />
                          )}
                          <span className="text-xs font-semibold text-white">
                            {alerta.contact_name || `Lead ${alerta.lead_id}`}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted flex-shrink-0">{tiempoRelativo(alerta.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-2 line-clamp-2 ml-3.5">
                        "{alerta.mensaje_cliente}"
                      </p>
                      <div className="flex items-center gap-2 ml-3.5">
                        <Link
                          href="/conversations"
                          onClick={() => { marcarLeida(alerta.id); setPanelAbierto(false); }}
                          className="text-[11px] text-accent hover:text-white transition-colors font-medium"
                        >
                          Ver conversación →
                        </Link>
                        {!alerta.leida && (
                          <button
                            onClick={() => marcarLeida(alerta.id)}
                            className="text-[11px] text-muted hover:text-white transition-colors"
                          >
                            Marcar leída
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-4" style={{ height: 1, background: 'rgba(255,255,255,.05)' }} />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map((item) => {
          const activo = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 relative group"
              style={activo ? {
                background: 'rgba(79,142,247,.12)',
                color: '#7fb0fa',
                boxShadow: '0 0 0 1px rgba(79,142,247,.2)',
              } : { color: '#4a5a70' }}
            >
              {activo && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #6da0fa, #3a7af5)' }} />
              )}
              <span className={`transition-colors duration-150 ${activo ? 'text-accent' : 'group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className={`font-medium transition-colors duration-150 ${activo ? '' : 'group-hover:text-white'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
        {isAdmin() && (
          <Link
            href="/users"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group"
            style={pathname === '/users' ? {
              background: 'rgba(79,142,247,.12)', color: '#7fb0fa',
            } : { color: '#4a5a70' }}
          >
            <svg className="w-[18px] h-[18px] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="font-medium group-hover:text-white transition-colors">Usuarios</span>
          </Link>
        )}

        {/* User info */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,.03)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #5b95f9, #3a6fd8)' }}>
            {(usuario?.nombre || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate leading-none">{usuario?.nombre || 'Usuario'}</div>
            <div className="text-[10px] text-muted truncate mt-0.5 leading-none">{usuario?.rol || 'empleado'}</div>
          </div>
          <button onClick={logout} title="Cerrar sesión"
            className="text-muted hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
