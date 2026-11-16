// Pegel – Getränke-Datenbank
//
// Alkoholgehalte sind typische Werte (Hersteller- bzw. Durchschnittsangaben).
// Sie schwanken je nach Sorte, Land und Rezept – im Dialog lassen sie sich anpassen.
//
// Einträge: [Name, Vol.-%, Menge in ml (optional), Suchbegriffe (optional)]
// Longdrinks: Menge = nur der Spirituosen-Anteil (z. B. 4 cl Gin), Prozent = Spirituose.
// Cocktails:  Menge und Prozent beziehen sich auf das ganze Glas.

export const CATEGORIES = {
  bier: { label: 'Bier', icon: 'bier', ml: 500, sizes: [200, 330, 500, 1000], estMin: 30 },
  wein: { label: 'Wein', icon: 'wein', ml: 200, sizes: [100, 200, 250, 500], estMin: 30 },
  sekt: { label: 'Sekt und Spritz', icon: 'sekt', ml: 100, sizes: [100, 200, 750], estMin: 20 },
  cocktail: { label: 'Cocktails', icon: 'cocktail', ml: 250, sizes: [], estMin: 30 },
  longdrink: { label: 'Longdrinks', icon: 'longdrink', ml: 40, sizes: [20, 40, 60, 80], estMin: 30,
    note: 'Menge = nur der Alkohol-Anteil (z. B. 4 cl Gin), Prozent = der Spirituose.' },
  schnaps: { label: 'Schnaps', icon: 'shot', ml: 20, sizes: [20, 40], estMin: 0 },
  likoer: { label: 'Likör', icon: 'shot', ml: 20, sizes: [20, 40], estMin: 0 },
  cider: { label: 'Cider und Mix', icon: 'pils', ml: 330, sizes: [250, 300, 330, 500], estMin: 30 },
};

const RAW = {
  bier: [
    ['Helles', 5.0], ['Pils', 4.8, 330, 'pilsener pilsner'], ['Export', 5.3], ['Märzen', 5.6],
    ['Weißbier', 5.4, 500, 'weizen hefeweizen weissbier'], ['Kristallweizen', 5.3], ['Dunkles Weißbier', 5.3, 500, 'weizen dunkel'],
    ['Dunkles', 5.0, 500, 'dunkel'], ['Kellerbier', 5.0, 500, 'zwickel ungespundet'], ['Schwarzbier', 4.8],
    ['Kölsch', 4.8, 200, 'stange'], ['Altbier', 4.8, 250, 'alt'], ['Lager', 5.0], ['Landbier', 5.0],
    ['Bockbier', 7.0, 500, 'bock starkbier'], ['Doppelbock', 7.5, 500, 'starkbier'],
    ['Oktoberfestbier (Maß)', 6.0, 1000, 'wiesn mass maß festbier'], ['Festbier', 5.8],
    ['IPA', 6.5, 330, 'india pale ale craft'], ['Pale Ale', 5.2, 330, 'craft'], ['Stout', 5.5, 330],
    ['Radler', 2.5, 500, 'alster alsterwasser'], ['Diesel (Bier-Cola)', 2.5, 500, 'colabier'],
    ['Russ (Weizen-Limo)', 2.7, 500, 'russn'], ['Alkoholfreies Bier', 0.4, 500, '0,0 alkoholfrei'],
    ['Augustiner Lagerbier Hell', 5.2], ['Augustiner Edelstoff', 5.6],
    ['Paulaner Münchner Hell', 4.9], ['Paulaner Hefe-Weißbier', 5.5, 500, 'weizen'],
    ['Paulaner Salvator', 7.9, 500, 'doppelbock'], ['Löwenbräu Original', 5.2], ['Spaten Münchner Hell', 5.2],
    ['Hofbräu Original', 5.1, 500, 'hb'], ['Tegernseer Hell', 4.8],
    ['Erdinger Weißbier', 5.3, 500, 'weizen'], ['Erdinger Weißbier Dunkel', 5.3, 500, 'weizen'],
    ['Franziskaner Hefe-Weissbier', 5.0, 500, 'weizen'], ['Weihenstephaner Hefeweissbier', 5.4, 500, 'weizen'],
    ['Schneider Weisse TAP7', 5.4, 500, 'weizen'],
    ['Beck’s Pils', 4.9, 330, 'becks'], ['Krombacher Pils', 4.8, 330], ['Warsteiner Pilsener', 4.8, 330],
    ['Bitburger Pils', 4.8, 330, 'bit'], ['Veltins Pilsener', 4.8, 330], ['Radeberger Pilsner', 4.8, 330],
    ['Jever Pilsener', 4.9, 330], ['Rothaus Tannenzäpfle', 5.1, 330], ['Flensburger Pilsener', 4.8, 330, 'flens'],
    ['Astra Urtyp', 4.9, 330], ['Köstritzer Schwarzbier', 4.8, 500], ['Oettinger Pils', 4.7],
    ['Früh Kölsch', 4.8, 200], ['Reissdorf Kölsch', 4.8, 200], ['Gaffel Kölsch', 4.8, 200],
    ['Heineken', 5.0, 330], ['Corona Extra', 4.5, 355], ['Carlsberg', 5.0, 330],
    ['Pilsner Urquell', 4.4, 500], ['Budweiser Budvar', 5.0, 500], ['Guinness Draught', 4.2, 500],
    ['Desperados', 5.9, 330, 'tequila bier'],
  ],
  wein: [
    ['Weißwein', 12.0, 200, 'weisswein'], ['Rotwein', 13.0], ['Roséwein', 11.5, 200, 'rose'],
    ['Riesling', 11.5], ['Grauburgunder', 12.5, 200, 'pinot grigio grigio'], ['Weißburgunder', 12.5, 200, 'pinot blanc'],
    ['Silvaner', 12.0], ['Müller-Thurgau', 11.5, 200, 'rivaner'], ['Sauvignon Blanc', 12.5],
    ['Chardonnay', 13.0], ['Spätburgunder', 13.0, 200, 'pinot noir'], ['Dornfelder', 12.5],
    ['Merlot', 13.5], ['Cabernet Sauvignon', 13.5], ['Primitivo', 14.0, 200, 'zinfandel'],
    ['Rioja', 13.5], ['Chianti', 13.0], ['Lambrusco', 8.0],
    ['Weinschorle (weiß)', 6.0, 250, 'schorle spritzer gespritzter'], ['Weinschorle (rot)', 6.5, 250, 'schorle'],
    ['Federweißer', 6.0, 200, 'federweisser neuer wein'], ['Glühwein', 10.0, 200, 'weihnachtsmarkt'],
    ['Glühwein mit Schuss', 15.0, 220, 'weihnachtsmarkt amaretto rum'], ['Sangria', 8.0, 250],
    ['Portwein', 20.0, 50, 'port'], ['Sherry', 17.0, 50], ['Wermut', 15.0, 50, 'vermouth martini bianco'],
    ['Lillet Blanc', 17.0, 50],
  ],
  sekt: [
    ['Sekt', 11.0], ['Prosecco', 11.0, 100, 'frizzante spumante'], ['Champagner', 12.0, 100, 'champagne'],
    ['Crémant', 12.0, 100, 'cremant'], ['Cava', 11.5], ['Rotkäppchen Sekt', 11.0],
    ['Piccolo', 11.0, 200, 'sekt kleine flasche'],
    ['Aperol Spritz', 8.0, 200, 'spritz'], ['Hugo', 7.0, 250, 'holunder spritz'],
    ['Lillet Wild Berry', 6.0, 200, 'lillet tonic'], ['Limoncello Spritz', 8.0, 200, 'spritz'],
    ['Campari Spritz', 9.0, 200, 'spritz'], ['Kir Royal', 11.0, 100], ['Bellini', 8.0, 150],
    ['Mimosa', 6.0, 150, 'orangensaft sekt o-saft'],
  ],
  cocktail: [
    ['Mojito', 8.0, 250], ['Caipirinha', 13.0, 200, 'cachaca'], ['Caipiroska', 13.0, 200, 'wodka vodka'],
    ['Piña Colada', 7.0, 300, 'pina colada'], ['Long Island Iced Tea', 11.0, 350, 'lit'],
    ['Sex on the Beach', 8.0, 250],
    ['Mai Tai', 14.0, 200], ['Zombie', 12.0, 300], ['Swimming Pool', 8.0, 300],
    ['Margarita', 22.0, 120], ['Daiquiri', 20.0, 100], ['Cosmopolitan', 20.0, 110, 'cosmo'],
    ['Espresso Martini', 20.0, 120], ['Martini (Dry)', 30.0, 90, 'dry martini'], ['Negroni', 22.0, 110],
    ['Old Fashioned', 30.0, 90], ['Manhattan', 28.0, 90], ['Whiskey Sour', 15.0, 130, 'whisky'],
    ['Amaretto Sour', 10.0, 130], ['Pisco Sour', 15.0, 130], ['Gin Basil Smash', 15.0, 150],
    ['White Russian', 20.0, 100], ['Black Russian', 28.0, 80], ['Mojito alkoholfrei', 0.0, 250, 'virgin'],
    ['Bowle', 7.0, 200, 'erdbeerbowle'], ['Feuerzangenbowle', 12.0, 200],
  ],
  longdrink: [
    ['Gin Tonic', 40.0, 40, 'gin tonic g&t gt'], ['Wodka Lemon', 40.0, 40, 'vodka'], ['Wodka Energy', 40.0, 40, 'vodka red bull'],
    ['Wodka O', 40.0, 40, 'vodka orange o-saft'], ['Moscow Mule', 40.0, 40, 'vodka ginger beer'],
    ['Cuba Libre', 40.0, 40, 'rum cola'], ['Rum Cola', 40.0, 40], ['Dark ’n’ Stormy', 40.0, 40, 'dark and stormy rum ginger'],
    ['Whisky Cola', 40.0, 40, 'whiskey cola jacky'], ['Jacky Cola', 40.0, 40, 'jack daniels cola'],
    ['Tequila Sunrise', 38.0, 40, 'tequila orange'], ['Paloma', 38.0, 40, 'tequila grapefruit'],
    ['Gin Lemon', 40.0, 40], ['Gin Sour', 40.0, 40], ['Malibu Orange', 21.0, 40, 'malibu o-saft'],
    ['Malibu Kirsch', 21.0, 40, 'malibu kiba'], ['Batida Kirsch', 16.0, 40, 'batida de coco'],
    ['Jägermeister Energy', 35.0, 40, 'jäger jaegermeister jagerbomb jägerbomb'], ['Asbach Cola', 36.0, 40, 'weinbrand cola'],
    ['Campari Orange', 25.0, 40, 'campari o-saft'], ['Aperol Soda', 11.0, 60],
  ],
  schnaps: [
    ['Wodka', 40.0, 20, 'vodka'], ['Gin', 40.0], ['Rum (weiß)', 37.5, 20, 'rum'], ['Rum (braun)', 40.0, 20, 'rum'],
    ['Whisky', 40.0, 20, 'whiskey scotch bourbon'], ['Tequila', 38.0], ['Mezcal', 40.0],
    ['Korn', 32.0, 20, 'kurzer'], ['Doppelkorn', 38.0], ['Obstler', 40.0, 20, 'obstbrand'],
    ['Williams Birne', 40.0, 20, 'williams christ'], ['Kirschwasser', 40.0], ['Zwetschgenwasser', 40.0, 20, 'zwetschge'],
    ['Grappa', 40.0], ['Ouzo', 38.0], ['Raki', 45.0], ['Sambuca', 38.0], ['Absinth', 60.0, 20, 'absinthe'],
    ['Weinbrand', 36.0, 20, 'brandy'], ['Cognac', 40.0], ['Calvados', 40.0], ['Pisco', 40.0],
    ['Strohrum', 80.0, 20, 'stroh inländer'],
    ['Absolut Vodka', 40.0, 20, 'wodka'], ['Smirnoff Vodka', 37.5, 20, 'wodka'], ['Bombay Sapphire', 40.0, 20, 'gin'],
    ['Hendrick’s Gin', 41.4, 20, 'hendricks'], ['Tanqueray', 43.1, 20, 'gin'], ['Gordon’s Gin', 37.5, 20, 'gordons'],
    ['Monkey 47', 47.0, 20, 'gin'], ['Bacardi Carta Blanca', 37.5, 20, 'rum'], ['Havana Club 3 Años', 40.0, 20, 'rum'],
    ['Captain Morgan Spiced Gold', 35.0, 20, 'rum'], ['Jack Daniel’s', 40.0, 20, 'jack daniels whiskey'],
    ['Jameson', 40.0, 20, 'whiskey'], ['Johnnie Walker Red Label', 40.0, 20, 'whisky'], ['Jim Beam', 40.0, 20, 'bourbon'],
    ['José Cuervo Especial', 38.0, 20, 'tequila'], ['Asbach Uralt', 36.0, 20, 'weinbrand'],
  ],
  likoer: [
    ['Jägermeister', 35.0, 20, 'jäger jaeger'], ['Kümmerling', 35.0, 20, 'kräuterlikör'],
    ['Kräuterlikör', 35.0], ['Berliner Luft', 18.0, 20, 'pfeffi pfefferminz'], ['Pfefferminzlikör', 18.0, 20, 'pfeffi'],
    ['Kleiner Feigling', 20.0, 20, 'feigling'], ['Fruchtlikör', 18.0, 20, 'saurer apfel waldmeister'],
    ['Mexikaner', 12.0, 40, 'mexi'], ['Eierlikör', 20.0, 20, 'verpoorten'],
    ['Baileys', 17.0, 40, 'irish cream'], ['Amaretto', 28.0, 20, 'disaronno'], ['Licor 43', 31.0, 20],
    ['Limoncello', 30.0], ['Ramazzotti', 30.0, 20, 'amaro'], ['Averna', 29.0, 20, 'amaro'],
    ['Fernet-Branca', 39.0, 20, 'fernet'], ['Campari', 25.0, 40], ['Aperol', 11.0, 40],
    ['Malibu', 21.0, 40, 'kokos'], ['Kahlúa', 16.0, 40, 'kahlua kaffeelikör'], ['Cointreau', 40.0, 20, 'triple sec'],
    ['Batida de Coco', 16.0, 40, 'batida'], ['Sahnelikör', 17.0, 40],
  ],
  cider: [
    ['Apfelwein', 5.5, 300, 'äppler ebbelwoi ebbelwei schoppen geripptes'], ['Sauergespritzter', 3.7, 300, 'apfelwein sauer gespritzt'],
    ['Süßgespritzter', 3.7, 300, 'apfelwein süß gespritzt'], ['Cider', 4.5, 330], ['Strongbow', 4.5, 330, 'cider'],
    ['Somersby', 4.5, 330, 'cider'], ['Smirnoff Ice', 4.0, 275, 'alkopop'], ['Bacardi Breezer', 4.0, 275, 'alkopop'],
    ['Hard Seltzer', 4.5, 330, 'seltzer'], ['Mixery', 3.1, 330, 'biermix'],
  ],
};

let n = 0;
export const DRINKS = Object.entries(RAW).flatMap(([cat, list]) =>
  list.map(([name, abv, ml, alias]) => ({
    id: `d${n++}`,
    name,
    cat,
    abv,
    volumeMl: ml ?? CATEGORIES[cat].ml,
    alias: alias ?? '',
  })),
);

export const normalize = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u') // „aeppler“ findet „Äppler“
    .replace(/[’'`´]/g, '')
    .replace(/[^a-z0-9%,.& ]+/g, ' ')
    .trim();

const INDEX = DRINKS.map((d) => ({
  d,
  name: normalize(d.name),
  all: normalize(`${d.name} ${d.alias} ${CATEGORIES[d.cat].label}`),
}));

/** Suche: alle Wörter müssen vorkommen; Treffer am Namensanfang zuerst */
export function searchDrinks(query, { cat = null, limit = 40 } = {}) {
  const q = normalize(query);
  const words = q.split(/\s+/).filter(Boolean);
  const hits = [];
  for (const e of INDEX) {
    if (cat && e.d.cat !== cat) continue;
    if (!words.every((w) => e.all.includes(w))) continue;
    let score = 0;
    if (q) {
      if (e.name.startsWith(q)) score -= 3;
      else if (e.name.split(' ').some((w) => w.startsWith(words[0]))) score -= 2;
      else if (e.name.includes(words[0])) score -= 1;
    }
    hits.push({ d: e.d, score });
  }
  hits.sort((a, b) => a.score - b.score || a.d.name.length - b.d.name.length);
  return hits.slice(0, limit).map((h) => h.d);
}

export function sizesFor(drink) {
  const c = CATEGORIES[drink.cat];
  const set = new Set([...(c?.sizes ?? []), drink.volumeMl]);
  return [...set].filter(Boolean).sort((a, b) => a - b);
}

export const iconFor = (cat) => CATEGORIES[cat]?.icon ?? 'glas';
export const estMinFor = (cat) => CATEGORIES[cat]?.estMin ?? 20;
