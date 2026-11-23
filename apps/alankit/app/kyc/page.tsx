"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { fetchKycByPan, getKycStatus, refreshKyc, safeReturnUrl, type KycStatus } from '@/lib/kyc';

const OPEN_ACCOUNT_URL = 'https://openaccount.alankit.co.in/';

export default function KycPage() {
  const [pan, setPan] = useState('');
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [returnUrl, setReturnUrl] = useState('/dashboard');
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    getKycStatus().then(value => { if (active) {
      setStatus(value);
      setReturnUrl(safeReturnUrl(new URLSearchParams(window.location.search).get('returnUrl')));
    } })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function check(refresh = false) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = refresh ? await refreshKyc() : await fetchKycByPan(pan);
      setStatus(result);
      if (result.state === 'NOT_FOUND' && result.openAccountUrl === OPEN_ACCOUNT_URL) {
        // The server has saved the pending PAN and provider response before redirecting.
        window.location.assign(OPEN_ACCOUNT_URL);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to check KYC.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) { setError('Enter a valid PAN number.'); return; }
    void check();
  }

  return <><Header /><main className="mx-auto w-full max-w-xl px-6 py-14">
    <p className="text-sm font-medium text-blue-600">Identity verification</p>
    <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Complete your KYC</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-600">Enter your PAN to fetch your existing Alankit KYC. Verified KYC is required before buying stocks.</p>
    {loading ? <p role="status" className="mt-8">Checking your KYC status…</p> : <section className="mt-8 space-y-5 rounded-xl border border-zinc-200 bg-white p-6">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error} {error === 'Please sign in to continue.' && <Link href="/login?returnUrl=%2Fkyc" className="underline">Sign in</Link>}</p>}
      {status?.state === 'VERIFIED' ? <>
        <h2 className="text-xl font-semibold text-emerald-700">Your KYC is verified</h2>
        <p className="text-sm text-zinc-600">You can now buy stocks on Alankit.</p>
        <Link href={returnUrl} className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white">Continue</Link>
      </> : <>
        {status?.canRefresh && <div className="space-y-3 rounded-lg bg-zinc-50 p-4 text-sm">
          <p>Saved PAN: <strong>{status.pan}</strong></p>
          {status.state === 'ERROR' && <p role="status">We couldn’t confirm your KYC. Your PAN is saved. Please try again later.</p>}
          {status.state === 'REVIEW_REQUIRED' && <p role="status">We couldn’t link this KYC to your account. Please contact support to check your registered details.</p>}
          {['PENDING', 'NOT_FOUND'].includes(status.state) && <p role="status">Your KYC is pending. Complete account opening with Alankit, then return here and check again.</p>}
          {status.state === 'FETCHING' && <p role="status">A lookup was started. You can check again if it did not finish.</p>}
          <button disabled={busy} onClick={() => void check(true)} className="font-medium text-blue-600 disabled:opacity-50">{busy ? 'Fetching KYC…' : 'I’ve completed KYC — check again'}</button>
          {status.openAccountUrl === OPEN_ACCOUNT_URL && <a href={OPEN_ACCOUNT_URL} className="block font-medium text-blue-600">Complete KYC with Alankit →</a>}
          {status.state === 'REVIEW_REQUIRED' && <Link href="/support" className="block font-medium text-blue-600">Contact support</Link>}
        </div>}
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="pan" className="block text-sm font-medium">{status?.canRefresh ? 'Check a PAN number' : 'PAN number'}</label>
          <input id="pan" name="pan" required maxLength={10} pattern="[A-Z]{5}[0-9]{4}[A-Z]" autoComplete="off" spellCheck={false} value={pan} disabled={busy} onChange={event => setPan(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCDE1234F" className="block w-full rounded-lg border px-4 py-3 uppercase tracking-widest" />
          <p className="text-xs leading-5 text-zinc-500">By continuing, you consent to Alankit retrieving and saving your KYC details for your account.</p>
          <button disabled={busy || pan.length !== 10} className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Fetching KYC…' : 'Fetch my KYC'}</button>
        </form>
      </>}
    </section>}
    <Link href="/stocks" className="mt-6 inline-block text-sm text-zinc-600">Continue browsing stocks</Link>
  </main></>;
}
