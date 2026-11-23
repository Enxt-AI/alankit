"use client";

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { paymentRequest, checkoutSdkUrl, type CheckoutSession } from '@/lib/payments';
import { getKycStatus } from '@/lib/kyc';

type Stock = { id: string; name: string; price: number; minimumPurchaseQuantity?: number };
type Order = { id: string; orderNumber: string; totalAmount: number; quantity: number; status: string; paymentStatus: string; stock?: { name: string } };
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));

export default function CheckoutPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockId, setStockId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [order, setOrder] = useState<Order | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kycVerified, setKycVerified] = useState(false);
  const inFlight = useRef(false);
  const stock = stocks.find(item => item.id === stockId);

  useEffect(() => {
    let active = true;
    getKycStatus().then(async kyc => {
      if (!active) return null;
      if (kyc.kycStatus !== 'VERIFIED') {
        window.location.replace(`/kyc?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return null;
      }
      setKycVerified(true);
      return Promise.all([paymentRequest<Stock[]>('stocks'), paymentRequest<Order[]>('orders/my-orders')]);
    }).then(result => { if (active && result) {
      const [items, existing] = result;
      setStocks(items); setOrders(existing.filter(item => item.status === 'PENDING' && item.paymentStatus !== 'PAID'));
      const selected = items.find(item => item.id === new URLSearchParams(window.location.search).get('stockId'));
      if (selected) { setStockId(selected.id); setQuantity(Math.max(1, selected.minimumPurchaseQuantity || 1)); }
    } })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  async function run(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to continue.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  function openCheckout() {
    if (!session || !window.AtomPaynetz || !ready || inFlight.current) return;
    try {
      const { atomTokenId, merchId, custEmail, custMobile, returnUrl } = session;
      new window.AtomPaynetz({ atomTokenId, merchId, custEmail, custMobile, returnUrl }, session.environment);
    } catch { setError('Unable to open checkout. Please reload and resume this order.'); }
  }

  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-12">
    <Link href="/stocks" className="text-blue-600">← Stocks</Link>
    <h1 className="text-3xl font-semibold">Checkout</h1>
    <p className="text-sm text-zinc-600">Choose an available stock or resume an existing order. Sign in and complete KYC before paying.</p>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error} <Link href="/login" className="underline">Sign in</Link></p>}
    {!kycVerified && <p role="status">Checking KYC before checkout… <Link href="/kyc?returnUrl=%2Fcheckout" className="text-blue-600 underline">Complete KYC</Link></p>}
    {kycVerified && !order && <>
      {orders.length > 0 && <section className="space-y-3"><h2 className="font-semibold">Pending orders</h2>{orders.map(item => <button key={item.id} disabled={busy} onClick={() => setOrder(item)} className="block w-full rounded-lg border p-4 text-left">{item.stock?.name || item.orderNumber} · {money(item.totalAmount)} <span className="float-right text-blue-600">Resume</span></button>)}</section>}
      <form className="space-y-4 rounded-xl border p-6" onSubmit={event => { event.preventDefault(); void run(async () => {
        if (!stockId || !Number.isSafeInteger(quantity) || quantity < Math.max(1, stock?.minimumPurchaseQuantity || 1)) throw new Error('Select a stock and a valid quantity.');
        const created = await paymentRequest<Order>('orders', { stockId, quantity });
        setOrder(created);
      }); }}>
        <label className="block">Stock<select required value={stockId} disabled={busy} onChange={event => { setStockId(event.target.value); setQuantity(Math.max(1, stocks.find(item => item.id === event.target.value)?.minimumPurchaseQuantity || 1)); }} className="mt-2 block w-full rounded border p-3"><option value="">Select a stock</option>{stocks.map(item => <option key={item.id} value={item.id}>{item.name} · {money(item.price)}</option>)}</select></label>
        <label className="block">Quantity<input type="number" required min={Math.max(1, stock?.minimumPurchaseQuantity || 1)} step={1} value={quantity} disabled={busy} onChange={event => setQuantity(Number(event.target.value))} className="mt-2 block w-full rounded border p-3" /></label>
        {stock && <p>Estimated amount: {money(stock.price * quantity)}</p>}
        <button disabled={busy || !stock} className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Creating order…' : 'Create order and review total'}</button>
      </form>
    </>}
    {order && <section className="space-y-4 rounded-xl border p-6">
      <h2 className="text-xl font-semibold">{order.stock?.name || 'Your order'}</h2>
      <p>Order {order.orderNumber} · {order.quantity} shares</p><p className="text-2xl font-semibold">{money(order.totalAmount)}</p>
      {!session ? <button disabled={busy} onClick={() => void run(async () => {
        const result = await paymentRequest<CheckoutSession>(`payments/${encodeURIComponent(order.id)}/create`, {});
        if (result.provider !== 'ndps' || !['uat', 'prod'].includes(result.environment)) throw new Error('Unexpected payment provider response.');
        setSession(result);
      })} className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:opacity-50">{busy ? 'Preparing payment…' : 'Continue to payment'}</button> : <>
        <Script src={checkoutSdkUrl(session.environment)} onReady={() => setReady(true)} onError={() => setError('Unable to load secure checkout. Please reload and resume this order.')} />
        <button disabled={!ready || busy} onClick={openCheckout} className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:opacity-50">{ready ? `Pay ${money(session.amount)}` : 'Loading secure checkout…'}</button>
      </>}
      <Link href={`/payment/result?orderId=${encodeURIComponent(order.id)}`} className="block text-blue-600">Check payment status</Link>
    </section>}
  </main>;
}
