// Pegel – Fahrplan für den Sperrbildschirm
//
// Eine Web-App kann kein Sperrbildschirm-Widget anzeigen. Stattdessen legt Pegel eine Mitteilung
// ab, die den weiteren Verlauf als Uhrzeiten enthält. So stimmt sie auch, ohne dass sie sich
// laufend aktualisieren muss (das ginge nur mit einem Server).

import { bacAt } from './bac.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const BLOCKS = '▁▂▃▄▅▆▇█';
export const NOTIFY_TAG = 'pegel-fahrplan';

const fmtBac = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Verlaufsbalken aus Blockzeichen, z. B. ▅▇▆▅▃▂▁ */
export function sparkline(values, max) {
  const top = Math.max(max, 0.0001);
  return values.map((v) => BLOCKS[Math.max(0, Math.min(7, Math.round((v / top) * 7)))]).join('');
}

/**
 * Baut Titel und Text der Mitteilung aus der Zusammenfassung (summarize).
 * Gibt null zurück, wenn es nichts anzuzeigen gibt (nüchtern, nichts mehr im Anflug).
 */
export function buildNotification(s, now, label) {
  if (!s.points.length || (!s.soberAt && s.current < 0.005)) return null;
  const end = s.soberAt ?? now;
  const lines = [];

  if (s.peak && s.peak.t > now + 5 * MIN && s.peak.bac > s.current + 0.02) {
    lines.push(`Steigt noch bis ${fmtBac(s.peak.bac)} ‰ um ${fmtTime(s.peak.t)}`);
  }
  const marks = [];
  if (s.below05) marks.push(`unter 0,5 ‰ ab ${fmtTime(s.below05)}`);
  if (s.soberAt) marks.push(`nüchtern ab ${fmtTime(s.soberAt)}`);
  if (marks.length) {
    const text = marks.join(' · ');
    lines.push(text[0].toUpperCase() + text.slice(1));
  }

  // Werte zu den nächsten vollen Stunden
  const hours = [];
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  for (let t = next.getTime() + HOUR; t < end && hours.length < 3; t += HOUR) {
    hours.push(`${new Date(t).getHours()} Uhr ${fmtBac(bacAt(s.points, t))}`);
  }
  if (hours.length) lines.push(hours.join(' · '));

  if (end - now > 20 * MIN) {
    const samples = Array.from({ length: 10 }, (_, i) => bacAt(s.points, now + ((end - now) * i) / 9));
    lines.push(`${sparkline(samples, Math.max(...samples))} bis ${fmtTime(end)}`);
  }

  return {
    title: `${fmtBac(s.current)} ‰ um ${fmtTime(now)} · ${label}`,
    body: lines.join('\n'),
  };
}

/** 'ok' | 'install' (iPhone: erst zum Home-Bildschirm) | 'unsupported' | 'denied' */
export function notifySupport() {
  const hasApi = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  if (!hasApi) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && !navigator.standalone ? 'install' : 'unsupported';
  }
  return Notification.permission === 'denied' ? 'denied' : 'ok';
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
}

export async function clearNotification() {
  try {
    const reg = await registration();
    const open = (await reg?.getNotifications?.({ tag: NOTIFY_TAG })) ?? [];
    open.forEach((n) => n.close());
  } catch { /* nicht überall verfügbar */ }
}

/** Legt die Mitteilung ab bzw. ersetzt die vorhandene. Gibt true zurück, wenn es geklappt hat. */
export async function showNotification(note) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const reg = await registration();
    if (!reg) return false;
    await reg.showNotification(note.title, {
      body: note.body,
      tag: NOTIFY_TAG, // ersetzt die vorige Mitteilung statt eine neue zu stapeln
      renotify: false,
      silent: true,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      lang: 'de',
    });
    return true;
  } catch {
    return false;
  }
}
