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
  const [showPass, setShowPass] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,142,247,.12) 0%, #07101f 55%)' }}>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-[.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(79,142,247,1) 1px, transparent 1px), linear-gradient(90deg, rgba(79,142,247,1) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="w-full max-w-[360px] animate-fade-in relative z-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, #5b95f9, #3a6fd8)', boxShadow: '0 8px 32px rgba(79,142,247,.4)' }}>
            K
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">CRM AI Bot</h1>
          <p className="text-sm text-muted mt-2">Fix A Trip · Kommo Dashboard</p>
        </div>

        {/* Card */}
        <div className="card p-7">
          <p className="text-sm font-medium text-white mb-6">Iniciar sesión en tu cuenta</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-2">Email</label>
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
              <label className="block text-xs font-medium text-muted mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input w-full pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                >
                  {showPass
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-danger/8 border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || !email || !password}
              className="btn-primary w-full py-3 mt-2"
            >
              {cargando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : 'Entrar al dashboard'}
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
