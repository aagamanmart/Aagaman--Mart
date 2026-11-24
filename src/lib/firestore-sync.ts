import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { normalizeDeliveryConfig } from './pincode';
import type { Address, BannerItem, DeliveryScheduleConfig, StoreConfig } from '../types';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'utkarshjaiswar137@gmail.com';

export interface FirestoreCustomerItem {
  id: number;
  uid: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  authMethod?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isBlocked: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  addresses?: Address[];
  wishlistCount?: number;
  orderCount: number;
  totalSpent: number;
  recentOrders?: Array<{ orderNumber: string; status: string; grandTotal: number; createdAt: string }>;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return null;
}

function clampStr(val: string | undefined | null, maxLen: number): string {
  return String(val || '').trim().slice(0, maxLen);
}

function stableNumericId(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = (hash * 31 + uid.charCodeAt(i)) % 900000000;
  }
  return Math.abs(hash) + 10000;
}

export function isFirebaseBootstrappedAdmin(): boolean {
  const cur = auth.currentUser;
  return Boolean(
    cur &&
      cur.emailVerified &&
      cur.email &&
      cur.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
  );
}

export async function syncGoogleCustomerToFirestore(payload: {
  uid: string;
  name: string;
  email: string;
  phone?: string | null;
  photoUrl?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  wishlistCount?: number;
  orderCount?: number;
  totalSpent?: number;
}): Promise<{ isBlocked: boolean }> {
  const cur = auth.currentUser;
  if (!cur || !cur.emailVerified || cur.uid !== payload.uid || !cur.email) {
    return { isBlocked: false };
  }

  const docPath = `customers/${cur.uid}`;
  const ref = doc(db, 'customers', cur.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  const safeName = clampStr(payload.name || cur.displayName || cur.email.split('@')[0], 160) || 'Customer';
  const safeEmail = clampStr(cur.email, 200);
  const safePhone = clampStr(payload.phone, 30);
  const safePhotoUrl = clampStr(payload.photoUrl || cur.photoURL, 1000);
  const wishlistCount = Math.max(0, Math.min(10000, Math.round(payload.wishlistCount ?? 0)));
  const orderCount = Math.max(0, Math.min(100000, Math.round(payload.orderCount ?? 0)));
  const totalSpent = Math.max(0, Math.min(100000000, Number(payload.totalSpent ?? 0)));

  if (snap.exists()) {
    const existingData = snap.data();
    if (existingData.isBlocked === true) {
      return { isBlocked: true };
    }
    try {
      await updateDoc(ref, {
        name: safeName,
        phone: safePhone || clampStr(existingData.phone as string, 30),
        photoUrl: safePhotoUrl || clampStr(existingData.photoUrl as string, 1000),
        emailVerified: Boolean(cur.emailVerified || payload.emailVerified),
        phoneVerified: Boolean(payload.phoneVerified ?? existingData.phoneVerified),
        wishlistCount: Math.max(wishlistCount, Number(existingData.wishlistCount || 0)),
        orderCount: Math.max(orderCount, Number(existingData.orderCount || 0)),
        totalSpent: Math.max(totalSpent, Number(existingData.totalSpent || 0)),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
    return { isBlocked: false };
  }

  try {
    await setDoc(ref, {
      uid: cur.uid,
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      photoUrl: safePhotoUrl,
      authMethod: 'google',
      emailVerified: Boolean(cur.emailVerified),
      phoneVerified: Boolean(payload.phoneVerified),
      isBlocked: false,
      wishlistCount,
      orderCount,
      totalSpent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
  return { isBlocked: false };
}

export async function fetchFirestoreCustomersAsAdmin(): Promise<FirestoreCustomerItem[]> {
  if (!isFirebaseBootstrappedAdmin()) return [];
  const path = 'customers';
  try {
    const q = query(collection(db, path), orderBy('lastLoginAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const uid = String(data.uid || d.id);
      return {
        id: stableNumericId(uid),
        uid,
        name: String(data.name || ''),
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        photoUrl: String(data.photoUrl || ''),
        authMethod: String(data.authMethod || 'google'),
        emailVerified: Boolean(data.emailVerified),
        phoneVerified: Boolean(data.phoneVerified),
        isBlocked: Boolean(data.isBlocked),
        createdAt: toIsoString(data.createdAt),
        lastLoginAt: toIsoString(data.lastLoginAt) || toIsoString(data.createdAt),
        addresses: [],
        wishlistCount: Number(data.wishlistCount || 0),
        orderCount: Number(data.orderCount || 0),
        totalSpent: Number(data.totalSpent || 0),
        recentOrders: [],
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function toggleFirestoreCustomerBlock(uid: string, isBlocked: boolean): Promise<void> {
  if (!isFirebaseBootstrappedAdmin() || !uid) return;
  const path = `customers/${uid}`;
  try {
    await updateDoc(doc(db, 'customers', uid), {
      isBlocked: Boolean(isBlocked),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchFirestoreStoreConfig(): Promise<Partial<StoreConfig> | null> {
  const path = 'storeConfig/main';
  try {
    const snap = await getDoc(doc(db, 'storeConfig', 'main'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      siteName: String(data.siteName || 'AAGAMAN MART'),
      tagline: String(data.tagline || 'Quality That Moves You Forward.'),
      announcementText: String(data.announcementText || ''),
      announcementEnabled: data.announcementEnabled !== false,
      supportEmail: String(data.supportEmail || 'support@aagamanmart.in'),
      supportPhone: String(data.supportPhone || ''),
      headquarters: String(data.headquarters || ''),
      freeShippingThreshold: Number(data.freeShippingThreshold ?? 999),
      standardShippingCharge: Number(data.standardShippingCharge ?? 49),
      expressShippingCharge: Number(data.expressShippingCharge ?? 129),
      defaultGstPercent: Number(data.defaultGstPercent ?? 18),
      flashSaleTitle: String(data.flashSaleTitle || ''),
      flashSaleSubtitle: String(data.flashSaleSubtitle || ''),
      banners: Array.isArray(data.banners) ? (data.banners as BannerItem[]) : [],
      deliveryConfig: data.deliveryConfig
        ? normalizeDeliveryConfig(data.deliveryConfig as Partial<DeliveryScheduleConfig>)
        : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveFirestoreStoreConfig(config: StoreConfig): Promise<void> {
  if (!isFirebaseBootstrappedAdmin()) return;
  const path = 'storeConfig/main';
  const normalizedDelivery = normalizeDeliveryConfig(config.deliveryConfig);
  try {
    await setDoc(doc(db, 'storeConfig', 'main'), {
      siteName: clampStr(config.siteName || 'AAGAMAN MART', 120) || 'AAGAMAN MART',
      tagline: clampStr(config.tagline, 240),
      announcementText: clampStr(config.announcementText, 300),
      announcementEnabled: config.announcementEnabled !== false,
      supportEmail: clampStr(config.supportEmail, 200),
      supportPhone: clampStr(config.supportPhone, 40),
      headquarters: clampStr(config.headquarters, 300),
      freeShippingThreshold: Math.max(0, Math.min(1000000, Number(config.freeShippingThreshold ?? 999))),
      standardShippingCharge: Math.max(0, Math.min(10000, Number(config.standardShippingCharge ?? 49))),
      expressShippingCharge: Math.max(0, Math.min(10000, Number(config.expressShippingCharge ?? 129))),
      defaultGstPercent: Math.max(0, Math.min(28, Number(config.defaultGstPercent ?? 18))),
      flashSaleTitle: clampStr(config.flashSaleTitle, 160),
      flashSaleSubtitle: clampStr(config.flashSaleSubtitle, 400),
      banners: (config.banners || []).slice(0, 10),
      deliveryConfig: {
        sameHubDays: normalizedDelivery.sameHubDays,
        standardDays: normalizedDelivery.standardDays,
        remoteDays: normalizedDelivery.remoteDays,
        expressDays: normalizedDelivery.expressDays,
        codEnabled: normalizedDelivery.codEnabled,
        cutoffNote: normalizedDelivery.cutoffNote,
        pincodeRules: normalizedDelivery.pincodeRules.map((r) => ({
          pincode: clampStr(r.pincode, 6),
          cityLabel: clampStr(r.cityLabel, 120),
          serviceable: Boolean(r.serviceable),
          deliveryDays: Math.max(0, Math.min(30, Math.round(r.deliveryDays))),
          codAvailable: Boolean(r.codAvailable),
          courierPartner: clampStr(r.courierPartner, 80),
          note: clampStr(r.note, 200),
        })),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface FirestoreSupportTicketItem {
  id: number;
  ticketId: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  routedToEmail: string;
  emailStatus: string;
  createdAt: string;
}

export async function syncSupportTicketToFirestore(payload: {
  ticketId: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  routedToEmail: string;
  emailStatus: 'sent' | 'pending_smtp' | 'failed';
}): Promise<void> {
  const cur = auth.currentUser;
  if (!cur || !cur.emailVerified) return;

  const safeTicketId = payload.ticketId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || `TKT-${Date.now()}`;
  const path = `supportTickets/${safeTicketId}`;

  try {
    await setDoc(doc(db, 'supportTickets', safeTicketId), {
      ticketId: safeTicketId,
      uid: cur.uid,
      name: clampStr(payload.name, 160) || 'Customer',
      email: clampStr(payload.email, 200).toLowerCase(),
      phone: clampStr(payload.phone, 30),
      subject: clampStr(payload.subject, 200),
      message: clampStr(payload.message, 2000),
      status: 'Open',
      routedToEmail: clampStr(payload.routedToEmail, 200) || BOOTSTRAPPED_ADMIN_EMAIL,
      emailStatus: payload.emailStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchFirestoreSupportTicketsAsAdmin(): Promise<FirestoreSupportTicketItem[]> {
  if (!isFirebaseBootstrappedAdmin()) return [];
  const path = 'supportTickets';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const ticketId = String(data.ticketId || d.id);
      return {
        id: stableNumericId(ticketId),
        ticketId,
        name: String(data.name || ''),
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        subject: String(data.subject || ''),
        message: String(data.message || ''),
        status: String(data.status || 'Open'),
        routedToEmail: String(data.routedToEmail || BOOTSTRAPPED_ADMIN_EMAIL),
        emailStatus: String(data.emailStatus || 'pending_smtp'),
        createdAt: toIsoString(data.createdAt) || new Date().toISOString(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateFirestoreSupportTicketStatus(
  ticketId: string,
  status: 'Open' | 'In Progress' | 'Resolved'
): Promise<void> {
  if (!isFirebaseBootstrappedAdmin() || !ticketId) return;
  const path = `supportTickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
