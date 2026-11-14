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

/**
 * Node.js / SSR fallback: read the JSON dataset straight off disk when the
 * bundler-style `import('./x.json')` is unavailable (e.g. plain `node` test
 * runs, which require a `type: "json"` import attribute Vite adds implicitly).
 * Keeps the same promise contract so production behaviour is unchanged.
 */
async function loadJsonFromDisk(fileName) {
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const raw = fs.readFileSync(path.join(here, fileName), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadDataset(importFn, fileName, assign) {
  return importFn()
    .then((mod) => assign(normalize(mod)))
    .catch(() => loadJsonFromDisk(fileName).then((data) => assign(data)));
}

export function loadMobilePrefixes() {
  if (!prefixesPromise) {
    prefixesPromise = loadDataset(
      () => import('./mobilePrefixes.json'),
      'mobilePrefixes.json',
      (data) => {
        prefixesIndex = data;
        return prefixesIndex;
      },
    );
  }
  return prefixesPromise;
}

export function loadOperators() {
  if (!operatorsPromise) {
    operatorsPromise = loadDataset(
      () => import('./operators.json'),
      'operators.json',
      (data) => {
        operatorsIndex = data;
        return operatorsIndex;
      },
    );
  }
  return operatorsPromise;
}

export function loadRegions() {
  if (!regionsPromise) {
    regionsPromise = loadDataset(
      () => import('./regions.json'),
      'regions.json',
      (data) => {
        regionsIndex = data;
        return regionsIndex;
      },
    );
  }
  return regionsPromise;
}

/**
 * Register already-parsed datasets (used by tests and by tooling that has the
 * JSON in memory) so the synchronous readers work without the async loaders.
 */
export function registerNumberingDatasets({ prefixes, operators, regions } = {}) {
  if (prefixes && typeof prefixes === 'object') {
    prefixesIndex = prefixes;
    prefixesPromise = Promise.resolve(prefixes);
  }
  if (operators && typeof operators === 'object') {
    operatorsIndex = operators;
    operatorsPromise = Promise.resolve(operators);
  }
  if (regions && typeof regions === 'object') {
    regionsIndex = regions;
    regionsPromise = Promise.resolve(regions);
  }
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