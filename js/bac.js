// Pegel – Blutalkohol-Modell (reine Rechenlogik, ohne DOM)
//
// Verteilung:   Watson-Formel für das Gesamtkörperwasser (GKW, Watson et al. 1981),
//               BAK [‰ = g/kg] = 0,8 · A / (1,055 · GKW)   (A = resorbierter Alkohol in g;
//               0,8 = Wasseranteil des Blutes, 1,055 g/ml = Dichte des Blutes).
//               Entspricht der Widmark-Formel mit individuellem Reduktionsfaktor r.
//               Gegenprobe: stimmt für normale Körpermaße auf wenige Prozent mit der
//               Formel von Seidl et al. (2000) überein (siehe Tests).
// Resorption:   exponentiell (Halbwertszeit abhängig vom Mageninhalt),
//               abzüglich Resorptionsdefizit (Alkohol, der nie im Blut ankommt):
//               leerer Magen 0–10 % (hier 5 %), voller Magen 10–30 % (hier 20 %).
// Abbau:        im Mittel 0,15 ‰ pro Stunde (Spanne 0,1–0,2). Oberhalb von etwa 0,2 ‰
//               praktisch linear (Widmark), darunter langsamer, weil das abbauende Enzym
//               nicht mehr ausgelastet ist (Michaelis-Menten-Kinetik).
//
// Alle Werte sind Schätzungen. Die Streuung zwischen Menschen liegt bei rund ±20 %.

export const ETHANOL_DENSITY = 0.789; // g/ml
const BLOOD_WATER_FRACTION = 0.8;
const BLOOD_DENSITY = 1.055; // g/ml
const HOUR = 3600_000;
const MINUTE = 60_000;

/** Abbaurate in ‰ pro Stunde (gemessen im geraden Teil der Kurve, etwa 0,2 bis 1,0 ‰) */
export const ELIMINATION = { fast: 0.2, typical: 0.15, slow: 0.1 };

/**
 * Halbsättigung des Abbaus in ‰. Literaturwerte für den Menschen liegen bei etwa
 * 0,03 bis 0,08 g/l; unterhalb von rund 0,1 ‰ ist die Kurve nicht mehr gerade.
 */
export const ELIMINATION_KM = 0.04;
// Damit die mittlere Steigung zwischen 1,0 und 0,2 ‰ genau der Abbaurate entspricht:
const VMAX_FACTOR = (0.8 + ELIMINATION_KM * Math.log(1.0 / 0.2)) / 0.8;

/** Momentane Abbaugeschwindigkeit in ‰ pro Stunde bei Blutalkohol `bac` */
export function eliminationRate(bac, beta = ELIMINATION.typical) {
  if (bac <= 0) return 0;
  return (beta * VMAX_FACTOR * bac) / (ELIMINATION_KM + bac);
}

/** Übliche Streuung einer solchen Berechnung (Variationskoeffizient, Gullberg/Searle) */
export const RELATIVE_UNCERTAINTY = 0.21;

export const STOMACH = {
  empty: { absorptionHalfLifeMin: 8, resorptionDeficit: 0.05 },
  full: { absorptionHalfLifeMin: 20, resorptionDeficit: 0.2 },
};

/** Gramm reiner Alkohol in einem Getränk */
export function alcoholGrams(volumeMl, abvPercent) {
  return volumeMl * (abvPercent / 100) * ETHANOL_DENSITY;
}

/** Gesamtkörperwasser in Litern nach Watson et al. (1980) */
export function totalBodyWater({ sex, age, heightCm, weightKg }) {
  if (sex === 'female') {
    return -2.097 + 0.1069 * heightCm + 0.2466 * weightKg;
  }
  return 2.447 - 0.09516 * age + 0.1074 * heightCm + 0.3362 * weightKg;
}

/** Wie viel ‰ ein Gramm vollständig resorbierter Alkohol ergibt */
export function permillePerGram(profile) {
  const tbw = totalBodyWater(profile);
  if (!(tbw > 5)) throw new Error('Ungültiges Profil');
  return BLOOD_WATER_FRACTION / (BLOOD_DENSITY * tbw);
}

export function isValidProfile(p) {
  return (
    !!p &&
    (p.sex === 'male' || p.sex === 'female') &&
    p.age >= 16 && p.age <= 110 &&
    p.heightCm >= 120 && p.heightCm <= 230 &&
    p.weightKg >= 35 && p.weightKg <= 250
  );
}

function stomachOf(drink) {
  return drink.fullStomach ? STOMACH.full : STOMACH.empty;
}

/** Trinkdauer in ms (0 = auf einmal getrunken) */
export function drinkDurationMs(drink) {
  return Math.max(0, (drink.durationMin ?? 0) * MINUTE);
}

/**
 * Anteil des Getränks, der bis Zeitpunkt t ins Blut übergegangen ist (0…1).
 * Das Getränk wird gleichmäßig über die Trinkdauer D getrunken; jeder Schluck
 * wird exponentiell resorbiert (Faltung → geschlossene Formel).
 */
export function absorbedFraction(drink, t) {
  const dt = t - drink.time;
  if (dt <= 0) return 0;
  const k = Math.LN2 / (stomachOf(drink).absorptionHalfLifeMin * MINUTE); // pro ms
  const D = drinkDurationMs(drink);
  if (D === 0) return 1 - Math.exp(-k * dt);
  if (dt <= D) return (dt - (1 - Math.exp(-k * dt)) / k) / D;
  return (D - (Math.exp(-k * (dt - D)) - Math.exp(-k * dt)) / k) / D;
}

function effectiveGrams(drink) {
  return alcoholGrams(drink.volumeMl, drink.abv) * (1 - stomachOf(drink).resorptionDeficit);
}

/**
 * Simuliert den BAK-Verlauf in Minutenschritten ab dem ersten Getränk,
 * bis aller Alkohol aufgenommen und wieder abgebaut ist (mind. bis `until`).
 * @returns {{t:number, bac:number}[]}
 */
export function simulate(drinks, profile, { elimination = ELIMINATION.typical, stepMin = 1, until = 0 } = {}) {
  if (!drinks.length) return [];
  const sorted = [...drinks].sort((a, b) => a.time - b.time);
  const k = permillePerGram(profile);
  const stepMs = stepMin * MINUTE;
  const stepH = stepMin / 60;
  const start = sorted[0].time;
  const lastDrink = Math.max(...sorted.map((d) => d.time + drinkDurationMs(d)));
  const hardEnd = Math.max(lastDrink, until) + 72 * HOUR;

  const points = [{ t: start, bac: 0 }];
  let bac = 0;
  for (let t = start + stepMs; t <= hardEnd; t += stepMs) {
    let gramsIn = 0;
    let pending = false;
    for (const d of sorted) {
      if (d.time >= t) { pending = true; break; }
      const f0 = absorbedFraction(d, t - stepMs);
      const f1 = absorbedFraction(d, t);
      gramsIn += effectiveGrams(d) * (f1 - f0);
      if (f1 < 0.999) pending = true;
    }
    bac += gramsIn * k;
    bac -= eliminationRate(bac, elimination) * stepH;
    // Erst wenn nichts mehr nachkommt, den Rest unter der Anzeigegrenze auf null setzen
    if (!pending && bac < 0.001) bac = 0;
    points.push({ t, bac });
    if (!pending && bac === 0 && t >= until) break;
  }
  return points;
}

/** BAK zum Zeitpunkt t (lineare Interpolation) */
export function bacAt(points, t) {
  if (!points.length || t <= points[0].t) return 0;
  const last = points[points.length - 1];
  if (t >= last.t) return last.bac;
  const step = points[1].t - points[0].t;
  const i = Math.floor((t - points[0].t) / step);
  const a = points[i];
  const b = points[i + 1];
  return a.bac + ((b.bac - a.bac) * (t - a.t)) / (b.t - a.t);
}

/**
 * Zeitpunkt, ab dem der BAK dauerhaft unter `threshold` liegt.
 * null, wenn das (ab `now`) bereits der Fall ist.
 */
export function timeBelow(points, threshold, now) {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].bac >= threshold) {
      const t = i + 1 < points.length ? points[i + 1].t : points[i].t;
      return t > now ? t : null;
    }
  }
  return null;
}

/** Alles, was die Oberfläche braucht, in einem Aufruf */
export function summarize(drinks, profile, now) {
  const points = simulate(drinks, profile, { until: now });
  const empty = {
    points, current: 0, peak: null, below05: null, below03: null,
    soberAt: null, soberEarliest: null, soberLatest: null, totalGrams: 0,
  };
  if (!points.length) return empty;

  let peak = points[0];
  for (const p of points) if (p.bac > peak.bac) peak = p;

  const EPS = 0.005;
  const fast = simulate(drinks, profile, { elimination: ELIMINATION.fast, until: now });
  const slow = simulate(drinks, profile, { elimination: ELIMINATION.slow, until: now });

  return {
    points,
    current: bacAt(points, now),
    peak: peak.bac > 0 ? peak : null,
    below05: timeBelow(points, 0.5, now),
    below03: timeBelow(points, 0.3, now),
    soberAt: timeBelow(points, EPS, now),
    soberEarliest: timeBelow(fast, EPS, now),
    soberLatest: timeBelow(slow, EPS, now),
    totalGrams: drinks.reduce((s, d) => s + alcoholGrams(d.volumeMl, d.abv), 0),
  };
}

/** Wahrscheinliche Spanne um einen Schätzwert (± eine Standardabweichung) */
export function likelyRange(bac) {
  return { low: bac * (1 - RELATIVE_UNCERTAINTY), high: bac * (1 + RELATIVE_UNCERTAINTY) };
}

/** Einordnung eines Promillewerts (Rechtslage Deutschland, Stand 2026) */
export function classify(bac) {
  if (bac < 0.01) return { level: 0, label: 'Stocknüchtern', note: 'Rechnerisch nüchtern. Restalkohol ist trotzdem möglich.' };
  if (bac < 0.3) return { level: 1, label: 'Leicht angeschwipst', note: 'Für Fahranfänger und unter 21 gilt 0,0 ‰.' };
  if (bac < 0.5) return { level: 2, label: 'Gut angeheitert', note: 'Ab 0,3 ‰ mit Ausfallerscheinungen ist Fahren strafbar.' };
  if (bac < 1.1) return { level: 3, label: 'Ordentlich einen sitzen', note: 'Über 0,5 ‰: Fahren ist eine Ordnungswidrigkeit (Bußgeld, Fahrverbot).' };
  if (bac < 1.6) return { level: 4, label: 'Sternhagelvoll', note: 'Absolut fahruntüchtig: Ab 1,1 ‰ ist Fahren eine Straftat.' };
  if (bac < 2.5) return { level: 5, label: 'Jetzt reicht’s aber', note: 'Trink Wasser, mach eine Pause und lass dich begleiten.' };
  return { level: 6, label: 'Gefährlich hoch', note: 'Alkoholvergiftung möglich. Nicht allein bleiben, im Notfall 112 rufen.' };
}
