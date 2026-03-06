'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function tiempoRelativo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function ReplyBox({ leadId, onSent }) {
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  const enviar = async () => {
    if (!msg.trim()) return;
    setEnviando(true); setError(null);
    try {
      await api.reply(leadId, msg.trim());
      setMsg('');
      setOk(true);
      setTimeout(() => setOk(false), 3000);
      onSent?.();
    } catch (e) { setError(e.message); }
    setEnviando(false);
  };

  return (
    <div className="border-t border-border p-4">
      <div className="flex gap-2 items-end">
        <textarea
          rows={2}
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }}
          placeholder="Responder manualmente... (Ctrl+Enter)"
          className="input resize-none flex-1 text-sm"
        />
        <button
          onClick={enviar}
          disabled={enviando || !msg.trim()}
          className="btn-primary px-4 py-2.5 disabled:opacity-50 text-sm self-end"
        >
          {enviando
            ? <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin block" />
            : 'Enviar'}
        </button>
      </div>
      {ok    && <p className="text-success text-xs mt-1.5">Enviado a Kommo</p>}
      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
  );
}

function ChatPanel({ contacto, mensajes, onClose, onSent }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-surface border-l border-border flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="font-semibold text-white">{contacto.nombre || 'Sin nombre'}</div>
            <div className="text-xs text-muted mt-0.5">
              Lead #{contacto.lead_id} · {mensajes.length} mensaje{mensajes.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mensajes.map((m, i) => (
            <div key={i} className="space-y-2">
              {/* Mensaje del cliente */}
              {m.mensaje_cliente && m.mensaje_cliente !== '[Respuesta manual desde dashboard]' && (
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-200 leading-relaxed">
                      {m.mensaje_cliente}
                    </div>
                    <div className="text-xs text-muted mt-1 ml-1">{tiempoRelativo(m.timestamp)}</div>
                  </div>
                </div>
              )}
              {/* Respuesta del bot / manual */}
              {m.respuesta_bot && (
                <div className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="bg-accent/20 border border-accent/30 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white leading-relaxed">
                      {m.respuesta_bot}
                    </div>
                    <div className="text-xs text-muted mt-1 mr-1 text-right">{formatFecha(m.timestamp)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        <ReplyBox leadId={contacto.lead_id} onSent={onSent} />
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [chatAbierto, setChatAbierto] = useState(null);

  const cargar = () => {
    setCargando(true);
    api.conversations()
      .then(data => setConversaciones(Array.isArray(data) ? data : data.conversations || []))
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  // Agrupar por lead_id
  const grupos = conversaciones.reduce((acc, conv) => {
    const key = conv.lead_id || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        lead_id: conv.lead_id,
        nombre: conv.contact_name || null,
        mensajes: [],
        ultimo: null,
      };
    }
    acc[key].mensajes.push(conv);
    if (!acc[key].ultimo || new Date(conv.timestamp) > new Date(acc[key].ultimo)) {
      acc[key].ultimo = conv.timestamp;
    }
    return acc;
  }, {});

  const contactos = Object.values(grupos)
    .sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo));

  const filtrados = contactos.filter(c =>
    !busqueda ||
    String(c.lead_id).includes(busqueda) ||
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.mensajes.some(m => m.mensaje_cliente?.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const contactoActivo = chatAbierto ? grupos[chatAbierto] : null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Conversaciones</h1>
          <p className="text-sm text-muted mt-1">
            {cargando ? 'Cargando...' : `${filtrados.length} contacto${filtrados.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar por lead, nombre o mensaje..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="input w-72"
        />
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-5 py-4 mb-6 text-sm">{error}</div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Contacto</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Lead</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Último mensaje</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Mensajes</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Actividad</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Cargando...
                </div>
              </td></tr>
            )}
            {!cargando && filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">
                {busqueda ? 'Sin resultados' : 'Sin conversaciones aún.'}
              </td></tr>
            )}
            {filtrados.map(c => {
              const ultimo = [...c.mensajes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
              const preview = ultimo?.mensaje_cliente || ultimo?.respuesta_bot || '—';
              return (
                <tr
                  key={c.lead_id}
                  onClick={() => setChatAbierto(c.lead_id)}
                  className="border-b border-border/50 hover:bg-white/2 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {(c.nombre || '?')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-white">{c.nombre || <span className="text-muted">Sin nombre</span>}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-accent text-xs bg-accent/10 px-2 py-1 rounded">#{c.lead_id}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs max-w-xs truncate">
                    {preview.length > 70 ? preview.substring(0, 70) + '…' : preview}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs bg-white/5 text-muted px-2 py-0.5 rounded-full">
                      {c.mensajes.length}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted text-xs">{tiempoRelativo(c.ultimo)}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-accent opacity-0 group-hover:opacity-100">Ver →</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contactoActivo && (
        <ChatPanel
          contacto={contactoActivo}
          mensajes={[...contactoActivo.mensajes].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))}
          onClose={() => setChatAbierto(null)}
          onSent={cargar}
        />
      )}
    </div>
  );
}
