# Contact Generator — Code Analysis (WhatsApp Shield)

> Read-only analysis. Har claim ke saath file path aur function name diya gaya hai.
> Jo cheez code mein nahi mili, wahan likha hai: **"code mein nahi mila / not found"**.
> Koi existing file modify nahi ki gayi.

---

## 1) Overview

Yeh feature "WhatsApp Shield" ke andar **Audience Setup → Range Gen → Number Generator** panel hai.
UI ka main component hai: `src/components/dashboard/NumberGenerator.jsx` (export `NumberGenerator`, line 31).

Panel ke 3 modes hain (line 30 `mode` state, default `'sequential'`):
- **Sequential / Range** — `runSequential` (line 268)
- **Random** — `runRandom` (line 393)
- **Region-Wise** — `runRegion` (line 411)

UI title ke neeche likha hua text hai:
`"Synthetic / test numbers validated with libphonenumber."` (line 622).
Yeh sabse important baat hai: tool khud kehta hai ke yeh **synthetic / test numbers** hain — real subscriber numbers nahi.

Flow ek line mein:
```
UI (NumberGenerator.jsx)
   -> user "Generate Numbers" click karta hai (handleGenerate, line 549)
   -> us mode ka function chalta hai (runSequential / runRandom / runRegion)
   -> numberingPlans.js ke helpers pool/prefix banate hain
   -> validateCandidate() libphonenumber se check karta hai
   -> generated[] state mein valid numbers aate hain
   -> "Generation Plan Preview" + results + CSV/copy/use
```

**Facebook / WhatsApp ka koi server is feature mein involve nahi hai.** Ye poori generation browser (client-side) mein hoti hai. Koi API route / worker is generation ke liye code mein nahi mila (backend `backend/server.js` validation-scanning ke liye hai, number generation ke liye nahi).

---

## 2) Libraries Used (table)

Versions `package.json` se liye gaye hain (`D:\WhatsApp\package.json`, lines 20–54).

| Package | Version | Kahan use hota hai | Kis kaam ke liye |
|---|---|---|---|
| `libphonenumber-js` | `^1.13.4` | `src/data/numberingPlans.js` (line 1–2), `src/utils/geoLookup.js` (line 1), `src/pages/NumberFormatsPage.jsx` (line 4) | Number **validation** aur **parsing**. `parsePhoneNumberFromString` / `parsePhoneNumberFromString as parseMaxPhoneNumber` (`libphonenumber-js/max`, line 2). `isValid()`, `getType()`, `country`, `countryCallingCode`, `nationalNumber` nikalne ke liye. Yeh hi feature ka core engine hai. |
| `libphonenumber-geo-carrier` | `^2.0.0` | Sirf `package.json` mein mila (line 40). | **Import kahin nahi mila is generation feature mein.** `operators.json` aur `mobilePrefixes.json` build-time generate kiye gaye lagte hain (file headers dekh ke), lekin runtime par is library ka direct import code mein **nahi mila**. |
| `country-flag-icons` | `^1.5.11` | Flag dikhane ke liye (indirect, `SvgFlag` ke through) | Country flag UI. Generation logic nahi. |
| `lucide-react` | `^0.475.0` | `NumberGenerator.jsx` (line 5) | Icons (Users, Shuffle, MapPin, etc.). |
| `react` / `react-dom` | `^18.3.1` | Poore frontend | UI framework. |
| `framer-motion`, `gsap`, `recharts` | various | App ke doosre pages | Animations/charts. Generation se direct taalluq nahi. |
| `country-state-city` | `^3.2.1` | `package.json` line 34 mein hai. | Is generation feature mein iska direct import **code mein nahi mila / not found**. |

**Random / utility libraries:** Koi external random lib use nahi hui. Randomness JS built-in `Math.random()` se hai — `randomDigits(len)` function `src/data/numberingPlans.js` line 61–65.

**Datasets (repo ke andar, node_modules nahi):**

| File | Format | Kis kaam ke liye | Loader |
|---|---|---|---|
| `src/data/mobilePrefixes.json` | `{ ISO: { cc, natLens[], prefixes[[prefix,len]], parent? } }` | Territory-wise mobile/fixed prefix pool. Generation ka asli source. | `loadMobilePrefixes()` — `src/data/numberingDatasets.js` line 33 |
| `src/data/operators.json` | `{ ISO: [ { n: name, p: [prefixes] } ] }` | Carrier / operator names aur unke prefixes. | `loadOperators()` — line 43 |
| `src/data/regions.json` | `{ ISO: [ [code, name] ] }` | ISO 3166-2 subdivisions (sirf naam, label-only). | `loadRegions()` — line 53 |
| `src/data/countries.js` | `[{ name, code, iso }]` | Calling code ↔ ISO mapping. Comment line 1: "Generated dynamically from libphonenumber-js official metadata". | direct import |
| `src/data/geocodes/{cc}.json` | `{ prefix: location }` | Offline geocoding (prefix → jagah). Region list banane ke liye. | `loadGeocodesForCallingCode()` — `src/utils/geoLookup.js` line 152 |

> Note: `mobilePrefixes.json`, `operators.json`, `regions.json` ke headers (`numberingDatasets.js` line 1–18) ke mutabiq yeh **build-time generated** datasets hain — `mobilePrefixes.json` "discovered by probing libphonenumber metadata" se, `operators.json` "extracted from libphonenumber-geo-carrier resources" se, aur `regions.json` ISO 3166-2 se. Generation ke waqt koi network call / external API nahi hota.

---

## 3) File Map

| Concern | File | Function / Component | Line |
|---|---|---|---|
| **UI (poore 3 modes + preview + buttons)** | `src/components/dashboard/NumberGenerator.jsx` | `NumberGenerator` | 31 |
| **Generation Plan Preview** | `src/components/dashboard/NumberGenerator.jsx` | JSX block "Generation Plan Preview" | 996–1034 |
| **Sequential generator** | `src/components/dashboard/NumberGenerator.jsx` | `runSequential` | 268 |
| **Random generator** | `src/components/dashboard/NumberGenerator.jsx` | `runRandom` → `getRandomNumbers` | 393 |
| **Region-wise generator** | `src/components/dashboard/NumberGenerator.jsx` | `runRegion` → `generateBucketed` | 411 |
| **Async wrapper (limits, spinner, report)** | `src/components/dashboard/NumberGenerator.jsx` | `generateAsync` | 328 |
| **Validation step (core)** | `src/data/numberingPlans.js` | `validateCandidate` | 116 |
| **Pool-based generation (random engine)** | `src/data/numberingPlans.js` | `generateFromPool` | 348 |
| **Bucketed region/operator split** | `src/data/numberingPlans.js` | `generateBucketed` | 897 |
| **Random numbers entry point** | `src/data/numberingPlans.js` | `getRandomNumbers` | 419 |
| **Prefix pool lookup** | `src/data/numberingPlans.js` | `getCountryPrefixPool` / `getCountryPlan` | 136 / 155 |
| **Region pool** | `src/data/numberingPlans.js` | `getRegionPool` | 242 |
| **Operator list (per country)** | `src/data/numberingPlans.js` | `getOperatorsForCountry` | 260 |
| **Subdivision list (label-only)** | `src/data/numberingPlans.js` | `getSubdivisionsForCountry` | 291 |
| **Prefix expand** | `src/data/numberingPlans.js` | `expandPrefixes` | 198 |
| **Dataset loaders** | `src/data/numberingDatasets.js` | `ensureNumberingDatasets` etc. | 33–79 |
| **Region/state list (merged verified + label-only)** | `src/utils/geoLookup.js` | `getDynamicRegionsForCountry` | 331 |
| **Calling code ↔ ISO** | `src/data/numberingPlans.js` | `callingCodeToIso` | 461 |
| **Country data** | `src/data/countries.js` | `countries`, `getCountryByCallingCode` | 3, 1234 |
| **CSV export util** | `src/utils/exportUtils.js` | `downloadFile` | (used at line 27, 583) |

**Connection flow (UI click → output):**

```
[Generate Numbers] button  (NumberGenerator.jsx:1038)
        │ onClick
        ▼
handleGenerate()  (line 549)
        │  mode switch
        ├── 'sequential' ──► runSequential()          (line 268)
        │                        └─ ensureNumberingDatasets()  (numberingDatasets.js:63)
        │                        └─ getCountryPlan(iso)         (numberingPlans.js:155)
        │                        └─ loop Start..End ─► validateCandidate() (numberingPlans.js:116)
        │
        ├── 'random' ───────► runRandom()  (line 393)
        │                        └─ generateAsync()  (line 328)
        │                             └─ getRandomNumbers()  (numberingPlans.js:419)
        │                                  └─ generateFromPool() (numberingPlans.js:348)
        │                                       └─ validateCandidate() (line 116)
        │
        └── 'region' ───────► runRegion()  (line 411)
                                 └─ getDynamicRegionsForCountry() (geoLookup.js:331)  [state list]
                                 └─ getOperatorsForCountry()      (numberingPlans.js:260) [operator list]
                                 └─ expandPrefixes / getRegionPool  (pools)
                                 └─ generateBucketed()            (numberingPlans.js:897)
                                      └─ generateFromPool() per bucket
                                           └─ validateCandidate() (line 116)

        ▼
   setGenerated(validNums)  (line 318 / 365)
   setReport(...)            (line 320 / 367)
   "Generation Plan Preview"  re-renders  (line 996)
```

---

## 4) Sequential / Range Mode

Function: `runSequential` — `src/components/dashboard/NumberGenerator.jsx` line 268–325.

**Step by step:**

1. **Start/End read (line 269–272):**
   - `rangeStart` / `rangeEnd` (UI inputs, line 663 & 672) se strings liye jaate hain.
   - `.replace(/\D/g, '')` — sirf digits rakhe jaate hain (spaces, `+` waghera hata diye jaate hain).
   - `parseInt(..., 10)` se numbers banaye jaate hain.

2. **Basic range check (line 274–277):**
   - Agar start/end valid number nahi, ya `start >= end`, to error: *"Invalid range. Start must be a smaller number than End."* (Ghaur karein: `start == end` bhi reject hota hai.)

3. **Max limit (line 279–283):**
   - `count = end - start + 1`.
   - Agar `count > 10000` → error: *"Range too large. Maximum 10,000 sequential numbers per batch."*
   - **Hard limit = 10,000** (is mode ke liye).

4. **Country → ISO (line 285–289):**
   - `callingCodeToIso(seqCountry)` se ISO nikalta hai. `seqCountry` = shared `targetCountry` (line 37).
   - `callingCodeToIso` (numberingPlans.js:461) preferred ISO table use karta hai: `{1:'US', 7:'RU', 61:'AU', 44:'GB', 212:'MA'}` (line 447–453). Is liye **+1 ka matlab hamesha US** maana jaata hai, Canada nahi.

5. **Country code add (line 294):**
   - `cc = String(seqCountry).replace(/\D/g,'')` — calling code (jaise `"1"`).

6. **Datasets + plan + types (line 299–302):**
   - `await ensureNumberingDatasets()` — teen datasets load hote hain.
   - `plan = getCountryPlan(iso)` — plan metadata (cc, natLens, prefixes, isMobileOnly).
   - `types = typesForPlan(plan)` — allowed types. `typesForPlan` (line 41–43): agar `isMobileOnly === false` to `FIXED_TYPES` (`FIXED_LINE`, `FIXED_LINE_OR_MOBILE`), warna `MOBILE_TYPES` (`MOBILE`, `FIXED_LINE_OR_MOBILE`).
   - `validateIso = plan.sourceIso || iso` — agar territory apna plan na rakhe to parent ISO se validate.

7. **Loop (line 304–309):**
   ```
   for (let i = start; i <= end; i += 1) {
     const national = String(i);
     const e164 = validateCandidate(validateIso, cc, national, types);
     if (e164) validNums.push(e164);
     else invalid += 1;
   }
   ```
   - Har number `national` (country code ke **bina**, jaisa UI label kehta hai line 662) ban ke validation se guzarta hai.
   - `validateCandidate` (numberingPlans.js:116–129) yeh checks karta hai:
     - `parseMaxPhoneNumber('+' + callingCode + national, iso)` — `libphonenumber-js/max` se parse.
     - `parsed.isValid()` — **`isValid`** use hota hai. `isPossible` is mode mein use **nahi** hota (code mein nahi mila).
     - `allowedTypes.has(parsed.getType())` — **`getType()`** se type check (MOBILE / FIXED etc.).
     - `parsed.countryCallingCode === callingCode` round-trip.
     - `parsed.nationalNumber.length === national.length` round-trip.
     - `parsed.country === iso` round-trip.
   - Sab pass ho to `parsed.number` (E.164, jaise `+12025550100`) return hota hai.

8. **Invalid numbers (line 307–308):** chup-chaap drop ho jaate hain, sirf `invalid` counter barhta hai.

9. **Output (line 318–324):**
   - `setGenerated(validNums)`, `setDroppedCount(invalid)`.
   - Report: `{ mode:'sequential', country, iso, prefix:null, requested:count, produced:validNums.length }`.
   - Message: *"X valid numbers generated. (Y outside this country's numbering plan were dropped.)"*

> **Ahem:** Sequential mode country ki numbering plan ke **prefixes** ko force nahi karta. Yeh sirf `validateCandidate` par bharosa karta hai — yaani jo bhi number us country ke liye format-valid hai wo accept ho jaa sakta hai (chahe woh kisi mobile prefix ka na ho). Loop sirf apne diye gaye range par chalta hai.

---

## 5) Random Mode

Function: `runRandom` (NumberGenerator.jsx:393) → `generateAsync` (line 328) → `getRandomNumbers` (numberingPlans.js:419) → `generateFromPool` (numberingPlans.js:348).

**Step by step:**

1. **Quantity check (`generateAsync`, line 330–338):**
   - `requested = Math.floor(Number(quantity))` — kam az kam 1.
   - `MAX_QTY = 50000` (NumberGenerator.jsx:29). `requested > MAX_QTY` → error.

2. **`getRandomNumbers(countryCode, quantity)` (numberingPlans.js:419):**
   - `iso` banata hai, `ensureNumberingDatasets()` (line 421).
   - `plan = getCountryPlan(iso)`. Agar plan/prefixes nahi → error *"No numbering plan is available for this country yet."*.
   - `types = plan.isMobileOnly ? MOBILE_TYPES : FIXED_TYPES` (line 426).
   - `generateFromPool({ pool: plan.prefixes, allowedTypes: types, ... })` (line 427).

3. **`generateFromPool` (line 348–413) — asli random logic:**
   - `requested = min(quantity, HARD_MAX_QUANTITY=500000)` (line 48, 349).
   - `usable = normalizePool(pool)` (line 352 / 315) — prefix ko chhota karta hai taake kam az kam 1 subscriber digit bache.
   - **Capacity** (line 361–366): har `[prefix, natLen]` ke liye `10^(natLen - prefix.length)` numbers possible. `target = min(requested, capacity)`.
   - **Loop (line 378–404):**
     - `[prefix, natLen] = usable[cursor % usable.length]` — **round-robin** taake har prefix par numbers evenly phailen (line 379–380).
     - `subscriber = randomDigits(natLen - prefix.length)` (line 382, `randomDigits` line 61: `Math.floor(Math.random()*10)` per digit).
     - `national = prefix + subscriber` (line 383).
     - **Degenerate check** (line 387): `hasDegenerateSubscriber(national, prefix.length)` (line 85). Reject karta hai: same digit repeat (`+92311111111`), 4+ same digits in a row (`(\d)\1{3,}`), ya ascending/descending staircase (`123456`). Sirf **subscriber part** check hota hai, prefix nahi.
     - `validateCandidate(validateIso, callingCode, national, types)` (line 392).
     - **Duplicate handling** (line 393): `if (e164 && !seenSet.has(e164))` — `seenSet` (Set) mein add, warna skip.
   - **Safety guards:**
     - `maxAttempts = max(20000, target*60)` (line 46, 370).
     - `stallLimit = max(5000, usable.length*20)` (line 58, 371).
     - `BUCKET_TIME_BUDGET_MS = 4000` (line 54, 372) — wall-clock budget.
   - Return `{ numbers: [{number, prefix, national}], truncated, error }` (line 406–412).

4. **Output (runRandom line 407):** report `{ mode:'random', country, iso, prefix:null, requested, produced }`.
   - `runRandom` `getRandomNumbers` ka result direct return nahi karta — `generateAsync` line 356 `{ numbers, ... }` expect karta hai. `getRandomNumbers` `{ numbers: [...strings], error, truncated }` deta hai, jo match karta hai.

> Yaani Random mode **country ke real discovered mobile prefixes** se random subscriber digits jorrta hai, phir libphonenumber se validate karta hai, aur unique rakhta hai.

---

## 6) Region-Wise Mode

Function: `runRegion` — `src/components/dashboard/NumberGenerator.jsx` line 411–547.

### 6a. State / Region list kaise banti hai

- UI mein list `regions` state se aati hai (line 52), jo `useEffect` (line 88–129) mein set hoti hai.
- Data source: `getDynamicRegionsForCountry(iso, regionCountry)` — `src/utils/geoLookup.js` line 331.
- Yeh function **do sources** ko merge karta hai:
  1. **Prefix regions (verified)** — offline geocoder chunks `src/data/geocodes/{cc}.json` se. `loadGeocodesForCallingCode` (geoLookup.js:152). Har prefix ek location se map hota hai; yahan se `verified: true`, `labelOnly: false` region banti hai (geoLookup.js:386–396).
     - US ke liye special scoping (geoLookup.js:358–374): sirf woh locations rakhta hai jo US state names se match karein (Canadian locations skip).
  2. **ISO 3166-2 subdivisions (label-only)** — `getSubdivisionsForCountry(iso)` (numberingPlans.js:291), jo `regions.json` se aata hai. `verified: false`, `labelOnly: true`, `prefix: ''`, `prefixes: []` (geoLookup.js:406–422).
- Dedupe (geoLookup.js:424–427): agar koi naam verified prefix region mein pehle se hai, uska label-only twin hata diya jaata hai.
- `source` set hota hai: `'prefix'` / `'iso'` / `'prefix+iso'` / `'none'` (line 433–436).

### 6b. Operator list aur unke prefixes

- UI `operatorOptions` state (line 59) `useEffect` (line 132–160) mein load hoti hai.
- `getOperatorsForCountry(regionIso)` — `src/data/numberingPlans.js` line 260.
- Data source: `src/data/operators.json` (build-time `libphonenumber-geo-carrier` se banaya gaya, header line 11–13).
- Logic (line 260–286): per ISO carriers list le ke, sirf woh carrier rakhta hai jiske prefixes us country ke plan prefixes se match karein (`mp.startsWith(p) || p.startsWith(mp)`). Result: `{ id, name, prefixes, prefix }`.
- UI display (line 845–847): `+{regionCountry} {op.prefixes.slice(0,3).join(', ')}{... +N}` — is liye US par dikhta hai jaise `Onvoy +1 659200, 659222, 659300 +9` (3 dikhte hain, `+9` baaki).

### 6c. "Distinct Prefixes In Scope" aur "Targets"

- **Distinct Prefixes In Scope** = `combinedPrefixCount` (line 221–226):
  - `selectedPrefixes` — selected **regions** ke prefixes ka union (line 181–191).
  - `selectedOperatorPrefixes` — selected **operators** ke prefixes ka union (line 212–218).
  - Dono ka union size. UI line 1025 par dikhta hai.
- **Targets** = UI line 1012:
  - `(report && report.buckets) || (selectedRegionsList.length || selectedOperatorsList.length || 1)`.
  - `report.buckets` = buckets ki tadaad (line 534). Bucket banta hai region×operator combination se (line 436–444).

**US par "Targets: 1" aur "Distinct Prefixes In Scope: 0" kyun?**

- US ke liye region list predominantly **label-only** hoti hai (states ke paas verified prefix mapping nahi — sirf naam). Label-only region ka `prefix: ''`, `prefixes: []` hota hai.
- Is liye `selectedPrefixes` **khali** rehti hai → `combinedPrefixCount = 0`.
- Operator select na ho (any operator) aur ek state select ho: buckets = `[{region, operator:null}]` → length **1** → "Targets: 1".
- Agar `report` mojood na ho (generate se pehle), preview formula `selectedRegionsList.length || selectedOperatorsList.length || 1` = 1 deta hai (kyunki 1 state selected hai).

### 6d. "label only" ka matlab (code ke hisaab se)

- Code mein `labelOnly` flag (geoLookup.js:419) un regions par lagta hai jinke paas **koi verified prefix mapping nahi**. Sirf naam hota hai (ISO 3166-2 se).
- UI mein badge dikhta hai: `label only` (NumberGenerator.jsx:951–955) aur line 960 par `+{cc} • any`.
- Note (line 858–866) sirf tab dikhta hai jab `regionSource === 'iso'`, yaani **koi bhi verified prefix region mojood nahi**:
  > *"Official subdivision names are available for this country, but mobile prefixes are not mapped to individual regions. Treat these as targeting labels, not verified locations."*
- Generation par asar (numberingPlans.js `getRegionPool` line 242–253): label-only region ke paas prefixes nahi, is liye `getRegionPool` **country ka pura plan pool** (`plan.prefixes`) return kar deta hai. Matlab: label sirf ek **targeting label** hai — us state ki actual location ka claim nahi.

### 6e. Kaunse countries mein real prefix→region mapping hai

Real (verified) prefix→region mapping **offline geocoder chunks** se aati hai: `src/data/geocodes/{cc}.json`. Jo bhi calling code ka geocode file mojood hai (`src/data/geocodes/` mein 152 files), us country ke liye verified prefix regions ban sakti hain — **agar** woh prefix kisi location se map ho aur (US ke case mein) state name se match kare.

Ye files mojood hain (kan-jo list, `src/data/geocodes/`): `1, 7, 20, 27, 30–58, 61–98, 212, 213, 216, 218, 220–269, 290, 299, 351–389, 420, 421, 501, 504, 51–58, 592, 593, 595, 598, 599, 670–690, 850, 880, 886, 960–968, 970–976, 992–996` waghera.

- **Verified prefix mapping un countries ke liye jahan geocode file hai aur prefix location resolve karti hai** (jaise GB/44, PK/92, AE/971, IN/91, DE/49, FR/33, AU/61 etc.).
- **Label-only** woh subdivisions hain jinka naam `regions.json` se aata hai lekin prefix mapping nahi milti. US ke bahut se states is shaqal mein label-only nikalte hain (is liye UI par "label only" aur `+1 • any` dikhta hai).

> Code mein hardcoded per-country "verified vs label" list **nahi mili**. Yeh **runtime** par decide hota hai: `getDynamicRegionsForCountry` (geoLookup.js:331) geocode data aur ISO subdivisions ko merge karke `verified` / `labelOnly` set karta hai. Is liye exactly kaunsi states verified hain yeh geocode file ke content par depend karta hai, code par nahi.
> **Note:** `numberingPlans.js` mein ek purana hardcoded `REGIONS` object bhi hai (line 549–851), jismein US, CA, IN, PK, GB waghera ke liye kuch prefixes likhe hain. Lekin `getRegionsForCountry` (line 864) ab `getDynamicRegionsForCountry` ke saath mix hota hai; kuch jagah yeh purana object `lookupExistingNumberingPlanRegion` (geoLookup.js:109) ke reverse index ke liye use hota hai. Region-Wise UI `getDynamicRegionsForCountry` result use karti hai.

### 6f. Selection scenarios

`runRegion` (line 411–547) buckets banata hai (line 435–444):
```
hasRegions   = selectedRegionsList.length > 0
hasOperators = selectedOperatorsList.length > 0

hasRegions && hasOperators → har (region × operator) ek bucket
hasRegions only            → har region ek bucket (operator null)
otherwise (operators only) → har operator ek bucket (region null)
dono khali                  → error (line 446–448)
```

- **Ek state, koi operator nahi:** 1 bucket. Pool = `getRegionPool(iso, region)` (line 456). Label-only state ke liye yeh country plan pool hai.
- **Kai states, koi operator nahi:** har state ek bucket. `generateBucketed` (line 897) batch ko fair split karta hai — `base = floor(total/buckets)`, pehle `total % buckets` buckets ko +1 (line 926–927).
- **Saari states select:** `Select All` button (line 882) `setSelectedRegionIds(regions.map(r=>r.id))`. Bahut se buckets ban jaate hain; har bucket ko thora hissa milta hai.
- **State + operator:** bucket mein operator prefixes priority lete hain: `opPrefixes ? expandPrefixes(iso, opPrefixes) : ...` (line 453–456). Agar operator ke prefixes resolve na hon to `fallbackUsed` record hota hai aur region/country pool par gir jaata hai (line 457–461).
- **Sirf operator:** bucket `{region:null, operator}`; pool operator prefixes se.

**Quantity kaise apply hoti hai:**
- `totalTarget = min(floor(regionQuantity), MAX_QTY=50000)` (line 413).
- `generateBucketed` target ko buckets mein baantta hai (line 926–936), phir interleave karta hai (line 938–946) taake ek bucket output mein cluster na kare, aur `slice(0, target)` (line 948).

### 6g. Output metadata

- Har number par `meta` lagti hai (line 477–495): `country, regionId, regionName, regionVerified, operatorName, prefix, generationIndex`.
- `window.__whatsappShieldNumberMetadata` par Map rakhi jaati hai (line 498) — CSV export (line 575) is se region/operator column bharta hai; agar `regionVerified === false` aur naam "All regions" nahi, to CSV mein `(label only)` lagta hai (line 578).

---

## 7) Kya numbers real state ke hote hain? (clear answer)

**Nahi.** Code ke mutabiq yeh **synthetic / test numbers** hain, **format-valid** hain — real/active/subscriber numbers ya verified locations **nahi**.

Daleel (code se):

1. UI khud likhta hai: `"Synthetic / test numbers validated with libphonenumber."` (NumberGenerator.jsx:622).
2. `numberingPlans.js` header (line 31–34):
   > *"The system NEVER claims a generated number belongs to a real person, brand or WhatsApp account. Generated numbers are synthetic/test data..."*
3. `validateCandidate` (line 116) sirf **format/plan** check karta hai, kisi live database se nahi:
   - `isValid()` — number ki **shakal** sahi hai.
   - `getType()` — type (MOBILE/FIXED) plan se match karta hai.
   - length + country + calling-code round-trip.
4. `getRegionPool` comment (line 233–238) saaf kehta hai label-only regions ke liye:
   > *"...never a claim about where that number is located."*
5. **Koi WhatsApp / Facebook / HLR / subscriber API call is feature mein nahi hai.** Koi network request nahi jo bataaye number active hai ya WhatsApp par registered hai.

**libphonenumber validation kya guarantee karta hai aur kya nahi:**

| Karta hai (guarantee) | Nahi karta (guarantee nahi) |
|---|---|
| Number kisi country ke numbering plan ke mutabiq **format-valid** hai | Number **actually in use / active** hai |
| Length, country code, area/mobile prefix plan ke mutabiq hai | Number kisi **real shakhs** ka hai |
| Type (MOBILE / FIXED) detect kar sakta hai | Number **us state/region** ka hai (portability ke wajah se) |
| E.164 output round-trip match karta hai | Number **WhatsApp par registered** hai |

Yaani: **valid format ≠ number active hai ≠ us state ka hai ≠ WhatsApp par hai.**

---

## 8) Limitations & Edge Cases (sirf report)

1. **US/Canada (NANP +1) area codes mobile operator se tied nahi.** NANP mein area code (NPA) geography batata hai, mobile operator nahi. Operator list `operators.json` se aati hai jo build-time `libphonenumber-geo-carrier` se bani — is liye US operators (jaise Onvoy, Fractel) ke prefix groups dikh sakte hain lekin yeh mobile-operator mapping reliably represent nahi karte (`getOperatorsForCountry`, numberingPlans.js:260).
2. **Number portability:** koi bhi number apna original operator/region chhod kar doosre par port ho sakta hai. Code is ko nahi jaan sakta. Is liye "region/operator" claim hamesha **label** hai.
3. **Label-only regions:** US ke bahut se states ke paas verified prefix mapping nahi. `getRegionPool` (line 242) aise regions ke liye pura country pool use karta hai — yaani state select karna sirf label badalta hai, actual number location nahi.
4. **"+1 hamesha US":** `callingCodeToIso` mein `CALLING_CODE_PREFERRED_ISO = {1:'US', ...}` (line 447). Is liye Canada/Caribbean ke numbers +1 under generate karne par US plan se validate honge (aur `parsed.country === 'US'` check ki wajah se CA numbers drop ho sakte hain).
5. **Hardcoded limits:**
   - Sequential: `count > 10000` reject (NumberGenerator.jsx:280).
   - Random / Region quantity: `MAX_QTY = 50000` (line 29, 335).
   - `generateFromPool`: `HARD_MAX_QUANTITY = 500000` (numberingPlans.js:48).
   - Attempts: `MIN_TOTAL_ATTEMPTS=20000`, `MAX_ATTEMPT_FACTOR=60` (line 46–47).
   - Stall: `STALL_FLOOR=5000`, `STALL_POOL_FACTOR=20` (line 58–59).
   - Time budget per bucket: `BUCKET_TIME_BUDGET_MS=4000` (line 54).
6. **Chhote plans:** kuch territories (jaise Tokelau +690, Tristan da Cunha +290) sirf kuch sau distinct numbers produce kar sakte hain. `capacity` (line 361) is liye target limit karta hai aur `truncated` set karta hai (line 410).
7. **Degenerate filter heuristic:** `hasDegenerateSubscriber` (line 85) kuch valid numbers ko bhi reject kar sakta hai (jaise jisme legit 4-digit repeat ho), lekin yeh subscriber part par hi lagta hai.
8. **`country-state-city` package** `package.json` mein hai (line 34) lekin is feature mein direct import **code mein nahi mila** — ya to dead dependency hai ya kisi aur page mein use hoti hai (is analysis mein generation code mein nahi mili).
9. **`libphonenumber-geo-carrier`** bhi `package.json` mein hai (line 40) lekin runtime generation code mein direct import **nahi mila** — datasets build-time pre-generate hain.
10. **`REGIONS` hardcoded object** (numberingPlans.js:549–851) mein kuch entries **duplicate/overlapping prefixes** rakhti hain (jaise IN mein `983` Maharashtra aur West Bengal dono; PK mein sab provinces `300`). `getRuntimeReverseRegionIndex` (geoLookup.js:63) sirf un prefixes ko index karta hai jo **unique** region identify karein (`names.size === 1`, line 97–101) — baaki skip.
11. **`regionSource` note:** "label only / prefixes not mapped" note sirf tab aata hai jab `regionSource === 'iso'` (NumberGenerator.jsx:858). Mixed case (`prefix+iso`) mein note chhup jaata hai, chahe kuch states label-only hon.
12. **Sequential mode plan prefixes ignore karta hai:** sirf `validateCandidate` par bharosa. Yaani aap aisa range de sakte hain jo country ke liye valid format ho lekin mobile prefix ka na ho (agar plan FIXED_LINE_OR_MOBILE allow kare).

---

## 9) Examples

> Neeche output **expected / illustrative** hai (actual digits `Math.random()` par depend karte hain, is liye exact subscriber digits har baar badal sakte hain). Structure aur validation behavior code se traced hai.

### Example A — Sequential: United States, start `2025550100`, end `2025550105`

Trace (`runSequential`, NumberGenerator.jsx:268):
- `seqCountry = "1"`, `start = 2025550100`, `end = 2025550105`.
- `count = 6` (≤ 10000, OK).
- `iso = callingCodeToIso("1") = "US"`.
- `cc = "1"`, `plan = getCountryPlan("US")`, `types` (US plan likely FIXED_LINE_OR_MOBILE) .
- Loop 6 numbers, `national` = `2025550100` … `2025550105`.
- Har ek `validateCandidate("US", "1", national, types)`:
  - `+'12025550100'` parse → `isValid()` (202 area code Washington DC, 555 exchange — libphonenumber example-friendly range). `getType()` allowed hai.
  - `countryCallingCode === "1"`, length 10 === 10, `country === "US"` → pass.
- **Output (illustrative):**
  ```
  +12025550100
  +12025550101
  +12025550102
  +12025550103
  +12025550104
  +12025550105
  ```
- Agar koi number invalid ho (misal ke taur par US mein `+1 202 000 xxxx`), woh `invalid` counter mein jaata aur message: *"6 valid numbers generated."* ya dropped count ke saath.

### Example B — Random: United States, quantity 5

Trace (`runRandom` → `getRandomNumbers` → `generateFromPool`):
- `iso="US"`, `plan.prefixes` = mobilePrefixes.json se US ke real discovered mobile prefixes.
- `target = min(5, capacity)` = 5.
- Round-robin: prefix pool se prefix uthata hai, `randomDigits(natLen - prefix.length)` se subscriber banata hai.
- Degenerate filter (zero runs / staircase) skip karta hai.
- `validateCandidate` pass hone par `seenSet` mein unique add.
- **Output (illustrative):**
  ```
  +13105551234
  +19175559876
  +17135554321
  +14045558765
  +12065550119
  ```
- Yeh sirf **format-valid synthetic** numbers hain — kisi real subscriber ka claim nahi.

### Example C — Region-Wise: United States, state = California, any operator, quantity 5

Trace (`runRegion`, NumberGenerator.jsx:411):
- `regionIso = "US"`, `regionCountry = "1"`.
- Region list `getDynamicRegionsForCountry("US","1")` se: California agar geocode/ISO se mojood → ya verified prefix region (agar prefix mapping mili) ya **label-only** subdivision.
- Operator: koi select nahi → `hasOperators=false`, `hasRegions=true` → buckets = `[{region: California, operator:null}]` → **Targets = 1**.
- Pool (line 456): `getRegionPool("US", california)`:
  - Agar California **label-only** hai (`prefixes: []`) → raw khali → `return plan.prefixes` (poore US plan pool).
  - Agar California **verified** hai (`prefixes` mojood) → `expandPrefixes` se us state ke prefixes.
- `generateBucketed` se 5 numbers.
- **Output (label-only case):** 5 valid US numbers; har number ki metadata mein `regionName: "California"`, `regionVerified: false`. CSV mein region column: `"California (label only)"` (NumberGenerator.jsx:578).
- **Matlab:** California select karne se number California ka **nahi** ho jaata — yeh sirf ek **targeting label** hai. Actual number US plan ke kisi bhi valid prefix se aa sakta hai.

### Example D — Jahan region/operator prefix mapping **real** hai (trace)

Misal: **United Kingdom (+44)** ya **Pakistan (+92)** — jinke geocode files mojood hain (`src/data/geocodes/44.json`, `92.json`).

Trace (yasmin se):
- `getDynamicRegionsForCountry("GB","44")` geocode file se prefix regions banata hai, jaise `London` ke prefix `7400`, `South West` `7425` etc. (`verified:true`).
- User `London` select kare + operator select kare:
  - Region pool = `expandPrefixes("GB", ["7400"])` (numberingPlans.js:198) → GB plan ke `7400` se shuru hone wale `[prefix,len]` pairs.
  - `validateCandidate("GB","44", national, types)` — GB mobile plan (07xxx) ke mutabiq.
  - **Output (illustrative):** `+447400123456` type numbers jahan prefix `7400` region pool se aaya.
- Yahan prefix **wakai** region pool ko narrow karta hai (verified). Lekin phir bhi: number ka **actually woh location/subscriber** hona libphonenumber guarantee nahi karta (portability).

---

## 10) Short Summary

- **Feature:** `NumberGenerator.jsx` (UI) + `numberingPlans.js` (engine) + `numberingDatasets.js` (loaders) + `mobilePrefixes.json`/`operators.json`/`regions.json` (data) + `geoLookup.js` (region list).
- Sirf **ek** phone library asal mein use hoti hai: **`libphonenumber-js ^1.13.4`** (`/max` build) validation ke liye. Randomness `Math.random()` se.
- 3 modes: Sequential (loop + `validateCandidate`, max 10,000), Random (`generateFromPool`, max 50,000), Region-Wise (`generateBucketed`, buckets = region×operator).
- US mein states "label only" hain kyunki unke paas verified prefix mapping nahi → `Distinct Prefixes In Scope: 0`, `Targets: 1`, aur pool poore country plan se aata hai.
- **Numbers format-valid synthetic hain — real, active, ya verified location/subscriber names nahi.** libphonenumber sirf shakal/plan check karta hai.

---

## اردو خلاصہ (Final Conclusion)

یہ "Number Generator" صرف **libphonenumber-js** لائبریری سے نمبروں کی **shape/format** چیک کرتا ہے۔
Sequential، Random اور Region-Wise — تینوں modes میں جو نمبر بنتے ہیں وہ **synthetic/test** ہوتے ہیں،
یعنی format کے لحاظ سے درست لیکن **اصل، فعال (active)، کسی حقیقی شخص کا، کسی خاص ریاست کا،
یا WhatsApp پر رجسٹرڈ** ہونے کی کوئی ضمانت نہیں۔

United States (+1) میں states کو "label only" دکھایا جاتا ہے کیونکہ امریکہ میں area code کو
mobile operator یا ریاست سے مضبوطی سے نہیں جوڑا جا سکتا (number portability کی وجہ سے)۔
اسی لیے "Distinct Prefixes In Scope: 0" اور "Targets: 1" آتا ہے، اور state منتخب کرنا صرف ایک
**targeting label** ہے — نمبر اُس ریاست کا ہونے کا ثبوت نہیں۔

**حتمی بات:** یہ نمبر صرف testing/authorized contact lists کے لیے ہیں، حقیقی لوگوں کے نمبر یا
تصدیق شدہ مقامات نہیں۔ Format valid ہونا ≠ نمبر استعمال میں ہونا ≠ اُس ریاست کا ہونا ≠ WhatsApp پر ہونا۔
