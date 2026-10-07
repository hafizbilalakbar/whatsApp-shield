/* ============================================================================
   WhatsApp Shield — Numbering dataset loaders
   ----------------------------------------------------------------------------
   Three build-time generated datasets, each code-split into its own chunk so the
   initial bundle stays small:

     mobilePrefixes.json  metadata-verified MOBILE / FIXED_LINE prefixes per
                          territory, discovered by probing libphonenumber metadata.
                          Entry: { cc, natLens: number[], prefixes: [prefix, len][],
                                   parent?: iso }
     operators.json       carrier name -> national prefixes, extracted from
                          libphonenumber-geo-carrier resources.
                          Entry: [prefix, carrierName][]
     regions.json         ISO 3166-2 administrative subdivisions (label only).
                          Entry: [isoCode, name][]

   Everything is memoised, so each chunk is fetched at most once per session.
   ============================================================================ */

let prefixesPromise = null;
let operatorsPromise = null;
let regionsPromise = null;

let prefixesIndex = null;
let operatorsIndex = null;
let regionsIndex = null;

function normalize(mod) {
  const value = mod && mod.default !== undefined ? mod.default : mod;
  return value && typeof value === 'object' ? value : {};
}

export function loadMobilePrefixes() {
  if (!prefixesPromise) {
    prefixesPromise = import('./mobilePrefixes.json').then((mod) => {
      prefixesIndex = normalize(mod);
      return prefixesIndex;
    });
  }
  return prefixesPromise;
}

export function loadOperators() {
  if (!operatorsPromise) {
    operatorsPromise = import('./operators.json').then((mod) => {
      operatorsIndex = normalize(mod);
      return operatorsIndex;
    });
  }
  return operatorsPromise;
}

export function loadRegions() {
  if (!regionsPromise) {
    regionsPromise = import('./regions.json').then((mod) => {
      regionsIndex = normalize(mod);
      return regionsIndex;
    });
  }
  return regionsPromise;
}

export function ensureNumberingDatasets() {
  return Promise.all([loadMobilePrefixes(), loadOperators(), loadRegions()]);
}

/* Synchronous readers - valid only after ensureNumberingDatasets() resolved. */

export function getPrefixIndexSync() {
  return prefixesIndex;
}

export function getOperatorsSync() {
  return operatorsIndex;
}

export function getRegionsSync() {
  return regionsIndex;
}