# Branding & data‑attribution notes

## SSAI
SSAI's mark appears on every module (own brand — no restriction).

## NASA / ESA / NOAA logos — ACTION NEEDED BEFORE PUBLIC LAUNCH
Modules built on real data show the data provider's logo (NASA "meatball", ESA, NOAA) under a **"Data source"** label, and a text data credit.

The underlying **data and imagery are public domain** (NASA) or **CC BY‑SA 4.0** (ESA/Copernicus Sentinel‑1, ESA/Webb) and are free to use **with attribution** — that part is clean.

**However:** NASA's insignia generally may not be used by non‑NASA organizations in a way that implies **endorsement or partnership** without permission. SSAI being a NASA contractor does not automatically grant logo‑use rights for a brand/marketing piece. This deliverable currently shows the NASA logo as a *data‑source credit* (the most defensible framing), per the client's request for an SSAI × NASA collaboration look.

➡️ **Before this goes public, SSAI should confirm NASA (and ESA) logo usage with their contract officer / NASA Office of Communications.** If not cleared, fall back to a **text‑only credit** ("Data · NASA MODIS", "ESA Copernicus Sentinel‑1, CC BY‑SA 4.0") — that requires no permission. The build can switch to text‑only credits by clearing the `source` logos in `_build/build_library.py`.

## Specific attributions
- NASA MODIS / Blue Marble / Black Marble / SDO / JPL imagery — NASA, public domain.
- Sentinel‑1 SAR (radar vs optical) — **Contains modified Copernicus Sentinel data (ESA), via Wikimedia Commons, CC BY‑SA 4.0** — attribution is required; keep the credit visible.
- JWST imagery (deep field, nebula) — NASA/ESA/CSA (CC BY 4.0 where ESA‑processed).
