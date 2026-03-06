'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';

function StatCard({ label, value, color, icon }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(255,255,255,.05)' }}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted font-medium uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value ?? '—'}</div>
      </div>
    </div>
  );
}

function ChatBurbuja({ msg }) {
  const esBot = msg.rol === 'bot';
  return (
    <div className={`flex gap-3 ${esBot ? 'justify-start' : 'justify-end'}`}>
      {esBot && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'linear-gradient(135deg,#4f8ef7,#3a6fd8)' }}>
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      )}
      <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        esBot
          ? 'bg-card border border-border text-slate-200 rounded-tl-sm'
          : 'text-white rounded-tr-sm'
      }`}
        style={!esBot ? { background: 'linear-gradient(135deg,#4f8ef7,#3a6fd8)' } : {}}>
        {msg.texto}
        {msg.cargando && (
          <span className="inline-flex gap-1 ml-2">
            {[0,1,2].map(i => (
              <span key={i} className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BotPage() {
  const [activo, setActivo] = useState(null);
  const [stats, setStats] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Chat de prueba
  const [mensajes, setMensajes] = useState([
    { rol: 'bot', texto: 'Hola, soy el asistente IA de Fix A Trip. Escríbeme algo para probar cómo respondería a un cliente real.' }
  ]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    Promise.all([api.botStatus(), api.stats()])
      .then(([bot, s]) => { setActivo(bot.activo); setStats(s.resumen); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleToggle = async () => {
    setToggling(true);
    try { const res = await api.botToggle(); setActivo(res.activo); }
    catch (e) { console.error(e); }
    setToggling(false);
  };

  const enviarMensaje = async (e) => {
    e?.preventDefault();
    const texto = input.trim();
    if (!texto || enviando) return;

    setInput('');
    setMensajes(prev => [...prev, { rol: 'usuario', texto }]);
    setEnviando(true);

    // Burbuja de "escribiendo..."
    setMensajes(prev => [...prev, { rol: 'bot', texto: '', cargando: true }]);

    try {
      const data = await api.botTest(texto);
      setMensajes(prev => [
        ...prev.slice(0, -1), // quitar burbuja de cargando
        { rol: 'bot', texto: data.respuesta }
      ]);
    } catch (err) {
      setMensajes(prev => [
        ...prev.slice(0, -1),
        { rol: 'bot', texto: 'Error al generar respuesta. Verifica que la API Key de Claude esté configurada en Railway.' }
      ]);
    }
    setEnviando(false);
  };

  const limpiarChat = () => {
    setMensajes([
      { rol: 'bot', texto: 'Hola, soy el asistente IA de Fix A Trip. Escríbeme algo para probar cómo respondería a un cliente real.' }
    ]);
  };

  return (
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white tracking-tight">Bot Control</h1>
        <p className="text-sm text-muted mt-1">Gestiona el estado del asistente IA y pruébalo antes de activarlo.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Toggle card */}
        <div className="card">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-base font-semibold text-white">Asistente IA</div>
                {!cargando && (
                  <span className={`badge text-xs ${activo ? 'badge-success' : 'badge-danger'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activo ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                    {activo ? 'Activo' : 'Inactivo'}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted leading-relaxed">
                {cargando
                  ? 'Verificando estado...'
                  : activo
                    ? 'El bot está respondiendo mensajes automáticamente desde Kommo.'
                    : 'El bot está pausado. Los mensajes entrantes no recibirán respuesta automática.'
                }
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={cargando || toggling}
              className="relative flex-shrink-0 w-14 h-7 rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: activo ? 'linear-gradient(135deg,#22c55e,#16a34a)' : '#1a2a40',
                boxShadow: activo ? '0 0 16px rgba(34,197,94,.3)' : 'none',
              }}
            >
              <span className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300"
                style={{ transform: activo ? 'translateX(28px)' : 'translateX(0)' }} />
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-border grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted">
              <span>Webhook:</span>
              <code className="text-xs text-accent font-mono bg-accent-dim/60 px-2 py-0.5 rounded-lg">POST /webhook</code>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <span>Modelo:</span>
              <span className="text-white font-medium">claude-sonnet-4-6</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {cargando ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 space-y-3">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-7 w-14" />
              </div>
            ))
          ) : stats ? (
            <>
              <StatCard label="Total leads" value={stats.total_leads} color="text-accent"
                icon={<svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
              />
              <StatCard label="Conversaciones" value={stats.total_conversaciones} color="text-purple-400"
                icon={<svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
              />
              <StatCard label="Respuestas IA" value={stats.respuestas_ia} color="text-success"
                icon={<svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              />
              <StatCard label="Errores" value={stats.total_errores} color={stats.total_errores > 0 ? 'text-danger' : 'text-success'}
                icon={<svg className={`w-5 h-5 ${stats.total_errores > 0 ? 'text-danger' : 'text-success'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Chat de prueba */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Probar el bot</h2>
            <p className="text-xs text-muted mt-0.5">Escribe como si fueras un cliente. El bot responde usando su IA y conocimiento actual.</p>
          </div>
          <button onClick={limpiarChat} className="text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-surface border border-transparent hover:border-border">
            Limpiar chat
          </button>
        </div>

        {/* Mensajes */}
        <div className="rounded-xl overflow-y-auto flex flex-col gap-4 p-4 mb-4"
          style={{ background: 'rgba(0,0,0,.2)', minHeight: '280px', maxHeight: '420px' }}>
          {mensajes.map((msg, i) => (
            <ChatBurbuja key={i} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={enviarMensaje} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe un mensaje de prueba... ej: ¿Cuánto cuesta el tour?"
            className="input flex-1"
            disabled={enviando}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || enviando}
            className="btn-primary px-5 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {enviando ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>

    </div>
  );
}
