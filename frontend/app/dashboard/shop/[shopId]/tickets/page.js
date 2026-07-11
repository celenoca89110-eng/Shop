'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { LifeBuoy } from 'lucide-react';

const STATUS_LABELS = { open: 'Ouvert', answered: 'Répondu', closed: 'Fermé', archived: 'Archivé' };
const STATUS_COLORS = {
  open: 'bg-yellow-500/20 text-yellow-400',
  answered: 'bg-green-500/20 text-green-400',
  closed: 'bg-white/10 text-white/50',
  archived: 'bg-white/10 text-white/30',
};

export default function ShopTicketsPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const params = status ? { status } : {};
    api.get(`/tickets/manage/${shopId}`, { params }).then(({ data }) => setTickets(data.tickets));
  }, [user, shopId, status]);

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <LifeBuoy className="h-6 w-6 text-brand-violetLight" /> Tickets support
          </h1>
          <select className="input-field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            <option value="open">Ouvert</option>
            <option value="answered">Répondu</option>
            <option value="closed">Fermé</option>
            <option value="archived">Archivé</option>
          </select>
        </div>

        {tickets.length === 0 ? (
          <p className="text-white/40">Aucun ticket pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/shop/${shopId}/tickets/${t.id}`}
                className="card flex items-center justify-between hover:border-brand-violet/50"
              >
                <div>
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-sm text-white/50">{t.username} ({t.email})</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
