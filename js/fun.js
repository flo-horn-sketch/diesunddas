// Pegel – der Spaß-Teil: Pegelberts Sprüche, Kater-Wetterbericht, Trinktempo, Zungenbrecher.
// Bewusst ohne Belohnung fürs Mehrtrinken; ab der höchsten Stufe ist Schluss mit lustig.

/** Sprüche je Stufe (Index = Stufe aus classify) */
export const QUIPS = [
  [
    'Ich bin so leer wie dein Glas.',
    'Stocknüchtern. Ich könnte jetzt Steuererklärungen machen.',
    'Na, was darf’s denn sein?',
    'Noch ist alles im grünen Bereich.',
  ],
  [
    'Ein Schlückchen in Ehren …',
    'Läuft bei mir. Wörtlich.',
    'Ich fühl mich prickelnd.',
    'Das kitzelt in der Schaumkrone.',
  ],
  [
    'Wer hat hier geschaukelt?',
    'Ich bin nicht betrunken, ich bin gut gefüllt.',
    'Autoschlüssel? Kenn ich heute nicht mehr.',
    'Ich werd langsam gesprächig. Merkst du, oder?',
  ],
  [
    'Ich hab euch alle lieb!',
    'Karaoke klingt gerade nach einer super Idee. Ist es nicht.',
    'Bitte keine Nachrichten mehr an Verflossene.',
    'Der Boden war eben noch gerade.',
    'Online-Shopping bitte erst morgen wieder.',
  ],
  [
    'Isch bin völlig nüschtern.',
    'Wo ist denn mein Henkel hin?',
    'Ich seh dich doppelt. Hübsch, alle beide.',
    'Jetzt hilft nur noch Wasser. Viel Wasser.',
  ],
  [
    'Mir ist schwummrig. Wasser, bitte.',
    'Für heute hab ich genug. Du auch.',
    'Bringt mich bitte jemand nach Hause?',
  ],
  [
    'Das ist zu viel. Bleib nicht allein und hol dir Hilfe.',
  ],
];

export const WATER_QUIPS = [
  'Ahh, Wasser! Du bist ein Schatz.',
  'Gluck, gluck. Dein Kopf sagt morgen Danke.',
  'Wasser marsch! So mag ich das.',
  'Endlich mal was ohne Umdrehungen.',
];

export const THIRSTY_QUIPS = [
  'Ich hätte Durst. Auf Wasser, ausnahmsweise.',
  'Kleiner Tipp vom Glas: Zwischendurch ein Wasser.',
  'Drei am Stück. Jetzt wär ein Wasser dran.',
];

export const CHEERS = ['Prost!', 'Zum Wohl!', 'Wohl bekomm’s!', 'Hoch die Tassen!', 'Stößchen!', 'Na dann, Prost!', 'Auf dich!'];
export const SHOT_CHEERS = ['Zack, weg!', 'Kopf in den Nacken!', 'Runter damit!', 'Und hopp!'];

export const TWISTERS = [
  'Fischers Fritze fischt frische Fische.',
  'Blaukraut bleibt Blaukraut und Brautkleid bleibt Brautkleid.',
  'Zwischen zwei Zwetschgenzweigen zwitschern zwei Schwalben.',
  'Der Whiskymixer mixt den Whisky mit dem Whiskymixer.',
  'Zehn zahme Ziegen zogen zehn Zentner Zucker zum Zoo.',
  'Schnecken erschrecken, wenn sie an Schnecken schlecken.',
  'Der Cottbuser Postkutscher putzt den Cottbuser Postkutschkasten.',
  'Wenn Fliegen hinter Fliegen fliegen, fliegen Fliegen Fliegen nach.',
  'Es klapperten die Klapperschlangen, bis ihre Klappern schlapper klangen.',
];

/** Zufälliger Eintrag, möglichst nicht derselbe wie zuletzt */
export function pick(list, avoid = null, random = Math.random) {
  if (list.length <= 1) return list[0];
  const options = list.filter((x) => x !== avoid);
  return options[Math.floor(random() * options.length)];
}

const FORECASTS = [
  { icon: 'sonne', title: 'Sonnig und klar', text: 'Morgen wachst du auf wie ein junger Gott.' },
  { icon: 'wolkesonne', title: 'Leicht bewölkt', text: 'Ein kleines Brummen ist möglich. Ein Glas Wasser vorm Schlafen hilft.' },
  { icon: 'wolke', title: 'Bedeckt mit Brummschädel', text: 'Stell dir schon mal Wasser ans Bett und plan morgen früh nichts Wichtiges.' },
  { icon: 'gewitter', title: 'Gewitter im Kopf', text: 'Rollläden runter, Rollmops raus. Der Vormittag fällt aus.' },
  { icon: 'orkan', title: 'Orkanwarnung', text: 'Morgen ist gestrichen. Trink jetzt Wasser und lass es für heute gut sein.' },
];

/**
 * Kater-Wetterbericht aus dem Höchstwert. Wer genug Wasser trinkt
 * (mindestens ein Glas je zwei Getränke), bekommt eine Stufe milder – außer beim Orkan.
 */
export function katerForecast(peakBac, drinkCount, waterCount) {
  let level = peakBac < 0.3 ? 0 : peakBac < 0.6 ? 1 : peakBac < 1.0 ? 2 : peakBac < 1.6 ? 3 : 4;
  const hydrated = drinkCount > 0 && waterCount >= Math.ceil(drinkCount / 2);
  const milder = hydrated && level > 0 && level < 4;
  if (milder) level -= 1;
  return { level, milder, ...FORECASTS[level] };
}

/** Urteil übers Trinktempo: gelobt wird langsam, nicht schnell */
export function tempoVerdict(durationMin, typicalMin) {
  if (!typicalMin) return '';
  const ratio = durationMin / typicalMin;
  if (ratio < 0.35) return 'Sturzflug! Kurz durchatmen.';
  if (ratio < 0.8) return 'Flott unterwegs.';
  if (ratio <= 1.6) return 'Schönes Tempo.';
  return 'Genießer. So geht das.';
}

/** Kommentar zur laufenden Stoppuhr */
export function runningComment(elapsedMin, typicalMin) {
  const ratio = typicalMin ? elapsedMin / typicalMin : 0;
  if (elapsedMin < 2) return 'frisch gezapft';
  if (ratio < 1) return 'läuft';
  if (ratio < 2) return 'wird langsam warm';
  if (ratio < 4) return 'nuckelst du noch?';
  return 'schon ausgetrunken?';
}

/** Wie viele alkoholische Getränke seit dem letzten Wasser begonnen wurden */
export function drinksSinceWater(drinks, water) {
  const lastWater = water.length ? Math.max(...water) : 0;
  return drinks.filter((d) => d.abv > 0 && d.time > lastWater).length;
}
