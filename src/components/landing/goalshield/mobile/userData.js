/* Unique realistic funnel users. Photos are dedicated assets under
   public/avatars-funnel and are never reused from testimonial sections. */

export const USERS = {
  nadia: { img: '/avatars-funnel/u01.jpg', name: 'Nadia El-Sayed', role: 'Solar & Renewables', city: 'Dubai' },
  omar: { img: '/avatars-funnel/u02.jpg', name: 'Omar Reza', role: 'Fitness Studio', city: 'Riyadh' },
  sofia: { img: '/avatars-funnel/u03.jpg', name: 'Sofia Lindqvist', role: 'Cloud Consulting', city: 'Doha' },
  yusuf: { img: '/avatars-funnel/u04.jpg', name: 'Yusuf Adeyemi', role: 'Property Manager', city: 'Abu Dhabi' },
  rafael: { img: '/avatars-funnel/u05.jpg', name: 'Rafael Ortega', role: 'Logistics', city: 'Madrid' },
  amara: { img: '/avatars-funnel/u06.jpg', name: 'Amara Diop', role: 'Retail Chain', city: 'Dakar' },
  sophie: { img: '/avatars-funnel/u07.jpg', name: 'Sophie Laurent', role: 'E-commerce', city: 'Paris' },
  jonas: { img: '/avatars-funnel/u08.jpg', name: 'Jonas Lindqvist', role: 'SaaS', city: 'Stockholm' },
  mara: { img: '/avatars-funnel/u09.jpg', name: 'Mara Bertolini', role: 'Interior Design', city: 'Milan' },
  kemi: { img: '/avatars-funnel/u10.jpg', name: 'Kemi Adegoke', role: 'Retail', city: 'Lagos' },
  diego: { img: '/avatars-funnel/u11.jpg', name: 'Diego Fuentes', role: 'Freight & Logistics', city: 'Valencia' },
  raees: { img: '/avatars-funnel/u12.jpg', name: 'Raees Malik', role: 'Importer', city: 'Karachi' },
  hana: { img: '/avatars-funnel/u13.jpg', name: 'Hana Lee', role: 'Boutique Owner', city: 'Seoul' },
  marcus: { img: '/avatars-funnel/u14.jpg', name: 'Marcus Webb', role: 'Co-working', city: 'London' },
  petra: { img: '/avatars-funnel/u15.jpg', name: 'Petra Novak', role: 'Architecture', city: 'Prague' },
  chen: { img: '/avatars-funnel/u16.jpg', name: 'Chen Wei', role: 'Manufacturer', city: 'Shenzhen' },
  ingrid: { img: '/avatars-funnel/u17.jpg', name: 'Ingrid Berg', role: 'Jewelry Retailer', city: 'Copenhagen' },
};

export const COMPANIES = [
  { company: 'Golden Thread Imports', user: 'raees' },
  { company: 'Aurora Fit-out', user: 'petra' },
  { company: 'Nile Freight', user: 'amara' },
  { company: 'PixelBrew Studio', user: 'chen' },
  { company: 'Verana Home', user: 'hana' },
  { company: 'Canary Works', user: 'marcus' },
];

export const companyOf = (name) => COMPANIES.find((c) => c.company === name);