import type { CollectionObject } from './objects';

/*
 * Synthetic sample imagery: simple SVG illustrations, generated in code.
 * Served only through /api/objects/[id]/image (not /public) so that the
 * private fixtures go through the access-controlled path.
 */

const INK = '#3b3a36';
const PAPER = '#efece4';

const drawings: Record<CollectionObject['drawing'], string> = {
  clock: `
    <rect x="215" y="110" width="170" height="230" rx="10" fill="#b8955a" stroke="${INK}" stroke-width="4"/>
    <rect x="240" y="80" width="120" height="34" rx="8" fill="none" stroke="${INK}" stroke-width="6"/>
    <circle cx="300" cy="200" r="62" fill="#f8f4ea" stroke="${INK}" stroke-width="4"/>
    <line x1="300" y1="200" x2="300" y2="160" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <line x1="300" y1="200" x2="330" y2="214" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <rect x="240" y="285" width="120" height="36" rx="4" fill="#a3834c" stroke="${INK}" stroke-width="3"/>`,
  photograph: `
    <rect x="170" y="70" width="260" height="310" fill="#fbf8f1" stroke="${INK}" stroke-width="3"/>
    <rect x="195" y="95" width="210" height="230" fill="#8d8a80"/>
    <circle cx="265" cy="170" r="24" fill="#d9d4c7"/><path d="M225 325 q40 -110 80 0" fill="#ece8de"/>
    <circle cx="335" cy="165" r="24" fill="#d9d4c7"/><path d="M300 325 q35 -105 70 0" fill="#57544c"/>
    <line x1="215" y1="352" x2="385" y2="352" stroke="#b9b4a6" stroke-width="3"/>`,
  sampler: `
    <rect x="150" y="70" width="300" height="310" fill="#f4eedf" stroke="#7a5b3a" stroke-width="10"/>
    <text x="300" y="150" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#7c3b2f" letter-spacing="6">ABCDEFG</text>
    <text x="300" y="200" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#2f5d58" letter-spacing="6">HIJKLMN</text>
    <text x="300" y="250" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#7c3b2f" letter-spacing="6">OPQRSTU</text>
    <g fill="#2f5d58">${[190, 240, 290, 340, 390].map((x) => `<circle cx="${x}" cy="320" r="10"/>`).join('')}</g>`,
  letters: `
    <rect x="160" y="140" width="280" height="170" fill="#f6f0e2" stroke="${INK}" stroke-width="3" transform="rotate(-6 300 225)"/>
    <rect x="170" y="125" width="280" height="170" fill="#fbf7ee" stroke="${INK}" stroke-width="3" transform="rotate(4 300 210)"/>
    <path d="M175 135 L310 225 L445 135" fill="none" stroke="${INK}" stroke-width="3" transform="rotate(4 300 210)"/>
    <rect x="292" y="110" width="16" height="210" fill="#8a2f3b"/><rect x="170" y="203" width="270" height="14" fill="#8a2f3b"/>`,
  caddy: `
    <rect x="215" y="130" width="170" height="220" rx="6" fill="#2f5d58" stroke="${INK}" stroke-width="4"/>
    <rect x="205" y="105" width="190" height="34" rx="6" fill="#244a46" stroke="${INK}" stroke-width="4"/>
    <circle cx="300" cy="235" r="48" fill="#e7d8b0" stroke="#b8955a" stroke-width="5"/>
    <text x="300" y="245" font-family="Georgia,serif" font-size="28" text-anchor="middle" fill="#7c3b2f">TEA</text>`,
  tin: `
    <rect x="185" y="150" width="230" height="190" rx="8" fill="#c9b27c" stroke="${INK}" stroke-width="4"/>
    <rect x="205" y="110" width="190" height="60" fill="#fbf8f1" stroke="${INK}" stroke-width="2" transform="rotate(-4 300 140)"/>
    <rect x="215" y="100" width="170" height="60" fill="#f4efe3" stroke="${INK}" stroke-width="2" transform="rotate(5 300 130)"/>
    <line x1="230" y1="125" x2="360" y2="135" stroke="#8d8a80" stroke-width="2"/>
    <rect x="175" y="150" width="250" height="26" rx="6" fill="#b49a62" stroke="${INK}" stroke-width="4"/>`,
};

export function objectImageSvg(object: Pick<CollectionObject, 'drawing' | 'name' | 'visibility'>) {
  const label = object.visibility === 'private' ? 'PRIVATE · SYNTHETIC SAMPLE' : 'SYNTHETIC SAMPLE';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">
  <title>${object.name} (synthetic illustration)</title>
  <rect width="600" height="450" fill="${PAPER}"/>
  <ellipse cx="300" cy="390" rx="190" ry="18" fill="#00000014"/>
  ${drawings[object.drawing]}
  <text x="20" y="432" font-family="ui-monospace,monospace" font-size="13" fill="#6b6860">${label}</text>
</svg>`;
}
