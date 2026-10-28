'use client';

// Browser notifications (Web Push) for CAP alerts: permission, service worker and the
// subscription the API pushes to. See apps/web/public/sw.js and the API's PushService.

/**
 * Why browser notifications can or can't be used on this device:
 * - 'insecure':   page opened over plain http (e.g. http://192.168.43.210:3000) — browsers only allow it on https
 * - 'ios-browser': iPhone/iPad outside a Home Screen app — iOS only allows it once the app is added to the Home Screen
 * - 'unsupported': the browser has no Web Push
 * - otherwise the Notification permission: 'default' (not asked yet), 'granted', 'denied'
 */
export type PushAvailability = 'insecure' | 'ios-browser' | 'unsupported' | NotificationPermission;

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function pushAvailability(): PushAvailability {
  if (!window.isSecureContext) return 'insecure';
  if (isIos() && !isStandalone()) return 'ios-browser';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** VAPID public key (base64url) → the bytes PushManager.subscribe expects */
function keyBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((v, i) => v === b[i]);

/**
 * Registers the service worker and (re)subscribes this browser, then tells the API.
 * Safe to call on every page load once permission is granted: it repairs a subscription
 * the API lost (new key pair, database reset) and is a no-op otherwise.
 */
export async function syncPushSubscription(): Promise<boolean> {
  const res = await fetch('/api/notifications/push-key', { cache: 'no-store' });
  const { publicKey } = res.ok ? await res.json() : { publicKey: null };
  if (!publicKey) return false;
  const serverKey = keyBytes(publicKey);

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  // Subscribed with an older server key: it would never receive anything
  if (subscription && !sameKey(subscription.options.applicationServerKey, serverKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  }

  const saved = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  return saved.ok;
}

/** Asks for permission (must run from a tap: iOS refuses otherwise) and subscribes. */
export async function enablePushNotifications(): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await syncPushSubscription();
  return permission;
}
