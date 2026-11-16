// Pegel – Strich-Icons (24×24, ein Pfad pro Icon)

export const ICONS = {
  bier: 'M6 8h9v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 8a2.5 2.5 0 0 1 1.5-4.2A3 3 0 0 1 13 3.5 2.5 2.5 0 0 1 15 8',
  pils: 'M8 3h8l-1.2 15a2 2 0 0 1-2 1.8h-1.6a2 2 0 0 1-2-1.8zM8.4 8h7.2',
  weizen: 'M8.5 3h7c.6 3 .8 5 0 8-.6 2.2-.8 4.5-.5 7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2c.3-2.5.1-4.800-.5-7-.8-3-.6-5 0-8zM8.2 7.5h7.6',
  radler: 'M6.5 7H15l-1 12a2 2 0 0 1-2 1.8H9.5a2 2 0 0 1-2-1.8zM20 5.5a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0zM17.2 2.7v5.6',
  wein: 'M8 3h8v5a4 4 0 0 1-8 0zM12 12v8.5M8.5 20.5h7',
  sekt: 'M9.5 3h5l-.5 8a2 2 0 0 1-4 0zM12 13v7.5M9 20.5h6',
  spritz: 'M7 4.5h10c.5 4-.8 8-5 8s-5.5-4-5-8zM12 12.5v8M8.5 20.5h7M13.5 9l3-6.500',
  cocktail: 'M5 4.5h14l-7 8zM12 12.5v8M8.500 20.500h7M8 8h8',
  longdrink: 'M7 7h10l-1 12a2 2 0 0 1-2 1.8h-4a2 2 0 0 1-2-1.8zM12.5 13 15 3h2.5',
  shot: 'M7.5 8h9l-1.3 10a2 2 0 0 1-2 1.8h-2.4a2 2 0 0 1-2-1.8zM8.2 13h7.6',
  glas: 'M7 4h10l-1 15a2 2 0 0 1-2 1.8h-4a2 2 0 0 1-2-1.8zM7.5 10h9',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 5l7 7-7 7',
  stopwatch: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M9.5 2.5h5',
};

const NS = 'http://www.w3.org/2000/svg';

/** Erzeugt ein <svg class="ico"> für den Icon-Schlüssel */
export function icon(key, size = 24) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ico');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', ICONS[key] ?? ICONS.glas);
  svg.append(path);
  return svg;
}
