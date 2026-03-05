import './globals.css';
import Sidebar from '../components/Sidebar';

export const metadata = {
  title: 'CRM AI Bot — Dashboard',
  description: 'Panel de control del asistente IA para Kommo CRM'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="flex h-screen overflow-hidden bg-base">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
