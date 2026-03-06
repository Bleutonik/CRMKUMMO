'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { setToken, setUsuario, getToken } from '../../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace('/bot');
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setCargando(true); setError(null);
    try {
      const data = await api.login(email, password);
      setToken(data.token);
      setUsuario(data.usuario);
      router.replace('/bot');
    } catch (e) {
      setError(e.message);
    }
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">K</div>
          <h1 className="text-xl font-semibold text-white">CRM AI Bot</h1>
          <p className="text-sm text-muted mt-1">Fix A Trip · Kommo Dashboard</p>
        </div>

        {/* Form */}
        <div className="card p-6">
          <h2 className="text-base font-medium text-white mb-5">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1.5">Email</label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input w-full"
                required
              />
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-2.5 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || !email || !password}
              className="btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-xs text-muted text-center mt-6">
          ¿No tienes acceso? Contacta al administrador.
        </p>
      </div>
    </div>
  );
}
