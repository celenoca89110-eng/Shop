'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { LifeBuoy, Plus, X } from 'lucide-react';

const STATUS_LABELS = { open: 'Ouvert', answered: 'Répondu', closed: 'Fermé', archived: 'Archivé' };
const STATUS_COLORS = {
  open: 'bg-yellow-500/20 text-yellow-400',
  answered: 'bg-green-500/20 text-green-400',
  closed: 'bg-white/10 text-white/50',
  archived: 'bg-white/10 text-white/30',
};

export default function SupportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [shopSlug, setShopSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function load() {
    api.get('/tickets/me').then(({ data }) => setTickets(data.tickets));
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/tickets', { shopSlug, subject, message });
      setShowForm(false);
      setShopSlug('');
      setSubject('');
      setMessage('');
      router.push(`/support/${data.ticket.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du ticket.');
    }
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <LifeBuoy className="h-6 w-6 text-brand-violetLight" /> Support
          </h1>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm">
            {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {showForm ? 'Annuler' : 'Nouveau ticket'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="card mb-8 space-y-4">
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div>
              <label className="mb-1 block text-sm text-white/60">Slug de la boutique</label>
              <input required className="input-field" placeholder="cecashop" value={shopSlug} onChange={(e) => setShopSlug(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/60">Sujet</label>
              <input required className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/60">Message</label>
              <textarea required rows={4} className="input-field" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary w-full">Envoyer</button>
          </form>
        )}

        {tickets.length === 0 ? (
          <p className="text-white/40">Vous n&apos;avez aucun ticket pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <Link key={t.id} href={`/support/${t.id}`} className="card flex items-center justify-between hover:border-brand-violet/50">
                <div>
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-sm text-white/50">{t.shop_name}</p>
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
