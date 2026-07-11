'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { Star, MessageSquare } from 'lucide-react';

export default function ShopReviewsPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function load() {
    api.get(`/reviews/manage/${shopId}`).then(({ data }) => setReviews(data.reviews));
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopId]);

  async function submitReply(reviewId) {
    const reply = replyDrafts[reviewId];
    if (!reply) return;
    await api.post(`/reviews/manage/${shopId}/${reviewId}/reply`, { reply });
    load();
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-8 flex items-center gap-2 text-2xl font-bold">
          <Star className="h-6 w-6 text-brand-violetLight" /> Avis produits
        </h1>

        {reviews.length === 0 ? (
          <p className="text-white/40">Aucun avis pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="card">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{r.username}</span>
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`} />
                    ))}
                  </span>
                </div>
                <p className="mb-2 text-sm text-white/50">{r.product_name}</p>
                {r.comment && <p className="mb-3 text-sm text-white/70">{r.comment}</p>}

                {r.seller_reply ? (
                  <div className="rounded-lg bg-white/5 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-brand-violetLight">Votre réponse</p>
                    <p className="text-white/60">{r.seller_reply}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="input-field flex-1 text-sm"
                      placeholder="Répondre à cet avis…"
                      value={replyDrafts[r.id] || ''}
                      onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                    <button onClick={() => submitReply(r.id)} className="btn-secondary text-xs">
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Répondre
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
