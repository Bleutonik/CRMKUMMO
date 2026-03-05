import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';

const estiloTabla = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px'
};

const estiloTh = {
  padding: '12px 16px',
  textAlign: 'left',
  color: '#64748b',
  borderBottom: '1px solid #334155',
  fontWeight: '500',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const estiloTd = {
  padding: '14px 16px',
  borderBottom: '1px solid #1e293b',
  color: '#cbd5e1'
};

export default function Conversaciones() {
  const [datos, setDatos] = useState(null);
  const [seleccionada, setSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    api.conversaciones()
      .then(setDatos)
      .finally(() => setCargando(false));
  }, []);

  const verDetalle = async (conv) => {
    setSeleccionada(conv);
    setCargandoDetalle(true);
    try {
      const data = await api.conversacion(conv.id);
      setDetalle(data);
    } catch (e) {
      console.error(e);
    }
    setCargandoDetalle(false);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const colorRol = (rol) => {
    if (rol === 'cliente') return { bg: '#1e3a5f', color: '#93c5fd' };
    if (rol === 'asistente') return { bg: '#14532d', color: '#86efac' };
    return { bg: '#1c1917', color: '#a8a29e' };
  };

  return (
    <Layout titulo="Conversaciones">
      <div style={{ display: 'grid', gridTemplateColumns: seleccionada ? '1fr 420px' : '1fr', gap: '24px' }}>

        {/* Lista de conversaciones */}
        <div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando conversaciones...</div>
            ) : (
              <table style={estiloTabla}>
                <thead>
                  <tr>
                    <th style={estiloTh}>Lead</th>
                    <th style={estiloTh}>Último mensaje</th>
                    <th style={estiloTh}>Mensajes</th>
                    <th style={estiloTh}>Estado</th>
                    <th style={estiloTh}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {datos?.conversaciones?.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...estiloTd, textAlign: 'center', color: '#475569', padding: '40px' }}>
                        Sin conversaciones aún. El bot comenzará a registrar cuando lleguen mensajes de Kommo.
                      </td>
                    </tr>
                  )}
                  {datos?.conversaciones?.map((conv) => (
                    <tr
                      key={conv.id}
                      onClick={() => verDetalle(conv)}
                      style={{
                        cursor: 'pointer',
                        background: seleccionada?.id === conv.id ? '#0f172a' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      <td style={estiloTd}>
                        <div style={{ fontWeight: '500', color: '#e2e8f0' }}>
                          {conv.lead_nombre || `Lead #${conv.kommo_lead_id}`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {conv.contacto_nombre || conv.contacto_email || '—'}
                        </div>
                      </td>
                      <td style={estiloTd}>
                        <div style={{
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: '#94a3b8',
                          fontSize: '13px'
                        }}>
                          {conv.ultimo_mensaje || '—'}
                        </div>
                      </td>
                      <td style={{ ...estiloTd, textAlign: 'center' }}>
                        <span style={{
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '20px',
                          padding: '2px 10px',
                          fontSize: '13px'
                        }}>
                          {conv.total_mensajes}
                        </span>
                      </td>
                      <td style={estiloTd}>
                        <span style={{
                          background: conv.estado === 'activa' ? '#14532d' : '#1c1917',
                          color: conv.estado === 'activa' ? '#86efac' : '#a8a29e',
                          borderRadius: '20px',
                          padding: '2px 10px',
                          fontSize: '12px'
                        }}>
                          {conv.estado}
                        </span>
                      </td>
                      <td style={{ ...estiloTd, fontSize: '12px', color: '#64748b' }}>
                        {formatearFecha(conv.ultimo_mensaje_en)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel de detalle */}
        {seleccionada && (
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '70vh'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: '600', color: '#e2e8f0' }}>
                  {seleccionada.lead_nombre || `Lead #${seleccionada.kommo_lead_id}`}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Kommo ID: {seleccionada.kommo_lead_id}
                </div>
              </div>
              <button
                onClick={() => { setSeleccionada(null); setDetalle(null); }}
                style={{
                  background: 'none', border: 'none', color: '#64748b',
                  cursor: 'pointer', fontSize: '20px', lineHeight: 1
                }}
              >×</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cargandoDetalle && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Cargando mensajes...</div>
              )}
              {detalle?.mensajes?.map((msg) => {
                const estilo = colorRol(msg.rol);
                return (
                  <div key={msg.id} style={{
                    background: estilo.bg,
                    border: `1px solid ${estilo.color}33`,
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: estilo.color, fontWeight: '600', textTransform: 'uppercase' }}>
                        {msg.rol === 'cliente' ? 'Cliente' : msg.rol === 'asistente' ? '🤖 IA' : 'Sistema'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        {formatearFecha(msg.creado_en)}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {msg.contenido}
                    </div>
                    {msg.rol === 'asistente' && !msg.error && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569' }}>
                        {msg.tokens_usados} tokens · {msg.tiempo_respuesta_ms}ms
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
