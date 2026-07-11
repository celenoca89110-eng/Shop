'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { UserCircle, Save } from 'lucide-react';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [discordId, setDiscordId] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (user) setDiscordId(user.discord_id || '');
  }, [loading, user, router]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    try {
      await api.patch('/auth/me', { discordId });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde.');
    }
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <UserCircle className="h-6 w-6 text-brand-violetLight" /> Mon profil
        </h1>

        <form onSubmit={handleSave} className="card space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {saved && <p className="text-sm text-green-400">Enregistré ✓</p>}

          <div>
            <label className="mb-1 block text-sm text-white/60">Pseudo</label>
            <input className="input-field" value={user.username} disabled />
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/60">Email</label>
            <input className="input-field" value={user.email} disabled />
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/60">ID Discord</label>
            <input
              className="input-field"
              placeholder="123456789012345678"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
            />
            <p className="mt-1 text-xs text-white/30">
              Nécessaire pour recevoir automatiquement les rôles Discord liés à vos achats.
              Activez le mode développeur dans Discord pour copier votre ID (clic droit sur votre profil → Copier l&apos;identifiant).
            </p>
          </div>

          <button type="submit" className="btn-primary w-full">
            <Save className="mr-2 h-4 w-4" /> Enregistrer
          </button>
        </form>
      </main>
    </>
  );
}
