/* Randomized fictional demo dataset for the funnel showcase.
   Built ONCE per page load from a safe persona/brand pool. The same set is
   shared by the desktop pinned scenes and the mobile/tablet card mocks, and is
   never reused from testimonial or discovery sections (guarded below).

   All personas are fictional, global B2B identities (UK/US/Canada/France/
   Germany/Spain/Italy/Portugal/Netherlands/Europe) — no South-Asian, Gulf or
   MENA placeholders. A single "hero" customer threads through the whole
   workflow (found -> verified -> chatted -> won) so the story stays coherent. */

const BLOCKED = new Set([
  // testimonial clients (demos.jsx — renamed global/Western personas)
  'Amelie Rousseau', 'Daniel Moreau', 'Petra Schneider', 'Luis Ferreira', 'Hannah Meyer',
  'Marco Bellini', 'Lena Vogel', 'Oliver Hartmann', 'Sofia Reyes', 'Hanna Falk',
  'Marco Silva', 'Olaf Hedley', 'Freya Nielsen', 'Adam Olsen', 'Tomas Novak',
  'Alice Payne', 'Annika Kruse', 'Daniel Osborne', 'Daniel Cruz', 'Paula Neumann',
  'Pauline Steiner', 'Tomas Weber', 'Tomas Berg', 'Andreas Brandt', 'Alistair Cole',
  'Adrian Meyer', 'Alina Costa', 'Carlos Rivera', 'Daniel Reid', 'Emma Larsson',
  'Franziska Albrecht', 'Fiona Yates', 'Grace Palmer', 'Hedda Christophersen', 'Hannah Pfeiffer',
  'James Clarke', 'Lena Fischer', 'Lena Krause', 'Luis Oliveira', 'Luis Santos', 'Marco Bianchi',
  'Marco Rossi', 'Maria Lopez', 'Nina Torres', 'Oskar Halvorsen', 'Otto Klein',
  'Owen Whitfield', 'Rachel Stone', 'Sofia Anders', 'Sofia Muller', 'Sofia Werner',
  'Thomas Wright', 'Tomas Parker',
  // legacy discovery / message-agent personas no longer in the pool
  'Nadia El-Sayed', 'Omar Reza', 'Sofia Lindqvist', 'Yousef Bitar', 'Rafael Ortega',
  'Amara Diop', 'Jonas Lindqvist', 'Mara Bertolini', 'Kemi Adegoke',
  'Diego Fuentes', 'Raees Malik', 'Hana Lee', 'Marcus Webb', 'Petra Novak',
  'Chen Wei', 'Ingrid Berg', 'Omar Malik', 'Sara Ali', 'David Chen', 'Emma Davies',
  'Liam Byrne', 'Noor Jameel', 'Ahmed Raza', 'Elena Petrova', 'Carlos Mendes',
  'Tariq Haddad', 'Leila Mansour', 'Zara Iqbal', 'Bilal Sheikh',
  'Mateo Alves', 'Noura Salim', 'Yassine Belkadi',
  // landing mockup faces used by shield-scan / agent-app / discovery (landcast)
  'Oliver Bennett', 'Ethan Carter', 'Daniel Weber', 'Luca Romano',
  'James Whitmore', 'Claire Dubois', 'Sophie Laurent', 'Charlotte Hughes',
  'Isabella Martin', 'Amelia Grant',
]);

const OLD_BRANDS = new Set([
  'Golden Thread Imports', 'Aurora Fit-out', 'Nile Freight', 'PixelBrew Studio',
  'Verana Home', 'Canary Works', 'Brightline Solar', 'TerraFit Studio',
  'Maven Cloud', 'Beacon Media', 'CapeFreight',
]);

export const SEED = typeof window !== 'undefined' && window.__GOALSHIELD_SEED__ != null
  ? window.__GOALSHIELD_SEED__
  : Math.random();

let _s = SEED;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* Personas: photo files are the dedicated avatars-funnel assets. men->u18..u37,
   women->u38..u53 (matches the gender-verified downloads). All identities are
   fictional global B2B buyers (Western / European markets). */
const MEN = [
  ['Leon Becker', 'Commercial Director', 'Frankfurt', 'DE', 49],
  ['Erik Magnusson', 'Managing Director', 'Hamburg', 'DE', 49],
  ['Jack Turner', 'Head of Growth', 'Bristol', 'GB', 44],
  ['Hugo Fernández', 'Purchasing Director', 'Barcelona', 'ES', 34],
  ['Nathan Cole', 'Operations Manager', 'Manchester', 'GB', 44],
  ['Thomas Berger', 'Sales Director', 'Munich', 'DE', 49],
  ['Lucas Bernard', 'Procurement Manager', 'Paris', 'FR', 33],
  ['Miguel Casado', 'BD Manager', 'Valencia', 'ES', 34],
  ['Niels Visser', 'Operations Director', 'Rotterdam', 'NL', 31],
  ['Pedro Vieira', 'Procurement Lead', 'Lisbon', 'PT', 351],
  ['Finn Andersen', 'Supply Chain Manager', 'Copenhagen', 'DK', 45],
  ['Sebastian Keller', 'Managing Director', 'Zurich', 'CH', 41],
  ['Hugo Marchand', 'Sales Director', 'Lyon', 'FR', 33],
  ['Adam Scott', 'Operations Manager', 'Edinburgh', 'GB', 44],
  ['Leo van Wijk', 'BD Manager', 'Amsterdam', 'NL', 31],
  ['Marco Ferrari', 'VP Sales', 'Rome', 'IT', 39],
  ['Aiden O\'Connor', 'BD Manager', 'Dublin', 'IE', 353],
  ['Felix Bauer', 'Head of Engineering', 'Hamburg', 'DE', 49],
  ['William Harrison', 'Commercial Director', 'Chicago', 'US', 1],
  ['Benjamin Girard', 'Logistics Director', 'Marseille', 'FR', 33],
].map((p, i) => ({
  name: p[0], role: p[1], city: p[2], country: p[3], dial: p[4],
  img: `/avatars-funnel/u${String(18 + i).padStart(2, '0')}.jpg`,
}));

const WOMEN = [
  ['Charlotte Reed', 'Sales Director', 'Leeds', 'GB', 44],
  ['Claire Fontaine', 'Procurement Manager', 'Nice', 'FR', 33],
  ['Isabella Wagner', 'BD Manager', 'Prague', 'CZ', 420],
  ['Sophie Keller', 'Operations Manager', 'Strasbourg', 'FR', 33],
  ['Emma Wilson', 'Head of Marketing', 'New York', 'US', 1],
  ['Chloe Tremblay', 'Operations Manager', 'Montreal', 'CA', 1],
  ['Hannah Davies', 'Supply Chain Lead', 'Bristol', 'GB', 44],
  ['Lea Martin', 'HR & Ops Lead', 'Bordeaux', 'FR', 33],
  ['Anna Hoffmann', 'Purchasing Director', 'Cologne', 'DE', 49],
  ['Mia Janssen', 'BD Manager', 'Amsterdam', 'NL', 31],
  ['Beatriz Almeida', 'Procurement Officer', 'Porto', 'PT', 351],
  ['Giulia Conti', 'Retail Buyer', 'Rome', 'IT', 39],
  ['Melanie Kohler', 'Sales Manager', 'Frankfurt', 'DE', 49],
  ['Alicia Cruz', 'Marketing Director', 'Seville', 'ES', 34],
  ['Emily Turner', 'Head of Partnerships', 'Denver', 'US', 1],
  ['Nora Baumann', 'Operations Manager', 'Vienna', 'AT', 43],
].map((p, i) => ({
  name: p[0], role: p[1], city: p[2], country: p[3], dial: p[4],
  img: `/avatars-funnel/u${String(38 + i).padStart(2, '0')}.jpg`,
}));

const personaList = shuffle([...MEN, ...WOMEN])
  .filter((p) => !BLOCKED.has(p.name));

const BRAND_POOL = [
  'Aurelia Interiors', 'Voltix Solar', 'Kite & Kin Retail', 'Nimbus Cloud Services',
  'Harborline Freight', 'Vertex Build', 'Alora Studios', 'Craftline Manufacturing',
  'Summit Advisory', 'Brightwork Agency', 'Morave Distribution', 'Skyframe Properties',
  'Lumen Retail Group', 'Orium Foods', 'PulseFit Wellness', 'Nexa Digital',
  'Terra Home Goods', 'Cobalt Marine', 'Driftline Logistics', 'Aestra Cosmetics',
  'Brixton Supply Co', 'Atlas Hosting', 'Fable & Fern', 'Regia Hotels',
  'Cinder Automation', 'Woven Thread Co', 'Orbit Mobility', 'Sterling Med Care',
  'Prism Architecture', 'Vantage Freight',
].filter((b) => !OLD_BRANDS.has(b));

const SECTORS = [
  'Solar & Renewables', 'Interior Design', 'IT Services', 'Retail', 'Manufacturing',
  'Logistics', 'Real Estate', 'Fashion Retail', 'Food & Beverage', 'Healthcare',
  'Architecture', 'Fintech', 'Construction', 'Energy', 'Hospitality', 'Automotive',
  'Travel & Tourism', 'Textiles', 'Education', 'Beauty & Wellness', 'E-commerce', 'Software',
];

const tintOf = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

const digits = (n) => Array.from({ length: n }, () => rand(0, 9)).join('');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 22);
const tldPool = ['.io', '.com', '.co', '.ai', '.io', '.com', '.tech'];
const PLACES = [
  'London', 'Paris', 'Berlin', 'Madrid', 'Milan', 'Amsterdam', 'Lisbon',
  'Toronto', 'New York', 'Munich', 'Lyon', 'Manchester', 'Porto', 'Valencia',
  'Rome', 'Rotterdam', 'Barcelona', 'Zurich', 'Dublin', 'Vienna',
  'Copenhagen', 'Frankfurt', 'Hamburg', 'Bordeaux', 'Marseille',
];

const makePhone = (p) => `+${p.dial} ${digits(2)} ${digits(3)} ${digits(3)}`;
const makeWeb = (brand, cat) => `${slug(brand)}-${slug(cat)}${pick(tldPool)}`;

const found = rand(940, 2180);
const contacts = Math.round((found * 0.85) / 10) * 10;
const verified = Math.round((contacts * (0.68 + rnd() * 0.13)) / 2) * 2;
const dups = rand(8, 18);
const invalid = Math.max(40, contacts - verified - dups);
const score = rand(79, 95);
const conv = rand(16, 22);

const matches = [rand(94, 98), rand(90, 95), rand(86, 92), rand(82, 89), rand(80, 86)];

/* Sequential, non-overlapping allocation across every scene. */
const takeN = (n) => personaList.splice(0, n);

const buildLeads = (people) => shuffle(BRAND_POOL).slice(0, 5).map((brand, i) => {
  const p = people[i];
  const cat = pick(SECTORS);
  return {
    brand,
    cat,
    loc: `${p.city}, ${p.country}`,
    contact: p.name,
    img: p.img,
    phone: makePhone(p),
    web: makeWeb(brand, cat),
    match: matches[i],
    wa: i !== 4 || rnd() > 0.4,
    tint: tintOf(brand),
  };
});

const buildVerify = (list) => {
  const statuses = shuffle(['ready', 'dup', 'invalid']);
  if (!statuses.includes('ready')) statuses[0] = 'ready';
  return list.map((p, i) => {
    const status = i === 0 ? 'ready' : statuses.shift();
    return {
      name: p.name,
      img: p.img,
      loc: p.city,
      role: p.role,
      phone: makePhone(p),
      status,
      tint: tintOf(p.name),
      at: 0.34 + i * 0.06,
    };
  });
};

const buildChats = (list) => [
  { p: list[0], active: true, when: '10:06', last: pick(['Sent a catalog - ready?', 'Shared requirements', 'Wants a demo call']) },
  { p: list[1], active: false, when: '09:44', last: pick(['Pricing request received', 'Asked about bulk orders']) },
  { p: list[2], active: false, when: '09:12', last: pick(['Asked about bulk orders', 'Follow up this week']) },
].map((c) => ({
  name: c.p.name,
  img: c.p.img,
  role: c.p.role,
  meta: `${c.p.role} · ${pick(['GB', 'US', 'CA', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL'])}`,
  when: c.when,
  last: `${pick(['Retail', 'Interior', 'Logistics', 'SaaS', 'Fashion'])} · ${c.last}`,
  active: c.active,
  tint: tintOf(c.p.name),
  online: c.active,
}));

const buildMsgs = (chat) => {
  const qty = (rand(4, 40) * 5);
  const day = pick(['Fri', 'Mon', 'Wed']);
  return [
    { from: 'lead', text: 'Hi! We are renovating our showroom and need custom quotes for this project.', t: '10:02', at: 0.1 },
    { from: 'ai', text: `Great to meet you, ${chat.name.split(' ')[0]}. I will connect you with our specialists and send the catalog.`, t: '10:03', at: 0.18, tags: ['Product Catalog', chat.meta.split(' · ')[0]] },
    { from: 'lead', text: `Perfect - we need ${qty} units by next month.`, t: '10:04', at: 0.3 },
    { from: 'ai', text: `Sent: catalog with bulk pricing (${qty} pcs). Want a walkthrough call?`, t: '10:05', at: 0.42 },
    { from: 'ai', text: `Walkthrough locked for ${day} 14:00.`, t: '10:06', at: 0.76, sent: true },
  ];
};

const buildDeals = (people) => shuffle(BRAND_POOL).slice(0, 6).map((brand, i) => ({
  company: {
    brand,
    cat: pick(SECTORS),
    person: people[i],
  },
  value: i === 0 ? rand(38, 68) : rand(9, 36),
}));

const buildPipeline = (leadPersona) => ({
  p: leadPersona,
  tags: [pick(['Importer', 'Retail chain', 'Distributor', 'Franchise']), pick(['Repeat buyer', 'Approved budget', 'Signing soon']), 'High intent'],
});

const buildColumns = (deals) => ({
  qualified: [
    { card: deals[1], prio: 'High', meta: `Interiors · ${pick(PLACES)}`, note: 'Asked for proposal', at: 0.3 },
    { card: deals[2], prio: 'Medium', meta: `Logistics · ${pick(PLACES)}`, note: 'Budget review', at: 0.36 },
  ],
  followup: [
    { card: deals[3], prio: 'High', meta: `Branding · ${pick(PLACES)}`, note: 'Follow-up Fri 10:00', at: 0.44 },
    { card: deals[4], prio: 'Medium', meta: `Retail · ${pick(PLACES)}`, note: 'Send catalog', at: 0.5, move: true },
  ],
  opp: [
    { card: deals[0], prio: 'High', meta: `Textiles · ${pick(PLACES)}`, note: 'Proposal sent · awaiting PO', at: 0.56 },
    { card: deals[5], prio: 'High', meta: `Energy · ${pick(PLACES)}`, note: 'Contract review', at: 0.62 },
  ],
});

const buildActivity = (people) => [
  { p: people[0], title: 'Opportunity Created', desc: 'New opportunity added to pipeline', text: 'New opportunity added to pipeline', time: '10:12' },
  { p: people[1], title: 'Follow-up Scheduled', desc: `${pick(['Fri 9:30 AM', 'Mon 11:00 AM', 'Wed 13:00'])} · WhatsApp message`, text: 'Follow-up scheduled', time: '09:41' },
  { p: people[2], title: 'Customer Replied', desc: 'Customer replied to walkthrough', text: pick(['Sounds good - lets move ahead', 'We will sign this week', 'Send us the proposal']), time: '09:58' },
];

/* Weighted distribution chart (sums to 100). */
const wDist = (labels) => {
  const ws = labels.map(() => 1 + Math.floor(rnd() * 6));
  const total = ws.reduce((a, b) => a + b, 0);
  const pts = labels.map((label, i) => ({ label, pct: Math.round((ws[i] / total) * 100) }));
  pts[pts.length - 1].pct += 100 - pts.reduce((a, p) => a + p.pct, 0);
  return pts;
};

const buildMetrics = () => ({
  openRate: rand(58, 74),
  replyRate: rand(26, 44),
  qualifyRate: rand(18, 34),
  responseProb: rand(62, 84),
  winRate: rand(30, 48),
  avgDeal: rand(18, 46),
  pipelineValue: rand(180, 640),
  won: rand(4, 12),
  lost: rand(3, 9),
  indDist: wDist(shuffle(SECTORS).slice(0, 4)),
  locDist: wDist(shuffle(PLACES).slice(0, 4)),
});

const build = () => {
  const hero = personaList[0];
  const leadPeople = [hero, ...personaList.slice(1, 5)];
  const leads = buildLeads(leadPeople);

  const chats = buildChats(leadPeople.slice(0, 3));
  const msgs = buildMsgs(chats[0]);

  const dealPeople = [hero, ...personaList.slice(5, 10)];
  const deals = buildDeals(dealPeople);
  const pipelineLead = dealPeople[0];
  const columns = buildColumns(deals);
  const activityPeople = [hero, ...personaList.slice(10, 12)];

  personaList.splice(0, 12);

  const stageN = () => rand(2, 28);
  const stages = [
    ['New Lead', stageN()],
    ['Contacted', stageN()],
    ['Qualified', stageN()],
    ['Follow-up', stageN()],
    ['Opportunity', stageN()],
    ['Won', rand(1, 4)],
  ].map(([label, n]) => ({ label, n }));

  return {
    seed: SEED,
    personaCount: 36,
    found,
    contacts,
    verified,
    dups,
    invalid,
    score,
    conv,
    leads,
    metrics: buildMetrics(),
    verify: { total: contacts, verified, dups, invalid, list: buildVerify(leadPeople.slice(0, 4)) },
    chats,
    chat: {
      name: chats[0].name, img: chats[0].img, meta: chats[0].meta, score, msgs,
      intent: pick(['High intent', 'Budget confirmed', 'Timeline agreed']),
      intentPct: rand(68, 92),
      suggestions: [
        pick(['Send catalog', 'Ask for demo', 'Share pricing']),
        pick(['Schedule call', 'Send proposal', 'Confirm quantity']),
      ],
    },
    qual: {
      name: chats[0].name,
      img: chats[0].img,
      meta: `${chats[0].meta.split(' · ')[0]} · ${pick(['Spain', 'Portugal', 'France', 'Germany', 'Netherlands', 'United Kingdom'])}`,
      score,
    },
    followup: {
      when: pick(['Fri 10:00', 'Mon 11:00', 'Tue 14:00', 'Wed 09:30']),
      kind: pick(['WhatsApp auto-message', 'Email + WhatsApp']),
    },
    pipeline: buildPipeline(pipelineLead),
    deals,
    kanban: {
      columns: [
        { id: 'qualified', label: 'Qualified', count: columns.qualified.length, dot: 'bg-primary', cards: columns.qualified },
        { id: 'followup', label: 'Follow-up', count: columns.followup.length, dot: 'bg-p-mut', cards: columns.followup },
        { id: 'opp', label: 'Opportunity', count: columns.opp.length, dot: 'bg-primary', cards: columns.opp },
      ],
      moveId: columns.followup[1].card.company.brand,
      moveLabel: columns.followup[1].note,
    },
    activity: buildActivity(activityPeople),
    stages,
    stats: { total: contacts, ready: verified, invalid },
  };
};

const DEMO = build();

/* Personas the funnel did NOT consume this load. Gender-verified (u18-u53),
   available for the landing mockups to reuse without colliding with the funnel. */
export const SPARE_POOL = personaList.slice();

if (typeof window !== 'undefined' && typeof window.__DEMO__ === 'undefined') {
  window.__DEMO__ = DEMO;
}

export default DEMO;