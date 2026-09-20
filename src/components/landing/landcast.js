/* Per-load random cast for the landing mockups (Shield scan, Message Agent,
   Global Discovery directory + qualified tray).
   Built ONCE per page load from the funnel's leftover personas (SPARE_POOL) plus
   the dedicated avatars-funnel faces (u04-u17). All names/photos/roles stay
   coherent and disjoint from the funnel showcase and never reuse testimonial
   identities. */

import { SEED, SPARE_POOL } from './goalshield/demoData';

const KNOWN = [
  { name: 'Oliver Bennett', gender: 'm', img: '/avatars-funnel/u04.jpg', role: 'Commercial Director', city: 'London', country: 'UK', dial: 44 },
  { name: 'Ethan Carter', gender: 'm', img: '/avatars-funnel/u08.jpg', role: 'Head of Growth', city: 'Toronto', country: 'Canada', dial: 1 },
  { name: 'Daniel Weber', gender: 'm', img: '/avatars-funnel/u13.jpg', role: 'Managing Director', city: 'Berlin', country: 'Germany', dial: 49 },
  { name: 'Luca Romano', gender: 'm', img: '/avatars-funnel/u14.jpg', role: 'Purchasing Director', city: 'Milan', country: 'Italy', dial: 39 },
  { name: 'James Whitmore', gender: 'm', img: '/avatars-funnel/u16.jpg', role: 'Operations Manager', city: 'Birmingham', country: 'UK', dial: 44 },
  { name: 'Claire Dubois', gender: 'f', img: '/avatars-funnel/u07.jpg', role: 'Procurement Manager', city: 'Paris', country: 'France', dial: 33 },
  { name: 'Sophie Laurent', gender: 'f', img: '/avatars-funnel/u10.jpg', role: 'Operations Manager', city: 'Lyon', country: 'France', dial: 33 },
  { name: 'Charlotte Hughes', gender: 'f', img: '/avatars-funnel/u11.jpg', role: 'Sales Director', city: 'Manchester', country: 'UK', dial: 44 },
  { name: 'Isabella Martin', gender: 'f', img: '/avatars-funnel/u15.jpg', role: 'BD Manager', city: 'Madrid', country: 'Spain', dial: 34 },
  { name: 'Amelia Grant', gender: 'f', img: '/avatars-funnel/u17.jpg', role: 'Head of Growth', city: 'New York', country: 'USA', dial: 1 },
];

let _s = SEED;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const m = shuffle(KNOWN.filter((p) => p.gender === 'm'));
const w = shuffle(KNOWN.filter((p) => p.gender === 'f'));

export const SHIELD = [m[0], w[0], m[1], w[1]];
export const AGENT = [m[2], w[2], m[3]];
const DIR_EXTRA = [m[4], w[3], w[4]];

export const DIRECTORY = [...shuffle(SPARE_POOL), ...DIR_EXTRA];

const phoneFor = (p) => {
  const h = [...p.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1000003, 7);
  return `+${p.dial} ${String(50 + (h % 40))} ${String(100 + ((h >> 4) % 900))} ${String(1000 + ((h >> 8) % 9000))}`;
};

export const SCAN_ROWS = SHIELD.map((p) => ({
  name: p.name,
  img: p.img,
  role: p.role,
  num: phoneFor(p),
  country: p.country,
}));

const AGENT_STATES = [
  {
    status: 'New lead', statusTone: 'primary', time: '09:41', unread: 1,
    color: 'bg-primary/15 text-primary border-primary/30',
    messages: [
      { side: 'them', text: 'Hi! I saw your WhatsApp listing for sourcing agents.' },
      { side: 'ai', text: 'High intent detected. Suggest a short intro call this week.' },
      { side: 'mine', text: 'Happy to walk you through how we work together.' },
    ],
  },
  {
    status: 'Qualified', statusTone: 'success', time: '10:02', unread: 0,
    color: 'bg-success/15 text-success border-success/30',
    messages: [
      { side: 'them', text: 'I need 40+ wholesale contacts for our retail chain.' },
      { side: 'mine', text: 'We have a validated list ready — sending it now.' },
      { side: 'them', text: 'Perfect, this is exactly what we needed.' },
    ],
  },
  {
    status: 'Follow up', statusTone: 'warning', time: 'Yesterday', unread: 2,
    color: 'bg-warning/15 text-warning border-warning/30',
    messages: [
      { side: 'them', text: 'Are the results from last week ready for review?' },
      { side: 'mine', text: 'Yep — PDF report going out this afternoon.' },
    ],
  },
];

export const AGENT_CONTACTS = AGENT.map((p, i) => ({
  name: p.name,
  img: p.img,
  role: `${p.role} · ${p.city}`,
  ...AGENT_STATES[i],
}));