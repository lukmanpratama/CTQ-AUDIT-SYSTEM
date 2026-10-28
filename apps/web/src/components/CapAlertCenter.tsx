'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLatestAlertId } from '../lib/use-data-refresh';
import { PUBLIC_HTTPS_URL, enablePushNotifications, pushAvailability, syncPushSubscription, type PushAvailability } from '../lib/push-notifications';

type CapAlert = {
  id: string;
  type: 'DAILY' | 'WEEKLY';
  title: string;
  modelLabel: string | null;
  factory: string | null;
  cell: string | null;
  process: string | null;
  defect: string | null;
  defectRate: number;
  inspectionDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  rqcHeaderId: string | null;
};

// Newest alert id this browser has already received, so each alert pops up once per phone
const SEEN_KEY = 'ctq_cap_alert_seen';
const MAX_VISIBLE = 3;

const readSeen = () => {
  try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
};
const writeSeen = (id: string) => {
  try { localStorage.setItem(SEEN_KEY, id); } catch { /* private mode: alerts may repeat, harmless */ }
};

// "Aktifkan notifikasi" card closed with "Nanti": asked again after a few days
const PROMPT_KEY = 'ctq_push_prompt_closed_at';
const PROMPT_AGAIN_MS = 3 * 24 * 60 * 60 * 1000;
const promptClosedRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(PROMPT_KEY) || 0) < PROMPT_AGAIN_MS; } catch { return false; }
};

const httpsHost = new URL(PUBLIC_HTTPS_URL).host;

const pct = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;
const fmtDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * CAP alerts ("QDRS — ALERT DEFECT RATE") on every phone / PC with the app.
 * CAP daily = one inspection row above 20%; CAP weekly = a model's average defect rate last week
 * above 5% (created on Monday).
 *
 * Browser notifications first: once a phone allows them, the API pushes every alert as a system
 * notification (also when the app is closed) and no in-page popup is shown. Where they can't
 * work (plain-http address, iPhone outside a Home Screen app, permission refused) the alerts pop
 * up inside the page instead: the shared 15s data-version poll carries the newest alert id, and
 * when it grows the new alerts are fetched and shown until closed.
 */
export function CapAlertCenter() {
  const pathname = usePathname();
  const latestId = useLatestAlertId();
  const [alerts, setAlerts] = useState<CapAlert[]>([]);
  // null until checked after mount (browser-only APIs; keeps server and client HTML identical)
  const [availability, setAvailability] = useState<PushAvailability | null>(null);
  const [pushActive, setPushActive] = useState<boolean | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    const avail = pushAvailability();
    setAvailability(avail);
    setShowPrompt((avail === 'default' || avail === 'ios-browser' || avail === 'insecure') && !promptClosedRecently());
    if (avail !== 'granted') {
      setPushActive(false);
      return;
    }
    // Already allowed: make sure the API still has this phone's subscription
    syncPushSubscription().then(setPushActive, () => setPushActive(false));
  }, []);

  useEffect(() => {
    if (latestId === null || pushActive === null) return;
    const seen = readSeen();
    if (seen !== null && Number(latestId) <= Number(seen)) return;
    // The phone gets these as browser notifications: no duplicate popup in the page
    if (pushActive) {
      writeSeen(latestId);
      return;
    }

    let cancelled = false;
    // First visit on this phone: the API sends the last 24h of daily alerts and this week's weekly ones
    fetch(`/api/notifications${seen !== null ? `?afterId=${seen}` : ''}`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { latestId: string; items: CapAlert[] } | null) => {
        if (cancelled || !data) return;
        writeSeen(data.latestId);
        if (data.items.length === 0) return;
        setAlerts(prev => [...prev, ...data.items.filter(a => !prev.some(p => p.id === a.id))]);
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported (iPhone) */ }
      })
      .catch(() => { /* API unreachable: the next poll tries again */ });
    return () => { cancelled = true; };
  }, [latestId, pushActive]);

  const closePrompt = () => {
    setShowPrompt(false);
    try { localStorage.setItem(PROMPT_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  const enable = async () => {
    setEnabling(true);
    try {
      const permission = await enablePushNotifications();
      setAvailability(permission);
      setPushActive(permission === 'granted');
      setShowPrompt(false);
      if (permission === 'denied') alert('Notifikasi diblokir. Izinkan lewat pengaturan situs di browser jika ingin mengaktifkannya.');
    } catch (e) {
      console.error('Enabling browser notifications failed', e);
      alert('Notifikasi browser gagal diaktifkan di perangkat ini. Alert tetap muncul di dalam aplikasi.');
      setShowPrompt(false);
    } finally {
      setEnabling(false);
    }
  };

  // Not over the login form
  if (pathname === '/login') return null;

  const prompt = showPrompt && availability && (
    <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">Notifikasi alert CAP</p>
          {availability === 'insecure' ? (
            <p className="mt-0.5 text-xs text-gray-600">
              Notifikasi browser hanya bisa lewat alamat aman <b>{httpsHost}</b>. Buka CTQ Audit dari alamat itu untuk
              menerima alert CAP di HP ini, juga saat aplikasi ditutup.
            </p>
          ) : availability === 'ios-browser' ? (
            <p className="mt-0.5 text-xs text-gray-600">
              Di iPhone, notifikasi hanya bisa dari aplikasi di Layar Utama: buka <b>{httpsHost}</b> di <b>Safari</b>, ketuk
              <b> Bagikan</b> → <b>Tambahkan ke Layar Utama</b>, lalu buka CTQ Audit dari ikonnya.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-600">
              Terima notifikasi di HP ini saat defect rate melebihi batas CAP, juga saat aplikasi ditutup.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={closePrompt} className="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">
              {availability === 'default' ? 'Nanti' : 'Tutup'}
            </button>
            {availability === 'insecure' && (
              // Same page on the https address (phones register for notifications per address)
              <a
                href={`${PUBLIC_HTTPS_URL}${pathname}${typeof window !== 'undefined' ? window.location.search : ''}`}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Buka {httpsHost}
              </a>
            )}
            {availability === 'default' && (
              <button onClick={enable} disabled={enabling} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {enabling ? 'Mengaktifkan...' : 'Aktifkan notifikasi'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (alerts.length === 0) {
    return prompt
      ? <div className="fixed inset-x-0 top-0 z-[10000] flex flex-col items-center gap-2 p-3 pointer-events-none">{prompt}</div>
      : null;
  }

  const dismiss = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));
  // Newest first
  const visible = [...alerts].reverse().slice(0, MAX_VISIBLE);
  const hidden = alerts.length - visible.length;

  return (
    <div className="fixed inset-x-0 top-0 z-[10000] flex flex-col items-center gap-2 p-3 pointer-events-none" role="alert" aria-live="assertive">
      {prompt}
      {visible.map(a => (
        <div key={a.id} className="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border border-red-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 bg-red-600 px-4 py-2 text-white">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-extrabold tracking-wider">QDRS — ALERT DEFECT RATE</span>
            <button onClick={() => dismiss(a.id)} className="ml-auto -mr-1 p-1 text-white/80 hover:text-white" aria-label="Tutup notifikasi">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
              Notifikasi baru · {a.type === 'DAILY' ? 'CAP Daily' : 'CAP Weekly'}
            </p>
            <p className="mt-0.5 font-bold text-gray-900">{a.title}</p>

            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-sm">
              {a.type === 'DAILY' ? (
                <>
                  <dt className="text-gray-500">Factory/Cell</dt>
                  <dd className="font-medium text-gray-900">: {[a.factory, a.cell].filter(Boolean).join(' / ') || '-'}</dd>
                  <dt className="text-gray-500">Model</dt>
                  <dd className="font-medium text-gray-900">: {a.modelLabel || '-'}</dd>
                  <dt className="text-gray-500">Proses</dt>
                  <dd className="font-medium text-gray-900">: {a.process || '-'} — <span className="font-bold text-red-600">{pct(a.defectRate)}</span></dd>
                  <dt className="text-gray-500">Defect</dt>
                  <dd className="font-medium text-gray-900">: {a.defect || '-'}</dd>
                  {a.inspectionDate && (
                    <>
                      <dt className="text-gray-500">Tanggal</dt>
                      <dd className="font-medium text-gray-900">: {fmtDate(a.inspectionDate)}</dd>
                    </>
                  )}
                </>
              ) : (
                <>
                  <dt className="text-gray-500">Model</dt>
                  <dd className="font-medium text-gray-900">: {a.modelLabel || '-'}</dd>
                  <dt className="text-gray-500">Periode</dt>
                  <dd className="font-medium text-gray-900">: {a.periodStart && a.periodEnd ? `${fmtDate(a.periodStart)} – ${fmtDate(a.periodEnd)}` : '-'}</dd>
                  <dt className="text-gray-500">Avg Defect Rate</dt>
                  <dd className="font-bold text-red-600">: {pct(a.defectRate)}</dd>
                </>
              )}
            </dl>

            <div className="mt-3 flex justify-end gap-2">
              {a.type === 'DAILY' && a.rqcHeaderId && (
                <Link
                  href={`/audit/session/${a.rqcHeaderId}/summary?view=true`}
                  onClick={() => dismiss(a.id)}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Lihat data
                </Link>
              )}
              <button onClick={() => dismiss(a.id)} className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800">
                Tutup
              </button>
            </div>
          </div>
        </div>
      ))}

      {alerts.length > 1 && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-gray-900/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
          {hidden > 0 && <span>+{hidden} notifikasi lain</span>}
          <button onClick={() => setAlerts([])} className="underline">Tutup semua</button>
        </div>
      )}
    </div>
  );
}
