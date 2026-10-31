import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// A reproducible, local snapshot. Rendering and ordinary builds never call Horizons.
const epochUtc = process.argv[2] ?? '2026-10-29T12:00:00.000Z';
const epochMs = Date.parse(epochUtc);
if (!Number.isFinite(epochMs) || epochMs < Date.UTC(2017, 0, 1)) {
  throw new Error('Use an ISO UTC epoch from 2017 onward (TT−UTC = 69.184 seconds).');
}
const epochDays = (epochMs - Date.UTC(2000, 0, 1, 12)) / 86400000;
// Ignore the sub-2ms periodic TDB−TT term in this illustrative Kepler model.
const epochJdTdb = 2451545 + epochDays + 69.184 / 86400;
const targets = [
  ['moon', 301, 399], ['io', 501, 599], ['europa', 502, 599], ['ganymede', 503, 599], ['callisto', 504, 599],
  ['mimas', 601, 699], ['enceladus', 602, 699], ['tethys', 603, 699], ['dione', 604, 699], ['rhea', 605, 699],
  ['titan', 606, 699], ['iapetus', 608, 699], ['miranda', 705, 799], ['ariel', 701, 799],
  ['umbriel', 702, 799], ['titania', 703, 799], ['oberon', 704, 799], ['triton', 801, 899],
];
async function query(target, center, type) {
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  const params = { format: 'json', COMMAND: target, CENTER: '500@' + center, MAKE_EPHEM: 'YES', EPHEM_TYPE: type,
    TLIST: epochJdTdb.toFixed(10), REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', OUT_UNITS: 'KM-S',
    CSV_FORMAT: 'YES', OBJ_DATA: 'NO', VEC_TABLE: '2', VEC_CORR: 'NONE' };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, key === 'format' ? value : "'" + value + "'");
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error('Horizons HTTP ' + response.status);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const text = data.result;
  const row = text?.match(/\$\$SOE\s*([^\r\n]+)\s*\$\$EOE/)?.[1].split(',').map(item => item.trim());
  if (!row) throw new Error('Missing Horizons ephemeris row for ' + target);
  return { text, row, url: url.href };
}
const elements = {};
for (const [id, target, center] of targets) {
  // The Horizons API requests are intentionally sequential.
  const { text, row, url } = await query(target, center, 'ELEMENTS');
  const gmKm3S2 = Number(text.match(/Keplerian GM\s*:\s*([\d.E+\-]+)/)?.[1]);
  const orbit = {
    target, center, semiMajorAxisKm: Number(row[11]), eccentricity: Number(row[2]),
    inclination: Number(row[4]), ascendingNode: Number(row[5]), argumentOfPeriapsis: Number(row[6]),
    meanAnomalyAtEpoch: Number(row[9]), period: Number(row[13]) / 86400, gmKm3S2,
    ephemeris: text.match(/Target body name:.*\{source: ([^}]+)\}/)?.[1] ?? '', sourceUrl: url,
  };
  if (!Object.values(orbit).filter(value => typeof value === 'number').every(Number.isFinite)
      || orbit.eccentricity < 0 || orbit.eccentricity >= 1 || orbit.period <= 0 || orbit.gmKm3S2 <= 0) {
    throw new Error('Invalid Horizons elements for ' + id);
  }
  const vectors = await query(target, center, 'VECTORS');
  orbit.positionAtEpochKm = vectors.row.slice(2, 5).map(Number);
  orbit.velocityAtEpochKmS = vectors.row.slice(5, 8).map(Number);
  if (![...orbit.positionAtEpochKm, ...orbit.velocityAtEpochKmS].every(Number.isFinite)) throw new Error('Invalid reference vectors for ' + id);
  elements[id] = orbit;
  console.log(id + ': e=' + orbit.eccentricity.toFixed(6) + ', i=' + orbit.inclination.toFixed(3) + '°, P=' + orbit.period.toFixed(6) + ' days');
}
const destination = new URL('../src/constants/moonOrbitElements.json', import.meta.url);
await mkdir(fileURLToPath(new URL('../src/constants/', import.meta.url)), { recursive: true });
await writeFile(destination, JSON.stringify({ source: 'NASA/JPL Horizons', documentation: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
  epochUtc: new Date(epochMs).toISOString(), epochDays, epochJdTdb, referencePlane: 'J2000 ecliptic / ICRF',
  model: 'Fixed osculating Kepler ellipses, no perturbations or precession', elements }, null, 2) + '\n');
console.log('Saved all 18 satellite orbits.');
