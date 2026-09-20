/* Randomized fictional demo dataset for the funnel showcase.
   Built ONCE per page load from a safe persona/brand pool. The same set is
   shared by the desktop pinned scenes and the mobile/tablet card mocks, and is
   never reused from testimonial or discovery sections (guarded below). */

const BLOCKED = new Set([
  // testimonial clients
  'Aisha Rahman', 'Daniel Moreau', 'Priya Sharma', 'Luis Ferreira', 'Hana Yoo',
  'Marco Bellini', 'Lena Vogel', 'Omar Farouk', 'Sofia Reyes', 'Hana Yamamoto',
  'Marco Silva', 'Omar Haddad', 'Farah Noor', 'Adeyemi Okafor', 'Tomas Novak',
  'Aisha Patel', 'Aisha Kim', 'Daniel Okafor', 'Daniel Cruz', 'Priya Nair',
  'Priya Singh', 'Tomas Weber', 'Tomas Berg', 'Adeyemi Banks', 'Adeyemi Cole',
  'Ahmed Mansour', 'Aisha Costa', 'Carlos Rivera', 'Daniel Reid', 'Emma Larsson',
  'Farah Amin', 'Farah Yusuf', 'Grace Park', 'Hana Cho', 'Hana Park', 'James Chen',
  'Lena Fischer', 'Lena Krause', 'Luis Oliveira', 'Luis Santos', 'Marco Bianchi',
  'Marco Rossi', 'Maria Lopez', 'Nina Torres', 'Omar Hassan', 'Omar Khalil',
  'Omar Wells', 'Rachel Stone', 'Sofia Ali', 'Sofia Muller', 'Sofia Werner',
  'Thomas Wright', 'Tomas Park',
  // discovery / message-agent / other mockup people
  'Nadia El-Sayed', 'Omar Reza', 'Sofia Lindqvist', 'Yousef Bitar', 'Rafael Ortega',
  'Amara Diop', 'Sophie Laurent', 'Jonas Lindqvist', 'Mara Bertolini', 'Kemi Adegoke',
  'Diego Fuentes', 'Raees Malik', 'Hana Lee', 'Marcus Webb', 'Petra Novak',
  'Chen Wei', 'Ingrid Berg', 'Omar Malik', 'Sara Ali', 'David Chen', 'Emma Davies',
  'Liam Byrne', 'Noor Jameel', 'Ahmed Raza', 'Elena Petrova', 'Carlos Mendes',
  // shield-scan / agent-app / discovery mockup faces
  'Tariq Haddad', 'Leila Mansour', 'Noah Steinberg', 'Élodie Vasseur',
  'Zara Iqbal', 'Bilal Sheikh', 'Mateo Alves',
  'Noura Salim', 'Yassine Belkadi', 'Amelia Grant',
]);

const OLD_BRANDS = new Set([
  'Golden Thread Imports', 'Aurora Fit-out', 'Nile Freight', 'PixelBrew Studio',
  'Verana Home', 'Canary Works', 'Brightline Solar', 'TerraFit Studio',
  'Maven Cloud', 'Beacon Media', 'CapeFreight',
]);

const SEED = typeof window !== 'undefined' && window.__GOALSHIELD_SEED__ != null
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
   women->u38..u53 (matches the gender-verified downloads). */
const MEN = [
  ['Markus Brandt', 'Solar & Renewables', 'Munich', 'DE', 49],
  ['Tariq Qureshi', 'Architecture', 'Lahore', 'PK', 92],
  ['Youssef Hakim', 'Real Estate', 'Cairo', 'EG', 20],
  ['Elias Virtanen', 'IT Services', 'Helsinki', 'FI', 358],
  ['Arjun Nair', 'Manufacturing', 'Bangalore', 'IN', 91],
  ['Anders Holm', 'SaaS', 'Copenhagen', 'DK', 45],
  ['Pawel Nowak', 'Industrial Machinery', 'Krakow', 'PL', 48],
  ['Viktor Petrov', 'Construction', 'Sofia', 'BG', 359],
  ['Kenji Watanabe', 'Travel & Tourism', 'Tokyo', 'JP', 81],
  ['Dante Moretti', 'Food & Beverage', 'Rome', 'IT', 39],
  ['Bruno Carvalho', 'Automotive', 'Porto', 'PT', 351],
  ['Soren Beck', 'Fintech', 'Copenhagen', 'DK', 45],
  ['Gabor Sipos', 'Construction', 'Budapest', 'HU', 36],
  ['Ravi Patel', 'Healthcare', 'Ahmedabad', 'IN', 91],
  ['Callum Reid', 'E-commerce', 'Glasgow', 'GB', 44],
  ['Nikos Papadakis', 'Hospitality', 'Athens', 'GR', 30],
  ['Filip Novak', 'Logistics', 'Bratislava', 'SK', 421],
  ['Hamza Al-Rashid', 'Manufacturing', 'Muscat', 'OM', 968],
  ['Tobi Oladipo', 'Real Estate', 'Lagos', 'NG', 234],
  ['Mehdi Rastegar', 'Energy', 'Tehran', 'IR', 98],
].map((p, i) => ({
  name: p[0], role: p[1], city: p[2], country: p[3], dial: p[4],
  img: `/avatars-funnel/u${String(18 + i).padStart(2, '0')}.jpg`,
}));

const WOMEN = [
  ['Lina Halldórsdóttir', 'Jewelry Retail', 'Reykjavik', 'IS', 354],
  ['Ines Duarte', 'Interior Design', 'Lisbon', 'PT', 351],
  ['Amel Benali', 'Fashion Retail', 'Tunis', 'TN', 216],
  ['Eszter Kovacs', 'Architecture', 'Budapest', 'HU', 36],
  ['Silje Berg', 'E-commerce', 'Oslo', 'NO', 47],
  ['Camille Dubois', 'Beauty & Wellness', 'Nice', 'FR', 33],
  ['Aylin Günes', 'Textiles', 'Istanbul', 'TR', 90],
  ['Freya Ostergaard', 'Retail', 'Aarhus', 'DK', 45],
  ['Zara Mahmood', 'Education', 'Doha', 'QA', 974],
  ['Elif Demir', 'Boutique', 'Antalya', 'TR', 90],
  ['Aino Korpela', 'Health & Wellness', 'Helsinki', 'FI', 358],
  ['Maja Kowalska', 'Interior Design', 'Warsaw', 'PL', 48],
  ['Tine Sorensen', 'Beauty', 'Odense', 'DK', 45],
  ['Leila Haddad', 'Fashion', 'Beirut', 'LB', 961],
  ['Astrid Vik', 'Software', 'Bergen', 'NO', 47],
  ['Giulia Ricci', 'Food & Beverage', 'Florence', 'IT', 39],
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
const GULF = ['Dubai', 'Riyadh', 'Doha', 'Jeddah', 'Abu Dhabi', 'Manama', 'Muscat', 'Kuwait City'];

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

const buildVerify = (list) => shuffle(['ready', 'ready', 'dup', 'invalid']).slice(0, 4)
  .map((status, i) => {
    const p = list[i];
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

const buildChats = (list) => [
  { p: list[0], active: true, when: '10:06', last: pick(['Sent a catalog - ready?', 'Shared requirements', 'Wants a demo call']) },
  { p: list[1], active: false, when: '09:44', last: pick(['Pricing request received', 'Asked about bulk orders']) },
  { p: list[2], active: false, when: '09:12', last: pick(['Asked about bulk orders', 'Follow up this week']) },
].map((c) => ({
  name: c.p.name,
  img: c.p.img,
  role: c.p.role,
  meta: `${c.p.role} · ${pick(['IT', 'ES', 'DE', 'PT', 'AE', 'NO', 'DK', 'PL'])}`,
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
}));

const buildPipeline = (leadPersona) => ({
  p: leadPersona,
  tags: [pick(['Importer', 'Retail chain', 'Distributor', 'Franchise']), pick(['Repeat buyer', 'Approved budget', 'Signing soon']), 'High intent'],
});

const buildColumns = (deals) => ({
  qualified: [
    { card: deals[1], prio: 'High', meta: `Interiors · ${pick(GULF)}`, note: 'Asked for proposal', at: 0.3 },
    { card: deals[2], prio: 'Medium', meta: `Logistics · ${pick(GULF)}`, note: 'Budget review', at: 0.36 },
  ],
  followup: [
    { card: deals[3], prio: 'High', meta: `Branding · ${pick(GULF)}`, note: 'Follow-up Fri 10:00', at: 0.44 },
    { card: deals[4], prio: 'Medium', meta: `Retail · ${pick(GULF)}`, note: 'Send catalog', at: 0.5, move: true },
  ],
  opp: [
    { card: deals[0], prio: 'High', meta: `Textiles · Istanbul`, note: 'Proposal sent · awaiting PO', at: 0.56 },
    { card: deals[5], prio: 'High', meta: `Energy · ${pick(GULF)}`, note: 'Contract review', at: 0.62 },
  ],
});

const buildActivity = (people) => [
  { p: people[0], title: 'Opportunity Created', desc: 'New opportunity added to pipeline', time: '10:12' },
  { p: people[1], title: 'Follow-up Scheduled', desc: `${pick(['Fri 9:30 AM', 'Mon 11:00 AM', 'Wed 13:00'])} · WhatsApp message`, time: '09:41' },
  { p: people[2], title: 'Customer Replied', desc: pick(['Sounds good - lets move ahead', 'We will sign this week', 'Send us the proposal']), time: '09:58' },
];

const build = () => {
  const leads = buildLeads(takeN(5));
  const verifyList = buildVerify(takeN(4));
  const chatList = takeN(3);
  const chats = buildChats(chatList);
  const msgs = buildMsgs(chats[0]);

  const dealPersonas = takeN(6);
  const deals = buildDeals(dealPersonas);
  const pipelineLead = buildPipeline(dealPersonas[0]);
  const columns = buildColumns(deals);
  const activityPersonas = takeN(3);

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
    personaCount: personaList.length + 21,
    found,
    contacts,
    verified,
    dups,
    invalid,
    score,
    conv,
    leads,
    verify: { total: contacts, verified, dups, invalid, list: verifyList },
    chats,
    chat: { name: chats[0].name, img: chats[0].img, meta: chats[0].meta, score, msgs },
    qual: {
      name: chats[0].name,
      img: chats[0].img,
      meta: `${chats[0].meta.split(' · ')[0]} · ${pick(['Spain', 'Portugal', 'Denmark', 'Austria', 'Italy'])}`,
      score,
    },
    pipeline: pipelineLead,
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
    activity: buildActivity(activityPersonas),
    stages,
    stats: { total: contacts, ready: verified, invalid },
  };
};

const DEMO = build();

if (typeof window !== 'undefined' && typeof window.__DEMO__ === 'undefined') {
  window.__DEMO__ = DEMO;
}

export default DEMO;