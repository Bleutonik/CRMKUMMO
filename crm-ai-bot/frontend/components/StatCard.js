export default function StatCard({ titulo, valor, subtitulo, icono, color = '#38bdf8' }) {
  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {titulo}
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color, marginTop: '8px' }}>
            {valor ?? '—'}
          </div>
        </div>
        {icono && (
          <div style={{
            fontSize: '28px',
            background: '#0f172a',
            borderRadius: '10px',
            padding: '10px',
            lineHeight: 1
          }}>
            {icono}
          </div>
        )}
      </div>
      {subtitulo && (
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          {subtitulo}
        </div>
      )}
    </div>
  );
}
