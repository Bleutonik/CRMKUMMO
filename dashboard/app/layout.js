import './globals.css';

export const metadata = {
  title: 'CRM AI Bot — Dashboard',
  description: 'Panel de control del asistente IA para Kommo CRM'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ background: '#07101f' }}>
        {children}
      </body>
    </html>
  );
}
