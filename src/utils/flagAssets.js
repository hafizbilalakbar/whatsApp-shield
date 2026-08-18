// Local country-flag SVG assets. Vite transforms `import.meta.glob` at build
// time into an inlined map of raw SVG strings, so flags are embedded in the
// bundle with no network/emoji dependency. When this module runs unbundled
// (e.g. Node/unit runs without Vite) the glob call throws and we degrade to
// an empty map — callers fall back to ISO-chip rendering.
let svgByCode = {};
try {
  const raw = import.meta.glob('../../node_modules/country-flag-icons/3x2/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  for (const key of Object.keys(raw || {})) {
    const code = (key.split('/').pop() || '').replace(/\.svg$/i, '').toUpperCase();
    if (code) svgByCode[code] = raw[key];
  }
} catch (e) {
  svgByCode = {};
}

export function rawFlagSvg(code) {
  return svgByCode[String(code || '').toUpperCase()] || null;
}
