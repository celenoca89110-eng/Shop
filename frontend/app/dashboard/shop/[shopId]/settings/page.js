'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { Settings, Save } from 'lucide-react';

export default function ShopSettingsPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [shop, setShop] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get('/shops/mine').then(({ data }) => {
      const s = data.shops.find((sh) => sh.id === shopId);
      setShop(s);
      setForm({
        name: s?.name || '',
        description: s?.description || '',
        colorPrimary: s?.color_primary || '#7c3aed',
        colorSecondary: s?.color_secondary || '#000000',
        discordWebhookUrl: s?.discord_webhook_url || '',
        discordGuildId: s?.discord_guild_id || '',
      });
    });
  }, [user, shopId]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.patch(`/shops/manage/${shopId}`, form);
      setShop(data.shop);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde.');
    }
  }

  if (loading || !user || !form) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6 text-brand-violetLight" /> Réglages — {shop?.name}
        </h1>

        <form onSubmit={handleSave} className="card space-y-5">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {saved && <p className="text-sm text-green-400">Réglages enregistrés ✓</p>}

          <div>
            <label className="mb-1 block text-sm text-white/60">Nom</label>
            <input className="input-field" value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/60">Description</label>
            <textarea className="input-field" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-white/60">Couleur principale</label>
              <input type="color" className="input-field h-11 p-1" value={form.colorPrimary} onChange={(e) => update('colorPrimary', e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/60">Couleur secondaire</label>
              <input type="color" className="input-field h-11 p-1" value={form.colorSecondary} onChange={(e) => update('colorSecondary', e.target.value)} />
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <h2 className="mb-3 text-sm font-semibold text-white/70">Intégration Discord</h2>

            <div className="mb-4">
              <label className="mb-1 block text-sm text-white/60">URL du webhook Discord</label>
              <input
                className="input-field"
                placeholder="https://discord.com/api/webhooks/…"
                value={form.discordWebhookUrl}
                onChange={(e) => update('discordWebhookUrl', e.target.value)}
              />
              <p className="mt-1 text-xs text-white/30">
                Reçoit les notifications : nouvelle commande, commande terminée, remboursement, nouveau client, abonnement expiré.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/60">ID du serveur Discord (Guild ID)</label>
              <input
                className="input-field"
                placeholder="123456789012345678"
                value={form.discordGuildId}
                onChange={(e) => update('discordGuildId', e.target.value)}
              />
              <p className="mt-1 text-xs text-white/30">
                Nécessaire pour l&apos;attribution automatique des rôles à l&apos;achat. Le bot CecaShop doit être présent sur ce serveur.
              </p>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">
            <Save className="mr-2 h-4 w-4" /> Enregistrer
          </button>
        </form>
      </main>
    </>
  );
}
