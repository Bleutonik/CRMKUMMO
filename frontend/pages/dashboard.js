import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.stats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const formatearMs = (ms) => {
    if (!ms) return '—';
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  return (
    <Layout titulo="Dashboard">
      {cargando && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Cargando estadísticas...
        </div>
      )}

      {error && (
        <div style={{
          background: '#450a0a',
          border: '1px solid #7f1d1d',
          borderRadius: '8px',
          padding: '16px',
          color: '#fca5a5',
          marginBottom: '24px'
        }}>
          Error al cargar datos: {error}. Verifica que el backend esté corriendo.
        </div>
      )}

      {stats && (
        <>
          {/* Tarjetas principales */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            <StatCard
              titulo="Total de Leads"
              valor={stats.resumen?.total_leads}
              icono="👥"
              color="#38bdf8"
              subtitulo="Leads con IA activa"
            />
            <StatCard
              titulo="Conversaciones"
              valor={stats.resumen?.total_conversaciones}
              icono="💬"
              color="#a78bfa"
              subtitulo="Total históricas"
            />
            <StatCard
              titulo="Respuestas IA"
              valor={stats.resumen?.respuestas_ia}
              icono="🤖"
              color="#34d399"
              subtitulo="Generadas exitosamente"
            />
            <StatCard
              titulo="Tiempo Promedio"
              valor={formatearMs(stats.resumen?.tiempo_promedio_ms)}
              icono="⚡"
              color="#fbbf24"
              subtitulo="Por respuesta de IA"
            />
          </div>

          {/* Fila secundaria */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            <StatCard
              titulo="Hoy — Conversaciones"
              valor={stats.resumen?.conversaciones_hoy}
              icono="📅"
              color="#38bdf8"
              subtitulo="Últimas 24 horas"
            />
            <StatCard
              titulo="Hoy — Respuestas IA"
              valor={stats.resumen?.respuestas_hoy}
              icono="💡"
              color="#34d399"
              subtitulo="Últimas 24 horas"
            />
            <StatCard
              titulo="Tokens Promedio"
              valor={stats.resumen?.tokens_promedio}
              icono="📊"
              color="#a78bfa"
              subtitulo="Por respuesta"
            />
            <StatCard
              titulo="Errores"
              valor={stats.resumen?.total_errores}
              icono="⚠️"
              color={stats.resumen?.total_errores > 0 ? '#f87171' : '#34d399'}
              subtitulo="Total errores IA"
            />
          </div>

          {/* Gráfica de actividad */}
          {stats.actividadPorHora?.length > 0 && (
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#e2e8f0' }}>
                Actividad — Últimas 24 horas
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.actividadPorHora}>
                  <XAxis
                    dataKey="hora"
                    tickFormatter={(v) => new Date(v).getHours() + 'h'}
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }}
                    labelFormatter={(v) => `Hora: ${new Date(v).getHours()}:00`}
                  />
                  <Bar dataKey="mensajes" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
