'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../../components/Navbar';
import { useAuth } from '../../../../../../context/AuthContext';
import api from '../../../../../../lib/api';
import { Send, Archive, CheckCircle2, RotateCcw } from 'lucide-react';

export default function ShopTicketDetailPage() {
  const { shopId, ticketId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function load() {
    api.get(`/tickets/manage/${shopId}/${ticketId}`).then(({ data }) => setTicket(data.ticket));
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopId, ticketId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/manage/${shopId}/${ticketId}/messages`, { message });
      setMessage('');
      load();
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(status) {
    await api.patch(`/tickets/manage/${shopId}/${ticketId}/status`, { status });
    load();
  }

  if (loading || !user || !ticket) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ticket.subject}</h1>
            <p className="text-white/50">{ticket.username} ({ticket.email})</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => updateStatus('closed')} className="btn-secondary text-xs">
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Fermer
            </button>
            <button onClick={() => updateStatus('archived')} className="btn-secondary text-xs">
              <Archive className="mr-1.5 h-3.5 w-3.5" /> Archiver
            </button>
            {ticket.status !== 'open' && (
              <button onClick={() => updateStatus('open')} className="btn-secondary text-xs">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Rouvrir
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 space-y-3">
          {ticket.messages.map((m) => (
            <div
              key={m.id}
              className={`card max-w-[85%] ${m.sender_role === 'seller' ? 'ml-auto bg-brand-violet/10' : ''}`}
            >
              <p className="mb-1 text-xs text-white/40">{m.sender_role === 'seller' ? 'Vous' : m.username}</p>
              <p className="text-sm">{m.message}</p>
            </div>
          ))}
        </div>

        {ticket.status !== 'archived' && (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Votre réponse…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button type="submit" disabled={sending} className="btn-primary">
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
      </main>
    </>
  );
}
