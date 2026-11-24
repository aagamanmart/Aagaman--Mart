import type { DeliveryScheduleConfig, PincodeDeliveryRule } from '../types';

export const DEFAULT_DELIVERY_CONFIG: DeliveryScheduleConfig = {
  sameHubDays: 2,
  standardDays: 4,
  remoteDays: 6,
  expressDays: 1,
  codEnabled: true,
  cutoffNote: 'Orders placed before 4:00 PM dispatch the same day',
  pincodeRules: [],
};

export interface IndiaPostOfficeInfo {
  name: string;
  district: string;
  state: string;
  region: string;
  circle: string;
  deliveryStatus: string;
  pincode: string;
  postOfficeCount: number;
}

export type IndiaPostLookupResult =
  | { found: true; postOffice: IndiaPostOfficeInfo }
  | { found: false; noMatch: true }
  | { found: false; noMatch: false; networkError: true };

export type PincodeCheckResult =
  | {
      serviceable: true;
      noMatch: false;
      pincode: string;
      city: string;
      state: string;
      postOfficeName: string;
      deliveryStatus: string;
      zone: 'metro' | 'standard' | 'remote' | 'custom';
      region: string;
      courierPartner: string;
      estimatedDays: number;
      estimatedDelivery: string;
      codAvailable: boolean;
      cutoffNote: string;
      verifiedBy: 'indiapost' | 'admin-rule';
    }
  | {
      serviceable: false;
      noMatch: boolean;
      blockedByAdmin?: boolean;
      pincode: string;
      city?: string;
      state?: string;
      postOfficeName?: string;
      region?: string;
      error: string;
    };

const METRO_KEYWORDS = [
  'mumbai',
  'thane',
  'navi mumbai',
  'palghar',
  'pune',
  'delhi',
  'new delhi',
  'central delhi',
  'south delhi',
  'north delhi',
  'east delhi',
  'west delhi',
  'north west delhi',
  'south west delhi',
  'south east delhi',
  'north east delhi',
  'shahdara',
  'gurgaon',
  'gurugram',
  'noida',
  'gautam buddha nagar',
  'faridabad',
  'ghaziabad',
  'bengaluru',
  'bangalore',
  'bengaluru urban',
  'hyderabad',
  'rangareddy',
  'k.v.rangareddy',
  'medchal',
  'chennai',
  'kolkata',
  'howrah',
  'ahmedabad',
  'surat',
  'jaipur',
  'lucknow',
  'chandigarh',
  'indore',
  'kochi',
  'ernakulam',
];

const REMOTE_STATES = [
  'arunachal pradesh',
  'assam',
  'manipur',
  'meghalaya',
  'mizoram',
  'nagaland',
  'sikkim',
  'tripura',
  'jammu and kashmir',
  'jammu & kashmir',
  'ladakh',
  'andaman and nicobar',
  'andaman and nicobar islands',
  'lakshadweep',
  'himachal pradesh',
  'uttarakhand',
];

interface CacheEntry {
  result: IndiaPostLookupResult;
  expiresAt: number;
}

const lookupCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

export function isValidIndianPincodeFormat(rawCode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(rawCode.trim());
}

function clampInt(val: unknown, fallback: number, min: number, max: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function normalizeDeliveryConfig(raw?: Partial<DeliveryScheduleConfig> | null): DeliveryScheduleConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawRules = Array.isArray(src.pincodeRules) ? src.pincodeRules : [];
  const rules: PincodeDeliveryRule[] = [];
  const seen = new Set<string>();

  for (const r of rawRules) {
    if (!r || typeof r !== 'object') continue;
    const pin = String(r.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (!/^[1-9][0-9]{2}([0-9]{3})?$/.test(pin) || seen.has(pin)) continue;
    seen.add(pin);
    rules.push({
      pincode: pin,
      cityLabel: String(r.cityLabel || '').trim().slice(0, 120),
      serviceable: r.serviceable !== false,
      deliveryDays: clampInt(r.deliveryDays, 2, 0, 30),
      codAvailable: r.codAvailable !== false,
      courierPartner: String(r.courierPartner || '').trim().slice(0, 80),
      note: String(r.note || '').trim().slice(0, 200),
    });
    if (rules.length >= 100) break;
  }

  return {
    sameHubDays: clampInt(src.sameHubDays, DEFAULT_DELIVERY_CONFIG.sameHubDays, 0, 30),
    standardDays: clampInt(src.standardDays, DEFAULT_DELIVERY_CONFIG.standardDays, 0, 30),
    remoteDays: clampInt(src.remoteDays, DEFAULT_DELIVERY_CONFIG.remoteDays, 0, 30),
    expressDays: clampInt(src.expressDays, DEFAULT_DELIVERY_CONFIG.expressDays, 0, 15),
    codEnabled: src.codEnabled !== false,
    cutoffNote:
      typeof src.cutoffNote === 'string'
        ? src.cutoffNote.trim().slice(0, 240)
        : DEFAULT_DELIVERY_CONFIG.cutoffNote,
    pincodeRules: rules,
  };
}

export function formatEstimatedDeliveryDate(days: number, includeYear = false): string {
  const safeDays = Math.max(0, Math.min(30, Math.round(days)));
  if (safeDays === 0) {
    return 'Today (Same Day Delivery)';
  }
  const target = new Date(Date.now() + safeDays * 86400000);
  const formatted = target.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
  return safeDays === 1 ? `Tomorrow, ${formatted}` : formatted;
}

export function classifyIndianZone(district: string, state: string, circle = ''): 'metro' | 'standard' | 'remote' {
  const distLower = district.trim().toLowerCase();
  const stateLower = state.trim().toLowerCase();
  const circleLower = circle.trim().toLowerCase();

  if (
    REMOTE_STATES.some((s) => stateLower.includes(s)) ||
    circleLower.includes('north eastern') ||
    circleLower.includes('jammu')
  ) {
    return 'remote';
  }

  if (METRO_KEYWORDS.some((m) => distLower === m || distLower.includes(m) || stateLower === 'delhi')) {
    return 'metro';
  }

  return 'standard';
}

export async function lookupIndiaPostPincode(rawCode: string): Promise<IndiaPostLookupResult> {
  const code = rawCode.trim();
  if (!isValidIndianPincodeFormat(code)) {
    return { found: false, noMatch: true };
  }

  const cached = lookupCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(code)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { found: false, noMatch: false, networkError: true };
    }
    const payload = (await res.json()) as Array<{
      Status?: string;
      Message?: string;
      PostOffice?: Array<{
        Name?: string;
        District?: string;
        State?: string;
        Region?: string;
        Circle?: string;
        DeliveryStatus?: string;
        Pincode?: string;
      }> | null;
    }>;

    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first) {
      return { found: false, noMatch: false, networkError: true };
    }

    if (first.Status !== 'Success' || !Array.isArray(first.PostOffice) || first.PostOffice.length === 0) {
      const noMatchRes: IndiaPostLookupResult = { found: false, noMatch: true };
      lookupCache.set(code, { result: noMatchRes, expiresAt: Date.now() + CACHE_TTL_MS });
      return noMatchRes;
    }

    const deliveryOffice =
      first.PostOffice.find((po) => (po.DeliveryStatus || '').toLowerCase() === 'delivery') || first.PostOffice[0];

    const info: IndiaPostOfficeInfo = {
      name: String(deliveryOffice.Name || '').trim(),
      district: String(deliveryOffice.District || '').trim(),
      state: String(deliveryOffice.State || '').trim(),
      region: String(deliveryOffice.Region || '').trim(),
      circle: String(deliveryOffice.Circle || '').trim(),
      deliveryStatus: String(deliveryOffice.DeliveryStatus || 'Delivery').trim(),
      pincode: code,
      postOfficeCount: first.PostOffice.length,
    };

    const okRes: IndiaPostLookupResult = { found: true, postOffice: info };
    if (lookupCache.size >= 500) {
      const firstKey = lookupCache.keys().next().value;
      if (firstKey) lookupCache.delete(firstKey);
    }
    lookupCache.set(code, { result: okRes, expiresAt: Date.now() + CACHE_TTL_MS });
    return okRes;
  } catch {
    return { found: false, noMatch: false, networkError: true };
  } finally {
    clearTimeout(timeout);
  }
}

export function findMatchingPincodeRule(
  code: string,
  deliveryConfig: DeliveryScheduleConfig
): PincodeDeliveryRule | null {
  const clean = code.trim();
  const exact = deliveryConfig.pincodeRules.find((r) => r.pincode === clean);
  if (exact) return exact;
  const prefix = deliveryConfig.pincodeRules.find((r) => r.pincode.length === 3 && clean.startsWith(r.pincode));
  return prefix || null;
}

export function resolvePincodeDelivery(
  rawCode: string,
  lookup: IndiaPostLookupResult,
  rawDeliveryConfig?: Partial<DeliveryScheduleConfig> | null,
  shippingMethod: 'Standard Delivery' | 'Express Delivery' = 'Standard Delivery',
  includeYear = false
): PincodeCheckResult {
  const code = rawCode.trim();
  if (!isValidIndianPincodeFormat(code)) {
    return {
      serviceable: false,
      noMatch: false,
      pincode: code,
      error: 'Please enter a valid 6-digit Indian pincode.',
    };
  }

  const deliveryConfig = normalizeDeliveryConfig(rawDeliveryConfig);
  const matchingRule = findMatchingPincodeRule(code, deliveryConfig);

  if (!lookup.found) {
    if (lookup.noMatch) {
      return {
        serviceable: false,
        noMatch: true,
        pincode: code,
        error: `No match found — pincode ${code} India Post records me maujood nahi hai. Please enter a valid Indian pincode.`,
      };
    }

    // Network unreachable fallback: only approve if Admin explicitly added an exact 6-digit rule
    if (matchingRule && matchingRule.pincode === code) {
      if (!matchingRule.serviceable) {
        return {
          serviceable: false,
          noMatch: false,
          blockedByAdmin: true,
          pincode: code,
          region: matchingRule.cityLabel || `Pincode ${code}`,
          error:
            matchingRule.note ||
            `Delivery is currently disabled for pincode ${code} (${matchingRule.cityLabel || 'Restricted Zone'}).`,
        };
      }
      const days =
        shippingMethod === 'Express Delivery'
          ? Math.min(matchingRule.deliveryDays, deliveryConfig.expressDays)
          : matchingRule.deliveryDays;
      return {
        serviceable: true,
        noMatch: false,
        pincode: code,
        city: matchingRule.cityLabel || code,
        state: 'India',
        postOfficeName: matchingRule.cityLabel || `Pincode ${code}`,
        deliveryStatus: 'Delivery',
        zone: 'custom',
        region: matchingRule.cityLabel || `Pincode ${code}`,
        courierPartner: matchingRule.courierPartner || 'Aagaman Express Logistics',
        estimatedDays: days,
        estimatedDelivery: formatEstimatedDeliveryDate(days, includeYear),
        codAvailable: deliveryConfig.codEnabled && matchingRule.codAvailable,
        cutoffNote: matchingRule.note || deliveryConfig.cutoffNote,
        verifiedBy: 'admin-rule',
      };
    }

    return {
      serviceable: false,
      noMatch: false,
      pincode: code,
      error: 'Could not verify this pincode with India Post right now. Please try again in a moment.',
    };
  }

  const po = lookup.postOffice;
  const locationLabel = [po.name, po.district, po.state].filter(Boolean).join(', ');
  const cityState = [po.district, po.state].filter(Boolean).join(', ');

  if (matchingRule && !matchingRule.serviceable) {
    return {
      serviceable: false,
      noMatch: false,
      blockedByAdmin: true,
      pincode: code,
      city: po.district,
      state: po.state,
      postOfficeName: po.name,
      region: cityState,
      error:
        matchingRule.note ||
        `Delivery is currently not available for ${cityState} (${code}) per store shipping settings.`,
    };
  }

  const detectedZone = classifyIndianZone(po.district, po.state, po.circle);
  const zone: 'metro' | 'standard' | 'remote' | 'custom' = matchingRule ? 'custom' : detectedZone;

  let estimatedDays: number;
  if (matchingRule) {
    estimatedDays =
      shippingMethod === 'Express Delivery'
        ? Math.min(matchingRule.deliveryDays, deliveryConfig.expressDays)
        : matchingRule.deliveryDays;
  } else if (shippingMethod === 'Express Delivery') {
    estimatedDays = deliveryConfig.expressDays;
  } else if (detectedZone === 'metro') {
    estimatedDays = deliveryConfig.sameHubDays;
  } else if (detectedZone === 'remote') {
    estimatedDays = deliveryConfig.remoteDays;
  } else {
    estimatedDays = deliveryConfig.standardDays;
  }

  const defaultCourier =
    shippingMethod === 'Express Delivery'
      ? 'BlueDart Air Priority'
      : detectedZone === 'metro'
      ? 'Aagaman Prime Hub'
      : detectedZone === 'remote'
      ? 'India Post Speed / BlueDart'
      : 'Delhivery Express';

  const isArmyPostal = code.startsWith('9');
  const codAvailable = matchingRule
    ? deliveryConfig.codEnabled && matchingRule.codAvailable && !isArmyPostal
    : deliveryConfig.codEnabled && !isArmyPostal;

  return {
    serviceable: true,
    noMatch: false,
    pincode: code,
    city: po.district,
    state: po.state,
    postOfficeName: po.name,
    deliveryStatus: po.deliveryStatus,
    zone,
    region: locationLabel || cityState,
    courierPartner: matchingRule?.courierPartner || defaultCourier,
    estimatedDays,
    estimatedDelivery: formatEstimatedDeliveryDate(estimatedDays, includeYear),
    codAvailable,
    cutoffNote: matchingRule?.note || deliveryConfig.cutoffNote,
    verifiedBy: 'indiapost',
  };
}
