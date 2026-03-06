'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function truncar(texto, max) {
  if (!texto) return null;
  return texto.length > (max || 80) ? texto.substring(0, max || 80) + '…' : texto;
}

function ReplyBox({ leadId, onSent }) {
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  const enviar = async () => {
    if (!msg.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      await api.reply(leadId, msg.trim());
      setMsg('');
      setOk(true);
      setTimeout(() => setOk(false), 3000);
      onSent?.();
    } catch (e) {
      setError(e.message);
    }
    setEnviando(false);
  };

  return (
    <div className="mt-4 border-t border-border/50 pt-4">
      <div className="text-xs text-muted uppercase tracking-wider mb-2">Responder manualmente</div>
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }}
          placeholder="Escribe una respuesta... (Ctrl+Enter para enviar)"
          className="input resize-none flex-1 text-sm"
        />
        <button
          onClick={enviar}
          disabled={enviando || !msg.trim()}
          className="btn-primary px-4 self-stretch disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {enviando
            ? <span className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin block" />
            : 'Enviar'}
        </button>
      </div>
      {ok    && <p className="text-success text-xs mt-1.5">Respuesta enviada a Kommo</p>}
      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
  );
}

export default function ConversationsPage() {
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [expandida, setExpandida] = useState(null);

  const cargar = () => {
    api.conversations()
      .then(data => setConversaciones(Array.isArray(data) ? data : data.conversations || []))
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtradas = conversaciones.filter(c =>
    !busqueda ||
    String(c.lead_id).includes(busqueda) ||
    c.contact_name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.mensaje_cliente?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Conversaciones</h1>
          <p className="text-sm text-muted mt-1">
            {cargando ? 'Cargando...' : `${filtradas.length} conversaciones`}
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
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-5 py-4 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Lead</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Contacto</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Mensaje cliente</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Respuesta</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Fecha</th>
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
              {!cargando && filtradas.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted">
                  {busqueda ? 'Sin resultados' : 'Sin conversaciones aún.'}
                </td></tr>
              )}
              {filtradas.map((conv, i) => (
                <>
                  <tr
                    key={'row-' + i}
                    onClick={() => setExpandida(expandida === i ? null : i)}
                    className="border-b border-border/50 hover:bg-white/2 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-accent text-xs bg-accent/10 px-2 py-1 rounded">#{conv.lead_id}</span>
                    </td>
                    <td className="px-5 py-4 text-white font-medium">
                      {conv.contact_name || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-300 max-w-xs">
                      {truncar(conv.mensaje_cliente) || <span className="text-muted italic">—</span>}
                    </td>
                    <td className="px-5 py-4 text-slate-400 max-w-xs">
                      {truncar(conv.respuesta_bot) || <span className="text-muted italic">sin respuesta</span>}
                    </td>
                    <td className="px-5 py-4 text-muted text-xs whitespace-nowrap">{formatFecha(conv.timestamp)}</td>
                  </tr>
                  {expandida === i && (
                    <tr key={'exp-' + i} className="bg-surface/50">
                      <td colSpan={5} className="px-5 py-5">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <div className="text-xs text-muted uppercase tracking-wider mb-2">Mensaje del cliente</div>
                            <div className="bg-base rounded-lg p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                              {conv.mensaje_cliente || '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-success uppercase tracking-wider mb-2">Respuesta</div>
                            <div className="bg-base rounded-lg p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                              {conv.respuesta_bot || <span className="text-muted italic">Sin respuesta</span>}
                            </div>
                          </div>
                        </div>
                        <ReplyBox leadId={conv.lead_id} onSent={cargar} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
