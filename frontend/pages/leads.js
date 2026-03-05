import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';

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

export default function Leads() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api.leads()
      .then(setDatos)
      .finally(() => setCargando(false));
  }, []);

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const leadsFiltrados = datos?.leads?.filter(lead =>
    !busqueda ||
    lead.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    lead.contacto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    lead.contacto_email?.toLowerCase().includes(busqueda.toLowerCase())
  ) || [];

  return (
    <Layout titulo="Leads">
      {/* Barra de búsqueda */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, contacto o email..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#e2e8f0',
            fontSize: '14px',
            width: '320px',
            outline: 'none'
          }}
        />
        {datos && (
          <span style={{ marginLeft: '16px', color: '#64748b', fontSize: '14px' }}>
            {datos.paginacion?.total} leads totales
          </span>
        )}
      </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando leads...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>
                <th style={estiloTh}>Lead</th>
                <th style={estiloTh}>Contacto</th>
                <th style={estiloTh}>Email / Teléfono</th>
                <th style={estiloTh}>Conversaciones</th>
                <th style={estiloTh}>Mensajes</th>
                <th style={estiloTh}>Estado</th>
                <th style={estiloTh}>Creado</th>
              </tr>
            </thead>
            <tbody>
              {leadsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...estiloTd, textAlign: 'center', color: '#475569', padding: '40px' }}>
                    {busqueda ? 'Sin resultados para esta búsqueda' : 'Sin leads aún'}
                  </td>
                </tr>
              )}
              {leadsFiltrados.map((lead) => (
                <tr key={lead.id} style={{ transition: 'background 0.15s' }}>
                  <td style={estiloTd}>
                    <div style={{ fontWeight: '500', color: '#e2e8f0' }}>{lead.nombre}</div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>Kommo #{lead.kommo_lead_id}</div>
                  </td>
                  <td style={estiloTd}>
                    {lead.contacto_nombre || <span style={{ color: '#475569' }}>—</span>}
                  </td>
                  <td style={estiloTd}>
                    <div style={{ fontSize: '13px' }}>{lead.contacto_email || '—'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{lead.contacto_telefono || ''}</div>
                  </td>
                  <td style={{ ...estiloTd, textAlign: 'center' }}>
                    <span style={{
                      background: '#0f172a', border: '1px solid #334155',
                      borderRadius: '20px', padding: '2px 10px', fontSize: '13px'
                    }}>
                      {lead.total_conversaciones || 0}
                    </span>
                  </td>
                  <td style={{ ...estiloTd, textAlign: 'center' }}>
                    {lead.total_mensajes || 0}
                  </td>
                  <td style={estiloTd}>
                    <span style={{
                      background: lead.estado === 'activo' ? '#14532d' : '#1c1917',
                      color: lead.estado === 'activo' ? '#86efac' : '#a8a29e',
                      borderRadius: '20px', padding: '2px 10px', fontSize: '12px'
                    }}>
                      {lead.estado}
                    </span>
                  </td>
                  <td style={{ ...estiloTd, fontSize: '12px', color: '#64748b' }}>
                    {formatearFecha(lead.creado_en)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
