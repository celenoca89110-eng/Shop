'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { Star } from 'lucide-react';

export default function ReviewsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [submittedIds, setSubmittedIds] = useState([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get('/reviews/reviewable').then(({ data }) => setItems(data.items));
  }, [user]);

  async function submitReview(itemId) {
    const rating = ratings[itemId] || 5;
    const comment = comments[itemId] || '';
    try {
      await api.post('/reviews', { orderItemId: itemId, rating, comment });
      setSubmittedIds((s) => [...s, itemId]);
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors de l'envoi de l'avis.");
    }
  }

  if (loading || !user) return null;

  const pending = items.filter((i) => !submittedIds.includes(i.order_item_id));

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-8 text-2xl font-bold">Laisser un avis</h1>

        {pending.length === 0 ? (
          <p className="text-white/40">Aucun achat en attente d&apos;avis pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((item) => (
              <div key={item.order_item_id} className="card">
                <p className="mb-1 font-semibold">{item.product_name_snapshot}</p>
                <p className="mb-3 text-sm text-white/50">{item.shop_name}</p>

                <div className="mb-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatings((r) => ({ ...r, [item.order_item_id]: n }))}
                    >
                      <Star
                        className={`h-6 w-6 ${(ratings[item.order_item_id] || 5) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  className="input-field mb-3"
                  rows={2}
                  placeholder="Votre commentaire (optionnel)"
                  value={comments[item.order_item_id] || ''}
                  onChange={(e) => setComments((c) => ({ ...c, [item.order_item_id]: e.target.value }))}
                />

                <button onClick={() => submitReview(item.order_item_id)} className="btn-primary text-sm">
                  Publier l&apos;avis
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
