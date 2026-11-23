import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { isDbConfigured } from '../../db/index.ts';
import { verifyToken } from '../../lib/security.ts';

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

interface RuntimePersistedData {
  customers: RuntimeCustomerRecord[];
  config: Record<string, unknown> | null;
}

const RUNTIME_STORE_FILE = path.resolve(process.cwd(), '.aagaman-runtime-store.json');

const customerMap = new Map<string, RuntimeCustomerRecord>();
let runtimeConfig: Record<string, unknown> | null = null;
let loadedFromDisk = false;

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
  res.json({ ok: true, customer: merged });
});

runtimeRouter.get('/runtime/customers', requireRuntimeAdmin, (_req, res) => {
  ensureLoaded();
  const list = Array.from(customerMap.values()).sort(
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
