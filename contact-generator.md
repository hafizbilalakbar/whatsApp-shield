# Contact Generator — Code Analysis (WhatsApp Shield)

> Yeh analysis **current code (working tree)** ke mutabiq hai. Pichle version se **kya badla**
> woh Section 12 mein hai.
>
> - Har baat ke saath **file path + function + line number** diya gaya hai.
> - Jo cheez code mein nahi mili, wahan saaf likha hai: **"code mein nahi mila"**.
> - Line numbers is waqt ke files ke hisaab se hain; agar future mein shift hon to function
>   naam se dhoond lein.
> - Yeh ek **read-only** analysis hai: is document ke ilawa **koi code change nahi** hua.
>   Footer ke baare mein Section 14 dekhein.

---

## 1) Overview

`NumberGenerator` ek **client-side** number generator hai. Koi Facebook/WhatsApp server is
generation mein involve nahi; backend (`backend/server.js`) sirf validation-scanning ke liye
alag hai.

| Cheez | Kahan |
|---|---|
| UI / orchestrator | `src/components/dashboard/NumberGenerator.jsx` (component `NumberGenerator`, line 38) |
| Generation engine | `src/data/numberingPlans.js` |
| Dataset loaders | `src/data/numberingDatasets.js` |
| Limits / rules / provenance | `src/data/numberingConstants.js` |
| Region / lead geo logic | `src/utils/geoLookup.js` |
| Data (build-time se baked) | `src/data/mobilePrefixes.json`, `operators.json`, `regions.json`, `countries.js`, `geocodes/{cc}.json` |

Tool khud UI par likhta hai:

> `Synthetic / test numbers validated with libphonenumber.` (`NumberGenerator.jsx:734`)

Teen modes (`mode` state, `NumberGenerator.jsx:40`) + ek shared **Target Country** jo ISO
store karta hai (`NumberGenerator.jsx:44`):

```
UI (NumberGenerator.jsx)
   -> [Generate Numbers] click   (handleGenerate)
   -> mode switch:
        'sequential' -> runSequential()
        'random'     -> runRandom()   -> generateAsync() -> engine
        'region'     -> runRegion()   -> generateBucketedAsync()
   -> engine (numberingPlans.js) prefix pool + subscriber digits banata hai
   -> classifyCandidate() libphonenumber /max se validate
   -> setGenerated(numbers) + setReport(...) -> preview + Copy / CSV / Use
```

**Ahem baat:** numbers build-time prefix pool se bante hain aur phir **dobara libphonenumber
se validate** hote hain. Koi live subscriber database lookup **nahi hota** (Section 8).

---

## 2) Libraries Used

Versions `package.json` se. Bara farq: **runtime par sirf `libphonenumber-js`** use hoti hai;
`bson`, `libphonenumber-geo-carrier`, `country-state-city` sirf **build-time** (devDependencies).

| Package | Version | Type | Kahan / Kis kaam | Verdict |
|---|---|---|---|---|
| `libphonenumber-js` | `^1.13.4` | dependency (runtime) | `numberingPlans.js:1-2` (`/max` build), `geoLookup.js:1` | **Asli engine** — parse + `isValid()` + `getType()` |
| `bson` | `^7.2.0` | devDependency (build) | `scripts/build-numbering-datasets.mjs`, `scripts/build-geocodes.js` | BSON resources parhne ke liye (`deserialize`) |
| `libphonenumber-geo-carrier` | `^2.0.0` | devDependency (build) | `node_modules/libphonenumber-geo-carrier/resources/...` | Raw carrier/geocode data sirf build time |
| `country-state-city` | `^3.2.1` | devDependency (build) | `State.getStatesOfCountry(iso)` (`build-numbering-datasets.mjs`) | ISO 3166-2 subdivisions |
| `country-flag-icons` | `^1.5.11` | dependency | `SvgFlag` | UI flags |
| `lucide-react` | `^0.475.0` | dependency | icons | UI only |
| `react`, `react-dom` | `^18.3.1` | dependency | UI | — |

**Randomness:** `Math.random()` nahi. Subscriber digits **Web Crypto** se aate hain —
`nextRandomDigit()` / `randomDigits()` (`numberingPlans.js:70-96`), rejection sampling ke saath
(byte ≥ 250 discard). `Math.random()` sirf ek jagah cursor offset ke liye (`numberingPlans.js:459`).

> Purana version `Math.random()` use karta tha — woh predictable hai (Section 12).

**Datasets (runtime par load hote hain):**

| File | Shape | Loader |
|---|---|---|
| `src/data/mobilePrefixes.json` | `{ ISO: { cc, natLens[], prefixes:[[prefix,len]], type?, parent? } }` | `loadMobilePrefixes()` — `numberingDatasets.js:58` |
| `src/data/operators.json` | `{ ISO: [ { n: name, p: [prefixes] } ] }` | `loadOperators()` — `numberingDatasets.js:72` |
| `src/data/regions.json` | `{ ISO: [ [isoCode, name] ] }` | `loadRegions()` — `numberingDatasets.js:86` |
| `src/data/countries.js` | `[{ name, code, iso }]` + helpers | direct import |
| `src/data/geocodes/{cc}.json` | `{ prefix: location }` | `loadGeocodesForCallingCode()` — `geoLookup.js:188` |

---

## 2.1) Data Pipeline (build-time → runtime)

### Build step: `npm run build:datasets`

`package.json`:
```
npm run build:datasets
  = node scripts/build-numbering-datasets.mjs   (operators.json + regions.json)
    node scripts/build-geocodes.js              (geocodes/*.json)
    node scripts/build-countries.js             (countries.js)
```

| Output | Script | Source | Rule |
|---|---|---|---|
| `src/data/operators.json` | `build-numbering-datasets.mjs` | `libphonenumber-geo-carrier/resources/carrier/en` (BSON) | carrier naam se group; prefixes length-asc; operators prefix-count-desc; keys alphabetical |
| `src/data/regions.json` | `build-numbering-datasets.mjs` | `State.getStatesOfCountry(iso)` | `[isoCode, name]`; naam se dedupe + sort; shipped key-order preserve |
| `src/data/geocodes/{cc}.json` | `scripts/build-geocodes.js` | `.../resources/geocode/en` (BSON) | `bson.deserialize` → `JSON.stringify` (ek `{ prefix: location }`) |
| `src/data/countries.js` | `scripts/build-countries.js` | `libphonenumber-js` `getCountries()` + `Intl.DisplayNames` | `{ name, code, iso }`, naam se sorted |

**`mobilePrefixes.json` regenerate NAHI hota.** Iski per-territory prefix granularity
(2/3/4 digits) ek purane probing heuristic se aayi thi jo metadata se dobara paida nahi ho
sakti. Is liye shipped file **authoritative** hai — script sirf validate/report karta hai.

**Safety guard:** `writeGuarded()` (`build-numbering-datasets.mjs:49`) output sirf tab likhta
hai jab woh shipped file se **byte-identical** ho; warna candidate
`src/data/<name>.candidate.json` mein likha jaata hai. Rebuild curated data ko silently
corrupt nahi kar sakta.

```
[npm run build:datasets]
        |
        +--> operators.json  --(byte-match guard)--> shipped (unchanged) | .candidate.json
        +--> regions.json    --(byte-match guard)--> shipped (unchanged) | .candidate.json
        +--> mobilePrefixes.json  --(report-only)--> AUTHORITATIVE, never overwritten
        +--> geocodes/*.json  (overwritten; pure JSON passthrough)
        +--> countries.js     (overwritten; pure derive)
```

**Runtime loading** (`numberingDatasets.js`):

```
ensureNumberingDatasets()
   |--> loadMobilePrefixes() -> import('./mobilePrefixes.json')   (Vite)
   |                            fallback: fs.readFileSync (node)
   |--> loadOperators()
   |--> loadRegions()
         (har ek memoised: ek session mein ek dafa)
   v
getPrefixIndexSync() / getOperatorsSync() / getRegionsSync()
```

`ensureNumberingDatasets()` ko har mode generate karne se pehle call kiya jaata hai.

---

## 3) File Map & Flow

| Component | File | Function | Line |
|---|---|---|---|
| UI / orchestrator | `src/components/dashboard/NumberGenerator.jsx` | `NumberGenerator` | 38 |
| UI cap | `src/data/numberingConstants.js` | `UI_MAX_QTY=50000` (`MAX_QTY`) | 11 / `NumberGenerator.jsx:32` |
| Sequential run | `NumberGenerator.jsx` | `runSequential` | 332 |
| Random run | `NumberGenerator.jsx` | `runRandom` → `getRandomNumbers` | 484 |
| Region run | `NumberGenerator.jsx` | `runRegion` → `generateBucketedAsync` | 502 |
| Async wrapper | `NumberGenerator.jsx` | `generateAsync` | 399 |
| Preview box | `NumberGenerator.jsx` | JSX | 1146-1189 |
| Sequential engine | `src/data/numberingPlans.js` | `generateSequentialNumbers` | 629 |
| Random engine | `numberingPlans.js` | `getRandomNumbers` → `generateFromPoolAsync` | 585 / 544 |
| Bucketed engine | `numberingPlans.js` | `generateBucketedAsync` | 904 |
| Generator core | `numberingPlans.js` | `poolProducer` | 436 |
| Validation | `numberingPlans.js` | `classifyCandidate` / `validateCandidate` | 156 / 179 |
| Degenerate filter | `numberingPlans.js` | `hasDegenerateSubscriber` | 117 |
| Country plan | `numberingPlans.js` | `getCountryPlan` | 208 |
| Region pool | `numberingPlans.js` | `getRegionPool` | 293 |
| Operators | `numberingPlans.js` | `getOperatorsForCountry` | 317 |
| Subdivisions (label) | `numberingPlans.js` | `getSubdivisionsForCountry` | 357 |
| Region list (verified + label) | `src/utils/geoLookup.js` | `getDynamicRegionsForCountry` | 367 |
| Region icon | `src/components/ui/RegionIcon.jsx` | `RegionIcon` | — |
| Operator badge | `src/components/ui/OperatorIcon.jsx` | `OperatorIcon` | — |
| CSV util | `src/utils/exportUtils.js` | `downloadFile` | used at `NumberGenerator.jsx:695` |

---

## 4) Sequential / Range Mode

UI: country + start + end (`NumberGenerator.jsx:764-792`). Click → `runSequential` (332) →
engine `generateSequentialNumbers` (`numberingPlans.js:629`).

**Logic:**

1. Input se sirf digits rakhe jaate hain (`633-634`).
2. `len = max(startStr.length, endStr.length)` — dono **isi length tak zero-pad** (`639`).
3. Range `BigInt` se parse (`640-641`) — 15-digit numbers silently round nahi hote.
4. `start > end` → error. **`start === end` valid hai** (single number) — `642-644`.
5. Span `SEQUENTIAL_MAX = 10000` par cap (`numberingConstants.js`); overflow `truncated`
   report hota hai (`646-649`).
6. Har candidate:
   - country plan ke kisi **asli prefix** se start hona chahiye (`planPrefixes.find(...)`,
     `665`); warna `reasons.prefix++`;
   - `hasDegenerateSubscriber()` (`670`);
   - `classifyCandidate()` (`674`) — `isValid()` + type + country + length round-trip;
   - `seenSet` se duplicate check (`679`).
7. Output `{ numbers:[{number,national,prefix}], error, truncated, stats }`.

**Drop reasons** (`stats.reasons`): `prefix`, `length`, `type`, `country`, `invalid`,
`degenerate`, `duplicate` — UI inhe readable status message mein dikhata hai.

> **Ahem tabdeeli:** purana sequential mode prefix force nahi karta tha aur `start == end`
> reject karta tha. Ab range har number ko asli plan prefix se hona zaroori hai, `start == end`
> valid hai, aur BigInt overflow nahi hota.

---

## 5) Random Mode

UI: country + quantity (`NumberGenerator.jsx:794-835`). Click → `runRandom` (484) →
`generateAsync` (399) → `getRandomNumbers` (`numberingPlans.js:585`) → `generateFromPoolAsync` (544).

**`generateAsync` (UI safety):**

- quantity floor; `1` se kam → error; `UI_MAX_QTY = 50000` se zyada → error.
- `runIdRef` se race guard; `cancelRef` se cancel; 30ms yield ke baad generate.
- Progress (`onProgress`) aur `shouldCancel` pass kiye jaate hain.

**`getRandomNumbers` (585):**

- `ensureNumberingDatasets()` → `getCountryPlan(iso)`; plan na ho → error (`589-591`).
- `types = plan.isMobileOnly ? MOBILE_TYPES : FIXED_TYPES` (`592`).
- `pool = plan.prefixes` → `generateFromPoolAsync`.

**`poolProducer` (core generator, `436-501`) — asli random logic:**

- `usable = normalizePool(pool)` (`440`) — prefix ko itna chhota karta hai ke kam-az-kam 1
  subscriber digit bache (chhote territories jaise Tokelau +690 ke liye).
- **Capacity**: har `[prefix, natLen]` ke liye `10^(natLen - prefix.length)` numbers.
  `target = min(requested, capacity)` (`445-452`).
- **Round-robin cursor** (`459, 462`) — numbers har prefix par barabar phailte hain.
- `subscriber = randomDigits(...)` — **Web Crypto** se (`70`), rejection sampling (`70-96`).
- **Degenerate filter** `hasDegenerateSubscriber()` (`117`) — `SUBSCRIBER_RULES`
  (`numberingConstants.js`) par based: all-same digit, 5+ repeat run (4-in-a-row allowed),
  ascending/descending staircase. Sirf **subscriber part** par, prefix par nahi.
- `classifyCandidate()` (`156`) + `seenSet` dedupe.
- **Safety limits**: `MAX_ATTEMPT_FACTOR=60`, `MIN_TOTAL_ATTEMPTS=20000`, `STALL_FLOOR=5000`,
  `STALL_POOL_FACTOR=20`, `TOTAL_TIME_BUDGET_MS=8000`, `CHUNK_SIZE=200`, `CHUNK_YIELD_MS=12`.

`generateFromPoolAsync` (544) har `CHUNK_SIZE` numbers (ya har 12ms) par event loop ko yield
karta hai, is liye UI responsive rehti hai.

---

## 6) Operator / SIM Provider Logic

Operator list `src/data/operators.json` se; filtering `getOperatorsForCountry(iso)`
(`numberingPlans.js:317`).

**Rules (false-positive operators fix karne ke liye):**

1. Carrier prefix aur plan prefix dono digits hone chahiye.
2. Carrier prefix kam-az-kam `MIN_OPERATOR_PREFIX_LEN = 2` lamba ho.
3. Carrier sirf tab rakha jaata hai jab uska koi prefix **plan prefix se overlap kare** —
   `mp === c || mp.startsWith(c) || c.startsWith(mp)`.
4. **Duplicate carrier naam merge** ho jaate hain (prefixes ki union).
5. Result: `{ id, name, prefixes, prefix }`, naam se sorted.

### US par sirf Fractel + Onvoy kyun? (verified)

- US plan (`mobilePrefixes.json.US`) = **358** entries, sab **3-digit NPA** (201, 202, ...).
- `operators.json.US` mein 43 carrier hain, lekin zyada-tar prefixes **Caribbean +1**
  territories ki hain (246 Barbados, 758 St. Lucia, 809/829 DR, 787 Puerto Rico, 242 Bahamas,
  658 Jamaica, ...), jo US NPA plan se **overlap nahi** karti.
- Overlap sirf **NPA 659** (Birmingham, Alabama) par pass hota hai, is liye:
  - `Fractel`: `659529, 659766, 659888`
  - `Onvoy`: `659200, 659222, 659300, 659400, 659444, 659500, 659600, 659666, 659777, 659800, 659900, 659999`

Yeh ek **data artifact** hai, bug nahi: `libphonenumber-geo-carrier` ki en resource mein US
carriers ke liye sirf NPA 659 ke ranges hain.

> UI note: NANP territories par warning —
> `NANP_NON_US = {CA, JM, PR, DO, TT, BB, BS, GD, GU, VI}` (`NumberGenerator.jsx:36`, usage 1179).

---

## 7) Region-Wise Mode (most important)

UI: `NumberGenerator.jsx` (region tab). Click → `runRegion` (502) → `generateBucketedAsync`
(`numberingPlans.js:904`).

### 7.1 Region list kaise banti hai — `getDynamicRegionsForCountry` (`geoLookup.js:367`)

Do sources merge hote hain:

| Source | Kahan se | Flags | Prefix |
|---|---|---|---|
| **Verified** | offline geocoder chunks `src/data/geocodes/{cc}.json` (prefix → city/region) | `verified:true`, `labelOnly:false`, `source:'prefix'` | asli matched plan prefix |
| **Label-only** | `regions.json` (ISO 3166-2 subdivisions) | `verified:false`, `labelOnly:true`, `source:'iso'` | `[]` (khali) |

- Geocode analyse: `analyzeGeocodeRegions()` (`geoLookup.js:97`). Ek prefix jo **ek se zyada
  region claim** kare ambiguous hai aur har region se excluded (`134`, `393-396`).
- Matched prefixes `matchPlanPrefixes(raw, planPrefixes)` se (`116`) — sirf woh prefixes jo
  country ki **mobile plan** se overlap karein.
- Dedupe: verified region ke naam se milta label-only twin drop (`440-441`).
- `source` = `'prefix' | 'iso' | 'prefix+iso' | 'none'` (`447-450`).
- Region names geocoder se aate hain: `+1` US/CA ke liye state/province mein collapse
  (`regionNameFor`, `70-87`), baqi countries ke liye raw location string.

**Aaj ka runtime output (execute karke verify kiya gaya):**

| Country | source | total | verified | label-only |
|---|---|---|---|---|
| US (+1) | `prefix+iso` | 66 | **49 states** | 17 |
| CA (+1) | `prefix+iso` | 13 | 10 | 3 |
| IN (+91) | `prefix+iso` | 1241 | 1206 | 35 |
| GB (+44) | `iso` | 247 | **0** | 247 |
| FR (+33) | `iso` | 123 | 0 | 123 |
| PK / AE / DE | `iso` | — | 0 | sab |

### 7.2 Region-Wise generate kaise karta hai (`runRegion`, `502-658`)

1. `totalTarget = min(requested, MAX_QTY)`.
2. `plan = getCountryPlan(iso)`; na ho → error.
3. Buckets banaaye jaate hain:
   - region + operator → har combination ek bucket;
   - sirf regions → `{region, operator:null}`;
   - sirf operators → `{region:null, operator}`;
   - **dono khali → error** (`buckets.length === 0` par error return ho jaata hai, halanki
     comment "whole country plan" kehta hai).
4. **Label-only gate:** agar sirf label-only region(s) select hain (koi operator nahi) aur user
   ne confirm nahi kiya → error. Confirm `labelOnlyConfirmed` checkbox se (`NumberGenerator.jsx:1113`).
5. **Per-bucket pool:**
   - operator select → `expandPrefixes(iso, op.prefixes)`;
   - warna → `getRegionPool(iso, region)`.
6. Pool khali ho to UI country plan par fall back karta hai **aur record karta hai**
   (`fallbackUsed` / `labelOnlyUsed`) — silently nahi girta.
7. `generateBucketedAsync` batch ko buckets mein fairly baantta hai (`splitShares`;
   `base = floor(total/buckets)`, pehle `total%buckets` +1), phir **interleave** karta hai.
8. **Metadata:** har number par `{ country, regionId, regionName, regionVerified, operatorName,
   prefix, generationIndex }`, jo `window.__whatsappShieldNumberMetadata` Map mein rakhi jaati
   hai (CSV export is se bharta hai).

### 7.3 Reported problem + ROOT CAUSE (exact)

**Reported state:** `Selected Regions: All regions`, `Operators: Any operator`, `Targets: 1`,
`Distinct Prefixes In Scope: 0`, aur har row `+1 • any` ke saath **`label only`**.

**Exact root cause (general):** Region names offline **geocoder** se aate hain jinke prefixes
**geographic / landline area codes** hote hain, aur unhein country ke **mobile plan** se
intersect kiya jaata hai:

- `getDynamicRegionsForCountry` (`geoLookup.js:388-411`) geocode keys par
  `matchPlanPrefixes(raw, planPrefixes)` (`geoLookup.js:116`) lagata hai. Jis region ka koi bhi
  raw prefix plan se overlap na kare, woh verified list mein **aata hi nahi** (`397`).
- Jo prefixes reh jaate hain woh `regions.json` subdivisions hain → **sab label-only**
  (`geoLookup.js:420-436`), `verified:false`, `prefixes:[]`.
- Isi liye UI har row `+{cc} • any` dikhata hai (`NumberGenerator.jsx:1079`) aur `label only`
  badge (`1070-1074`). "Distinct Prefixes In Scope" `combinedPrefixCount` (`1174`) 0 rehta hai
  kyunke label-only region ke `prefixes=[]`. `getRegionPool` bhi label-only ke liye `[]`
  deta hai (`numberingPlans.js:293`), is liye whatsapp preview note aata hai
  *"No verified prefixes in scope — generation falls back to the country plan"* (`1176-1178`).
- **GB misaal:** geocoder keys `020`, `0113`, `0115`, ... (landline) jabke GB plan sirf `7xxx`
  mobile. Intersection = khali ⟹ GB ke **saare 247** regions label-only.

**US ke baare mein zaroori finding (honest):** current code mein US ka intersection **khali
nahi** hai — NANP mein geocoder keys bhi **3-digit NPA** hain, is liye `getDynamicRegionsForCountry('US','1')`
**49 states verified** deta hai (California = 39 NPAs, Florida = 23, Texas = 28, Washington = 5).
Yani "saare US states label-only + 0 prefixes" wala state current code reproduce **nahi** karta.
US par woh state sirf in conditions mein aayega:

1. **Geocode chunk load fail** ho jaye browser mein (`loadGeocodesForCallingCode`, `geoLookup.js:188`):
   `geocodeModules[modulePath]` na mile to `null` return (`199-201`), ya loader reject kare
   (`210-212`) — phir sirf ISO subdivisions (label-only) bachti hain.
2. App **stale build** (`dist/`) chala raha ho jo is data/loader se pehle ka ho.
3. App **purana code** chala raha ho jahan region mapping per-country lag thi.

**US ka ek asli, reproducerable bug (West Virginia):** `regionNameFor` (`geoLookup.js:70-87`)
US ke liye `norm.endsWith(st)` use karta hai (`77`). Kyunke `"West Virginia".endsWith("Virginia")`
sach hai, aur `US_STATE_NAMES` mein Virginia pehle aata hai, is liye **West Virginia ke
geocodes "Virginia" ban jaate hain**:
  - geocode `304`/`681` = `"West Virginia"`, magar `Virginia.prefixes` mein `304` aur `681`
    shamil ho jaate hain (galat).
  - `West Virginia` khud kabhi verified nahi hota → label-only.
  - Isi liye 50 states mein se **49 verified** aur West Virginia label-only dikhta hai.

> Summary: "region = verified location" sirf tab jahan geocoder granularity plan se match kare.
> US (NPA-level) match karta hai; GB/PK/AE/FR/DE nahi. West Virginia ek `endsWith` bug ki wajah
> se chhoot jaata hai.

### 7.4 Real mapping kahan hai (verified list)

Aaj ke runtime par **19 countries** mein verified regions hain (execute karke):

```
US 49 | CA 10 | IN 1206 | CN 340 | MX 182 | BR 27 | CL 24 | BD 8 | TJ 8 | KI 6 |
YE 4 | AT 2 | TO 2 | EG 1 | ML 1 | SO 1 | SJ 1 | TA 1 | VU 1
```

Baqi **180 countries sab label-only** (e.g. GB, FR, DE, PK, AE, AU, CZ, DZ, ...).
`IN` ke 1206 "verified" asal mein **city-level** geocode names hain jo mobile plan se match
karte hain. Operator mapping `operators.json` se: GB par 85 real carriers, US par sirf Fractel
+ Onvoy (Section 6).

### 7.5 "label-only" ka matlab (UI behaviour)

- `labelOnly` flag un regions par jo `regions.json` se hain aur jinke paas verified prefix
  mapping nahi (`geoLookup.js:433`). Sirf naam.
- Badge `label only` (`1070-1074`) + `+{cc} • any` (`1079`).
- Note jab `regionSource === 'iso'` (`971-979`): *"Official subdivision names are available for
  this country, but mobile prefixes are not mapped to individual regions. Treat these as
  targeting labels, not verified locations."*
- User ko explicitly tick karna padta hai **"Generate under label-only regions"** (`1113`) —
  warna selection `disabled` (`1046`, `1053`).
- Auto-select **sirf pehli verified** region karta hai (`165-166`); label-only kabhi auto-select
  nahi hoti.

---

## 8) Kya numbers real state ke hote hain? (clear answer)

**Nahi.** Sab numbers **synthetic / format-valid** hain — real, active, ya kisi verified
location/subscriber ke nahi.

Daleel (code se):

1. UI khud: `"Synthetic / test numbers validated with libphonenumber."` (`NumberGenerator.jsx:734`).
2. `numberingPlans.js` header: *"...NEVER claims a generated number belongs to a real person,
   brand or WhatsApp account. Generated numbers are synthetic/test data..."*
3. `classifyCandidate` (`156`) sirf **format/plan** check karta hai — kisi live DB se nahi.
4. `getRegionPool` header: empty result = "label-only"; country-wide numbers region label ke
   neeche **silently** paida nahi hote (fallback record hota hai).
5. Koi WhatsApp API / worker / live subscriber lookup generation mein **code mein nahi mila**.

| libphonenumber guarantee karta hai | Guarantee NAHI karta |
|---|---|
| Number us country ke plan ke hisaab se **format-valid** hai | Number **active/subscriber** hai |
| Type (MOBILE / FIXED) detect | Number kisi **real shakhs** ka hai |
| E.164 round-trip match | Number **us state/region** ka hai (portability) |
| — | Number **WhatsApp par registered** hai |

**format valid ≠ active ≠ us state ka hai ≠ WhatsApp par.**

---

## 9) Limitations & Edge Cases (sirf report)

1. **NANP (+1) area codes mobile operator se tied nahi.** Geography batata hai, carrier nahi;
   overlap rule ki wajah se US par sirf Fractel + Onvoy.
2. **Number portability:** number apna original operator/region chhod sakta hai; code yeh nahi
   jaan sakta. Har region/operator claim = **label**.
3. **Label-only regions:** verified prefix na hone par generation poora country plan use karta
   hai (fallback recorded); sirf label badalta hai.
4. **"+1 hamesha US":** `CALLING_CODE_PREFERRED_ISO = {1:'US', 7:'RU', 61:'AU', 44:'GB', 212:'MA'}`
   (`numberingPlans.js:705-711`). +1 par generate karne par plan US se validate hota hai.
5. **Hardcoded limits** sab `numberingConstants.js` mein: `UI_MAX_QTY=50000`,
   `ENGINE_MAX_QTY=500000`, `SEQUENTIAL_MAX=10000`, `MIN_TOTAL_ATTEMPTS=20000`,
   `MAX_ATTEMPT_FACTOR=60`, `STALL_FLOOR=5000`, `STALL_POOL_FACTOR=20`,
   `TOTAL_TIME_BUDGET_MS=8000`, `MIN_OPERATOR_PREFIX_LEN=2`.
6. **Chhote plans:** Tokelau (+690), Tristan da Cunha (+290) jaise sirf chand distinct numbers
   produce kar sakte hain; `capacity` target kamm karta hai, `truncated` set hota hai.
7. **Degenerate filter heuristic:** `SUBSCRIBER_RULES` kuch valid numbers bhi reject kar sakta
   hai, lekin sirf subscriber part par (4-in-a-row allowed).
8. **NANP warning set:** `{CA,JM,PR,DO,TT,BB,BS,GD,GU,VI}` CA par warning trigger karta hai
   magar BM/KY nahi — QA decision, bug nahi.
9. **`mobilePrefixes.json` regenerate nahi hota** — shipped file authoritative.
10. **West Virginia mapping bug** (`geoLookup.js:77` `endsWith`) — Section 7.3.

---

## 10) Examples (traced, asli output)

> Random numbers `crypto.getRandomValues` se, is liye har run par alag. Sequential deterministic
> hai. Neeche ke nataij asli run se.

### Example A — Sequential: US, start `2025550100`, end `2025550105`

```
+12025550100
+12025550101
+12025550102
+12025550103
+12025550104
+12025550105
```
`stats.accepted = 6`, `truncated = false`.

### Example B — Random: US, quantity 5

```
+18326659466
+18359481632
+18387520107
+18397827540
+18403496015
```
(ek asli run; round-robin NPAs + Web Crypto subscriber digits.)

### Example C — Region-Wise: US + California, quantity 5

- California **verified**: 39 NPAs; `getRegionPool('US', California)` = 39 `[prefix,10]` pairs.
- **Output (ek asli run):**

```
+12797855138
+13106203099
+13234280243
+13415459212
+13506318084
```
- Metadata: `regionName:"California"`, `regionVerified:true`; CSV region column "California",
  verified = `yes`.

### Example D — Country jahan mapping REAL hai vs label-only

| Country | Region | verified? | prefix? | Operator list |
|---|---|---|---|---|
| US (+1) | California | **yes** | 39 NPAs | Fractel, Onvoy |
| US (+1) | District of Columbia | no (label-only) | `[]` | Fractel, Onvoy |
| GB (+44) | London / any | **no** (label-only) | `[]` | 85 real carriers |

GB mein region select karne par note aata hai aur generation poora GB plan use karta hai
(fallback recorded). US California par prefix region pool ko narrow karta hai — magar phir bhi
number ka **actually** woh subscriber hona guarantee nahi (portability).

---

## 11) Short Summary

- Feature = `NumberGenerator.jsx` (UI) + `numberingPlans.js` (engine) + `numberingDatasets.js`
  (loaders) + `mobilePrefixes.json`/`operators.json`/`regions.json` (data) + `geoLookup.js` (region list).
- Sirf **ek** runtime phone library: `libphonenumber-js ^1.13.4` (`/max` build). Randomness ab
  **Web Crypto** se.
- 3 modes: Sequential (`generateSequentialNumbers`, BigInt, plan-prefix rule, max 10,000),
  Random (`generateFromPoolAsync`, 50,000 UI / 500,000 engine), Region-Wise
  (`generateBucketedAsync`, buckets = region×operator).
- Data build-time `npm run build:datasets` se; `mobilePrefixes.json` authoritative aur
  regenerate nahi hota; rebuild byte-match guard se protect.
- **Region-Wise:** verified = geocoder prefixes ∩ mobile plan. US mein 49 states verified;
  GB ke saare subdivisions label-only (landline vs mobile). West Virginia ek `endsWith` bug se
  label-only reh jaata hai.
- **Numbers format-valid synthetic hain — real, active, ya verified location/subscriber nahi.**

---

## 12) What changed (old vs new)

| # | Pehle (old) | Ab (current code) | File:line |
|---|---|---|---|
| 1 | Randomness `Math.random()` | **Web Crypto** + rejection sampling | `numberingPlans.js:70-96` |
| 2 | `validateCandidate` sirf valid/invalid | **`classifyCandidate`** reason-aware (`prefix/length/type/country/invalid/degenerate/duplicate`) | `numberingPlans.js:156` |
| 3 | Sequential: `parseInt`, `start==end` reject, prefix force nahi | **BigInt**, `start==end` valid, asli **plan prefix** zaroori, zero-pad | `numberingPlans.js:629-686` |
| 4 | Degenerate `(\d)\1{3,}` | `SUBSCRIBER_RULES` maxRepeatRun=**4**, all-same + staircase | `numberingConstants.js` , `numberingPlans.js:117` |
| 5 | Region pool label-only par **chupke country plan** | `getRegionPool` = `[]`; caller explicit **label-only** + fallback **record** | `numberingPlans.js:293`, `NumberGenerator.jsx` |
| 6 | Region list per-country hardcoded | **runtime** `getDynamicRegionsForCountry`; ambiguous prefixes excluded | `geoLookup.js:367,97` |
| 7 | Operators false positives / duplicates | naam merge + `MIN_OPERATOR_PREFIX_LEN=2`; US = Fractel + Onvoy | `numberingPlans.js:317` |
| 8 | `generateBucketed` synchronous | **`generateBucketedAsync`** chunked yield + recovery + interleave | `numberingPlans.js:904` |
| 9 | Limits UI mein hardcoded | ek jagah **`numberingConstants.js`** | `numberingConstants.js` |
| 10 | Datasets "pre-generated" (undocumented) | documented `npm run build:datasets` + **byte-match guard** | `scripts/build-numbering-datasets.mjs` |
| 11 | US states mostly label-only (per old doc) | Ab **US 49 verified** (NPA granularity); GB label-only | `geoLookup.js:367` |
| 12 | Footer: "Numbering data: ... regenerate with `npm run build:datasets`" | **UI mein koi aisi footer line maujood nahi** (neeche note) | — |

---

## 13) اردو خلاصہ (Final Conclusion)

یہ "Number Generator" صرف **libphonenumber-js** لائبریری سے نمبروں کی **shape/format** چیک
کرتا ہے، اور نمبر country کی اصل numbering plan (build-time `mobilePrefixes.json`) سے بناتا ہے۔

- **تینوں modes** (Sequential، Random، Region-Wise) میں بننے والے نمبر **synthetic/test**
  ہوتے ہیں — یعنی format کے لحاظ سے درست لیکن **اصل، فعال (active)، کسی حقیقی شخص کا، کسی
  خاص ریاست کا، یا WhatsApp پر رجسٹرڈ** ہونے کی کوئی ضمانت نہیں۔
- **Randomness** اب `Math.random()` کی بجائے **Web Crypto** سے ہے۔
- **Data** وقت build پر `npm run build:datasets` سے بنتا ہے (`operators.json`,
  `regions.json`)؛ `mobilePrefixes.json` authoritative ہے اور دوبارہ generate نہیں ہوتا؛
  rebuild byte-match guard سے محفوظ ہے۔
- **Region-Wise کا root cause:** region نام offline **geocoder** سے آتے ہیں جس کے prefixes
  عام طور پر **landline/geographic** ہوتے ہیں، مگر اُنہیں country کے **mobile plan** سے
  intersect کیا جاتا ہے۔ جہاں یہ دونوں ملتے ہیں (مثلاً US کے 3-digit NPA) وہاں region
  **verified** بنتی ہے (US کے **49 states**)؛ جہاں نہیں ملتے (مثلاً GB کے 020/0113 بمقابلہ 7xxx
  mobile) وہاں پورا ملک **label-only** ہو جاتا ہے اور generation ملک کے پورے plan پر fall
  back کرتا ہے (fallback record ہوتا ہے)۔
- **اہم وضاحت:** موجودہ (current) code میں US مکمل طور پر label-only **نہیں** ہے — 49 states
  verified ہیں۔ اگر runtime پر US کے تمام states label-only نظر آئیں تو اس کی وجہ geocode
  chunk کا لوڈ نہ ہونا، ایک stale build، یا پرانا code ہو سکتی ہے۔ (West Virginia ایک
  `endsWith("Virginia")` bug کی وجہ سے واقعی label-only رہ جاتا ہے۔)
- **US (+1)** میں operators صرف **Fractel + Onvoy** (659 prefixes) نظر آتے ہیں کیونکہ
  `operators.json` کے US میں زیادہ تر entries Caribbean +1 علاقوں کی ہیں جو US کے NPA plan
  سے overlap نہیں کرتیں۔
- **حتمی بات:** Format valid ہونا ≠ نمبر استعمال میں ہونا ≠ اُس ریاست/operator کا ہونا ≠
  WhatsApp پر ہونا۔

---

## 14) Footer line (requested removal) — status

Task ke mutabiq Number Generator ke UI se sirf yeh footer line hataani thi:
> "Numbering data: libphonenumber-js metadata + libphonenumber-geo-carrier resources ·
> generated 2026-10-10 · regenerate with `npm run build:datasets`"

**Finding:** yeh line **current code mein maujood nahi** (grep/ripgrep over `src`, repo root,
aur `dist/` — koi match nahi). Is liye hatane ke liye koi code change **nahi** hua.

- `NumberGenerator.jsx:27` par `DATASET_INFO` import hota hai magar **unused (dead import)** hai
  — yani provenance footer UI mein render nahi hota.
- Provenance data sirf `numberingConstants.js:67` (`DATASET_INFO`) mein rehta hai:
  `generatedAt:'2026-10-10'`, `source:'libphonenumber-js metadata + libphonenumber-geo-carrier
  resources'`, `regenerate:'npm run build:datasets'`.
- Is document ke ilawa **koi bhi code file change nahi hui** (read-only analysis).
