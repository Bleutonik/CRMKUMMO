'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

function formatValor(v) {
  if (!v) return null;
  return '$' + Number(v).toLocaleString('en-US');
}

function LeadCard({ lead, etapas, onMover, onDetalle }) {
  const [moviendo, setMoviendo] = useState(false);
  const [menu, setMenu] = useState(false);

  const mover = async (statusId) => {
    setMoviendo(true); setMenu(false);
    await onMover(lead.id, statusId, lead.pipeline_id);
    setMoviendo(false);
  };

  return (
    <div className="bg-base border border-border/60 rounded-xl p-3.5 hover:border-accent/40 transition-all group relative">
      {moviendo && (
        <div className="absolute inset-0 bg-surface/80 rounded-xl flex items-center justify-center z-10">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={() => onDetalle(lead.id)}
          className="text-sm font-medium text-white hover:text-accent transition-colors text-left leading-snug"
        >
          {lead.nombre}
        </button>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenu(!menu)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-white p-0.5 rounded"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
          {menu && (
            <div className="absolute right-0 top-6 bg-surface border border-border rounded-xl shadow-xl z-20 min-w-[160px] py-1 overflow-hidden">
              <div className="px-3 py-1.5 text-xs text-muted font-medium">Mover a etapa</div>
              {etapas.filter(e => e.id !== lead.status_id).map(e => (
                <button
                  key={e.id}
                  onClick={() => mover(e.id)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {lead.contacto && (
        <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {lead.contacto}
        </div>
      )}

      {formatValor(lead.valor) && (
        <div className="text-xs font-semibold text-emerald-400 mt-2">{formatValor(lead.valor)}</div>
      )}

      {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />}
    </div>
  );
}

export default function PipelinePage() {
  const [pipelines, setPipelines] = useState([]);
  const [leads, setLeads] = useState([]);
  const [pipelineActivo, setPipelineActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.pipelines()
      .then(p => {
        const pips = p.pipelines || [];
        setPipelines(pips);
        if (pips.length > 0) setPipelineActivo(pips[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  // Cargar leads del pipeline activo
  useEffect(() => {
    if (!pipelineActivo) return;
    setCargando(true);
    api.leadsCRM('', pipelineActivo, 1)
      .then(l => setLeads(l.leads || []))
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [pipelineActivo]);

  const pipeline = pipelines.find(p => p.id === pipelineActivo);
  const etapas = pipeline?._embedded?.statuses
    ? Object.values(pipeline._embedded.statuses)
        .filter(s => s.type !== 1 && s.type !== 2)
        .sort((a, b) => a.sort - b.sort)
    : [];

  const leadsDelPipeline = leads;

  const moverLead = async (leadId, statusId, pipelineId) => {
    await api.actualizarEtapa(leadId, statusId, pipelineId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status_id: statusId } : l));
  };

  const totalValor = leadsDelPipeline.reduce((s, l) => s + (l.valor || 0), 0);

  if (cargando) return (
    <div className="flex items-center justify-center h-full text-muted gap-3">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Cargando pipeline...
    </div>
  );

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">Pipeline</h1>
          <p className="text-sm text-muted mt-1">
            {leadsDelPipeline.length} leads · {totalValor > 0 ? '$' + totalValor.toLocaleString('en-US') + ' en pipeline' : ''}
          </p>
        </div>
        {pipelines.length > 1 && (
          <div className="flex gap-2">
            {pipelines.map(p => (
              <button
                key={p.id}
                onClick={() => setPipelineActivo(p.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pipelineActivo === p.id ? 'bg-accent text-white' : 'bg-surface border border-border text-muted hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-5 py-4 mb-6 text-sm">{error}</div>}

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
        {etapas.map(etapa => {
          const leadsEtapa = leadsDelPipeline.filter(l => l.status_id === etapa.id);
          const valorEtapa = leadsEtapa.reduce((s, l) => s + (l.valor || 0), 0);
          return (
            <div key={etapa.id} className="flex-shrink-0 w-72 flex flex-col">
              {/* Header columna */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-white">{etapa.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {leadsEtapa.length} lead{leadsEtapa.length !== 1 ? 's' : ''}
                    {valorEtapa > 0 && ` · $${valorEtapa.toLocaleString('en-US')}`}
                  </div>
                </div>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: etapa.color || '#6366f1' }}
                />
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {leadsEtapa.length === 0 ? (
                  <div className="border-2 border-dashed border-border/40 rounded-xl py-8 text-center text-xs text-muted">
                    Sin leads
                  </div>
                ) : (
                  leadsEtapa.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      etapas={etapas}
                      onMover={moverLead}
                      onDetalle={setDetalle}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detalle modal — reutilizamos el de leads */}
      {detalle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetalle(null)}>
          <div className="bg-surface border border-border rounded-2xl p-6 text-white" onClick={e => e.stopPropagation()}>
            <p className="text-muted text-sm">Abre la sección <strong>Leads</strong> para ver el detalle completo del lead #{detalle}</p>
            <button onClick={() => setDetalle(null)} className="btn-primary mt-4 text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
