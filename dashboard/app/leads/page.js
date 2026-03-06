'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

function formatFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatValor(v) {
  if (!v) return '—';
  return '$' + Number(v).toLocaleString('en-US');
}

function EstadoBadge({ statusId }) {
  const colores = {
    142: 'bg-slate-500/20 text-slate-300',
    143: 'bg-emerald-500/20 text-emerald-300',
    144: 'bg-red-500/20 text-red-300',
  };
  const nombres = { 142: 'Sin tocar', 143: 'Ganado', 144: 'Perdido' };
  const clase = colores[statusId] || 'bg-blue-500/20 text-blue-300';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${clase}`}>
      {nombres[statusId] || 'En proceso'}
    </span>
  );
}

function NoteModal({ lead, onClose }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState(null);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true); setErr(null);
    try {
      await api.agregarNota(lead.id, texto.trim());
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (e) { setErr(e.message); }
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-1">Agregar nota</h3>
        <p className="text-xs text-muted mb-4">Lead #{lead.id} — {lead.nombre}</p>
        <textarea
          autoFocus rows={4}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe tu nota..."
          className="input w-full resize-none mb-3"
        />
        {ok  && <p className="text-success text-sm mb-3">Nota agregada en Kommo</p>}
        {err && <p className="text-danger text-sm mb-3">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={enviar} disabled={enviando || !texto.trim()} className="btn-primary text-sm disabled:opacity-50">
            {enviando ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadDetalle({ id, onClose }) {
  const [lead, setLead] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [notaModal, setNotaModal] = useState(false);
  const [pipelines, setPipelines] = useState([]);
  const [cambiandoEtapa, setCambiandoEtapa] = useState(false);

  useEffect(() => {
    Promise.allSettled([api.leadDetalle(id), api.pipelines()])
      .then(([lr, pr]) => {
        if (lr.status === 'fulfilled') setLead(lr.value);
        if (pr.status === 'fulfilled') setPipelines(pr.value.pipelines || []);
      })
      .finally(() => setCargando(false));
  }, [id]);

  const pipeline = pipelines.find(p => p.id === lead?.pipeline_id);
  const etapas = pipeline?._embedded?.statuses
    ? Object.values(pipeline._embedded.statuses).filter(s => s.id !== 143 && s.id !== 144)
    : [];

  const cambiarEtapa = async (statusId) => {
    setCambiandoEtapa(true);
    try {
      await api.actualizarEtapa(lead.id, statusId, lead.pipeline_id);
      setLead(prev => ({ ...prev, status_id: statusId }));
    } catch (e) { console.error(e); }
    setCambiandoEtapa(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lead ? (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-accent bg-accent/10 px-2 py-0.5 rounded">#{lead.id}</span>
                    <EstadoBadge statusId={lead.status_id} />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{lead.nombre}</h2>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted">
                    {lead.valor > 0 && <span className="text-emerald-400 font-semibold">{formatValor(lead.valor)}</span>}
                    {lead.pipeline && <span>{lead.pipeline}</span>}
                    {lead.contacto && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {lead.contacto.nombre || lead.contacto}
                      </span>
                    )}
                  </div>
                  {lead.contacto?.telefono && (
                    <a href={`tel:${lead.contacto.telefono}`} className="text-sm text-muted hover:text-white mt-1 inline-block">
                      {lead.contacto.telefono}
                    </a>
                  )}
                </div>
                <div className="flex gap-2 items-start">
                  <button onClick={() => setNotaModal(true)} className="btn-ghost text-xs flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Nota
                  </button>
                  <button onClick={onClose} className="text-muted hover:text-white p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Cambiar etapa */}
              {etapas.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-muted mb-2">Etapa del pipeline</div>
                  <div className="flex flex-wrap gap-1.5">
                    {etapas.map(e => (
                      <button
                        key={e.id}
                        onClick={() => cambiarEtapa(e.id)}
                        disabled={cambiandoEtapa}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                          lead.status_id === e.id
                            ? 'bg-accent text-white'
                            : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-xs text-muted uppercase tracking-wider mb-3">
                Notas ({lead.notas?.length || 0})
              </div>
              {!lead.notas?.length ? (
                <div className="text-sm text-muted text-center py-8">Sin notas</div>
              ) : (
                <div className="space-y-3">
                  {lead.notas.map((n, i) => (
                    <div key={i} className="bg-base rounded-xl p-4">
                      <div className="text-xs text-muted mb-1.5">{formatFecha(n.creado_en)}</div>
                      <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {typeof n.texto === 'string' ? n.texto : JSON.stringify(n.texto)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-6 text-muted">No se pudo cargar el lead</div>
        )}
      </div>
      {notaModal && lead && <NoteModal lead={lead} onClose={() => setNotaModal(false)} />}
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [pipeline, setPipeline] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback((q, pip) => {
    setCargando(true); setError(null);
    api.leadsCRM(q, pip)
      .then(d => setLeads(d.leads || []))
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    api.pipelines().then(d => setPipelines(d.pipelines || [])).catch(() => {});
    cargar('', '');
  }, [cargar]);

  useEffect(() => {
    const t = setTimeout(() => cargar(busqueda, pipeline), 400);
    return () => clearTimeout(t);
  }, [busqueda, pipeline, cargar]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Leads</h1>
          <p className="text-sm text-muted mt-1">{cargando ? 'Cargando...' : `${leads.length} leads`}</p>
        </div>
        <div className="flex gap-3">
          {pipelines.length > 0 && (
            <select value={pipeline} onChange={e => setPipeline(e.target.value)} className="input text-sm">
              <option value="">Todos los pipelines</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <input
            type="text"
            placeholder="Buscar lead..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input w-64 text-sm"
          />
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-5 py-4 mb-6 text-sm">{error}</div>}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Lead</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Contacto</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Pipeline</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Estado</th>
              <th className="text-right px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Valor</th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-muted uppercase tracking-wider">Creado</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-muted">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Cargando leads...
                </div>
              </td></tr>
            )}
            {!cargando && leads.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-muted">Sin leads</td></tr>
            )}
            {leads.map(lead => (
              <tr key={lead.id} className="border-b border-border/50 hover:bg-white/2 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-medium text-white truncate max-w-[180px]">{lead.nombre}</div>
                  <div className="font-mono text-xs text-muted mt-0.5">#{lead.id}</div>
                </td>
                <td className="px-5 py-4 text-slate-300">{lead.contacto || <span className="text-muted">—</span>}</td>
                <td className="px-5 py-4 text-muted text-xs">{lead.pipeline || '—'}</td>
                <td className="px-5 py-4"><EstadoBadge statusId={lead.status_id} /></td>
                <td className="px-5 py-4 text-right font-medium text-emerald-400">{formatValor(lead.valor)}</td>
                <td className="px-5 py-4 text-muted text-xs">{formatFecha(lead.creado_en)}</td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => setDetalle(lead.id)}
                    className="text-xs text-muted hover:text-accent transition-colors px-2 py-1 rounded hover:bg-accent/10"
                  >
                    Ver →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalle && <LeadDetalle id={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
