import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { BCRYPT_COST, STORAGE_PREFIX } from '../src/config/constants.js';
import { disconnectPrisma, prisma } from '../src/config/prisma.js';
import { logger } from '../src/utils/logger.js';

/**
 * Seed data per Section 10. Idempotent: every row has a deterministic id
 * derived from a stable name, so re-running updates rows in place instead of
 * duplicating them.
 *
 * Nothing here uses `Math.random()` or the current clock. Dates are fixed
 * literals, which keeps two runs byte-identical and keeps review screenshots
 * stable.
 *
 * Copy in this file follows Section 1.3: the group-purchase properties are
 * described as opportunities to register interest in, and no row states or
 * implies a financial-performance figure.
 */

/** Fixed namespace for the UUIDv5 derivation below. Never change it — every seeded id depends on it. */
const SEED_NAMESPACE = 'b9f1e3a4-6c25-4a3e-9d1f-2b7c8e5a40d1';

/**
 * Derives a stable UUIDv5 from a name, so `upsert` has something to key on for
 * tables whose rows have no natural unique column.
 * @param {string} name stable identifier, e.g. `property:kazhakkoottam-10-cent`
 * @returns {string} RFC 4122 version 5 UUID
 */
const seedId = (name) => {
  const namespaceBytes = Buffer.from(SEED_NAMESPACE.replaceAll('-', ''), 'hex');
  const digest = createHash('sha1')
    .update(Buffer.concat([namespaceBytes, Buffer.from(name, 'utf8')]))
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};

/** Shared password for every seeded account (Section 10). */
const SEED_PASSWORD = 'Password123';

const USERS = [
  {
    key: 'admin',
    email: 'admin@estate.test',
    fullName: 'Radhika Menon',
    role: 'ADMIN',
    phone: '+91 98470 10001',
  },
  {
    key: 'agent1',
    email: 'agent.anil@estate.test',
    fullName: 'Anil Kuruppath',
    role: 'AGENT',
    phone: '+91 98470 10002',
  },
  {
    key: 'agent2',
    email: 'agent.divya@estate.test',
    fullName: 'Divya Raveendran',
    role: 'AGENT',
    phone: '+91 98470 10003',
  },
  {
    key: 'sub1',
    email: 'meera@example.test',
    fullName: 'Meera Krishnan',
    role: 'SUBSCRIBER',
    phone: '+91 98470 20001',
  },
  {
    key: 'sub2',
    email: 'joseph@example.test',
    fullName: 'Joseph Mathew',
    role: 'SUBSCRIBER',
    phone: '+91 98470 20002',
  },
  {
    key: 'sub3',
    email: 'fathima@example.test',
    fullName: 'Fathima Beevi',
    role: 'SUBSCRIBER',
    phone: '+91 98470 20003',
  },
  {
    key: 'sub4',
    email: 'suresh@example.test',
    fullName: 'Suresh Pillai',
    role: 'SUBSCRIBER',
    phone: null,
  },
  {
    key: 'sub5',
    email: 'anjali@example.test',
    fullName: 'Anjali Nair',
    role: 'SUBSCRIBER',
    phone: '+91 98470 20005',
  },
];

/**
 * 24 plots across the three southern districts, with localities and coordinates
 * that fall where they claim to. Prices are plausible for the locality; land in
 * Kerala is quoted per cent (1 cent = 435.6 sq ft).
 */
const PROPERTIES = [
  // --- Thiruvananthapuram district (9) -------------------------------------
  {
    slug: 'kazhakkoottam-technopark-10-cent',
    title: 'Ten cent plot near Technopark, Kazhakkoottam',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '5800000',
    area: '10',
    unit: 'CENT',
    locality: 'Kazhakkoottam',
    city: 'Thiruvananthapuram',
    district: 'Thiruvananthapuram',
    pincode: '695582',
    lat: 8.5686,
    lng: 76.8756,
    survey: '142/3B',
    agent: 'agent1',
    group: false,
    negotiable: true,
    amenities: ['Road frontage', 'Electricity', 'Compound wall'],
  },
  {
    slug: 'sreekaryam-residential-6-cent',
    title: 'Six cent residential plot at Sreekaryam',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '4200000',
    area: '6',
    unit: 'CENT',
    locality: 'Sreekaryam',
    city: 'Thiruvananthapuram',
    district: 'Thiruvananthapuram',
    pincode: '695017',
    lat: 8.5566,
    lng: 76.9186,
    survey: '77/12',
    agent: 'agent1',
    group: false,
    negotiable: false,
    amenities: ['Well', 'Road frontage'],
  },
  {
    slug: 'vattiyoorkavu-hillside-14-cent',
    title: 'Fourteen cent hillside plot, Vattiyoorkavu',
    type: 'PLOT',
    status: 'UNDER_OFFER',
    price: '7100000',
    area: '14',
    unit: 'CENT',
    locality: 'Vattiyoorkavu',
    city: 'Thiruvananthapuram',
    district: 'Thiruvananthapuram',
    pincode: '695013',
    lat: 8.5286,
    lng: 76.97,
    survey: '203/1A',
    agent: 'agent2',
    group: false,
    negotiable: true,
    amenities: ['Borewell', 'Coconut trees', 'Electricity'],
  },
  {
    slug: 'nedumangad-garden-land-1-acre',
    title: 'One acre garden land at Nedumangad',
    type: 'FARMLAND',
    status: 'AVAILABLE',
    price: '9500000',
    area: '1',
    unit: 'ACRE',
    locality: 'Nedumangad',
    city: 'Nedumangad',
    district: 'Thiruvananthapuram',
    pincode: '695541',
    lat: 8.6027,
    lng: 77.0035,
    survey: '318/4',
    agent: 'agent1',
    group: true,
    negotiable: true,
    amenities: ['Rubber trees', 'Well', 'Farm road'],
  },
  {
    slug: 'varkala-cliffside-8-cent',
    title: 'Eight cent plot near Varkala cliff',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '8800000',
    area: '8',
    unit: 'CENT',
    locality: 'Varkala',
    city: 'Varkala',
    district: 'Thiruvananthapuram',
    pincode: '695141',
    lat: 8.7379,
    lng: 76.7163,
    survey: '55/7C',
    agent: 'agent2',
    group: true,
    negotiable: false,
    amenities: ['Sea view', 'Road frontage', 'Electricity'],
  },
  {
    slug: 'kovalam-beach-road-12-cent',
    title: 'Twelve cent plot off Kovalam beach road',
    type: 'PLOT',
    status: 'SOLD',
    price: '13200000',
    area: '12',
    unit: 'CENT',
    locality: 'Kovalam',
    city: 'Thiruvananthapuram',
    district: 'Thiruvananthapuram',
    pincode: '695527',
    lat: 8.3988,
    lng: 76.9782,
    survey: '91/2',
    agent: 'agent2',
    group: false,
    negotiable: false,
    amenities: ['Compound wall', 'Borewell'],
  },
  {
    slug: 'balaramapuram-handloom-house',
    title: 'Three bedroom house on 7 cent, Balaramapuram',
    type: 'HOUSE',
    status: 'AVAILABLE',
    price: '6400000',
    area: '7',
    unit: 'CENT',
    locality: 'Balaramapuram',
    city: 'Balaramapuram',
    district: 'Thiruvananthapuram',
    pincode: '695501',
    lat: 8.4111,
    lng: 77.023,
    survey: '128/9',
    agent: 'agent1',
    group: false,
    negotiable: true,
    amenities: ['Car porch', 'Well', 'Compound wall'],
  },
  {
    slug: 'vellanad-rubber-estate-2-acre',
    title: 'Two acre rubber holding at Vellanad',
    type: 'FARMLAND',
    status: 'AVAILABLE',
    price: '14500000',
    area: '2',
    unit: 'ACRE',
    locality: 'Vellanad',
    city: 'Vellanad',
    district: 'Thiruvananthapuram',
    pincode: '695543',
    lat: 8.5461,
    lng: 77.0653,
    survey: '402/1',
    agent: 'agent1',
    group: true,
    negotiable: true,
    amenities: ['Rubber trees', 'Farm road', 'Stream boundary'],
  },
  {
    slug: 'attingal-highway-frontage-9-cent',
    title: 'Nine cent plot with highway frontage, Attingal',
    type: 'COMMERCIAL',
    status: 'DRAFT',
    price: '10200000',
    area: '9',
    unit: 'CENT',
    locality: 'Attingal',
    city: 'Attingal',
    district: 'Thiruvananthapuram',
    pincode: '695101',
    lat: 8.6963,
    lng: 76.8161,
    survey: '17/5B',
    agent: 'agent2',
    group: false,
    negotiable: true,
    amenities: ['NH frontage', 'Electricity'],
  },

  // --- Kollam district (8) --------------------------------------------------
  {
    slug: 'kottiyam-junction-8-cent',
    title: 'Eight cent plot near Kottiyam junction',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '3900000',
    area: '8',
    unit: 'CENT',
    locality: 'Kottiyam',
    city: 'Kollam',
    district: 'Kollam',
    pincode: '691571',
    lat: 8.848,
    lng: 76.706,
    survey: '64/3',
    agent: 'agent2',
    group: false,
    negotiable: true,
    amenities: ['Road frontage', 'Well'],
  },
  {
    slug: 'chathannoor-quiet-lane-11-cent',
    title: 'Eleven cent plot on a quiet lane, Chathannoor',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '4400000',
    area: '11',
    unit: 'CENT',
    locality: 'Chathannoor',
    city: 'Chathannoor',
    district: 'Kollam',
    pincode: '691572',
    lat: 8.8386,
    lng: 76.7523,
    survey: '112/6A',
    agent: 'agent1',
    group: false,
    negotiable: false,
    amenities: ['Coconut trees', 'Borewell'],
  },
  {
    slug: 'karunagappally-backwater-15-cent',
    title: 'Fifteen cent plot near Karunagappally backwaters',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '6100000',
    area: '15',
    unit: 'CENT',
    locality: 'Karunagappally',
    city: 'Karunagappally',
    district: 'Kollam',
    pincode: '690518',
    lat: 9.0544,
    lng: 76.5343,
    survey: '221/2C',
    agent: 'agent2',
    group: true,
    negotiable: true,
    amenities: ['Water frontage', 'Coconut trees', 'Road access'],
  },
  {
    slug: 'punalur-town-5-cent',
    title: 'Five cent plot in Punalur town',
    type: 'PLOT',
    status: 'UNDER_OFFER',
    price: '2300000',
    area: '5',
    unit: 'CENT',
    locality: 'Punalur',
    city: 'Punalur',
    district: 'Kollam',
    pincode: '691305',
    lat: 9.0119,
    lng: 76.9268,
    survey: '39/8',
    agent: 'agent1',
    group: false,
    negotiable: false,
    amenities: ['Town water', 'Electricity'],
  },
  {
    slug: 'paravur-lake-view-10-cent',
    title: 'Ten cent plot with lake view, Paravur',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '5200000',
    area: '10',
    unit: 'CENT',
    locality: 'Paravur',
    city: 'Paravur',
    district: 'Kollam',
    pincode: '691301',
    lat: 8.8095,
    lng: 76.6669,
    survey: '156/1',
    agent: 'agent2',
    group: false,
    negotiable: true,
    amenities: ['Lake view', 'Compound wall', 'Well'],
  },
  {
    slug: 'kundara-industrial-belt-20-cent',
    title: 'Twenty cent plot in the Kundara belt',
    type: 'COMMERCIAL',
    status: 'AVAILABLE',
    price: '8700000',
    area: '20',
    unit: 'CENT',
    locality: 'Kundara',
    city: 'Kundara',
    district: 'Kollam',
    pincode: '691501',
    lat: 8.9367,
    lng: 76.6786,
    survey: '88/4B',
    agent: 'agent1',
    group: true,
    negotiable: true,
    amenities: ['Three phase power', 'Lorry access'],
  },
  {
    slug: 'chavara-coastal-7-cent',
    title: 'Seven cent coastal plot at Chavara',
    type: 'PLOT',
    status: 'WITHDRAWN',
    price: '3100000',
    area: '7',
    unit: 'CENT',
    locality: 'Chavara',
    city: 'Chavara',
    district: 'Kollam',
    pincode: '691583',
    lat: 8.9709,
    lng: 76.5378,
    survey: '73/2',
    agent: 'agent2',
    group: false,
    negotiable: false,
    amenities: ['Road frontage'],
  },
  {
    slug: 'anchal-hill-plot-13-cent',
    title: 'Thirteen cent hill plot at Anchal',
    type: 'PLOT',
    status: 'DRAFT',
    price: '3600000',
    area: '13',
    unit: 'CENT',
    locality: 'Anchal',
    city: 'Anchal',
    district: 'Kollam',
    pincode: '691306',
    lat: 8.879,
    lng: 76.92,
    survey: '245/7',
    agent: 'agent1',
    group: false,
    negotiable: true,
    amenities: ['Well', 'Jackfruit trees'],
  },

  // --- Alappuzha district (7) ----------------------------------------------
  {
    slug: 'cherthala-town-9-cent',
    title: 'Nine cent plot near Cherthala town',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '4900000',
    area: '9',
    unit: 'CENT',
    locality: 'Cherthala',
    city: 'Cherthala',
    district: 'Alappuzha',
    pincode: '688524',
    lat: 9.6845,
    lng: 76.3363,
    survey: '61/5',
    agent: 'agent2',
    group: false,
    negotiable: true,
    amenities: ['Road frontage', 'Electricity', 'Well'],
  },
  {
    slug: 'kayamkulam-paddy-adjacent-1-acre',
    title: 'One acre beside paddy fields, Kayamkulam',
    type: 'FARMLAND',
    status: 'AVAILABLE',
    price: '7300000',
    area: '1',
    unit: 'ACRE',
    locality: 'Kayamkulam',
    city: 'Kayamkulam',
    district: 'Alappuzha',
    pincode: '690502',
    lat: 9.1795,
    lng: 76.501,
    survey: '190/3',
    agent: 'agent1',
    group: true,
    negotiable: true,
    amenities: ['Canal irrigation', 'Farm road'],
  },
  {
    slug: 'mavelikkara-temple-road-6-cent',
    title: 'Six cent plot on temple road, Mavelikkara',
    type: 'PLOT',
    status: 'SOLD',
    price: '2900000',
    area: '6',
    unit: 'CENT',
    locality: 'Mavelikkara',
    city: 'Mavelikkara',
    district: 'Alappuzha',
    pincode: '690101',
    lat: 9.2593,
    lng: 76.5544,
    survey: '104/2A',
    agent: 'agent2',
    group: false,
    negotiable: false,
    amenities: ['Town water', 'Compound wall'],
  },
  {
    slug: 'haripad-residential-8-cent',
    title: 'Eight cent residential plot at Haripad',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '3400000',
    area: '8',
    unit: 'CENT',
    locality: 'Haripad',
    city: 'Haripad',
    district: 'Alappuzha',
    pincode: '690514',
    lat: 9.2865,
    lng: 76.46,
    survey: '132/1B',
    agent: 'agent1',
    group: false,
    negotiable: true,
    amenities: ['Well', 'Road access'],
  },
  {
    slug: 'ambalappuzha-seaside-11-cent',
    title: 'Eleven cent plot near Ambalappuzha',
    type: 'PLOT',
    status: 'AVAILABLE',
    price: '4600000',
    area: '11',
    unit: 'CENT',
    locality: 'Ambalappuzha',
    city: 'Ambalappuzha',
    district: 'Alappuzha',
    pincode: '688561',
    lat: 9.3799,
    lng: 76.3468,
    survey: '48/9',
    agent: 'agent2',
    group: false,
    negotiable: false,
    amenities: ['Coconut trees', 'Road frontage'],
  },
  {
    slug: 'chengannur-station-apartment',
    title: 'Two bedroom apartment near Chengannur station',
    type: 'APARTMENT',
    status: 'AVAILABLE',
    price: '5500000',
    area: '1150',
    unit: 'SQFT',
    locality: 'Chengannur',
    city: 'Chengannur',
    district: 'Alappuzha',
    pincode: '689121',
    lat: 9.3164,
    lng: 76.6151,
    survey: null,
    agent: 'agent1',
    group: false,
    negotiable: false,
    amenities: ['Lift', 'Covered parking', 'Power backup'],
  },
  {
    slug: 'mararikulam-beach-belt-16-cent',
    title: 'Sixteen cent plot in the Mararikulam beach belt',
    type: 'PLOT',
    status: 'SOLD',
    price: '9900000',
    area: '16',
    unit: 'CENT',
    locality: 'Mararikulam',
    city: 'Mararikulam',
    district: 'Alappuzha',
    pincode: '688549',
    lat: 9.6042,
    lng: 76.3115,
    survey: '29/4C',
    agent: 'agent2',
    group: false,
    negotiable: true,
    amenities: ['Beach access', 'Compound wall', 'Borewell'],
  },
];

/** Group-purchase properties carry these two amounts; both are indicative only. */
const GROUP_AMOUNTS = Object.freeze({
  'nedumangad-garden-land-1-acre': { target: '9500000', minTicket: '950000' },
  'varkala-cliffside-8-cent': { target: '8800000', minTicket: '1100000' },
  'vellanad-rubber-estate-2-acre': { target: '14500000', minTicket: '1450000' },
  'karunagappally-backwater-15-cent': { target: '6100000', minTicket: '760000' },
  'kundara-industrial-belt-20-cent': { target: '8700000', minTicket: '1080000' },
  'kayamkulam-paddy-adjacent-1-acre': { target: '7300000', minTicket: '730000' },
});

/** Fixed publication dates, one per property index, so ordering is stable. */
const PUBLISHED_DATES = [
  '2026-01-12',
  '2026-01-28',
  '2026-02-04',
  '2026-02-17',
  '2026-02-25',
  '2026-03-03',
  '2026-03-14',
  '2026-03-22',
  '2026-03-30',
  '2026-04-06',
  '2026-04-15',
  '2026-04-21',
  '2026-04-29',
  '2026-05-05',
  '2026-05-13',
  '2026-05-19',
  '2026-05-27',
  '2026-06-02',
  '2026-06-10',
  '2026-06-16',
  '2026-06-24',
  '2026-07-01',
  '2026-07-08',
  '2026-07-15',
];

/** Descriptions keyed by property type, so every listing reads like a record rather than an advert. */
const DESCRIPTION_BY_TYPE = {
  PLOT: 'Dry, level land with clear title and a measured boundary. Survey sketch and tax receipts are available for inspection at the office. The agency can arrange a site visit on a weekday morning.',
  // "Cultivation records" rather than the agricultural sense of "yield": all
  // three farmland plots are group-purchase opportunities, and on that page the
  // word would read as a financial figure (Section 1.3).
  FARMLAND:
    'Cultivated holding with an existing access road. Cultivation records and the latest land tax receipt are held on file. Boundary stones were verified during the last inspection.',
  HOUSE:
    'Well maintained house on a walled plot, currently vacant. Building permit, occupancy certificate and tax receipts are on file. Viewing by appointment.',
  COMMERCIAL:
    'Commercial frontage with three phase power available at the boundary. Zoning details and the approved sketch can be reviewed at the office.',
  APARTMENT:
    'Apartment in a completed block with a functioning residents association. Maintenance dues are settled to date and the parcel deed is available for inspection.',
};

const ENQUIRIES = [
  {
    key: 'e01',
    slug: 'kazhakkoottam-technopark-10-cent',
    user: 'sub1',
    status: 'NEW',
    agent: null,
    name: 'Meera Krishnan',
    email: 'meera@example.test',
    phone: '+91 98470 20001',
    message:
      'Is the survey sketch available for this plot? I would like to check the boundary before visiting.',
    notes: null,
    day: '2026-07-02',
  },
  {
    key: 'e02',
    slug: 'kazhakkoottam-technopark-10-cent',
    user: null,
    status: 'CONTACTED',
    agent: 'agent1',
    name: 'Rahul Varma',
    email: 'rahul.varma@example.test',
    phone: '+91 90370 44112',
    message:
      'Please share the exact frontage measurement and whether the road is panchayat maintained.',
    notes: 'Called on 3 July. Sending the sketch by email.',
    day: '2026-07-03',
  },
  {
    key: 'e03',
    slug: 'sreekaryam-residential-6-cent',
    user: 'sub2',
    status: 'QUALIFIED',
    agent: 'agent1',
    name: 'Joseph Mathew',
    email: 'joseph@example.test',
    phone: '+91 98470 20002',
    message:
      'We are looking for six to eight cent in this area for a family home. Is the price negotiable?',
    notes: 'Budget confirmed. Wants a Saturday visit.',
    day: '2026-06-21',
  },
  {
    key: 'e04',
    slug: 'varkala-cliffside-8-cent',
    user: 'sub3',
    status: 'NEW',
    agent: null,
    name: 'Fathima Beevi',
    email: 'fathima@example.test',
    phone: '+91 98470 20003',
    message: 'How far is this plot from the beach road, and is there a separate access path?',
    notes: null,
    day: '2026-07-11',
  },
  {
    key: 'e05',
    slug: 'kovalam-beach-road-12-cent',
    user: null,
    status: 'CLOSED',
    agent: 'agent2',
    name: 'Sandeep Nambiar',
    email: 'sandeep.n@example.test',
    phone: '+91 94470 88231',
    message: 'Is this plot still on the market? I enquired last month as well.',
    notes: 'Plot sold. Enquirer informed and offered alternatives at Kovalam.',
    day: '2026-05-14',
  },
  {
    key: 'e06',
    slug: 'nedumangad-garden-land-1-acre',
    user: 'sub4',
    status: 'CONTACTED',
    agent: 'agent1',
    name: 'Suresh Pillai',
    email: 'suresh@example.test',
    phone: '+91 93880 15522',
    message:
      'Interested in the group purchase opportunity here. How does the agency handle the paperwork?',
    notes:
      'Explained that the register records interest only and the agency follows up individually.',
    day: '2026-06-30',
  },
  {
    key: 'e07',
    slug: 'kottiyam-junction-8-cent',
    user: null,
    status: 'NEW',
    agent: null,
    name: 'Lakshmi Devi',
    email: 'lakshmi.d@example.test',
    phone: null,
    message: 'Please tell me the pincode and the nearest landmark so I can find the plot on a map.',
    notes: null,
    day: '2026-07-19',
  },
  {
    key: 'e08',
    slug: 'karunagappally-backwater-15-cent',
    user: 'sub5',
    status: 'QUALIFIED',
    agent: 'agent2',
    name: 'Anjali Nair',
    email: 'anjali@example.test',
    phone: '+91 98470 20005',
    message: 'Does the water frontage flood during the monsoon? Any record of the water level?',
    notes: 'Shared the last two inspection notes. Site visit requested for August.',
    day: '2026-07-08',
  },
  {
    key: 'e09',
    slug: 'punalur-town-5-cent',
    user: null,
    status: 'CONTACTED',
    agent: 'agent1',
    name: 'Thomas Kurian',
    email: 'thomas.k@example.test',
    phone: '+91 90480 33119',
    message: 'Is town water connected already or does it need a new application?',
    notes: 'Connection exists. Awaiting the buyer decision.',
    day: '2026-06-11',
  },
  {
    key: 'e10',
    slug: 'kundara-industrial-belt-20-cent',
    user: 'sub2',
    status: 'NEW',
    agent: null,
    name: 'Joseph Mathew',
    email: 'joseph@example.test',
    phone: '+91 98470 20002',
    message: 'What is the load sanctioned for the three phase connection at the boundary?',
    notes: null,
    day: '2026-07-22',
  },
  {
    key: 'e11',
    slug: 'cherthala-town-9-cent',
    user: null,
    status: 'NEW',
    agent: null,
    name: 'Priya Sasidharan',
    email: 'priya.s@example.test',
    phone: '+91 99610 77004',
    message: 'Can I see the tax receipt and the previous deed before arranging a visit?',
    notes: null,
    day: '2026-07-24',
  },
  {
    key: 'e12',
    slug: 'mavelikkara-temple-road-6-cent',
    user: 'sub1',
    status: 'CLOSED',
    agent: 'agent2',
    name: 'Meera Krishnan',
    email: 'meera@example.test',
    phone: '+91 98470 20001',
    message: 'Has this plot been sold? It still shows on the site.',
    notes: 'Confirmed sold in June. Listing status updated.',
    day: '2026-06-28',
  },
  {
    key: 'e13',
    slug: 'haripad-residential-8-cent',
    user: 'sub3',
    status: 'CONTACTED',
    agent: 'agent1',
    name: 'Fathima Beevi',
    email: 'fathima@example.test',
    phone: '+91 98470 20003',
    message: 'Is there an approved layout for this plot, and what is the road width?',
    notes: 'Layout copy sent. Road is 4.5 metres.',
    day: '2026-07-05',
  },
  {
    key: 'e14',
    slug: 'chengannur-station-apartment',
    user: null,
    status: 'NEW',
    agent: null,
    name: 'George Philip',
    email: 'george.p@example.test',
    phone: '+91 94960 20087',
    message: 'What are the monthly maintenance dues for this apartment?',
    notes: null,
    day: '2026-07-26',
  },
  {
    key: 'e15',
    slug: 'vellanad-rubber-estate-2-acre',
    user: 'sub4',
    status: 'QUALIFIED',
    agent: 'agent2',
    name: 'Suresh Pillai',
    email: 'suresh@example.test',
    phone: '+91 93880 15522',
    message: 'How many trees are tappable at present, and when was the last inspection?',
    notes: 'Sent the June inspection note. Serious enquiry.',
    day: '2026-07-14',
  },
];

const SITE_VISITS = [
  {
    key: 'v1',
    slug: 'kazhakkoottam-technopark-10-cent',
    user: 'sub1',
    date: '2026-08-08',
    slot: 'MORNING',
    status: 'CONFIRMED',
    confirmed: '2026-07-27T05:30:00.000Z',
    phone: '+91 98470 20001',
    notes: 'Confirmed for 9am. Meet at the junction.',
  },
  {
    key: 'v2',
    slug: 'sreekaryam-residential-6-cent',
    user: 'sub2',
    date: '2026-08-15',
    slot: 'AFTERNOON',
    status: 'REQUESTED',
    confirmed: null,
    phone: '+91 98470 20002',
    notes: null,
  },
  {
    key: 'v3',
    slug: 'varkala-cliffside-8-cent',
    user: 'sub3',
    date: '2026-07-18',
    slot: 'MORNING',
    status: 'COMPLETED',
    confirmed: '2026-07-14T04:45:00.000Z',
    phone: '+91 98470 20003',
    notes: 'Visited with family. Asked for the neighbouring plot details as well.',
  },
  {
    key: 'v4',
    slug: 'karunagappally-backwater-15-cent',
    user: 'sub5',
    date: '2026-08-22',
    slot: 'MORNING',
    status: 'REQUESTED',
    confirmed: null,
    phone: '+91 98470 20005',
    notes: null,
  },
  {
    key: 'v5',
    slug: 'kottiyam-junction-8-cent',
    user: 'sub4',
    date: '2026-07-11',
    slot: 'EVENING',
    status: 'CANCELLED',
    confirmed: '2026-07-08T09:00:00.000Z',
    phone: null,
    notes: 'Cancelled by the subscriber the previous evening.',
  },
  {
    key: 'v6',
    slug: 'cherthala-town-9-cent',
    user: 'sub1',
    date: '2026-07-04',
    slot: 'AFTERNOON',
    status: 'NO_SHOW',
    confirmed: '2026-07-01T06:15:00.000Z',
    phone: '+91 98470 20001',
    notes: 'Agent waited 40 minutes. No contact.',
  },
  {
    key: 'v7',
    slug: 'haripad-residential-8-cent',
    user: 'sub3',
    date: '2026-08-05',
    slot: 'MORNING',
    status: 'CONFIRMED',
    confirmed: '2026-07-28T04:00:00.000Z',
    phone: '+91 98470 20003',
    notes: 'Confirmed. Bring the survey sketch.',
  },
  {
    key: 'v8',
    slug: 'vellanad-rubber-estate-2-acre',
    user: 'sub4',
    date: '2026-06-20',
    slot: 'MORNING',
    status: 'COMPLETED',
    confirmed: '2026-06-17T05:00:00.000Z',
    phone: '+91 93880 15522',
    notes: 'Walked the boundary with the owner present.',
  },
];

const INTERESTS = [
  {
    key: 'i01',
    slug: 'nedumangad-garden-land-1-acre',
    user: 'sub1',
    amount: '1200000',
    status: 'NEW',
    notes: 'Would like to join with two family members. Please call after 6pm.',
    agentNotes: null,
    day: '2026-07-06',
  },
  {
    key: 'i02',
    slug: 'nedumangad-garden-land-1-acre',
    user: 'sub4',
    amount: '950000',
    status: 'CONTACTED',
    notes: 'Registering interest at the minimum indicative amount for now.',
    agentNotes: 'Spoke on 8 July. Wants to see the boundary first.',
    day: '2026-07-07',
  },
  {
    key: 'i03',
    slug: 'varkala-cliffside-8-cent',
    user: 'sub3',
    amount: '2200000',
    status: 'QUALIFIED',
    notes: 'Prefer the portion closer to the road.',
    agentNotes: 'Documents verified. Ready for the next step when the group is formed.',
    day: '2026-06-25',
  },
  {
    key: 'i04',
    slug: 'varkala-cliffside-8-cent',
    user: 'sub5',
    amount: '1100000',
    status: 'NEW',
    notes: null,
    agentNotes: null,
    day: '2026-07-12',
  },
  {
    key: 'i05',
    slug: 'vellanad-rubber-estate-2-acre',
    user: 'sub4',
    amount: '2900000',
    status: 'CONTACTED',
    notes: 'Interested if the tappable tree count is confirmed.',
    agentNotes: 'Sent the inspection note. Following up next week.',
    day: '2026-07-15',
  },
  {
    key: 'i06',
    slug: 'vellanad-rubber-estate-2-acre',
    user: 'sub2',
    amount: null,
    status: 'WITHDRAWN',
    notes: 'Registering interest to learn more; no amount decided yet.',
    agentNotes: 'Withdrew on 20 July — bought elsewhere.',
    day: '2026-07-02',
  },
  {
    key: 'i07',
    slug: 'karunagappally-backwater-15-cent',
    user: 'sub5',
    amount: '760000',
    status: 'NEW',
    notes: 'Please share the monsoon water level records.',
    agentNotes: null,
    day: '2026-07-20',
  },
  {
    key: 'i08',
    slug: 'kundara-industrial-belt-20-cent',
    user: 'sub2',
    amount: '1080000',
    status: 'QUALIFIED',
    notes: 'Looking for a godown site with lorry access.',
    agentNotes: 'Requirement matches. Awaiting the group to reach the indicative target.',
    day: '2026-06-18',
  },
  {
    key: 'i09',
    slug: 'kundara-industrial-belt-20-cent',
    user: 'sub1',
    amount: '1500000',
    status: 'CLOSED',
    notes: 'Interested subject to the power load being confirmed.',
    agentNotes: 'Load was lower than required. Enquiry closed with the subscriber informed.',
    day: '2026-06-05',
  },
  {
    key: 'i10',
    slug: 'kayamkulam-paddy-adjacent-1-acre',
    user: 'sub3',
    amount: '730000',
    status: 'NEW',
    notes: 'Would like to see the canal irrigation arrangement.',
    agentNotes: null,
    day: '2026-07-23',
  },
];

/** Which plots subscriber #1 owns, per Section 10: one solely, one at a 40% share. */
const OWNERSHIPS = [
  {
    key: 'o1',
    slug: 'kovalam-beach-road-12-cent',
    user: 'sub1',
    share: '100.00',
    registeredOn: '2024-11-18',
    ref: 'TVM/KVM/2024/1182',
    notes: 'Sole ownership. Original deed held by the owner; office holds a certified copy.',
  },
  {
    key: 'o2',
    slug: 'mararikulam-beach-belt-16-cent',
    user: 'sub1',
    share: '40.00',
    registeredOn: '2025-03-04',
    ref: 'ALP/MRK/2025/0417',
    notes: 'Joint purchase recorded as a 40% share.',
  },
  // Co-owner, so the shares on that plot total exactly 100%.
  {
    key: 'o3',
    slug: 'mararikulam-beach-belt-16-cent',
    user: 'sub2',
    share: '60.00',
    registeredOn: '2025-03-04',
    ref: 'ALP/MRK/2025/0418',
    notes: 'Joint purchase recorded as a 60% share.',
  },
];

/** Four management logs for each owned plot (Section 10). */
const LOG_TEMPLATES = [
  {
    type: 'INSPECTION',
    title: 'Quarterly boundary inspection',
    notes:
      'All four boundary stones located and photographed. No encroachment observed. Fence line intact.',
    visible: true,
  },
  {
    type: 'MAINTENANCE',
    title: 'Undergrowth cleared',
    notes:
      'Two workers cleared undergrowth across the plot and trimmed the boundary hedge. Debris removed the same day.',
    visible: true,
  },
  {
    type: 'TAX',
    title: 'Land tax paid for the year',
    notes: 'Village office receipt collected and filed. Copy posted to the owner.',
    visible: true,
  },
  {
    type: 'LEGAL',
    title: 'Certified deed copy obtained',
    notes: 'Certified copy of the deed obtained from the registrar and added to the property file.',
    visible: false,
  },
];

/** Dates for the four logs and six snapshots on each owned plot. */
const LOG_DATES = ['2025-10-14', '2026-01-20', '2026-04-11', '2026-06-27'];
const SNAPSHOT_DATES = [
  '2025-09-05T04:30:00.000Z',
  '2025-11-12T05:00:00.000Z',
  '2026-01-19T04:45:00.000Z',
  '2026-03-24T05:15:00.000Z',
  '2026-05-16T04:20:00.000Z',
  '2026-07-09T05:05:00.000Z',
];

/** A handful of saved plots so the subscriber dashboard has something to show. */
const SAVED = [
  { user: 'sub1', slug: 'sreekaryam-residential-6-cent' },
  { user: 'sub1', slug: 'varkala-cliffside-8-cent' },
  { user: 'sub2', slug: 'kundara-industrial-belt-20-cent' },
  { user: 'sub3', slug: 'haripad-residential-8-cent' },
  { user: 'sub3', slug: 'varkala-cliffside-8-cent' },
  { user: 'sub5', slug: 'karunagappally-backwater-15-cent' },
];

/**
 * Placeholder image URL, deterministic per key so the same plot always shows the
 * same photographs.
 * @param {string} key
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
const placeholderImage = (key, width = 1200, height = 800) =>
  `https://picsum.photos/seed/${key}/${width}/${height}`;

/**
 * A date-only value as the `Date` a `@db.Date` column expects.
 * @param {string} isoDate `YYYY-MM-DD`
 * @returns {Date}
 */
const atUtcMidnight = (isoDate) => new Date(`${isoDate}T00:00:00.000Z`);

/**
 * Creates the eight accounts from Section 10, all sharing one password.
 * @returns {Promise<Map<string, { id: string, fullName: string, email: string }>>} keyed by the short key in USERS
 */
const seedUsers = async () => {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_COST);
  const byKey = new Map();

  for (const user of USERS) {
    const id = seedId(`user:${user.email}`);
    const data = {
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      isActive: true,
    };
    const record = await prisma.user.upsert({
      where: { id },
      // The hash is only written on create, so re-seeding does not invalidate a
      // password someone changed while testing.
      create: { id, ...data, passwordHash },
      update: data,
    });
    byKey.set(user.key, record);
  }

  return byKey;
};

/**
 * Creates the 24 listings, six of them flagged as group-purchase opportunities.
 * @param {Map<string, { id: string }>} users
 * @returns {Promise<Map<string, { id: string, slug: string }>>} keyed by slug
 */
const seedProperties = async (users) => {
  const bySlug = new Map();

  for (const [index, property] of PROPERTIES.entries()) {
    const id = seedId(`property:${property.slug}`);
    const groupAmounts = GROUP_AMOUNTS[property.slug];
    const isPublished = property.status !== 'DRAFT';

    const data = {
      slug: property.slug,
      title: property.title,
      description: DESCRIPTION_BY_TYPE[property.type],
      propertyType: property.type,
      status: property.status,
      price: property.price,
      priceIsNegotiable: property.negotiable,
      areaValue: property.area,
      areaUnit: property.unit,
      addressLine: property.survey
        ? `Survey ${property.survey}, ${property.locality}`
        : property.locality,
      locality: property.locality,
      city: property.city,
      district: property.district,
      state: 'Kerala',
      pincode: property.pincode,
      latitude: property.lat,
      longitude: property.lng,
      surveyNumber: property.survey,
      amenities: property.amenities,
      isGroupPurchase: property.group,
      groupTargetAmount: groupAmounts?.target ?? null,
      groupMinTicket: groupAmounts?.minTicket ?? null,
      listedByAgentId: users.get(property.agent).id,
      // Fixed spread so the "most viewed" ordering is stable between runs.
      viewCount: 12 + index * 7,
      publishedAt: isPublished ? new Date(`${PUBLISHED_DATES[index]}T09:00:00.000Z`) : null,
    };

    const record = await prisma.property.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    bySlug.set(property.slug, record);
  }

  return bySlug;
};

/**
 * Three to five media rows per property, exactly one of them the cover — a
 * partial unique index enforces that.
 * @param {Map<string, { id: string }>} properties
 * @returns {Promise<void>}
 */
const seedMedia = async (properties) => {
  for (const [index, property] of PROPERTIES.entries()) {
    const propertyId = properties.get(property.slug).id;
    const imageCount = 3 + (index % 3); // 3, 4 or 5

    for (let position = 0; position < imageCount; position += 1) {
      const key = `${property.slug}-${position + 1}`;
      const id = seedId(`media:${key}`);
      const data = {
        propertyId,
        type: 'IMAGE',
        storageKey: `${STORAGE_PREFIX.propertyMedia}/seed/${key}.jpg`,
        url: placeholderImage(key),
        caption:
          position === 0
            ? `${property.locality} — view from the road`
            : `${property.locality} — view ${position + 1}`,
        sortOrder: position,
        isCover: position === 0,
      };
      await prisma.propertyMedia.upsert({ where: { id }, create: { id, ...data }, update: data });
    }

    // One property also carries the survey sketch as a PDF, so the media manager
    // has a non-image row to render.
    if (property.slug === 'kazhakkoottam-technopark-10-cent') {
      const id = seedId(`media:${property.slug}-sketch`);
      const data = {
        propertyId,
        type: 'DOCUMENT',
        storageKey: `${STORAGE_PREFIX.propertyMedia}/seed/${property.slug}-sketch.pdf`,
        url: 'https://example.test/seed/survey-sketch.pdf',
        caption: 'Survey sketch (village office copy)',
        sortOrder: 99,
        isCover: false,
      };
      await prisma.propertyMedia.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }
};

/**
 * Records who owns what. Shares on each property total 100%.
 * @param {Map<string, { id: string }>} properties
 * @param {Map<string, { id: string }>} users
 * @returns {Promise<string[]>} ids of the properties subscriber #1 owns
 */
const seedOwnerships = async (properties, users) => {
  const ownedByFirstSubscriber = [];

  for (const ownership of OWNERSHIPS) {
    const id = seedId(`ownership:${ownership.key}`);
    const propertyId = properties.get(ownership.slug).id;
    const data = {
      propertyId,
      ownerUserId: users.get(ownership.user).id,
      sharePercentage: ownership.share,
      registeredOn: atUtcMidnight(ownership.registeredOn),
      documentRef: ownership.ref,
      notes: ownership.notes,
    };
    await prisma.ownership.upsert({ where: { id }, create: { id, ...data }, update: data });
    if (ownership.user === 'sub1') ownedByFirstSubscriber.push(ownership.slug);
  }

  return ownedByFirstSubscriber;
};

/**
 * Four management logs and six site photographs for each owned plot, with one
 * log per plot hidden from the owner so the visibility filter is exercised.
 * @param {string[]} ownedSlugs
 * @param {Map<string, { id: string }>} properties
 * @param {Map<string, { id: string }>} users
 * @returns {Promise<void>}
 */
const seedLogsAndSnapshots = async (ownedSlugs, properties, users) => {
  for (const slug of ownedSlugs) {
    const propertyId = properties.get(slug).id;

    for (const [index, template] of LOG_TEMPLATES.entries()) {
      const logKey = `${slug}-log-${index + 1}`;
      const logId = seedId(`log:${logKey}`);
      const logData = {
        propertyId,
        agentId: users.get(index % 2 === 0 ? 'agent1' : 'agent2').id,
        logType: template.type,
        title: template.title,
        notes: template.notes,
        occurredOn: atUtcMidnight(LOG_DATES[index]),
        isVisibleToOwner: template.visible,
      };
      await prisma.managementLog.upsert({
        where: { id: logId },
        create: { id: logId, ...logData },
        update: logData,
      });

      // The two field visits carry a photograph each.
      if (template.type === 'INSPECTION' || template.type === 'MAINTENANCE') {
        const mediaId = seedId(`log-media:${logKey}`);
        const mediaData = {
          logId,
          storageKey: `${STORAGE_PREFIX.logMedia}/seed/${logKey}.jpg`,
          url: placeholderImage(logKey, 1000, 700),
          caption: `${template.title} — ${LOG_DATES[index]}`,
        };
        await prisma.managementLogMedia.upsert({
          where: { id: mediaId },
          create: { id: mediaId, ...mediaData },
          update: mediaData,
        });
      }
    }

    for (const [index, capturedAt] of SNAPSHOT_DATES.entries()) {
      const snapshotKey = `${slug}-snapshot-${index + 1}`;
      const id = seedId(`snapshot:${snapshotKey}`);
      const data = {
        propertyId,
        capturedAt: new Date(capturedAt),
        storageKey: `${STORAGE_PREFIX.snapshots}/seed/${snapshotKey}.jpg`,
        url: placeholderImage(snapshotKey, 1400, 900),
        source: 'MANUAL',
      };
      await prisma.plotSnapshot.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }
};

/**
 * Fifteen enquiries across all four statuses, some from guests and some from
 * signed-in subscribers.
 * @param {Map<string, { id: string }>} properties
 * @param {Map<string, { id: string }>} users
 * @returns {Promise<void>}
 */
const seedEnquiries = async (properties, users) => {
  for (const enquiry of ENQUIRIES) {
    const id = seedId(`enquiry:${enquiry.key}`);
    const data = {
      propertyId: properties.get(enquiry.slug).id,
      userId: enquiry.user ? users.get(enquiry.user).id : null,
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      message: enquiry.message,
      status: enquiry.status,
      assignedAgentId: enquiry.agent ? users.get(enquiry.agent).id : null,
      agentNotes: enquiry.notes,
      createdAt: new Date(`${enquiry.day}T07:30:00.000Z`),
    };
    await prisma.enquiry.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
};

/**
 * Eight site visit requests spread across every visit status.
 * @param {Map<string, { id: string }>} properties
 * @param {Map<string, { id: string }>} users
 * @returns {Promise<void>}
 */
const seedSiteVisits = async (properties, users) => {
  for (const visit of SITE_VISITS) {
    const id = seedId(`visit:${visit.key}`);
    const data = {
      propertyId: properties.get(visit.slug).id,
      userId: users.get(visit.user).id,
      preferredDate: atUtcMidnight(visit.date),
      preferredSlot: visit.slot,
      contactPhone: visit.phone,
      status: visit.status,
      confirmedAt: visit.confirmed ? new Date(visit.confirmed) : null,
      agentNotes: visit.notes,
    };
    await prisma.siteVisit.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
};

/**
 * Ten interest registrations on the group-purchase plots, across every interest
 * status. These record an expression of interest only (Section 1.3).
 * @param {Map<string, { id: string }>} properties
 * @param {Map<string, { id: string }>} users
 * @returns {Promise<void>}
 */
const seedInterests = async (properties, users) => {
  for (const interest of INTERESTS) {
    const id = seedId(`interest:${interest.key}`);
    const data = {
      propertyId: properties.get(interest.slug).id,
      userId: users.get(interest.user).id,
      indicativeAmount: interest.amount,
      notes: interest.notes,
      status: interest.status,
      agentNotes: interest.agentNotes,
      createdAt: new Date(`${interest.day}T10:00:00.000Z`),
    };
    await prisma.interestRegistration.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }
};

/**
 * Saved plots, so the subscriber dashboard is reviewable.
 * @param {Map<string, { id: string }>} properties
 * @param {Map<string, { id: string }>} users
 * @returns {Promise<void>}
 */
const seedSaved = async (properties, users) => {
  for (const saved of SAVED) {
    const userId = users.get(saved.user).id;
    const propertyId = properties.get(saved.slug).id;
    await prisma.savedProperty.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });
  }
};

/**
 * Counts every table, for the report at the end of a run.
 * @returns {Promise<Record<string, number>>}
 */
const countRows = async () => {
  const [
    users,
    properties,
    groupPurchase,
    media,
    enquiries,
    siteVisits,
    saved,
    interests,
    ownerships,
    logs,
    logMedia,
    snapshots,
    withLocation,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.property.count(),
    prisma.property.count({ where: { isGroupPurchase: true } }),
    prisma.propertyMedia.count(),
    prisma.enquiry.count(),
    prisma.siteVisit.count(),
    prisma.savedProperty.count(),
    prisma.interestRegistration.count(),
    prisma.ownership.count(),
    prisma.managementLog.count(),
    prisma.managementLogMedia.count(),
    prisma.plotSnapshot.count(),
    // The trigger, not the application, fills `location`; verifying it here
    // catches a migration that was applied out of order.
    prisma.$queryRaw`SELECT count(*)::int AS count FROM properties WHERE location IS NOT NULL`,
  ]);

  return {
    users,
    properties,
    groupPurchase,
    propertyMedia: media,
    enquiries,
    siteVisits,
    savedProperties: saved,
    interestRegistrations: interests,
    ownerships,
    managementLogs: logs,
    managementLogMedia: logMedia,
    plotSnapshots: snapshots,
    propertiesWithLocation: withLocation[0].count,
  };
};

/**
 * Runs the whole seed in dependency order.
 * @returns {Promise<void>}
 */
const main = async () => {
  const users = await seedUsers();
  const properties = await seedProperties(users);
  await seedMedia(properties);
  const ownedSlugs = await seedOwnerships(properties, users);
  await seedLogsAndSnapshots(ownedSlugs, properties, users);
  await seedEnquiries(properties, users);
  await seedSiteVisits(properties, users);
  await seedInterests(properties, users);
  await seedSaved(properties, users);

  const counts = await countRows();
  logger.info({ counts }, 'seed complete');
  for (const [table, count] of Object.entries(counts)) {
    logger.info(`  ${table.padEnd(24)} ${count}`);
  }
  logger.info(`Every seeded account uses the password ${SEED_PASSWORD}`);
};

try {
  await main();
} catch (error) {
  logger.error({ err: error }, 'seed failed');
  process.exitCode = 1;
} finally {
  await disconnectPrisma();
}
