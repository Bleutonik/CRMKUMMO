'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';

const CATEGORIAS = ['general', 'precios', 'disponibilidad', 'reservas', 'tours', 'contacto', 'otro'];

function BadgeCategoria({ cat }) {
  const colores = {
    general:       'bg-slate-500/20 text-slate-300',
    precios:       'bg-yellow-500/20 text-yellow-300',
    disponibilidad:'bg-blue-500/20 text-blue-300',
    reservas:      'bg-purple-500/20 text-purple-300',
    tours:         'bg-emerald-500/20 text-emerald-300',
    contacto:      'bg-pink-500/20 text-pink-300',
    otro:          'bg-gray-500/20 text-gray-300'
  };
  return (
    <span className={`badge ${colores[cat] || colores.otro}`}>
      {cat}
    </span>
  );
}

export default function TrainingPage() {
  const [conocimiento, setConocimiento] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [eliminando, setEliminando] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [importando, setImportando] = useState(false);
  const [extrayendo, setExtrayendo] = useState(false);
  const [entrenando, setEntrenando] = useState(false);
  const [adminMsg, setAdminMsg] = useState(null);
  const [exito, setExito] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    pregunta: '',
    respuesta: '',
    categoria: 'general'
  });

  const cargar = useCallback(() => {
    api.knowledge()
      .then(data => setConocimiento(data.conocimiento || []))
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pregunta.trim() || !form.respuesta.trim()) return;

    setEnviando(true);
    setErrorMsg(null);
    try {
      await api.crearKnowledge(form);
      setForm({ pregunta: '', respuesta: '', categoria: 'general' });
      setExito(true);
      setTimeout(() => setExito(false), 3000);
      cargar();
    } catch (err) {
      setErrorMsg(err.message);
    }
    setEnviando(false);
  };

  const handleEliminar = async (id) => {
    setEliminando(id);
    try {
      await api.eliminarKnowledge(id);
      setConocimiento(prev => prev.filter(k => k.id !== id));
    } catch (e) {
      console.error(e);
    }
    setEliminando(null);
  };

  const filtrados = filtroCategoria === 'todas'
    ? conocimiento
    : conocimiento.filter(k => k.categoria === filtroCategoria);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Entrenamiento del Bot</h1>
        <p className="text-sm text-muted mt-1">
          Agrega conocimiento manualmente o entrena el bot leyendo el historial de Kommo.
        </p>
      </div>

      {/* Panel de entrenamiento desde Kommo */}
      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-white mb-1">Entrenar desde Kommo</h2>
        <p className="text-xs text-muted mb-5">
          Lee los leads directamente de Kommo y extrae conocimiento con IA en un solo paso. No requiere importar conversaciones.
        </p>

        <div className="flex flex-wrap gap-3">
          {/* Entrenamiento directo desde Kommo — lee todos los leads e historial */}
          <button
            onClick={async () => {
              setEntrenando(true);
              setAdminMsg(null);
              try {
                await api.entrenarKommo();
                setAdminMsg({ tipo: 'ok', texto: 'Entrenamiento iniciado. Claude está leyendo todos los leads de Kommo y extrayendo conocimiento. Puede tardar varios minutos. El conocimiento aparecerá abajo automáticamente.' });
                setTimeout(() => cargar(), 60000);
                setTimeout(() => cargar(), 120000);
                setTimeout(() => cargar(), 180000);
              } catch (e) {
                setAdminMsg({ tipo: 'error', texto: `Error: ${e.message}` });
              }
              setEntrenando(false);
            }}
            disabled={importando || extrayendo || entrenando}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {entrenando ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                Iniciando...
              </span>
            ) : '⚡ Entrenar desde Kommo (todos los leads)'}
          </button>

          {/* Aprender del historial de conversaciones en la DB */}
          <button
            onClick={async () => {
              setImportando(true);
              setAdminMsg(null);
              try {
                await api.aprenderDB();
                setAdminMsg({ tipo: 'ok', texto: 'Aprendizaje desde historial de conversaciones iniciado. Claude analizará los últimos 500 intercambios y extraerá conocimiento. Aparecerá en minutos.' });
                setTimeout(() => cargar(), 45000);
                setTimeout(() => cargar(), 90000);
              } catch (e) {
                setAdminMsg({ tipo: 'error', texto: `Error: ${e.message}` });
              }
              setImportando(false);
            }}
            disabled={importando || extrayendo || entrenando}
            className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importando ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-white/40 border-t-white/80 rounded-full animate-spin" />
                Iniciando...
              </span>
            ) : '💬 Aprender del historial de conversaciones'}
          </button>

          {/* Opciones avanzadas colapsadas */}
          <details className="w-full">
            <summary className="text-xs text-muted cursor-pointer hover:text-white mt-2">
              Opciones avanzadas (importar + extraer por separado)
            </summary>
            <div className="flex flex-wrap gap-3 mt-3">
              <button
                onClick={async () => {
                  setImportando(true);
                  setAdminMsg(null);
                  try {
                    await api.importarKommo();
                    setAdminMsg({ tipo: 'ok', texto: 'Importación iniciada. Revisa los logs de Railway.' });
                  } catch (e) {
                    setAdminMsg({ tipo: 'error', texto: `Error: ${e.message}` });
                  }
                  setImportando(false);
                }}
                disabled={importando || extrayendo || entrenando}
                className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importando ? 'Iniciando...' : '1. Importar historial'}
              </button>

              <button
                onClick={async () => {
                  setExtrayendo(true);
                  setAdminMsg(null);
                  try {
                    await api.extraerKnowledge();
                    setAdminMsg({ tipo: 'ok', texto: 'Extracción iniciada. En unos minutos verás el conocimiento.' });
                    setTimeout(() => cargar(), 30000);
                  } catch (e) {
                    setAdminMsg({ tipo: 'error', texto: `Error: ${e.message}` });
                  }
                  setExtrayendo(false);
                }}
                disabled={importando || extrayendo || entrenando}
                className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extrayendo ? 'Iniciando...' : '2. Extraer conocimiento con IA'}
              </button>
            </div>
          </details>
        </div>

        {adminMsg && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
            adminMsg.tipo === 'ok'
              ? 'bg-success/10 border border-success/20 text-success'
              : 'bg-danger/10 border border-danger/20 text-danger'
          }`}>
            {adminMsg.texto}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Formulario — 2 columnas */}
        <div className="lg:col-span-2">
          <div className="card sticky top-8">
            <h2 className="text-sm font-semibold text-white mb-5">Nueva entrada de conocimiento</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Pregunta</label>
                <input
                  type="text"
                  placeholder="ej: ¿Cuánto cuesta el tour básico?"
                  value={form.pregunta}
                  onChange={e => setForm(p => ({ ...p, pregunta: e.target.value }))}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Respuesta</label>
                <textarea
                  rows={5}
                  placeholder="ej: El tour básico tiene un precio de $50 por persona e incluye..."
                  value={form.respuesta}
                  onChange={e => setForm(p => ({ ...p, respuesta: e.target.value }))}
                  className="input resize-none"
                  required
                />
              </div>

              <div>
                <label className="label">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                  className="input"
                >
                  {CATEGORIAS.map(c => (
                    <option key={c} value={c} className="bg-surface">{c}</option>
                  ))}
                </select>
              </div>

              {exito && (
                <div className="bg-success/10 border border-success/20 text-success rounded-lg px-4 py-3 text-sm">
                  Conocimiento agregado correctamente
                </div>
              )}
              {errorMsg && (
                <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || !form.pregunta.trim() || !form.respuesta.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? 'Guardando...' : 'Agregar conocimiento'}
              </button>
            </form>
          </div>
        </div>

        {/* Lista — 3 columnas */}
        <div className="lg:col-span-3">
          {/* Filtro por categoría */}
          <div className="flex gap-2 flex-wrap mb-5">
            <button
              onClick={() => setFiltroCategoria('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtroCategoria === 'todas'
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-border text-muted hover:text-white'
              }`}
            >
              Todas ({conocimiento.length})
            </button>
            {CATEGORIAS.map(cat => {
              const count = conocimiento.filter(k => k.categoria === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setFiltroCategoria(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroCategoria === cat
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-border text-muted hover:text-white'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Lista */}
          {cargando ? (
            <div className="card text-center text-muted py-12">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Cargando conocimiento...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="card text-center text-muted py-12">
              <div className="text-4xl mb-3">📚</div>
              <div className="text-sm">Sin entradas aún. Agrega conocimiento usando el formulario.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtrados.map(item => (
                <div key={item.id} className="card group hover:border-border/80 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <BadgeCategoria cat={item.categoria} />
                        <span className="text-xs text-muted">
                          {new Date(item.creado_en).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white mb-1.5">
                        {item.pregunta}
                      </div>
                      <div className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                        {item.respuesta}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEliminar(item.id)}
                      disabled={eliminando === item.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted hover:text-danger p-1 rounded disabled:opacity-50"
                      title="Eliminar"
                    >
                      {eliminando === item.id ? (
                        <div className="w-4 h-4 border border-danger border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
