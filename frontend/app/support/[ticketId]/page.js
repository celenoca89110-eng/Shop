'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../lib/api';
import { Send } from 'lucide-react';

export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function load() {
    api.get(`/tickets/me/${ticketId}`).then(({ data }) => setTicket(data.ticket));
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ticketId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/me/${ticketId}/messages`, { message });
      setMessage('');
      load();
    } finally {
      setSending(false);
    }
  }

  if (loading || !user || !ticket) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-1 text-2xl font-bold">{ticket.subject}</h1>
        <p className="mb-8 text-white/50">{ticket.shop_name}</p>

        <div className="mb-6 space-y-3">
          {ticket.messages.map((m) => (
            <div
              key={m.id}
              className={`card max-w-[85%] ${m.sender_role === 'user' ? 'ml-auto bg-brand-violet/10' : ''}`}
            >
              <p className="mb-1 text-xs text-white/40">{m.sender_role === 'user' ? 'Vous' : m.username}</p>
              <p className="text-sm">{m.message}</p>
            </div>
          ))}
        </div>

        {ticket.status !== 'archived' && (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Votre message…"
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
