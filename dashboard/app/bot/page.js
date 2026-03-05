'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

function StatItem({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-xs text-muted uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value ?? '—'}</div>
    </div>
  );
}

export default function BotPage() {
  const [activo, setActivo] = useState(null);
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    Promise.all([api.botStatus(), api.stats()])
      .then(([bot, s]) => {
        setActivo(bot.activo);
        setStats(s.resumen);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await api.botToggle();
      setActivo(res.activo);
    } catch (e) {
      console.error(e);
    }
    setToggling(false);
  };

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="Bot Control"
        subtitle="Controla el estado del asistente IA conectado a Kommo."
      />

      {/* Toggle principal */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-white mb-1">Estado del bot</div>
            <div className="text-sm text-muted">
              {cargando
                ? 'Verificando estado...'
                : activo
                  ? 'El bot está respondiendo mensajes de Kommo automáticamente.'
                  : 'El bot está pausado. Los mensajes no serán respondidos.'
              }
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Badge de estado */}
            {!cargando && (
              <span className={`badge ${activo ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${activo ? 'bg-success' : 'bg-danger'} animate-pulse`} />
                {activo ? 'ACTIVO' : 'INACTIVO'}
              </span>
            )}

            {/* Toggle switch */}
            <button
              onClick={handleToggle}
              disabled={cargando || toggling}
              className={`
                relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
                ${activo ? 'bg-success' : 'bg-subtle'}
              `}
            >
              <span className={`
                absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300
                ${activo ? 'translate-x-7' : 'translate-x-0'}
              `} />
            </button>
          </div>
        </div>

        {/* Info adicional */}
        <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted">Endpoint webhook: </span>
            <code className="text-accent text-xs bg-accent/10 px-2 py-0.5 rounded">POST /webhook</code>
          </div>
          <div>
            <span className="text-muted">Modelo IA: </span>
            <span className="text-white">claude-sonnet-4-6</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatItem
            label="Total leads"
            value={stats.total_leads}
            color="text-accent"
          />
          <StatItem
            label="Conversaciones"
            value={stats.total_conversaciones}
            color="text-purple-400"
          />
          <StatItem
            label="Respuestas IA"
            value={stats.respuestas_ia}
            color="text-success"
          />
          <StatItem
            label="Errores"
            value={stats.total_errores}
            color={stats.total_errores > 0 ? 'text-danger' : 'text-success'}
          />
        </div>
      )}
    </div>
  );
}
