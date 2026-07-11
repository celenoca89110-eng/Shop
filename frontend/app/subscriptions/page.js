'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { RefreshCw, XCircle, Repeat } from 'lucide-react';

const STATUS_LABELS = {
  active: 'Actif',
  expired: 'Expiré',
  cancelled: 'Annulé',
};

const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400',
  expired: 'bg-white/10 text-white/50',
  cancelled: 'bg-red-500/20 text-red-400',
};

function formatRemaining(endsAt, status) {
  if (status !== 'active') return '—';
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Expire bientôt';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours} heure${hours > 1 ? 's' : ''} restante${hours > 1 ? 's' : ''}`;
}

export default function SubscriptionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function load() {
    api.get('/subscriptions/me').then(({ data }) => setSubscriptions(data.subscriptions)).finally(() => setLoadingSubs(false));
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleRenew(sub) {
    setBusyId(sub.id);
    try {
      const { data } = await api.post(`/subscriptions/${sub.id}/renew`);
      if (data.free) {
        router.push(`/checkout/success?order=${data.orderId}`);
      } else {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors du renouvellement.');
      setBusyId(null);
    }
  }

  async function handleCancel(sub, immediate) {
    if (!confirm(immediate ? 'Résilier immédiatement cet abonnement ?' : 'Désactiver le renouvellement automatique ?')) return;
    setBusyId(sub.id);
    try {
      await api.patch(`/subscriptions/${sub.id}/cancel`, { immediate });
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <Repeat className="h-6 w-6 text-brand-violetLight" />
          Mes abonnements
        </h1>

        {loadingSubs ? (
          <p className="text-white/40">Chargement…</p>
        ) : subscriptions.length === 0 ? (
          <p className="text-white/40">Vous n&apos;avez aucun abonnement pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{sub.product_name_snapshot}</p>
                  <p className="text-sm text-white/50">{sub.shop_name}</p>
                  <p className="mt-1 text-xs text-white/40">
                    Fin : {new Date(sub.ends_at).toLocaleDateString('fr-FR')} · {formatRemaining(sub.ends_at, sub.status)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[sub.status]}`}>
                    {STATUS_LABELS[sub.status]}
                  </span>
                  {sub.status !== 'cancelled' && (
                    <button
                      onClick={() => handleRenew(sub)}
                      disabled={busyId === sub.id}
                      className="btn-secondary text-xs"
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Renouveler
                    </button>
                  )}
                  {sub.status === 'active' && (
                    <button
                      onClick={() => handleCancel(sub, true)}
                      disabled={busyId === sub.id}
                      className="text-red-400"
                      title="Résilier immédiatement"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
