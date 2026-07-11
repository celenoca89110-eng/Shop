'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../lib/api';
import { Download } from 'lucide-react';

const STATUS_LABELS = {
  pending: 'En attente',
  paid: 'Payée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
  subscription_active: 'Abonnement actif',
  subscription_cancelled: 'Abonnement annulé',
  subscription_expired: 'Abonnement expiré',
};

function formatPrice(cents) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get(`/orders/me/${orderId}`)
      .then(({ data }) => setOrder(data.order))
      .catch(() => setError('Commande introuvable.'));

    api
      .get(`/orders/me/${orderId}/downloads`)
      .then(({ data }) => setDownloads(data.downloads))
      .catch(() => setDownloads([]));
  }, [user, orderId]);

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        {error ? (
          <p className="text-white/40">{error}</p>
        ) : !order ? (
          <p className="text-white/40">Chargement…</p>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold">Commande #{order.order_number}</h1>
            <p className="mb-8 text-white/50">{order.shop_name}</p>

            <div className="card mb-6">
              <h2 className="mb-4 font-semibold">Articles</h2>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">{item.product_name_snapshot}</p>
                      <p className="text-sm text-white/40">Quantité : {item.quantity}</p>
                    </div>
                    <p>{formatPrice(item.unit_price_cents * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            {downloads.length > 0 && (
              <div className="card mb-6">
                <h2 className="mb-4 font-semibold">Fichiers à télécharger</h2>
                <div className="space-y-2">
                  {downloads.map((d) => {
                    const expired = new Date(d.expires_at) < new Date();
                    const exhausted = d.download_count >= d.max_downloads;
                    const disabled = expired || exhausted;
                    return (
                      <div key={d.token} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{d.file_name}</p>
                          <p className="text-xs text-white/40">
                            {d.download_count}/{d.max_downloads} téléchargements ·{' '}
                            {expired ? 'lien expiré' : `expire le ${new Date(d.expires_at).toLocaleDateString('fr-FR')}`}
                          </p>
                        </div>
                        {disabled ? (
                          <span className="text-xs text-white/30">Indisponible</span>
                        ) : (
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL}/files/download/${d.token}`}
                            className="btn-secondary text-xs"
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Télécharger
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card space-y-2">
              <div className="flex justify-between text-white/60">
                <span>Sous-total</span>
                <span>{formatPrice(order.subtotal_cents)}</span>
              </div>
              {order.discount_cents > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Réduction</span>
                  <span>-{formatPrice(order.discount_cents)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(order.total_cents)}</span>
              </div>
              <div className="mt-3 flex justify-between text-sm text-white/40">
                <span>Statut</span>
                <span>{STATUS_LABELS[order.status]}</span>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
