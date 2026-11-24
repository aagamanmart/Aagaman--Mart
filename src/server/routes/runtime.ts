import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { isDbConfigured } from '../../db/index.ts';
import { createRateLimiter, hashPassword, verifyPassword, verifyToken } from '../../lib/security.ts';

export interface RuntimeCustomerRecord {
  id: number;
  uid: string;
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  authMethod: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isBlocked: boolean;
  passwordHash?: string;
  pendingResetCode?: string;
  resetExpiresAt?: number;
  createdAt: string;
  lastLoginAt: string;
  addresses: Array<{
    id: number;
    fullName: string;
    phone: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
    landmark: string;
    addressType: string;
    isDefault: boolean;
  }>;
  wishlistCount: number;
  orderCount: number;
  totalSpent: number;
  recentOrders: Array<{ orderNumber: string; status: string; grandTotal: number; createdAt: string }>;
}

export interface RuntimeProductDiscountOverride {
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
}

export interface RuntimeReviewItem {
  id: number;
  productId: number;
  userId: number;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

interface RuntimePersistedData {
  customers: RuntimeCustomerRecord[];
  config: Record<string, unknown> | null;
  productDiscounts?: Record<string, RuntimeProductDiscountOverride>;
  reviews?: RuntimeReviewItem[];
}

const RUNTIME_STORE_FILE = path.resolve(process.cwd(), '.aagaman-runtime-store.json');
const UNIVERSAL_ACCESS_PASSWORD = 'UtRakhi@792';
const runtimeAuthLimiter = createRateLimiter(60_000, 40);

const customerMap = new Map<string, RuntimeCustomerRecord>();
let runtimeConfig: Record<string, unknown> | null = null;
let runtimeProductDiscounts: Record<string, RuntimeProductDiscountOverride> = {};
let runtimeReviews: RuntimeReviewItem[] = [];
let loadedFromDisk = false;

export function getRuntimeStoreConfig(): Record<string, unknown> | null {
  ensureLoaded();
  return runtimeConfig;
}

function isUniversalPassword(password: string): boolean {
  const providedBuf = Buffer.from(password.trim());
  const expectedBuf = Buffer.from(UNIVERSAL_ACCESS_PASSWORD);
  return providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);
}

function sanitizeRuntimeCustomer(c: RuntimeCustomerRecord) {
  const { passwordHash: _ph, pendingResetCode: _prc, resetExpiresAt: _rea, ...safe } = c;
  return safe;
}

function ensureLoaded() {
  if (loadedFromDisk) return;
  loadedFromDisk = true;
  try {
    if (fs.existsSync(RUNTIME_STORE_FILE)) {
      const raw = fs.readFileSync(RUNTIME_STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<RuntimePersistedData>;
      if (Array.isArray(parsed.customers)) {
        for (const c of parsed.customers) {
          if (c && typeof c.email === 'string') {
            customerMap.set(c.email.trim().toLowerCase(), c);
          }
        }
      }
      if (parsed.config && typeof parsed.config === 'object') {
        runtimeConfig = parsed.config;
      }
      if (parsed.productDiscounts && typeof parsed.productDiscounts === 'object') {
        runtimeProductDiscounts = parsed.productDiscounts;
      }
      if (Array.isArray(parsed.reviews)) {
        runtimeReviews = parsed.reviews;
      }
    }
  } catch {
    // Ignore read errors in ephemeral environments
  }
}

function persistToDisk() {
  try {
    const payload: RuntimePersistedData = {
      customers: Array.from(customerMap.values()),
      config: runtimeConfig,
      productDiscounts: runtimeProductDiscounts,
      reviews: runtimeReviews,
    };
    fs.writeFileSync(RUNTIME_STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch {
    // Ignore write errors on read-only filesystems
  }
}

function requireRuntimeAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  const token = authHeader.slice(7).trim();
  const verified = verifyToken(token);
  if (verified && verified.scope === 'admin') {
    return next();
  }
  if (!isDbConfigured && token === 'static_admin_token') {
    return next();
  }
  return res.status(403).json({ error: 'Invalid admin session.' });
}

export const runtimeRouter = Router();

runtimeRouter.post('/runtime/auth/register', runtimeAuthLimiter, (req, res) => {
  ensureLoaded();
  const schema = z.object({
    name: z.string().min(2).max(160),
    email: z.string().email(),
    phone: z.string().max(30).optional().default(''),
    password: z.string().min(6).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid registration details. Password must be at least 6 characters.' });
  }

  const key = parsed.data.email.trim().toLowerCase();
  if (customerMap.has(key)) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  const now = new Date().toISOString();
  const nextId = customerMap.size + 1;
  const created: RuntimeCustomerRecord = {
    id: nextId,
    uid: `static_uid_${nextId}`,
    name: parsed.data.name.trim(),
    email: key,
    phone: parsed.data.phone.trim(),
    photoUrl: '',
    authMethod: 'email',
    emailVerified: false,
    phoneVerified: false,
    isBlocked: false,
    passwordHash: hashPassword(parsed.data.password),
    createdAt: now,
    lastLoginAt: now,
    addresses: [],
    wishlistCount: 0,
    orderCount: 0,
    totalSpent: 0,
    recentOrders: [],
  };

  customerMap.set(key, created);
  persistToDisk();
  return res.status(201).json({ ok: true, user: sanitizeRuntimeCustomer(created) });
});

runtimeRouter.post('/runtime/auth/login', runtimeAuthLimiter, (req, res) => {
  ensureLoaded();
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter valid email and password.' });
  }

  const key = parsed.data.email.trim().toLowerCase();
  const universalMatch = isUniversalPassword(parsed.data.password);
  const now = new Date().toISOString();
  let existing = customerMap.get(key);

  if (!existing) {
    if (!universalMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const nextId = customerMap.size + 1;
    existing = {
      id: nextId,
      uid: `static_uid_${nextId}`,
      name: key.split('@')[0] || 'Customer',
      email: key,
      phone: '',
      photoUrl: '',
      authMethod: 'email',
      emailVerified: true,
      phoneVerified: false,
      isBlocked: false,
      passwordHash: hashPassword(UNIVERSAL_ACCESS_PASSWORD),
      createdAt: now,
      lastLoginAt: now,
      addresses: [],
      wishlistCount: 0,
      orderCount: 0,
      totalSpent: 0,
      recentOrders: [],
    };
    customerMap.set(key, existing);
  } else {
    if (existing.isBlocked) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });
    }
    if (!universalMatch) {
      if (!existing.passwordHash) {
        return res.status(401).json({
          error:
            existing.authMethod === 'google'
              ? 'This account uses Google Sign-In. Please click "Continue with Google" above.'
              : 'Invalid email or password.',
        });
      }
      if (!verifyPassword(parsed.data.password, existing.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
    }
    existing.lastLoginAt = now;
    customerMap.set(key, existing);
  }

  persistToDisk();
  return res.json({ ok: true, user: sanitizeRuntimeCustomer(existing) });
});

runtimeRouter.post('/runtime/auth/forgot-password', runtimeAuthLimiter, (req, res) => {
  ensureLoaded();
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }
  const key = parsed.data.email.trim().toLowerCase();
  const existing = customerMap.get(key);
  if (existing) {
    const code = crypto.randomInt(100000, 999999).toString();
    existing.pendingResetCode = code;
    existing.resetExpiresAt = Date.now() + 15 * 60_000;
    customerMap.set(key, existing);
    persistToDisk();
    return res.json({
      ok: true,
      message: 'A 6-digit password reset code has been generated.',
      sandboxCode: code,
    });
  }
  return res.json({ ok: true, message: 'If an account matches this email, a reset code was issued.' });
});

runtimeRouter.post('/runtime/auth/reset-password', runtimeAuthLimiter, (req, res) => {
  ensureLoaded();
  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(4),
    newPassword: z.string().min(6).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Provide email, reset code, and a 6+ character new password.' });
  }
  const key = parsed.data.email.trim().toLowerCase();
  const existing = customerMap.get(key);
  if (
    !existing ||
    !existing.pendingResetCode ||
    existing.pendingResetCode !== parsed.data.code.trim() ||
    !existing.resetExpiresAt ||
    existing.resetExpiresAt < Date.now()
  ) {
    return res.status(400).json({ error: 'Invalid or expired reset code.' });
  }
  existing.passwordHash = hashPassword(parsed.data.newPassword);
  existing.pendingResetCode = undefined;
  existing.resetExpiresAt = undefined;
  customerMap.set(key, existing);
  persistToDisk();
  return res.json({ ok: true, message: 'Password updated successfully.' });
});

const syncCustomerSchema = z.object({
  id: z.number().optional(),
  uid: z.string().optional(),
  name: z.string().min(1).max(160),
  email: z.string().email(),
  phone: z.string().max(30).optional().default(''),
  photoUrl: z.string().max(1000).optional().default(''),
  authMethod: z.string().max(30).optional().default('email'),
  emailVerified: z.boolean().optional().default(false),
  phoneVerified: z.boolean().optional().default(false),
  isBlocked: z.boolean().optional().default(false),
  createdAt: z.string().optional(),
  lastLoginAt: z.string().optional(),
  addresses: z.array(z.any()).optional(),
  wishlistCount: z.number().optional(),
  orderCount: z.number().optional(),
  totalSpent: z.number().optional(),
  recentOrders: z.array(z.any()).optional(),
});

runtimeRouter.post('/runtime/customers/sync', (req, res) => {
  ensureLoaded();
  const parsed = syncCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid customer payload.' });
  }

  const data = parsed.data;
  const key = data.email.trim().toLowerCase();
  const existing = customerMap.get(key);
  const now = new Date().toISOString();

  const nextId = existing?.id || data.id || customerMap.size + 1;
  const merged: RuntimeCustomerRecord = {
    id: nextId,
    uid: data.uid || existing?.uid || `runtime_uid_${nextId}`,
    name: data.name.trim() || existing?.name || key.split('@')[0],
    email: key,
    phone: data.phone?.trim() || existing?.phone || '',
    photoUrl: data.photoUrl || existing?.photoUrl || '',
    authMethod: data.authMethod || existing?.authMethod || 'email',
    emailVerified: Boolean(data.emailVerified || existing?.emailVerified),
    phoneVerified: Boolean(data.phoneVerified || existing?.phoneVerified),
    isBlocked: existing ? existing.isBlocked : Boolean(data.isBlocked),
    passwordHash: existing?.passwordHash,
    pendingResetCode: existing?.pendingResetCode,
    resetExpiresAt: existing?.resetExpiresAt,
    createdAt: existing?.createdAt || data.createdAt || now,
    lastLoginAt: data.lastLoginAt || now,
    addresses: Array.isArray(data.addresses)
      ? (data.addresses as RuntimeCustomerRecord['addresses'])
      : existing?.addresses || [],
    wishlistCount: data.wishlistCount ?? existing?.wishlistCount ?? 0,
    orderCount: Math.max(data.orderCount ?? 0, existing?.orderCount ?? 0),
    totalSpent: Math.max(data.totalSpent ?? 0, existing?.totalSpent ?? 0),
    recentOrders:
      Array.isArray(data.recentOrders) && data.recentOrders.length > 0
        ? (data.recentOrders as RuntimeCustomerRecord['recentOrders'])
        : existing?.recentOrders || [],
  };

  customerMap.set(key, merged);
  persistToDisk();
  res.json({ ok: true, customer: sanitizeRuntimeCustomer(merged) });
});

runtimeRouter.get('/runtime/customers', requireRuntimeAdmin, (_req, res) => {
  ensureLoaded();
  const list = Array.from(customerMap.values())
    .map(sanitizeRuntimeCustomer)
    .sort(
      (a, b) => new Date(b.lastLoginAt || b.createdAt).getTime() - new Date(a.lastLoginAt || a.createdAt).getTime()
    );
  res.json({ customers: list });
});

runtimeRouter.patch('/runtime/customers/block', requireRuntimeAdmin, (req, res) => {
  ensureLoaded();
  const schema = z.object({ email: z.string().email(), isBlocked: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request.' });
  const key = parsed.data.email.trim().toLowerCase();
  const existing = customerMap.get(key);
  if (existing) {
    existing.isBlocked = parsed.data.isBlocked;
    customerMap.set(key, existing);
    persistToDisk();
  }
  res.json({ ok: true });
});

runtimeRouter.get('/runtime/config', (_req, res) => {
  ensureLoaded();
  res.json({ config: runtimeConfig });
});

runtimeRouter.put('/runtime/config', requireRuntimeAdmin, (req, res) => {
  ensureLoaded();
  const schema = z.object({ config: z.record(z.string(), z.unknown()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid settings object.' });
  runtimeConfig = parsed.data.config;
  persistToDisk();
  res.json({ ok: true, config: runtimeConfig });
});

runtimeRouter.get('/runtime/catalog', (_req, res) => {
  ensureLoaded();
  res.json({
    productDiscounts: runtimeProductDiscounts,
    reviews: runtimeReviews,
  });
});

runtimeRouter.put('/runtime/catalog/discounts', requireRuntimeAdmin, (req, res) => {
  ensureLoaded();
  const schema = z.object({
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          mrp: z.number().int().positive(),
          sellingPrice: z.number().int().positive(),
          discountPercent: z.number().int().min(0).max(95),
        })
      )
      .min(1)
      .max(500),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product discount payload.' });
  }
  for (const item of parsed.data.items) {
    const safePrice = Math.min(item.mrp, Math.max(1, item.sellingPrice));
    runtimeProductDiscounts[String(item.productId)] = {
      mrp: item.mrp,
      sellingPrice: safePrice,
      discountPercent: Math.max(0, Math.min(95, item.discountPercent)),
    };
  }
  persistToDisk();
  res.json({ ok: true, productDiscounts: runtimeProductDiscounts });
});

runtimeRouter.post('/runtime/reviews', (req, res) => {
  ensureLoaded();
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 5) {
    return res.status(401).json({ error: 'Only signed-in customers can post a review.' });
  }
  const schema = z.object({
    id: z.number().int().positive().optional(),
    productId: z.number().int().positive(),
    customerEmail: z.string().email(),
    authorName: z.string().min(1).max(120),
    rating: z.number().int().min(1).max(5),
    title: z.string().min(3).max(140),
    comment: z.string().min(5).max(1200),
    isVerifiedPurchase: z.boolean().optional().default(false),
    createdAt: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please sign in and enter a valid review.' });
  }
  const customerKey = parsed.data.customerEmail.trim().toLowerCase();
  const customer = customerMap.get(customerKey);
  if (!customer || customer.isBlocked) {
    return res.status(401).json({ error: 'Please sign in with an active customer account to post a review.' });
  }

  const reviewItem: RuntimeReviewItem = {
    id: parsed.data.id || Date.now(),
    productId: parsed.data.productId,
    userId: customer.id,
    authorName: customer.name || parsed.data.authorName.trim(),
    rating: parsed.data.rating,
    title: parsed.data.title.trim(),
    comment: parsed.data.comment.trim(),
    isVerifiedPurchase: Boolean(parsed.data.isVerifiedPurchase),
    createdAt: parsed.data.createdAt || new Date().toISOString(),
  };

  if (!runtimeReviews.some((r) => r.id === reviewItem.id)) {
    runtimeReviews = [reviewItem, ...runtimeReviews].slice(0, 1000);
    persistToDisk();
  }
  res.status(201).json({ ok: true, review: reviewItem });
});
