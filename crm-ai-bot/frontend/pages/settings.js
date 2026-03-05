import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';

export default function Configuracion() {
  const [prompt, setPrompt] = useState('');
  const [promptOriginal, setPromptOriginal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.configuracion()
      .then(data => {
        const cfg = data.configuracion;
        const promptSistema = cfg.find(c => c.clave === 'prompt_sistema');
        if (promptSistema) {
          setPrompt(promptSistema.valor);
          setPromptOriginal(promptSistema.valor);
        }
      })
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      await api.actualizarPrompt('prompt_sistema', prompt);
      setPromptOriginal(prompt);
      setMensaje({ tipo: 'exito', texto: 'Prompt guardado correctamente' });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `Error al guardar: ${e.message}` });
    }
    setGuardando(false);
  };

  const hayCambios = prompt !== promptOriginal;

  return (
    <Layout titulo="Configuración">
      <div style={{ maxWidth: '720px' }}>

        {/* Prompt del sistema */}
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#e2e8f0' }}>
            Prompt del Asistente IA
          </h2>
          <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
            Define el comportamiento y personalidad del asistente. Este texto se envía como
            instrucción de sistema a Claude en cada conversación.
          </p>

          {cargando ? (
            <div style={{ color: '#64748b' }}>Cargando configuración...</div>
          ) : (
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '14px',
                color: '#e2e8f0',
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          )}

          {mensaje && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: mensaje.tipo === 'exito' ? '#14532d' : '#450a0a',
              color: mensaje.tipo === 'exito' ? '#86efac' : '#fca5a5',
              fontSize: '14px'
            }}>
              {mensaje.texto}
            </div>
          )}

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={guardar}
              disabled={!hayCambios || guardando || cargando}
              style={{
                background: hayCambios && !guardando ? '#0284c7' : '#1e3a5f',
                color: hayCambios && !guardando ? '#fff' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: hayCambios && !guardando ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {guardando ? 'Guardando...' : 'Guardar Prompt'}
            </button>
            {hayCambios && (
              <button
                onClick={() => { setPrompt(promptOriginal); setMensaje(null); }}
                style={{
                  background: 'none',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                Descartar cambios
              </button>
            )}
          </div>
        </div>

        {/* Info de conexión */}
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '28px'
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#e2e8f0' }}>
            Variables de Entorno
          </h2>

          {[
            { nombre: 'KOMMO_TOKEN', desc: 'Token de acceso a la API de Kommo' },
            { nombre: 'KOMMO_BASE_URL', desc: 'URL base de tu cuenta Kommo (ej: https://tudominio.kommo.com)' },
            { nombre: 'CLAUDE_API_KEY', desc: 'Clave de API de Anthropic para Claude' },
            { nombre: 'DATABASE_URL', desc: 'Cadena de conexión a PostgreSQL' },
            { nombre: 'FRONTEND_URL', desc: 'URL del frontend para CORS' }
          ].map(v => (
            <div key={v.nombre} style={{
              display: 'flex',
              gap: '16px',
              padding: '12px 0',
              borderBottom: '1px solid #1e293b'
            }}>
              <code style={{
                background: '#0f172a',
                padding: '4px 10px',
                borderRadius: '6px',
                color: '#38bdf8',
                fontSize: '13px',
                minWidth: '180px',
                display: 'inline-block'
              }}>
                {v.nombre}
              </code>
              <span style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
                {v.desc}
              </span>
            </div>
          ))}

          <p style={{ margin: '16px 0 0 0', color: '#475569', fontSize: '13px' }}>
            Configura estas variables en Railway (backend) y Vercel (frontend). Nunca las expongas en el código.
          </p>
        </div>
      </div>
    </Layout>
  );
}
