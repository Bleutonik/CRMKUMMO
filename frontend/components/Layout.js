import Link from 'next/link';
import { useRouter } from 'next/router';

const navegacion = [
  { href: '/dashboard', etiqueta: 'Dashboard', icono: '📊' },
  { href: '/conversations', etiqueta: 'Conversaciones', icono: '💬' },
  { href: '/leads', etiqueta: 'Leads', icono: '👥' },
  { href: '/settings', etiqueta: 'Configuración', icono: '⚙️' }
];

export default function Layout({ children, titulo }) {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        background: '#1e293b',
        borderRight: '1px solid #334155',
        padding: '0',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #334155' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#38bdf8' }}>
            🤖 CRM AI Bot
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Asistente IA para Kommo
          </div>
        </div>

        {/* Navegación */}
        <nav style={{ padding: '16px 0', flex: 1 }}>
          {navegacion.map((item) => {
            const activo = router.pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 20px',
                  color: activo ? '#38bdf8' : '#94a3b8',
                  background: activo ? '#0f172a' : 'transparent',
                  borderLeft: activo ? '3px solid #38bdf8' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: '14px',
                  fontWeight: activo ? '600' : '400'
                }}>
                  <span>{item.icono}</span>
                  <span>{item.etiqueta}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #334155', fontSize: '11px', color: '#475569' }}>
          Kommo CRM Assistant v1.0
        </div>
      </aside>

      {/* Contenido principal */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          padding: '20px 32px',
          borderBottom: '1px solid #1e293b',
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '600', color: '#f1f5f9' }}>
            {titulo}
          </h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
