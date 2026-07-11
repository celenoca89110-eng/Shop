'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.email, form.password, form.username);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col px-6 py-20">
        <h1 className="mb-8 text-center text-2xl font-bold">Créer un compte</h1>

        {success ? (
          <div className="card text-center">
            <p className="text-brand-violetLight">
              Compte créé ! Vérifiez votre email puis connectez-vous.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            {error && (
              <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
            )}

            <div>
              <label className="mb-1 block text-sm text-white/60">Pseudo</label>
              <input
                required
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                className="input-field"
                placeholder="VotrePseudo"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/60">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="input-field"
                placeholder="vous@exemple.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/60">Mot de passe</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="input-field"
                placeholder="8 caractères minimum"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>

            <p className="text-center text-sm text-white/40">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-brand-violetLight hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        )}
      </main>
    </>
  );
}
