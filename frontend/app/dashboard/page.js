'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { ShieldCheck, Store, User, Plus, Package, Ticket, ClipboardList } from 'lucide-react';

const ROLE_LABELS = {
  user: 'Utilisateur',
  shop_owner: 'Vendeur',
  admin: 'Administrateur',
  founder: 'Founder',
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/shops/mine')
      .then(({ data }) => setShops(data.shops))
      .catch(() => setShops([]))
      .finally(() => setLoadingShops(false));
  }, [user]);

  async function handleCreateShop(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/shops', { name });
      setShops((s) => [...s, data.shop]);
      setName('');
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création.');
    }
  }

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 py-20 text-white/40">Chargement…</main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="mb-8 text-2xl font-bold">Bonjour, {user.username} 👋</h1>

        <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="card">
            <User className="mb-3 h-6 w-6 text-brand-violetLight" />
            <p className="text-sm text-white/50">Rôle</p>
            <p className="text-lg font-semibold">{ROLE_LABELS[user.role] || user.role}</p>
          </div>
          <div className="card">
            <Store className="mb-3 h-6 w-6 text-brand-violetLight" />
            <p className="text-sm text-white/50">Boutiques</p>
            <p className="text-lg font-semibold">{shops.length}</p>
          </div>
          <div className="card">
            <ShieldCheck className="mb-3 h-6 w-6 text-brand-violetLight" />
            <p className="text-sm text-white/50">Sécurité</p>
            <p className="text-lg font-semibold">Compte vérifié</p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Mes boutiques</h2>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle boutique
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateShop} className="card mb-6 flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-white/60">Nom de la boutique</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Ma super boutique"
              />
            </div>
            <button type="submit" className="btn-primary">Créer</button>
          </form>
        )}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loadingShops ? (
          <p className="text-white/40">Chargement…</p>
        ) : shops.length === 0 ? (
          <p className="text-white/40">Vous ne gérez aucune boutique pour le moment.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <div key={shop.id} className="card">
                <h3 className="mb-1 text-lg font-semibold">{shop.name}</h3>
                <p className="mb-4 text-sm text-white/50">/{shop.slug}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/shop/${shop.id}/products`} className="btn-secondary text-xs">
                    <Package className="mr-1.5 h-3.5 w-3.5" /> Produits
                  </Link>
                  <Link href={`/dashboard/shop/${shop.id}/promo-codes`} className="btn-secondary text-xs">
                    <Ticket className="mr-1.5 h-3.5 w-3.5" /> Codes promo
                  </Link>
                  <Link href={`/dashboard/shop/${shop.id}/orders`} className="btn-secondary text-xs">
                    <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Commandes
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card mt-10">
          <h2 className="mb-3 text-lg font-semibold">Prochaines étapes</h2>
          <ul className="list-inside list-disc space-y-1 text-white/60">
            <li>Phase 3 : abonnements et calendrier</li>
            <li>Phase 4 : intégration Discord (webhooks + rôles automatiques)</li>
            <li>Phase 5 : support, avis produits, dashboard statistiques</li>
          </ul>
        </div>
      </main>
    </>
  );
}
