'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import { useAuth } from '../../../../../context/AuthContext';
import api from '../../../../../lib/api';
import { Coins, Trash2, Save } from 'lucide-react';

const CURRENCIES = ['BTC', 'ETH', 'LTC', 'SOL'];
const CURRENCY_LABELS = { BTC: 'Bitcoin', ETH: 'Ethereum', LTC: 'Litecoin', SOL: 'Solana' };

export default function CryptoWalletsPage() {
  const { shopId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState([]);
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  function load() {
    api.get(`/crypto/manage/${shopId}`).then(({ data }) => {
      setWallets(data.wallets);
      const d = {};
      data.wallets.forEach((w) => { d[w.currency] = w.address; });
      setDrafts(d);
    });
  }

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shopId]);

  async function saveWallet(currency) {
    const address = drafts[currency];
    if (!address) return;
    await api.post(`/crypto/manage/${shopId}`, { currency, address });
    load();
  }

  async function deleteWallet(currency) {
    await api.delete(`/crypto/manage/${shopId}/${currency}`);
    setDrafts((d) => ({ ...d, [currency]: '' }));
    load();
  }

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold">
          <Coins className="h-6 w-6 text-brand-violetLight" /> Paiement crypto
        </h1>
        <p className="mb-8 text-sm text-white/40">
          Renseignez vos adresses de réception. Le client verra l&apos;adresse et le montant à
          envoyer ; vous devez confirmer manuellement la réception depuis la page Commandes
          (aucune vérification blockchain automatique n&apos;est effectuée).
        </p>

        <div className="space-y-4">
          {CURRENCIES.map((currency) => {
            const existing = wallets.find((w) => w.currency === currency);
            return (
              <div key={currency} className="card">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">{CURRENCY_LABELS[currency]} ({currency})</span>
                  {existing && (
                    <button onClick={() => deleteWallet(currency)} className="text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1 font-mono text-sm"
                    placeholder={`Adresse ${currency}…`}
                    value={drafts[currency] || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [currency]: e.target.value }))}
                  />
                  <button onClick={() => saveWallet(currency)} className="btn-secondary text-xs">
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Enregistrer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
