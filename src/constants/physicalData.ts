import type { BodyId, PlanetId } from '../types/types';

// Mean (volume-equivalent) radii: https://ssd.jpl.nasa.gov/planets/phys_par.html
// and https://ssd.jpl.nasa.gov/sats/phys_par/. Bodies remain spherical.
// Sun: IAU 2015 B3 nominal radius. Haumea: Ortiz et al. 2017 equivalent radius.
export const PHYSICAL_RADIUS_KM: Record<BodyId, number> = {
  sun: 695700, mercury: 2439.4, venus: 6051.8, earth: 6371.0084, mars: 3389.5,
  ceres: 469.7, jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622,
  pluto: 1188.3, haumea: 797.5, makemake: 714, eris: 1163,
  moon: 1737.4, io: 1821.49, europa: 1560.8, ganymede: 2631.2, callisto: 2410.3,
  mimas: 198.2, enceladus: 252.1, tethys: 531.1, dione: 561.4, rhea: 763.5,
  titan: 2574.76, iapetus: 734.3, miranda: 235.8, ariel: 578.9, umbriel: 584.7,
  titania: 788.9, oberon: 761.4, triton: 1352.6,
};

// Positive magnitudes: retrograde rotation is encoded by the spin-axis direction.
// JPL nominal sidereal periods; Makemake: Hromakina et al. 2019 (22.8266 h),
// Eris: synchronous rotation, Bernstein et al. 2023 (Dysnomia period 15.78590 d).
export const PHYSICAL_ROTATION_DAYS: Record<PlanetId, number> = {
  mercury: 58.6462, venus: 243.018, earth: 0.99726968, mars: 1.02595676,
  ceres: 0.378090, jupiter: 0.41354, saturn: 0.44401, uranus: 0.71833,
  neptune: 0.67125, pluto: 6.3872, haumea: 3.9155 / 24, makemake: 22.8266 / 24, eris: 15.78590,
};

// Main ring system, D-ring inner edge to A-ring outer edge; NASA PDS Rings Node.
export const SATURN_RING_KM = { inner: 66900, outer: 136780 };
