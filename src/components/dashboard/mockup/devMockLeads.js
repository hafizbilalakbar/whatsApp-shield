/**
 * DEV_MOCK_LEADS & TEST FIXTURES
 * 
 * STRICT TEST FIXTURE:
 * - Only enabled when URL contains '?mockLeads=1' in development mode (import.meta.env.DEV).
 * - Never runs or bundles in production.
 * - Contains real schema fields only.
 * - NO hardcoded state or city on automatic leads so geo-detection runs dynamically.
 */

// 1. Single State Campaign (Florida US)
export const SINGLE_STATE_LEADS = [
  {
    number: '+13055581249',
    cleanNumber: '13055581249',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/marco.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: true,
    displayName: 'Apex Design & Co',
    verifiedName: 'Apex Design & Co',
    discoveredAt: Date.now() - 4000
  },
  {
    number: '+13055583892',
    cleanNumber: '13055583892',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/sofia.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 14000
  },
  {
    number: '+17865559124',
    cleanNumber: '17865559124',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 28000
  },
  {
    number: '+13055584411',
    cleanNumber: '13055584411',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/tomas.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: false,
    displayName: 'Tomas Morales',
    discoveredAt: Date.now() - 45000
  },
  {
    number: '+17865587780',
    cleanNumber: '17865587780',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 72000
  }
];

// 2. Multi-State Campaign (FL, NY, TX, CA, IL)
export const MULTI_STATE_LEADS = [
  {
    number: '+13055581249',
    cleanNumber: '13055581249',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/marco.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: true,
    displayName: 'Apex Design & Co',
    discoveredAt: Date.now() - 5000
  },
  {
    number: '+12125551234',
    cleanNumber: '12125551234',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/elena.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 15000
  },
  {
    number: '+17135559876',
    cleanNumber: '17135559876',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/tomas.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: false,
    displayName: 'Houston Logistics LLC',
    discoveredAt: Date.now() - 35000
  },
  {
    number: '+14155556789',
    cleanNumber: '14155556789',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 55000
  },
  {
    number: '+13125554321',
    cleanNumber: '13125554321',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/lena.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: 'Chicago Architecture',
    discoveredAt: Date.now() - 85000
  }
];

// 3. Multi-Country List (US, UK, Canada, Australia, UAE, Pakistan, Jamaica)
export const MULTI_COUNTRY_LEADS = [
  {
    number: '+13055581249',
    cleanNumber: '13055581249',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/marco.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: true,
    displayName: 'Apex Design & Co',
    discoveredAt: Date.now() - 4000
  },
  {
    number: '+442079460912',
    cleanNumber: '442079460912',
    detectedCountry: 'GB',
    exists: true,
    avatar: '/avatars/elena.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 14000
  },
  {
    number: '+14165551234',
    cleanNumber: '14165551234',
    detectedCountry: 'CA',
    exists: true,
    avatar: '/avatars/tomas.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: false,
    displayName: 'Toronto Media Works',
    discoveredAt: Date.now() - 28000
  },
  {
    number: '+61291234567',
    cleanNumber: '61291234567',
    detectedCountry: 'AU',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 48000
  },
  {
    number: '+971501234567',
    cleanNumber: '971501234567',
    detectedCountry: 'AE',
    exists: true,
    avatar: '/avatars/omar.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: true,
    displayName: 'Emirates Trade Group',
    discoveredAt: Date.now() - 72000
  },
  {
    number: '+923001234567',
    cleanNumber: '923001234567',
    detectedCountry: 'PK',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 95000
  },
  {
    number: '+18765551234',
    cleanNumber: '18765551234',
    detectedCountry: 'JM',
    exists: true,
    avatar: '/avatars/sofia.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: 'Kingston Sound Studio',
    discoveredAt: Date.now() - 120000
  }
];

// 4. Numbers with NO location data (Jamaica +1 876, Toll-free +1 800, Mobile ranges without geo)
export const NO_LOCATION_LEADS = [
  {
    number: '+18765551234',
    cleanNumber: '18765551234',
    detectedCountry: 'JM',
    exists: true,
    avatar: '/avatars/sofia.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 5000
  },
  {
    number: '+18005550199',
    cleanNumber: '18005550199',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: true,
    isVerified: true,
    displayName: 'Toll-Free Customer Care',
    discoveredAt: Date.now() - 15000
  },
  {
    number: '+18885550144',
    cleanNumber: '18885550144',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 35000
  },
  {
    number: '+18765559876',
    cleanNumber: '18765559876',
    detectedCountry: 'JM',
    exists: true,
    avatar: '/avatars/marco.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 65000
  }
];

// 5. Default 20 Mock Leads for General Appearance Testing
export const DEV_MOCK_LEADS = [
  ...SINGLE_STATE_LEADS,
  {
    number: '+13055586634',
    cleanNumber: '13055586634',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/alex.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: true,
    displayName: 'Vertex Creative Agency',
    discoveredAt: Date.now() - 120000
  },
  {
    number: '+13055581122',
    cleanNumber: '13055581122',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 150000
  },
  {
    number: '+13055589001',
    cleanNumber: '13055589001',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/maya.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: 'Maya Patel',
    discoveredAt: Date.now() - 180000
  },
  {
    number: '+13055584567',
    cleanNumber: '13055584567',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 210000
  },
  {
    number: '+13055588899',
    cleanNumber: '13055588899',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/david.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: false,
    displayName: 'David Miller',
    discoveredAt: Date.now() - 240000
  },
  {
    number: '+13055583344',
    cleanNumber: '13055583344',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 270000
  },
  {
    number: '+13055587711',
    cleanNumber: '13055587711',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/elena.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 300000
  },
  {
    number: '+13055582299',
    cleanNumber: '13055582299',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: true,
    isVerified: true,
    displayName: 'Horizon Consulting',
    discoveredAt: Date.now() - 330000
  },
  {
    number: '+13055585566',
    cleanNumber: '13055585566',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/rachel.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: 'Rachel Green',
    discoveredAt: Date.now() - 360000
  },
  {
    number: '+13055589944',
    cleanNumber: '13055589944',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 390000
  },
  {
    number: '+13055581177',
    cleanNumber: '13055581177',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/omar.jpg',
    profilePhotoAvailable: true,
    isBusiness: true,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 420000
  },
  {
    number: '+13055586688',
    cleanNumber: '13055586688',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 450000
  },
  {
    number: '+13055583322',
    cleanNumber: '13055583322',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/sofia.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 480000
  },
  {
    number: '+13055587755',
    cleanNumber: '13055587755',
    detectedCountry: 'US',
    exists: true,
    avatar: null,
    profilePhotoAvailable: false,
    isBusiness: true,
    isVerified: false,
    displayName: 'Solarix Energy',
    discoveredAt: Date.now() - 510000
  },
  {
    number: '+13055584499',
    cleanNumber: '13055584499',
    detectedCountry: 'US',
    exists: true,
    avatar: '/avatars/tomas.jpg',
    profilePhotoAvailable: true,
    isBusiness: false,
    isVerified: false,
    displayName: null,
    discoveredAt: Date.now() - 540000
  }
];

export function isDevMockEnabled() {
  if (typeof window === 'undefined') return false;
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('mockLeads') === '1' || window.__FORCE_MOCK_LEADS__ === true;
}
