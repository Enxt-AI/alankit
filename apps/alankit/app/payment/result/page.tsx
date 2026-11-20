"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { paymentRequest } from '@/lib/payments';

type Status = { paymentStatus: string; needsAdminRefund?: boolean };
function PaymentResult() {
  const orderId = useSearchParams().get('orderId');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!orderId) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    async function poll() {
      try {
        const result = await paymentRequest<Status>(`payments/${encodeURIComponent(orderId!)}`);
        if (!active) return;
        setStatus(result); setError('');
        if (!['PAID', 'FAILED'].includes(result.paymentStatus) && ++checks < 24) timer = setTimeout(poll, 5000);
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Unable to check payment.'); }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [orderId]);
  async function check() {
    if (!orderId || checking) return;
    setChecking(true); setError('');
    try {
      await paymentRequest('payments/verify', { orderId });
      setStatus(await paymentRequest<Status>(`payments/${encodeURIComponent(orderId)}`));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to check payment.'); }
    finally { setChecking(false); }
  }
  return <main className="mx-auto max-w-xl space-y-5 px-5 py-16">
    <h1 className="text-3xl font-semibold">Payment status</h1>
    <p role="status">{!orderId ? 'No order was specified.' : status?.needsAdminRefund ? 'Payment received after the order closed. Please contact support for a refund.' : status?.paymentStatus === 'PAID' ? 'Payment received. Your order is awaiting approval.' : status?.paymentStatus === 'FAILED' ? 'Payment was unsuccessful. You can resume your order to retry.' : 'Payment has not been confirmed yet. If you were debited, check the status before paying again.'}</p>
    {error && <p role="alert" className="text-rose-600">{error}</p>}
    {orderId && status?.paymentStatus !== 'PAID' && <button onClick={() => void check()} disabled={checking} className="rounded-lg bg-blue-600 px-5 py-3 text-white disabled:opacity-50">{checking ? 'Checking…' : 'Check again'}</button>}
    <Link href="/checkout" className="block text-blue-600">Return to orders</Link>
  </main>;
}
export default function PaymentResultPage() {
  return <Suspense fallback={<p className="p-10">Loading payment status…</p>}><PaymentResult /></Suspense>;
}
