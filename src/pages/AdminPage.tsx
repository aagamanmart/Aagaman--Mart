import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Eye,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Truck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { InvoiceModal } from '../components/InvoiceModal';
import { formatINR, useStore } from '../context/StoreContext';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  fetchFirestoreCustomersAsAdmin,
  fetchFirestoreStoreConfig,
  isFirebaseBootstrappedAdmin,
  saveFirestoreStoreConfig,
  toggleFirestoreCustomerBlock,
} from '../lib/firestore-sync';
import {
  createStaticAdminCategory,
  createStaticAdminCoupon,
  createStaticAdminProduct,
  createStaticAdminSubcategory,
  deleteStaticAdminCategory,
  deleteStaticAdminCoupon,
  getStaticAdminCategories,
  getStaticAdminCoupons,
  getStaticAdminCustomers,
  getStaticAdminDashboard,
  getStaticAdminOrders,
  getStaticAdminPayments,
  getStaticAdminProducts,
  getStaticAdminSettings,
  getStaticAdminTickets,
  hasJsonContentType,
  isJsonApiResponse,
  isStaticToken,
  markStaticAdminCodCollected,
  processStaticAdminReturn,
  resolveAssetUrl,
  toggleStaticAdminCoupon,
  toggleStaticAdminCustomerBlock,
  updateStaticAdminOrderStatus,
  updateStaticAdminProduct,
  updateStaticAdminSettings,
  updateStaticAdminTicketStatus,
  verifyStaticAdminLogin,
} from '../lib/static-store';
import {
  formatEstimatedDeliveryDate,
  lookupIndiaPostPincode,
  normalizeDeliveryConfig,
  resolvePincodeDelivery,
  type PincodeCheckResult,
} from '../lib/pincode';
import type { Address, BannerItem, OrderRecord, PincodeDeliveryRule, StoreConfig } from '../types';

const STUDIO_IMAGE_PRESETS: Array<{ label: string; url: string }> = [
  { label: 'Wireless Headphones', url: '/src/assets/images/prod_wireless_headphones_1795321793763.jpg' },
  { label: 'Smartwatch Pro', url: '/src/assets/images/prod_smartwatch_pro_1795321794237.jpg' },
  { label: 'Organic Groceries', url: '/src/assets/images/prod_groceries_organic_1795321794873.jpg' },
  { label: "Men's Jacket", url: '/src/assets/images/prod_fashion_mens_jacket_1795321793933.jpg' },
  { label: "Women's Kurta", url: '/src/assets/images/prod_fashion_womens_kurta_1795321794640.jpg' },
  { label: 'Kitchen Airfryer', url: '/src/assets/images/prod_kitchen_airfryer_1795321794199.jpg' },
  { label: 'Beauty & Skincare', url: '/src/assets/images/prod_beauty_skincare_1795321796092.jpg' },
  { label: 'Footwear Sneakers', url: '/src/assets/images/prod_footwear_sneakers_1795321794437.jpg' },
  { label: 'Brass Home Decor Lamp', url: '/src/assets/images/prod_decor_brass_lamp_1795321794677.jpg' },
  { label: 'Fitness Dumbbells', url: '/src/assets/images/prod_fitness_dumbbells_1795321796300.jpg' },
];

const HERO_BANNER_PRESETS: Array<{ label: string; url: string }> = [
  { label: 'Hero: Flagship Electronics & Audio', url: '/src/assets/images/hero_aagaman_electronics_1795321794113.jpg' },
  { label: 'Hero: Modern Home & Kitchen', url: '/src/assets/images/hero_aagaman_home_1795321794314.jpg' },
  ...STUDIO_IMAGE_PRESETS,
];

function readCompressedBannerImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const maxWidth = 1440;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

interface AdminProductImage {
  id: number;
  imageUrl: string;
  altText: string;
  displayOrder: number;
  isPrimary: boolean;
}

interface AdminProductItem {
  id: number;
  sku: string;
  name: string;
  brand: string;
  categoryId: number;
  categoryName: string;
  description: string;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  stock: number;
  soldCount: number;
  gstPercent: number;
  returnPolicy: string;
  isActive: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isDealOfDay: boolean;
  images: AdminProductImage[];
}

const ProductThumbnail: React.FC<{ src?: string; alt: string; className?: string }> = ({
  src,
  alt,
  className = 'w-12 h-12',
}) => {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveAssetUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`${className} rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0`}
        title={alt}
      >
        <Package className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-lg border border-slate-200 bg-slate-50 object-cover shrink-0`}
    />
  );
};

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export const AdminPage: React.FC = () => {
  const { navigate, notify, refreshStoreMeta } = useStore();
  // Security: Admin token kept strictly in React memory
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [envOverrideActive, setEnvOverrideActive] = useState(false);

  // Login / Bootstrap form state
  const [authName, setAuthName] = useState('Store Administrator');
  const [authEmail, setAuthEmail] = useState('admin@aagamanmart.in');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Dashboard tabs
  const [tab, setTab] = useState<
    'overview' | 'products' | 'categories' | 'orders' | 'customers' | 'payments' | 'marketing' | 'delivery' | 'settings'
  >('overview');

  // Data states
  const [dashboard, setDashboard] = useState<{
    kpis: Record<string, number>;
    lowStockProducts: Array<{ id: number; name: string; sku: string; stock: number; sellingPrice: number }>;
    bestSellingProducts: Array<{ id: number; name: string; soldCount: number; sellingPrice: number }>;
    recentOrders: OrderRecord[];
    salesChart: Array<{ day: string; revenue: number; orders: number }>;
  } | null>(null);
  const [adminProducts, setAdminProducts] = useState<AdminProductItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [adminCategories, setAdminCategories] = useState<
    Array<{ id: number; name: string; slug: string; description: string; isActive: boolean; subcategories: Array<{ id: number; name: string }> }>
  >([]);
  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([]);
  const [adminReturns, setAdminReturns] = useState<
    Array<{ id: number; orderId: number; reason: string; requestType: string; status: string; createdAt: string }>
  >([]);
  interface AdminCustomerItem {
    id: number;
    uid?: string;
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

  const [adminCustomers, setAdminCustomers] = useState<AdminCustomerItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'email' | 'google' | 'blocked'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerItem | null>(null);
  const [firebaseAdminConnected, setFirebaseAdminConnected] = useState<boolean>(() => isFirebaseBootstrappedAdmin());
  const [adminPayments, setAdminPayments] = useState<
    Array<{
      id: number;
      orderNumber: string;
      customerName: string;
      gateway: string;
      method: string;
      razorpayPaymentId: string | null;
      amount: number;
      status: string;
      createdAt: string;
    }>
  >([]);
  const [adminCoupons, setAdminCoupons] = useState<
    Array<{
      id: number;
      code: string;
      description: string;
      discountType: string;
      discountValue: number;
      minOrderValue: number;
      usedCount: number;
      usageLimit: number;
      isActive: boolean;
    }>
  >([]);
  const [adminTickets, setAdminTickets] = useState<
    Array<{ id: number; name: string; email: string; subject: string; message: string; status: string; createdAt: string }>
  >([]);
  const [settingsForm, setSettingsForm] = useState<StoreConfig>(() => getStaticAdminSettings());
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);

  // Delivery & Pincode Controls State
  const [newPinRule, setNewPinRule] = useState<PincodeDeliveryRule>({
    pincode: '',
    cityLabel: '',
    serviceable: true,
    deliveryDays: 1,
    codAvailable: true,
    courierPartner: '',
    note: '',
  });
  const [pinRuleVerifying, setPinRuleVerifying] = useState(false);
  const [pinRuleVerifyMsg, setPinRuleVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testPinInput, setTestPinInput] = useState('400051');
  const [testPinLoading, setTestPinLoading] = useState(false);
  const [testPinStdRes, setTestPinStdRes] = useState<PincodeCheckResult | null>(null);
  const [testPinExpRes, setTestPinExpRes] = useState<PincodeCheckResult | null>(null);

  // Add Product Form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProd, setNewProd] = useState({
    sku: '',
    name: '',
    brand: '',
    categoryId: 1,
    description: '',
    mrp: 1999,
    sellingPrice: 1499,
    stock: 25,
    gstPercent: 18,
    imageUrl: '/src/assets/images/prod_wireless_headphones_1795321793763.jpg',
  });

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<AdminProductItem | null>(null);
  const [editForm, setEditForm] = useState({
    sku: '',
    name: '',
    brand: '',
    categoryId: 1,
    description: '',
    mrp: 0,
    sellingPrice: 0,
    stock: 0,
    gstPercent: 18,
    returnPolicy: '7 Days Easy Return & Replacement',
    isActive: true,
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
    isNewArrival: false,
    isDealOfDay: false,
    imageUrls: [] as string[],
  });
  const [newEditImageUrl, setNewEditImageUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const openEditProduct = (product: AdminProductItem) => {
    const orderedImages = [...(product.images || [])].sort((a, b) => a.displayOrder - b.displayOrder);
    const urls = orderedImages.map((img) => img.imageUrl).filter(Boolean);
    setEditingProduct(product);
    setEditForm({
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      categoryId: product.categoryId,
      description: product.description,
      mrp: product.mrp,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      gstPercent: product.gstPercent ?? 18,
      returnPolicy: product.returnPolicy || '7 Days Easy Return & Replacement',
      isActive: product.isActive,
      isFeatured: Boolean(product.isFeatured),
      isTrending: Boolean(product.isTrending),
      isBestSeller: Boolean(product.isBestSeller),
      isNewArrival: Boolean(product.isNewArrival),
      isDealOfDay: Boolean(product.isDealOfDay),
      imageUrls: urls.length > 0 ? urls : [STUDIO_IMAGE_PRESETS[0].url],
    });
    setNewEditImageUrl('');
  };

  // Add Category / Subcategory / Coupon forms
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newSubCatId, setNewSubCatId] = useState(1);
  const [newSubName, setNewSubName] = useState('');
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed' | 'free_shipping',
    discountValue: 15,
    minOrderValue: 999,
    maxDiscountLimit: 500,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/status');
        if (isJsonApiResponse(res)) {
          const json = await res.json();
          setNeedsBootstrap(Boolean(json.needsBootstrap));
          setEnvOverrideActive(Boolean(json.envOverrideActive));
          return;
        }
      } catch {
        // Static deployment — universal admin password login
      } finally {
        setStatusLoading(false);
      }
      setNeedsBootstrap(false);
      setEnvOverrideActive(true);
    })();
  }, []);

  const loadAllAdminData = useCallback(async (token: string) => {
    if (isStaticToken(token)) {
      const staticDash = getStaticAdminDashboard();
      setDashboard(staticDash);
      setAdminProducts(getStaticAdminProducts());
      const cats = getStaticAdminCategories();
      setAdminCategories(cats);
      if (cats[0]) {
        setNewProd((prev) => ({ ...prev, categoryId: cats[0].id }));
        setNewSubCatId(cats[0].id);
      }
      const ordData = getStaticAdminOrders();
      setAdminOrders(ordData.orders);
      setAdminReturns(ordData.returns);
      const localCustomers = getStaticAdminCustomers();
      setAdminCustomers(localCustomers);
      setAdminPayments(getStaticAdminPayments());
      setAdminCoupons(getStaticAdminCoupons());
      const localSettings = getStaticAdminSettings();
      setSettingsForm(localSettings);
      setAdminTickets(getStaticAdminTickets());

      setFirebaseAdminConnected(isFirebaseBootstrappedAdmin());
      try {
        const [rtCustRes, rtCfgRes, fsCustomers, fsConfig] = await Promise.all([
          fetch('/api/runtime/customers', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          fetch('/api/runtime/config').catch(() => null),
          fetchFirestoreCustomersAsAdmin().catch(() => [] as AdminCustomerItem[]),
          fetchFirestoreStoreConfig().catch(() => null),
        ]);

        const byEmail = new Map<string, AdminCustomerItem>();
        const mergeCustomer = (incomingCust: AdminCustomerItem) => {
          const key = (incomingCust.email || '').trim().toLowerCase();
          if (!key) return;
          const existing = byEmail.get(key);
          if (!existing) {
            byEmail.set(key, incomingCust);
          } else {
            byEmail.set(key, {
              ...existing,
              ...incomingCust,
              uid: incomingCust.uid || existing.uid,
              phone: incomingCust.phone || existing.phone,
              photoUrl: incomingCust.photoUrl || existing.photoUrl,
              addresses:
                (incomingCust.addresses && incomingCust.addresses.length > 0
                  ? incomingCust.addresses
                  : existing.addresses) || [],
              orderCount: Math.max(incomingCust.orderCount || 0, existing.orderCount || 0),
              totalSpent: Math.max(incomingCust.totalSpent || 0, existing.totalSpent || 0),
              recentOrders:
                incomingCust.recentOrders && incomingCust.recentOrders.length > 0
                  ? incomingCust.recentOrders
                  : existing.recentOrders || [],
              lastLoginAt:
                new Date(incomingCust.lastLoginAt || 0).getTime() >= new Date(existing.lastLoginAt || 0).getTime()
                  ? incomingCust.lastLoginAt
                  : existing.lastLoginAt,
            });
          }
        };

        for (const lc of localCustomers) mergeCustomer(lc);
        if (rtCustRes && isJsonApiResponse(rtCustRes)) {
          const rtCustJson = await rtCustRes.json();
          const remoteCustomers: AdminCustomerItem[] = Array.isArray(rtCustJson.customers)
            ? rtCustJson.customers
            : [];
          for (const rc of remoteCustomers) mergeCustomer(rc);
        }
        for (const fc of fsCustomers) mergeCustomer(fc);

        const mergedCustomers = Array.from(byEmail.values()).sort(
          (a, b) =>
            new Date(b.lastLoginAt || b.createdAt || 0).getTime() -
            new Date(a.lastLoginAt || a.createdAt || 0).getTime()
        );
        setAdminCustomers(mergedCustomers);
        setDashboard({
          ...staticDash,
          kpis: {
            ...staticDash.kpis,
            totalCustomers: mergedCustomers.length,
          },
        });

        let mergedSettings = { ...localSettings };
        if (fsConfig) {
          mergedSettings = { ...mergedSettings, ...fsConfig };
        }
        if (rtCfgRes && isJsonApiResponse(rtCfgRes)) {
          const rtCfgJson = await rtCfgRes.json();
          if (rtCfgJson.config && typeof rtCfgJson.config === 'object') {
            mergedSettings = { ...mergedSettings, ...rtCfgJson.config };
          }
        }
        setSettingsForm(mergedSettings);
      } catch {
        // ignore offline runtime/Firestore sync errors
      }
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const [dRes, pRes, cRes, oRes, uRes, payRes, coupRes, setRes, tickRes] = await Promise.all([
      fetch('/api/admin/dashboard', { headers }),
      fetch('/api/admin/products', { headers }),
      fetch('/api/admin/categories', { headers }),
      fetch('/api/admin/orders', { headers }),
      fetch('/api/admin/customers', { headers }),
      fetch('/api/admin/payments', { headers }),
      fetch('/api/admin/coupons', { headers }),
      fetch('/api/admin/settings', { headers }),
      fetch('/api/admin/support-tickets', { headers }),
    ]);

    if (isJsonApiResponse(dRes)) setDashboard(await dRes.json());
    if (isJsonApiResponse(pRes)) setAdminProducts((await pRes.json()).products || []);
    if (isJsonApiResponse(cRes)) {
      const cats = (await cRes.json()).categories || [];
      setAdminCategories(cats);
      if (cats[0]) {
        setNewProd((prev) => ({ ...prev, categoryId: cats[0].id }));
        setNewSubCatId(cats[0].id);
      }
    }
    if (isJsonApiResponse(oRes)) {
      const oJson = await oRes.json();
      setAdminOrders(oJson.orders || []);
      setAdminReturns(oJson.returns || []);
    }
    if (isJsonApiResponse(uRes)) setAdminCustomers((await uRes.json()).customers || []);
    if (isJsonApiResponse(payRes)) setAdminPayments((await payRes.json()).payments || []);
    if (isJsonApiResponse(coupRes)) setAdminCoupons((await coupRes.json()).coupons || []);
    if (isJsonApiResponse(setRes)) {
      const serverCfg = (await setRes.json()).config || {};
      setSettingsForm({ ...getStaticAdminSettings(), ...serverCfg });
    }
    if (isJsonApiResponse(tickRes)) setAdminTickets((await tickRes.json()).tickets || []);
  }, []);

  useEffect(() => {
    if (adminToken && (tab === 'customers' || tab === 'overview' || tab === 'orders')) {
      loadAllAdminData(adminToken);
    }
  }, [tab, adminToken, loadAllAdminData]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      let useStaticAuth = false;
      try {
        const endpoint = needsBootstrap ? '/api/admin/bootstrap' : '/api/admin/login';
        const body = needsBootstrap
          ? { name: authName, email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (hasJsonContentType(res) && res.status < 500) {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Authentication failed.');
          setAdminToken(json.token);
          setAdminUser(json.admin);
          setNeedsBootstrap(false);
          await loadAllAdminData(json.token);
          notify('Signed in to AAGAMAN MART Admin Console.', 'success');
          return;
        }
        useStaticAuth = true;
      } catch (innerErr) {
        if (innerErr instanceof Error && !innerErr.message.includes('Failed to fetch')) {
          throw innerErr;
        }
        useStaticAuth = true;
      }

      if (useStaticAuth) {
        const staticSession = verifyStaticAdminLogin(authPassword);
        setAdminToken(staticSession.token);
        setAdminUser(staticSession.admin);
        setNeedsBootstrap(false);
        await loadAllAdminData(staticSession.token);
        notify('Signed in to AAGAMAN MART Admin Console.', 'success');
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-600">
        Loading Admin Console...
      </div>
    );
  }

  if (!adminToken || !adminUser) {
    return (
      <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-200 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EA580C]">
              AAGAMAN MART · Admin Console
            </p>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A] mt-1">
              {needsBootstrap ? 'Claim Store Administrator Access' : 'Admin Portal Sign In'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {needsBootstrap
                ? 'First-time setup: Create your secure administrator account to unlock store management.'
                : envOverrideActive
                ? 'Enter the universal password to unlock store management.'
                : 'Separate secure authentication for AAGAMAN MART administrators.'}
            </p>
          </div>

          <form onSubmit={handleAdminAuth} className="space-y-3.5">
            {needsBootstrap && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Name</label>
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            )}
            {!envOverrideActive && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {envOverrideActive ? 'Admin Password' : needsBootstrap ? 'Create Password (min 8 chars)' : 'Admin Password'}
              </label>
              <input
                type="password"
                required
                minLength={needsBootstrap ? 8 : 1}
                placeholder={envOverrideActive ? 'Enter universal admin password' : undefined}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            {authError && <p className="text-xs text-red-600 font-medium">{authError}</p>}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm transition-colors"
            >
              {authSubmitting
                ? 'Verifying...'
                : needsBootstrap
                ? 'Claim Admin Access & Continue'
                : 'Sign In to Admin Console'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-center text-xs text-slate-500 hover:text-[#0B1F3A] font-medium"
          >
            ← Return to AAGAMAN MART Storefront
          </button>
        </div>
      </div>
    );
  }

  const orderStatuses = [
    'Order Placed',
    'Payment Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Return Requested',
    'Returned',
    'Refund Initiated',
    'Refunded',
  ];

  const maxChartRev = Math.max(1, ...(dashboard?.salesChart.map((d) => d.revenue) || [1]));

  const deliveryCfg = normalizeDeliveryConfig(settingsForm.deliveryConfig);

  const saveStoreConfigAcrossStores = async (nextConfig: StoreConfig, successMsg: string) => {
    const normalizedConfig: StoreConfig = {
      ...nextConfig,
      deliveryConfig: normalizeDeliveryConfig(nextConfig.deliveryConfig),
    };
    setSettingsForm(normalizedConfig);
    if (!adminToken) return;
    if (isStaticToken(adminToken)) {
      await updateStaticAdminSettings(normalizedConfig, adminToken);
      await saveFirestoreStoreConfig(normalizedConfig).catch(() => {});
      await refreshStoreMeta();
      notify(successMsg, 'success');
      return;
    }
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ config: normalizedConfig }),
    });
    if (res.ok) {
      await saveFirestoreStoreConfig(normalizedConfig).catch(() => {});
      await refreshStoreMeta();
      notify(successMsg, 'success');
    } else {
      notify('Failed to save store configuration.', 'error');
    }
  };

  const renderAnnouncementBarEditor = () => (
    <div className="lg:col-span-12 bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#EA580C]" /> Top Announcement Bar &amp; Sale Strip
          </h3>
          <p className="text-slate-500 mt-0.5">
            Control the orange bar at the very top of the website (&ldquo;Grand Aagaman Sale Live...&rdquo;) and the Deals section headline.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            if (isStaticToken(adminToken)) {
              await updateStaticAdminSettings(settingsForm, adminToken);
              await saveFirestoreStoreConfig(settingsForm).catch(() => {});
              await refreshStoreMeta();
              notify('Top announcement bar updated!', 'success');
              return;
            }
            const res = await fetch('/api/admin/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
              body: JSON.stringify({ config: settingsForm }),
            });
            if (res.ok) {
              await refreshStoreMeta();
              notify('Top announcement bar updated!', 'success');
            } else {
              notify('Failed to update top announcement bar.', 'error');
            }
          }}
          className="px-4 h-9 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold"
        >
          Save Top Bar
        </button>
      </div>

      {/* Live Preview */}
      <div className="rounded-lg overflow-hidden border border-slate-200">
        <div className="px-3 py-1 bg-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Live Header Strip Preview {settingsForm.announcementEnabled === false ? '(Hidden on Storefront)' : '(Visible on Storefront)'}
        </div>
        {settingsForm.announcementEnabled === false ? (
          <div className="px-4 py-2 bg-slate-50 text-slate-400 text-center italic">
            Top announcement bar is currently turned OFF.
          </div>
        ) : (
          <div className="bg-[#EA580C] text-white text-xs font-medium px-4 py-1.5 text-center truncate">
            {settingsForm.announcementText?.trim() || 'Enter announcement text below...'}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <p className="font-semibold text-[#0B1F3A]">Show Top Announcement Bar on Website</p>
            <p className="text-slate-500 text-[11px]">Turn off to hide the orange promo strip above the header.</p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-[#0B1F3A]">
            <input
              type="checkbox"
              checked={settingsForm.announcementEnabled !== false}
              onChange={(e) => setSettingsForm({ ...settingsForm, announcementEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#EA580C]"
            />
            <span>{settingsForm.announcementEnabled !== false ? 'Visible' : 'Hidden'}</span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-slate-500 mb-1">Top Announcement Bar Text</label>
          <input
            value={settingsForm.announcementText || ''}
            onChange={(e) => setSettingsForm({ ...settingsForm, announcementText: e.target.value })}
            placeholder="Grand Aagaman Sale Live — Free Shipping above ₹999 · Use code AAGAMAN10 for 10% off"
            className="w-full h-9 px-3 rounded-lg border border-slate-300"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1">Sale Section Kicker Title</label>
          <input
            value={settingsForm.flashSaleTitle || ''}
            onChange={(e) => setSettingsForm({ ...settingsForm, flashSaleTitle: e.target.value })}
            placeholder="Grand Aagaman Sale"
            className="w-full h-9 px-3 rounded-lg border border-slate-300"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1">Sale Section Subtitle</label>
          <input
            value={settingsForm.flashSaleSubtitle || ''}
            onChange={(e) => setSettingsForm({ ...settingsForm, flashSaleSubtitle: e.target.value })}
            placeholder="Curated flagship deals across Electronics, Home & Lifestyle..."
            className="w-full h-9 px-3 rounded-lg border border-slate-300"
          />
        </div>
      </div>
    </div>
  );

  const renderHeroBannersEditor = () => (
    <div className="lg:col-span-12 bg-white border border-slate-200 rounded-xl p-6 space-y-5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#EA580C]" /> Homepage Hero Banners ({(settingsForm.banners || []).length})
          </h3>
          <p className="text-slate-500 mt-0.5">
            Edit the hero carousel slides shown at the top of the storefront — headline, offer badge, subtitle, button link, and background image.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextBanner: BannerItem = {
                id: `banner-${Date.now()}`,
                kicker: 'Featured Offer',
                title: 'New Season Collection',
                subtitle: 'Discover verified Indian brands, fast delivery, and instant Razorpay & UPI checkout.',
                ctaLabel: 'Shop Now',
                categorySlug: adminCategories[0]?.slug || 'all',
                imageUrl: HERO_BANNER_PRESETS[0].url,
              };
              setSettingsForm({
                ...settingsForm,
                banners: [...(settingsForm.banners || []), nextBanner],
              });
            }}
            className="px-3.5 h-9 rounded-lg border border-slate-300 hover:bg-slate-50 text-[#0B1F3A] font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Banner Slide
          </button>
          <button
            type="button"
            onClick={async () => {
              if (isStaticToken(adminToken)) {
                await updateStaticAdminSettings(settingsForm, adminToken);
                await saveFirestoreStoreConfig(settingsForm).catch(() => {});
                await refreshStoreMeta();
                notify('Homepage hero banners updated!', 'success');
                return;
              }
              const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                body: JSON.stringify({ config: settingsForm }),
              });
              if (res.ok) {
                await refreshStoreMeta();
                notify('Homepage hero banners updated!', 'success');
              } else {
                notify('Failed to save hero banners.', 'error');
              }
            }}
            className="px-4 h-9 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold"
          >
            Save Hero Banners
          </button>
        </div>
      </div>

      {(settingsForm.banners || []).length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-500 space-y-2">
          <p>No hero banners configured. Click &ldquo;Add Banner Slide&rdquo; to create your first storefront banner.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(settingsForm.banners || []).map((banner, idx) => {
            const updateBannerAt = (patch: Partial<BannerItem>) => {
              const next = [...(settingsForm.banners || [])];
              next[idx] = { ...next[idx], ...patch };
              setSettingsForm({ ...settingsForm, banners: next });
            };
            const moveBanner = (dir: -1 | 1) => {
              const next = [...(settingsForm.banners || [])];
              const target = idx + dir;
              if (target < 0 || target >= next.length) return;
              [next[idx], next[target]] = [next[target], next[idx]];
              setSettingsForm({ ...settingsForm, banners: next });
            };
            const removeBanner = () => {
              const next = (settingsForm.banners || []).filter((_, i) => i !== idx);
              setSettingsForm({ ...settingsForm, banners: next });
            };

            return (
              <div
                key={banner.id || idx}
                className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
              >
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-[#0B1F3A]">
                    Slide #{idx + 1} · {banner.kicker || 'Untitled Banner'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveBanner(-1)}
                      title="Move Up"
                      className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === (settingsForm.banners || []).length - 1}
                      onClick={() => moveBanner(1)}
                      title="Move Down"
                      className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={removeBanner}
                      title="Delete Slide"
                      className="px-2.5 py-1 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>

                <div className="p-4 grid lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-5 relative rounded-xl overflow-hidden bg-[#0B1F3A] text-white min-h-[190px] flex items-center border border-slate-200">
                    {banner.imageUrl && (
                      <img
                        src={resolveAssetUrl(banner.imageUrl)}
                        alt={banner.title}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0B1F3A]/95 via-[#0B1F3A]/75 to-[#0B1F3A]/25" />
                    <div className="relative z-10 p-5 space-y-2 max-w-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FDBA74]">
                        {banner.kicker || 'OFFER TAG'}
                      </p>
                      <p className="font-display text-lg font-bold leading-snug">
                        {banner.title || 'Banner Headline'}
                      </p>
                      <p className="text-[11px] text-slate-200 line-clamp-2">
                        {banner.subtitle || 'Banner description text'}
                      </p>
                      <span className="inline-block mt-1 px-3 py-1.5 rounded-md bg-[#EA580C] text-white text-[11px] font-semibold">
                        {banner.ctaLabel || 'Shop Now'} →
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-7 grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1">Top Badge / Kicker</label>
                      <input
                        value={banner.kicker}
                        onChange={(e) => updateBannerAt({ kicker: e.target.value })}
                        placeholder="Grand Aagaman Sale"
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Button Label (CTA)</label>
                      <input
                        value={banner.ctaLabel}
                        onChange={(e) => updateBannerAt({ ctaLabel: e.target.value })}
                        placeholder="Shop Electronics"
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-500 mb-1">Main Headline</label>
                      <input
                        value={banner.title}
                        onChange={(e) => updateBannerAt({ title: e.target.value })}
                        placeholder="Flagship Tech & Audio Built to Move You Forward"
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-500 mb-1">Subtitle / Description</label>
                      <textarea
                        rows={2}
                        value={banner.subtitle}
                        onChange={(e) => updateBannerAt({ subtitle: e.target.value })}
                        placeholder="Up to 42% off..."
                        className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Button Target Category</label>
                      <select
                        value={banner.categorySlug}
                        onChange={(e) => updateBannerAt({ categorySlug: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="all">All Products (/shop)</option>
                        {adminCategories.map((c) => (
                          <option key={c.id} value={c.slug}>
                            {c.name} (/category/{c.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Preset Banner Image</label>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) updateBannerAt({ imageUrl: e.target.value });
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="">Choose a built-in image...</option>
                        {HERO_BANNER_PRESETS.map((preset) => (
                          <option key={preset.url} value={preset.url}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-500 mb-1">Banner Image URL or Upload</label>
                      <div className="flex flex-wrap sm:flex-nowrap gap-2">
                        <input
                          value={banner.imageUrl}
                          onChange={(e) => updateBannerAt({ imageUrl: e.target.value })}
                          placeholder="https://... or /src/assets/images/..."
                          className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono text-[11px]"
                        />
                        <label className="px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B1F3A] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5 text-[#EA580C]" />
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              try {
                                const compressed = await readCompressedBannerImage(file);
                                updateBannerAt({ imageUrl: compressed });
                                notify('Banner image loaded! Click Save Hero Banners to apply.', 'info');
                              } catch {
                                notify('Unable to load selected image file.', 'error');
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-[#0B1F3A] text-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-white">AAGAMAN MART</p>
            <p className="text-[11px] text-[#FDBA74]">Admin Store Console</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs text-slate-300 hover:text-white underline lg:hidden"
          >
            Storefront
          </button>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar flex-1">
          {[
            { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
            { id: 'products', label: 'Products & Stock', icon: Package },
            { id: 'categories', label: 'Categories', icon: FolderTree },
            { id: 'orders', label: 'Orders & Returns', icon: ShoppingBag },
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'payments', label: 'Payments Ledger', icon: CreditCard },
            { id: 'marketing', label: 'Coupons & Banners', icon: Tag },
            { id: 'delivery', label: 'Delivery & Pincodes', icon: Truck },
            { id: 'settings', label: 'Settings & Support', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  tab === item.id
                    ? 'bg-[#EA580C] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2 hidden lg:block text-xs">
          <p className="font-semibold text-white truncate">{adminUser.name}</p>
          <p className="text-slate-400 truncate">{adminUser.email}</p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium"
            >
              Storefront
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminToken(null);
                setAdminUser(null);
              }}
              className="px-2.5 py-1.5 rounded bg-red-900/50 hover:bg-red-800 text-white"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 lg:p-8 overflow-x-hidden space-y-6">
        {/* Top Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs text-slate-500">Admin Console / {tab.toUpperCase()}</p>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A] capitalize">{tab}</h1>
          </div>
          <button
            type="button"
            onClick={() => loadAllAdminData(adminToken)}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
          >
            Refresh Data
          </button>
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && dashboard && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', val: formatINR(dashboard.kpis.totalRevenue) },
                { label: 'Total Orders', val: String(dashboard.kpis.totalOrders) },
                { label: 'Total Customers', val: String(dashboard.kpis.totalCustomers) },
                { label: 'Active Products', val: String(dashboard.kpis.totalProducts) },
                { label: 'Pending / Active', val: String(dashboard.kpis.pendingOrders) },
                { label: 'Delivered Orders', val: String(dashboard.kpis.deliveredOrders) },
                { label: 'Cancelled Orders', val: String(dashboard.kpis.cancelledOrders) },
                { label: 'Total Units Sold', val: String(dashboard.kpis.totalUnitsSold) },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className="font-mono text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">{kpi.val}</p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* 7-Day Sales Bar Chart */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#EA580C]" /> 7-Day Revenue Trend
                  </h2>
                </div>
                <div className="h-48 flex items-end gap-3 pt-4 border-b border-slate-100">
                  {dashboard.salesChart.map((d) => {
                    const heightPct = Math.max(6, Math.round((d.revenue / maxChartRev) * 100));
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {d.revenue > 0 ? formatINR(d.revenue) : '₹0'}
                        </span>
                        <div
                          className="w-full max-w-[40px] rounded-t-md bg-[#EA580C] transition-all"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[11px] font-medium text-slate-600">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Low Stock Alerts */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" /> Low-Stock Products
                </h2>
                {dashboard.lowStockProducts.length === 0 ? (
                  <p className="text-xs text-slate-500">All products have healthy inventory levels.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {dashboard.lowStockProducts.map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0B1F3A] truncate">{p.name}</p>
                          <p className="font-mono text-slate-500">{p.sku}</p>
                        </div>
                        <span className="font-mono font-bold text-red-600 tabular-nums shrink-0">
                          {p.stock} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Best Sellers & Recent Orders */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0B1F3A]">Best-Selling Products</h2>
                <div className="divide-y divide-slate-100 text-xs">
                  {dashboard.bestSellingProducts.map((p) => (
                    <div key={p.id} className="py-2.5 flex justify-between gap-3">
                      <span className="font-medium text-slate-800 truncate">{p.name}</span>
                      <span className="font-mono text-slate-600 tabular-nums shrink-0">
                        {p.soldCount} sold · {formatINR(p.sellingPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#0B1F3A]">Recent Orders</h2>
                {dashboard.recentOrders.length === 0 ? (
                  <p className="text-xs text-slate-500">No orders placed yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {dashboard.recentOrders.map((o) => (
                      <div key={o.id} className="py-2.5 flex justify-between gap-3">
                        <div>
                          <p className="font-mono font-semibold text-[#0B1F3A]">{o.orderNumber}</p>
                          <p className="text-slate-500">{o.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-[#EA580C] tabular-nums">{formatINR(o.grandTotal)}</p>
                          <p className="text-slate-500">{o.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search name, SKU, brand..."
                    className="h-9 pl-8 pr-3 rounded-lg border border-slate-300 bg-white text-xs w-60 focus:outline-none focus:border-[#0B1F3A]"
                  />
                </div>
                <select
                  value={productStatusFilter}
                  onChange={(e) => setProductStatusFilter(e.target.value as 'all' | 'active' | 'archived')}
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-700"
                >
                  <option value="all">All Status ({adminProducts.length})</option>
                  <option value="active">
                    Active ({adminProducts.filter((p) => p.isActive).length})
                  </option>
                  <option value="archived">
                    Archived ({adminProducts.filter((p) => !p.isActive).length})
                  </option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProduct((v) => !v)}
                className="px-4 py-2 rounded-lg bg-[#EA580C] text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {showAddProduct && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isStaticToken(adminToken)) {
                    createStaticAdminProduct({
                      ...newProd,
                      imageUrls: [newProd.imageUrl],
                    });
                    notify('Product added to store!', 'success');
                    setShowAddProduct(false);
                    await loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    return;
                  }
                  const res = await fetch('/api/admin/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({
                      ...newProd,
                      imageUrls: [newProd.imageUrl],
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok) notify(json.error || 'Error creating product', 'error');
                  else {
                    notify('Product added to store!', 'success');
                    setShowAddProduct(false);
                    await loadAllAdminData(adminToken);
                    refreshStoreMeta();
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 grid sm:grid-cols-3 gap-3 text-xs"
              >
                <input
                  required
                  placeholder="SKU (e.g. AAG-NEW-101)"
                  value={newProd.sku}
                  onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  required
                  placeholder="Product Name"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-slate-300"
                />
                <input
                  required
                  placeholder="Brand"
                  value={newProd.brand}
                  onChange={(e) => setNewProd({ ...newProd, brand: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-slate-300"
                />
                <select
                  value={newProd.categoryId}
                  onChange={(e) => setNewProd({ ...newProd, categoryId: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white"
                >
                  {adminCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  placeholder="MRP ₹"
                  value={newProd.mrp}
                  onChange={(e) => setNewProd({ ...newProd, mrp: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  required
                  placeholder="Selling Price ₹"
                  value={newProd.sellingPrice}
                  onChange={(e) => setNewProd({ ...newProd, sellingPrice: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  required
                  placeholder="Initial Stock"
                  value={newProd.stock}
                  onChange={(e) => setNewProd({ ...newProd, stock: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  required
                  placeholder="GST %"
                  value={newProd.gstPercent}
                  onChange={(e) => setNewProd({ ...newProd, gstPercent: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <div className="flex items-center gap-2">
                  <ProductThumbnail src={newProd.imageUrl} alt="New product preview" className="w-9 h-9" />
                  <input
                    required
                    placeholder="Image URL"
                    value={newProd.imageUrl}
                    onChange={(e) => setNewProd({ ...newProd, imageUrl: e.target.value })}
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setNewProd({ ...newProd, imageUrl: e.target.value });
                  }}
                  className="sm:col-span-3 h-9 px-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
                >
                  <option value="">Quick-pick a studio product image (optional)...</option>
                  {STUDIO_IMAGE_PRESETS.map((preset) => (
                    <option key={preset.url} value={preset.url}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <textarea
                  required
                  placeholder="Product Description"
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className="sm:col-span-3 p-3 rounded-lg border border-slate-300"
                  rows={2}
                />
                <button type="submit" className="sm:col-span-3 h-10 rounded-lg bg-[#0B1F3A] text-white font-semibold">
                  Publish Product
                </button>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Product & Image</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Price (₹)</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminProducts
                    .filter((p) => {
                      if (productStatusFilter === 'active' && !p.isActive) return false;
                      if (productStatusFilter === 'archived' && p.isActive) return false;
                      const q = productSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.sku.toLowerCase().includes(q) ||
                        p.brand.toLowerCase().includes(q) ||
                        p.categoryName.toLowerCase().includes(q)
                      );
                    })
                    .map((p) => {
                      const primaryImage =
                        p.images?.find((img) => img.isPrimary)?.imageUrl || p.images?.[0]?.imageUrl;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <ProductThumbnail src={primaryImage} alt={p.name} className="w-12 h-12" />
                              <div className="min-w-0">
                                <p className="font-semibold text-[#0B1F3A] truncate max-w-[260px]">{p.name}</p>
                                <p className="font-mono text-slate-500 mt-0.5">
                                  {p.sku} · {p.brand}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  {p.images?.length || 0} {p.images?.length === 1 ? 'image' : 'images'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">{p.categoryName}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <span className="font-semibold text-[#0B1F3A]">{formatINR(p.sellingPrice)}</span>
                            {p.mrp > p.sellingPrice && (
                              <span className="block text-[11px] text-slate-400 line-through">
                                {formatINR(p.mrp)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <button
                              type="button"
                              onClick={async () => {
                                if (isStaticToken(adminToken)) {
                                  updateStaticAdminProduct(p.id, { stock: p.stock + 10 });
                                  notify(`Restocked +10 units for ${p.sku}`, 'success');
                                  loadAllAdminData(adminToken);
                                  return;
                                }
                                await fetch(`/api/admin/products/${p.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${adminToken}`,
                                  },
                                  body: JSON.stringify({ stock: p.stock + 10 }),
                                });
                                notify(`Restocked +10 units for ${p.sku}`, 'success');
                                loadAllAdminData(adminToken);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-semibold"
                              title="Click to restock +10"
                            >
                              {p.stock} (+10)
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[11px] font-semibold ${
                                p.isActive ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              {p.isActive ? 'Active' : 'Archived'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditProduct(p)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B1F3A] font-semibold inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#EA580C]" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (isStaticToken(adminToken)) {
                                    updateStaticAdminProduct(p.id, { isActive: !p.isActive });
                                    notify(p.isActive ? 'Product archived.' : 'Product restored.', 'info');
                                    await loadAllAdminData(adminToken);
                                    refreshStoreMeta();
                                    return;
                                  }
                                  await fetch(`/api/admin/products/${p.id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${adminToken}`,
                                    },
                                    body: JSON.stringify({ isActive: !p.isActive }),
                                  });
                                  notify(p.isActive ? 'Product archived.' : 'Product restored.', 'info');
                                  await loadAllAdminData(adminToken);
                                  refreshStoreMeta();
                                }}
                                className={`font-medium hover:underline ${
                                  p.isActive ? 'text-red-600' : 'text-emerald-700'
                                }`}
                              >
                                {p.isActive ? 'Archive' : 'Restore'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {tab === 'categories' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {adminCategories.map((c) => (
                <div key={c.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <p className="font-bold text-sm text-[#0B1F3A]">{c.name}</p>
                    <p className="text-slate-500 mt-0.5">{c.description}</p>
                    {c.subcategories.length > 0 && (
                      <p className="text-slate-600 mt-1">
                        Subcategories: {c.subcategories.map((s) => s.name).join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isStaticToken(adminToken)) {
                        deleteStaticAdminCategory(c.id);
                        loadAllAdminData(adminToken);
                        refreshStoreMeta();
                        return;
                      }
                      await fetch(`/api/admin/categories/${c.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${adminToken}` },
                      });
                      loadAllAdminData(adminToken);
                      refreshStoreMeta();
                    }}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="lg:col-span-5 space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isStaticToken(adminToken)) {
                    createStaticAdminCategory(newCatName, newCatDesc);
                    setNewCatName('');
                    setNewCatDesc('');
                    loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    notify('Category created!', 'success');
                    return;
                  }
                  const res = await fetch('/api/admin/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ name: newCatName, description: newCatDesc }),
                  });
                  if (res.ok) {
                    setNewCatName('');
                    setNewCatDesc('');
                    loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    notify('Category created!', 'success');
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs"
              >
                <h3 className="font-display text-sm font-bold text-[#0B1F3A]">Add New Category</h3>
                <input
                  required
                  placeholder="Category Name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300"
                />
                <input
                  placeholder="Category Description"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300"
                />
                <button type="submit" className="w-full h-9 rounded-lg bg-[#EA580C] text-white font-semibold">
                  Create Category
                </button>
              </form>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isStaticToken(adminToken)) {
                    createStaticAdminSubcategory(newSubCatId, newSubName);
                    setNewSubName('');
                    loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    notify('Subcategory added!', 'success');
                    return;
                  }
                  const res = await fetch('/api/admin/subcategories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                    body: JSON.stringify({ categoryId: newSubCatId, name: newSubName }),
                  });
                  if (res.ok) {
                    setNewSubName('');
                    loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    notify('Subcategory added!', 'success');
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs"
              >
                <h3 className="font-display text-sm font-bold text-[#0B1F3A]">Add Subcategory</h3>
                <select
                  value={newSubCatId}
                  onChange={(e) => setNewSubCatId(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                >
                  {adminCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Subcategory Name"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300"
                />
                <button type="submit" className="w-full h-9 rounded-lg bg-[#0B1F3A] text-white font-semibold">
                  Add Subcategory
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ORDERS & RETURNS */}
        {tab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Update Lifecycle Status</th>
                    <th className="py-3 px-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-3 px-4">
                        <p className="font-mono font-bold text-[#0B1F3A]">{o.orderNumber}</p>
                        <p className="text-slate-500 font-mono">{o.shipping?.trackingNumber}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{o.customerName}</p>
                        <p className="text-slate-500">{o.addressSnapshot.city}</p>
                      </td>
                      <td className="py-3 px-4">
                        {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        {formatINR(o.grandTotal)}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={o.status}
                          onChange={async (e) => {
                            const nextStatus = e.target.value;
                            if (isStaticToken(adminToken)) {
                              updateStaticAdminOrderStatus(o.id, nextStatus);
                            } else {
                              await fetch(`/api/admin/orders/${o.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                                body: JSON.stringify({ status: nextStatus }),
                              });
                            }
                            notify(`Order ${o.orderNumber} updated to ${nextStatus}`, 'success');
                            loadAllAdminData(adminToken);
                          }}
                          className="h-8 px-2 rounded border border-slate-300 bg-white text-xs font-medium"
                        >
                          {orderStatuses.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setInvoiceOrder(o)}
                          className="text-[#EA580C] font-semibold hover:underline"
                        >
                          View PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Returns Queue */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">Return & Refund Requests</h3>
              {adminReturns.length === 0 ? (
                <p className="text-xs text-slate-500">No return requests submitted.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {adminReturns.map((r) => (
                    <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">
                          Return #{r.id} (Order #{r.orderId}) · {r.requestType.toUpperCase()}
                        </p>
                        <p className="text-slate-600">{r.reason}</p>
                        <p className="text-slate-400">Status: {r.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (isStaticToken(adminToken)) {
                              processStaticAdminReturn(r.id, 'Returned', true);
                            } else {
                              await fetch(`/api/admin/returns/${r.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                                body: JSON.stringify({ status: 'Returned', issueRefund: true }),
                              });
                            }
                            notify('Return approved and refund processed!', 'success');
                            loadAllAdminData(adminToken);
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-700 text-white font-semibold"
                        >
                          Approve & Issue Refund
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (isStaticToken(adminToken)) {
                              processStaticAdminReturn(r.id, 'Rejected', false);
                            } else {
                              await fetch(`/api/admin/returns/${r.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                                body: JSON.stringify({ status: 'Rejected', issueRefund: false }),
                              });
                            }
                            loadAllAdminData(adminToken);
                          }}
                          className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {tab === 'customers' && (() => {
          const filteredCustomers = adminCustomers.filter((c) => {
            if (customerFilter === 'email' && c.authMethod !== 'email') return false;
            if (customerFilter === 'google' && c.authMethod !== 'google') return false;
            if (customerFilter === 'blocked' && !c.isBlocked) return false;
            const q = customerSearch.trim().toLowerCase();
            if (!q) return true;
            return (
              c.name.toLowerCase().includes(q) ||
              c.email.toLowerCase().includes(q) ||
              (c.phone || '').toLowerCase().includes(q)
            );
          });

          return (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search name, email, or phone..."
                      className="h-9 pl-9 pr-3 w-64 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value as 'all' | 'email' | 'google' | 'blocked')}
                    className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-700"
                  >
                    <option value="all">All Registered ({adminCustomers.length})</option>
                    <option value="email">
                      Email Sign-Up ({adminCustomers.filter((c) => c.authMethod !== 'google').length})
                    </option>
                    <option value="google">
                      Google Sign-In ({adminCustomers.filter((c) => c.authMethod === 'google').length})
                    </option>
                    <option value="blocked">
                      Blocked ({adminCustomers.filter((c) => c.isBlocked).length})
                    </option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {firebaseAdminConnected ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      Cloud Sync Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const cred = await signInWithPopup(auth, googleAuthProvider);
                          if ((cred.user.email || '').trim().toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL) {
                            notify(`Please sign in with admin Google account (${BOOTSTRAPPED_ADMIN_EMAIL}).`, 'error');
                            return;
                          }
                          setFirebaseAdminConnected(true);
                          await loadAllAdminData(adminToken);
                          notify('Google Admin Cloud Sync connected!', 'success');
                        } catch (err: unknown) {
                          notify(err instanceof Error ? err.message : 'Google Admin connect failed.', 'error');
                        }
                      }}
                      className="px-3 h-8 rounded-lg bg-[#0B1F3A] hover:bg-slate-800 text-white font-semibold"
                    >
                      Sync Cloud Customers (Google Admin)
                    </button>
                  )}
                  <p className="text-slate-500">
                    Total Registered Accounts: <strong className="text-[#0B1F3A]">{adminCustomers.length}</strong>
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500 space-y-1">
                    <p className="font-semibold text-[#0B1F3A]">No registered customers found</p>
                    <p>When customers register or sign in via Email or Google from the storefront Sign In button, their full profile details will appear here.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-3 px-4">Customer &amp; Sign-In Method</th>
                        <th className="py-3 px-4">Mobile Number</th>
                        <th className="py-3 px-4">Registered / Last Sign-In</th>
                        <th className="py-3 px-4 text-right">Orders &amp; Addresses</th>
                        <th className="py-3 px-4 text-right">Total Spend</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCustomers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {c.photoUrl ? (
                                <img
                                  src={c.photoUrl}
                                  alt={c.name}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#0B1F3A] text-white font-bold flex items-center justify-center shrink-0">
                                  {(c.name || c.email || 'C').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="font-semibold text-[#0B1F3A]">{c.name}</p>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      c.authMethod === 'google'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {c.authMethod === 'google' ? 'Google' : 'Email'}
                                  </span>
                                  {c.emailVerified && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                      Verified
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-500">{c.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <div>{c.phone || '—'}</div>
                            {c.phoneVerified && (
                              <span className="text-[10px] text-emerald-700 font-sans font-semibold">OTP Verified</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <p>
                              Joined:{' '}
                              <span className="font-mono">
                                {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '—'}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Last sign-in:{' '}
                              {c.lastLoginAt
                                ? new Date(c.lastLoginAt).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <p>{c.orderCount} orders</p>
                            <p className="text-[11px] text-slate-400">
                              {(c.addresses || []).length} saved addr
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                            {formatINR(c.totalSpent)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedCustomer(c)}
                                className="px-2.5 py-1 rounded border border-slate-200 hover:border-[#0B1F3A] text-[#0B1F3A] font-semibold inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> Details
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (isStaticToken(adminToken)) {
                                    toggleStaticAdminCustomerBlock(c.id, !c.isBlocked);
                                    if (c.uid && isFirebaseBootstrappedAdmin()) {
                                      await toggleFirestoreCustomerBlock(c.uid, !c.isBlocked).catch(() => {});
                                    }
                                    try {
                                      await fetch('/api/runtime/customers/block', {
                                        method: 'PATCH',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${adminToken}`,
                                        },
                                        body: JSON.stringify({ email: c.email, isBlocked: !c.isBlocked }),
                                      });
                                    } catch {
                                      // ignore offline runtime sync errors
                                    }
                                  } else {
                                    await fetch(`/api/admin/customers/${c.id}/block`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                                      body: JSON.stringify({ isBlocked: !c.isBlocked }),
                                    });
                                  }
                                  loadAllAdminData(adminToken);
                                }}
                                className={`px-2.5 py-1 rounded font-semibold ${
                                  c.isBlocked ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {c.isBlocked ? 'Unblock' : 'Block'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })()}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Gateway & Method</th>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-[#0B1F3A]">{p.orderNumber}</td>
                    <td className="py-3 px-4">
                      {p.gateway.toUpperCase()} · {p.method.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{p.razorpayPaymentId || 'COD Pending'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">{formatINR(p.amount)}</td>
                    <td className="py-3 px-4 text-right">
                      {p.status === 'cod_pending' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (isStaticToken(adminToken)) {
                              markStaticAdminCodCollected(p.id);
                            } else {
                              await fetch(`/api/admin/payments/${p.id}/cod-collected`, {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${adminToken}` },
                              });
                            }
                            notify('COD cash marked collected.', 'success');
                            loadAllAdminData(adminToken);
                          }}
                          className="px-3 py-1 rounded bg-[#EA580C] text-white font-semibold"
                        >
                          Mark COD Collected
                        </button>
                      ) : (
                        <span className="font-semibold text-emerald-700 uppercase">{p.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MARKETING & COUPONS & BANNERS */}
        {tab === 'marketing' && (
          <div className="grid lg:grid-cols-12 gap-6">
            {renderAnnouncementBarEditor()}
            {renderHeroBannersEditor()}

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {adminCoupons.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-mono font-bold text-sm text-[#0B1F3A]">{c.code}</p>
                    <p className="text-slate-600">{c.description}</p>
                    <p className="text-slate-400 mt-0.5 tabular-nums">
                      Used {c.usedCount}/{c.usageLimit} · Min ₹{c.minOrderValue}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (isStaticToken(adminToken)) {
                          toggleStaticAdminCoupon(c.id, !c.isActive);
                        } else {
                          await fetch(`/api/admin/coupons/${c.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                            body: JSON.stringify({ isActive: !c.isActive }),
                          });
                        }
                        loadAllAdminData(adminToken);
                        refreshStoreMeta();
                      }}
                      className={`px-3 py-1 rounded font-semibold ${
                        c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (isStaticToken(adminToken)) {
                          deleteStaticAdminCoupon(c.id);
                        } else {
                          await fetch(`/api/admin/coupons/${c.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${adminToken}` },
                          });
                        }
                        loadAllAdminData(adminToken);
                      }}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isStaticToken(adminToken)) {
                  createStaticAdminCoupon(newCoupon);
                  setNewCoupon({ ...newCoupon, code: '', description: '' });
                  loadAllAdminData(adminToken);
                  refreshStoreMeta();
                  notify('Coupon created!', 'success');
                  return;
                }
                const res = await fetch('/api/admin/coupons', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                  body: JSON.stringify(newCoupon),
                });
                if (res.ok) {
                  setNewCoupon({ ...newCoupon, code: '', description: '' });
                  loadAllAdminData(adminToken);
                  refreshStoreMeta();
                  notify('Coupon created!', 'success');
                }
              }}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs"
            >
              <h3 className="font-display text-sm font-bold text-[#0B1F3A]">Create Promotional Coupon</h3>
              <input
                required
                placeholder="Code (e.g. DIWALI20)"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono uppercase"
              />
              <input
                required
                placeholder="Description"
                value={newCoupon.description}
                onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCoupon.discountType}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, discountType: e.target.value as 'percentage' | 'fixed' | 'free_shipping' })
                  }
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
                <input
                  type="number"
                  placeholder="Value"
                  value={newCoupon.discountValue}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min Order ₹"
                  value={newCoupon.minOrderValue}
                  onChange={(e) => setNewCoupon({ ...newCoupon, minOrderValue: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <input
                  type="number"
                  placeholder="Max Discount ₹"
                  value={newCoupon.maxDiscountLimit}
                  onChange={(e) => setNewCoupon({ ...newCoupon, maxDiscountLimit: Number(e.target.value) })}
                  className="h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
              </div>
              <button type="submit" className="w-full h-9 rounded-lg bg-[#EA580C] text-white font-semibold">
                Save Coupon
              </button>
            </form>
          </div>
        )}

        {/* DELIVERY & PINCODES */}
        {tab === 'delivery' && settingsForm && (
          <div className="grid lg:grid-cols-12 gap-6 text-xs">
            {/* Zone Delivery Schedule */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveStoreConfigAcrossStores(
                  { ...settingsForm, deliveryConfig: deliveryCfg },
                  'Delivery schedule & Indian pincode timing updated!'
                );
              }}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-[#EA580C]" /> Pan-India Delivery Schedule (Delivery Kab Hoga)
                  </h3>
                  <p className="text-slate-500 mt-0.5">
                    Set exact delivery days across India Post zones. Non-existent pincodes automatically show &ldquo;No Match&rdquo;.
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-4 h-9 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold"
                >
                  Save Delivery Schedule
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <label className="block font-semibold text-[#0B1F3A]">Metro &amp; Tier-1 Cities (Days)</label>
                  <p className="text-[11px] text-slate-500">Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai, Pune, Kolkata</p>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={deliveryCfg.sameHubDays}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        deliveryConfig: { ...deliveryCfg, sameHubDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) },
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                  <p className="text-[11px] font-medium text-emerald-700">
                    Customer sees: {formatEstimatedDeliveryDate(deliveryCfg.sameHubDays, false)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <label className="block font-semibold text-[#0B1F3A]">Standard Pan-India (Days)</label>
                  <p className="text-[11px] text-slate-500">All other verified Indian districts &amp; towns</p>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={deliveryCfg.standardDays}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        deliveryConfig: { ...deliveryCfg, standardDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) },
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                  <p className="text-[11px] font-medium text-emerald-700">
                    Customer sees: {formatEstimatedDeliveryDate(deliveryCfg.standardDays, false)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <label className="block font-semibold text-[#0B1F3A]">Remote / Hill / North-East &amp; J&amp;K (Days)</label>
                  <p className="text-[11px] text-slate-500">NE States, J&amp;K, Ladakh, Islands, Himachal &amp; Uttarakhand hills</p>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={deliveryCfg.remoteDays}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        deliveryConfig: { ...deliveryCfg, remoteDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) },
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                  <p className="text-[11px] font-medium text-emerald-700">
                    Customer sees: {formatEstimatedDeliveryDate(deliveryCfg.remoteDays, false)}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <label className="block font-semibold text-[#0B1F3A]">Express Air Priority (Days)</label>
                  <p className="text-[11px] text-slate-500">Paid fast air shipping option at checkout</p>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={deliveryCfg.expressDays}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        deliveryConfig: { ...deliveryCfg, expressDays: Math.max(0, Math.min(15, Number(e.target.value) || 0)) },
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                  <p className="text-[11px] font-medium text-emerald-700">
                    Customer sees: {formatEstimatedDeliveryDate(deliveryCfg.expressDays, false)}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block font-semibold text-[#0B1F3A] mb-1">Dispatch Cutoff Note</label>
                  <input
                    value={deliveryCfg.cutoffNote}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        deliveryConfig: { ...deliveryCfg, cutoffNote: e.target.value },
                      })
                    }
                    placeholder="Orders placed before 4:00 PM dispatch the same day"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="flex items-end">
                  <label className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer font-semibold text-[#0B1F3A]">
                    <span>Global Cash on Delivery (COD)</span>
                    <input
                      type="checkbox"
                      checked={deliveryCfg.codEnabled}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          deliveryConfig: { ...deliveryCfg, codEnabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-[#EA580C]"
                    />
                  </label>
                </div>
              </div>
            </form>

            {/* Live Pincode Tester */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#EA580C]" /> Live Indian Pincode Tester
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Test how customers see any 6-digit Indian pincode with your current rules (real India Post verification).
                </p>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const pin = testPinInput.trim();
                  setTestPinLoading(true);
                  try {
                    const lookup = await lookupIndiaPostPincode(pin);
                    setTestPinStdRes(resolvePincodeDelivery(pin, lookup, deliveryCfg, 'Standard Delivery', false));
                    setTestPinExpRes(resolvePincodeDelivery(pin, lookup, deliveryCfg, 'Express Delivery', false));
                  } finally {
                    setTestPinLoading(false);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  maxLength={6}
                  value={testPinInput}
                  onChange={(e) => setTestPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter e.g. 400051 or 999999"
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 font-mono"
                />
                <button
                  type="submit"
                  disabled={testPinLoading}
                  className="px-4 h-9 rounded-lg bg-[#0B1F3A] text-white font-semibold flex items-center gap-1.5"
                >
                  {testPinLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Test</span>
                </button>
              </form>

              {testPinStdRes && (
                !testPinStdRes.serviceable ? (
                  <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span>{testPinStdRes.noMatch ? 'NO MATCH (Invalid Indian Pincode)' : 'Not Serviceable'}</span>
                    </div>
                    <p>{testPinStdRes.error}</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B1F3A]">
                        {testPinStdRes.region} ({testPinStdRes.pincode})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase">
                        {testPinStdRes.zone}
                      </span>
                    </div>
                    <div className="space-y-1 text-slate-700">
                      <p>
                        <strong>Standard Delivery:</strong> {testPinStdRes.estimatedDelivery} ({testPinStdRes.estimatedDays}d) · {testPinStdRes.courierPartner}
                      </p>
                      {testPinExpRes?.serviceable && (
                        <p>
                          <strong>Express Delivery:</strong> {testPinExpRes.estimatedDelivery} ({testPinExpRes.estimatedDays}d) · {testPinExpRes.courierPartner}
                        </p>
                      )}
                      <p>
                        <strong>COD:</strong> {testPinStdRes.codAvailable ? 'Available' : 'Prepaid Only'}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Pincode-Specific Delivery Overrides */}
            <div className="lg:col-span-12 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="border-b border-slate-200 pb-4">
                <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#EA580C]" /> Pincode-Wise Custom Delivery Rules ({deliveryCfg.pincodeRules.length})
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Override delivery timing (&ldquo;delivery kab hoga&rdquo;), courier, COD, or block service for any specific 6-digit Indian pincode or 3-digit prefix (e.g. 400).
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const cleanPin = newPinRule.pincode.replace(/\D/g, '');
                  if (!/^[1-9][0-9]{2}([0-9]{3})?$/.test(cleanPin)) {
                    notify('Enter a valid 6-digit Indian pincode or 3-digit prefix (e.g. 400051 or 400).', 'error');
                    return;
                  }
                  if (cleanPin.length === 6) {
                    setPinRuleVerifying(true);
                    const lookup = await lookupIndiaPostPincode(cleanPin);
                    setPinRuleVerifying(false);
                    if (!lookup.found && lookup.noMatch) {
                      setPinRuleVerifyMsg({ ok: false, text: `No match found — ${cleanPin} is not a valid India Post pincode.` });
                      notify(`No match found for pincode ${cleanPin}. Please verify the Indian pincode.`, 'error');
                      return;
                    }
                    if (lookup.found && !newPinRule.cityLabel.trim()) {
                      newPinRule.cityLabel = `${lookup.postOffice.district}, ${lookup.postOffice.state}`;
                    }
                  }

                  const ruleToSave: PincodeDeliveryRule = {
                    ...newPinRule,
                    pincode: cleanPin,
                    cityLabel: newPinRule.cityLabel.trim() || `Zone ${cleanPin}`,
                    deliveryDays: Math.max(0, Math.min(30, Number(newPinRule.deliveryDays) || 0)),
                  };

                  const updatedRules = [
                    ruleToSave,
                    ...deliveryCfg.pincodeRules.filter((r) => r.pincode !== cleanPin),
                  ];
                  const nextCfg = {
                    ...settingsForm,
                    deliveryConfig: { ...deliveryCfg, pincodeRules: updatedRules },
                  };
                  await saveStoreConfigAcrossStores(nextCfg, `Delivery rule saved for pincode ${cleanPin}!`);
                  setNewPinRule({
                    pincode: '',
                    cityLabel: '',
                    serviceable: true,
                    deliveryDays: 1,
                    codAvailable: true,
                    courierPartner: '',
                    note: '',
                  });
                  setPinRuleVerifyMsg(null);
                }}
                className="grid sm:grid-cols-12 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 items-end"
              >
                <div className="sm:col-span-3">
                  <label className="block text-slate-500 mb-1">6-Digit Pincode / 3-Digit Prefix</label>
                  <div className="flex gap-1.5">
                    <input
                      required
                      maxLength={6}
                      value={newPinRule.pincode}
                      onChange={(e) => {
                        setNewPinRule({ ...newPinRule, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) });
                        setPinRuleVerifyMsg(null);
                      }}
                      placeholder="400051 or 400"
                      className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                    <button
                      type="button"
                      disabled={pinRuleVerifying || newPinRule.pincode.length !== 6}
                      onClick={async () => {
                        setPinRuleVerifying(true);
                        const lookup = await lookupIndiaPostPincode(newPinRule.pincode);
                        setPinRuleVerifying(false);
                        if (lookup.found) {
                          const label = `${lookup.postOffice.name}, ${lookup.postOffice.district}, ${lookup.postOffice.state}`;
                          setNewPinRule((prev) => ({
                            ...prev,
                            cityLabel: `${lookup.postOffice.district}, ${lookup.postOffice.state}`,
                          }));
                          setPinRuleVerifyMsg({ ok: true, text: `Verified: ${label}` });
                        } else if (lookup.noMatch) {
                          setPinRuleVerifyMsg({ ok: false, text: 'No match in India Post records.' });
                        } else {
                          setPinRuleVerifyMsg({ ok: false, text: 'India Post unreachable right now.' });
                        }
                      }}
                      className="px-2.5 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-[#0B1F3A] disabled:opacity-40"
                    >
                      {pinRuleVerifying ? '...' : 'Verify'}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-slate-500 mb-1">City / Post Office Label</label>
                  <input
                    value={newPinRule.cityLabel}
                    onChange={(e) => setNewPinRule({ ...newPinRule, cityLabel: e.target.value })}
                    placeholder="e.g. Mumbai BKC"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-500 mb-1">Delivery Days (0 = Today)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={newPinRule.deliveryDays}
                    onChange={(e) =>
                      setNewPinRule({ ...newPinRule, deliveryDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-500 mb-1">Service Status</label>
                  <select
                    value={newPinRule.serviceable ? 'yes' : 'no'}
                    onChange={(e) => setNewPinRule({ ...newPinRule, serviceable: e.target.value === 'yes' })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="yes">Deliverable</option>
                    <option value="no">Blocked / No Service</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 h-9">
                  <label className="flex items-center gap-1.5 font-semibold text-[#0B1F3A] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPinRule.codAvailable}
                      onChange={(e) => setNewPinRule({ ...newPinRule, codAvailable: e.target.checked })}
                      className="accent-[#EA580C]"
                    />
                    <span>COD Allowed</span>
                  </label>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-slate-500 mb-1">Courier Partner (Optional)</label>
                  <input
                    value={newPinRule.courierPartner || ''}
                    onChange={(e) => setNewPinRule({ ...newPinRule, courierPartner: e.target.value })}
                    placeholder="e.g. Aagaman Same-Day Hub"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-slate-500 mb-1">Customer Note (Optional)</label>
                  <input
                    value={newPinRule.note || ''}
                    onChange={(e) => setNewPinRule({ ...newPinRule, note: e.target.value })}
                    placeholder="e.g. Express van dispatch or Flood/Weather delay"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={pinRuleVerifying}
                    className="w-full h-9 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold"
                  >
                    Add / Save Pincode Rule
                  </button>
                </div>

                {pinRuleVerifyMsg && (
                  <p className={`sm:col-span-12 text-[11px] font-medium ${pinRuleVerifyMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                    {pinRuleVerifyMsg.text}
                  </p>
                )}
              </form>

              {deliveryCfg.pincodeRules.length === 0 ? (
                <p className="text-slate-500 text-center py-6 border border-dashed border-slate-300 rounded-xl">
                  No custom pincode overrides added yet. All valid India Post pincodes currently use your Metro / Standard / Remote schedule above.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Pincode</th>
                        <th className="py-2.5 px-3">Area / City</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Delivery Timing</th>
                        <th className="py-2.5 px-3">COD</th>
                        <th className="py-2.5 px-3">Courier / Note</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deliveryCfg.pincodeRules.map((rule) => (
                        <tr key={rule.pincode} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#0B1F3A]">
                            {rule.pincode}
                            {rule.pincode.length === 3 && (
                              <span className="ml-1.5 text-[10px] font-sans font-normal text-slate-500">(Prefix)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{rule.cityLabel}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold ${
                                rule.serviceable ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {rule.serviceable ? 'Deliverable' : 'Blocked'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {rule.serviceable ? (
                              <span>
                                <strong>{rule.deliveryDays === 0 ? 'Same Day' : `${rule.deliveryDays} day(s)`}</strong> ·{' '}
                                {formatEstimatedDeliveryDate(rule.deliveryDays, false)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3">{rule.codAvailable ? 'Allowed' : 'Prepaid'}</td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {[rule.courierPartner, rule.note].filter(Boolean).join(' · ') || 'Default'}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => setNewPinRule(rule)}
                              className="text-[#0B1F3A] hover:text-[#EA580C] font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = deliveryCfg.pincodeRules.filter((r) => r.pincode !== rule.pincode);
                                await saveStoreConfigAcrossStores(
                                  { ...settingsForm, deliveryConfig: { ...deliveryCfg, pincodeRules: updated } },
                                  `Removed rule for ${rule.pincode}.`
                                );
                              }}
                              className="text-red-600 hover:underline font-semibold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS & SUPPORT TICKETS */}
        {tab === 'settings' && settingsForm && (
          <div className="grid lg:grid-cols-12 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveStoreConfigAcrossStores(settingsForm, 'Store settings updated!');
              }}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#0B1F3A]">Store, Shipping &amp; GST Settings</h3>
                <button
                  type="button"
                  onClick={() => setTab('delivery')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#0B1F3A] font-semibold flex items-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5 text-[#EA580C]" /> Configure Delivery Dates &amp; Pincodes →
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Support Email Address</label>
                  <input
                    type="email"
                    required
                    value={settingsForm.supportEmail || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })}
                    placeholder="support@aagamanmart.in"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Support Phone</label>
                  <input
                    value={settingsForm.supportPhone || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, supportPhone: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-500 mb-1">Store Location / Headquarters Address</label>
                  <input
                    required
                    value={settingsForm.headquarters || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, headquarters: e.target.value })}
                    placeholder="Aagaman Commerce Tower, Bandra Kurla Complex, Mumbai 400051"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-slate-500">Top Announcement Bar (&ldquo;Grand Aagaman Sale Live...&rdquo;)</label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.announcementEnabled !== false}
                        onChange={(e) => setSettingsForm({ ...settingsForm, announcementEnabled: e.target.checked })}
                        className="accent-[#EA580C]"
                      />
                      <span>Show on Website</span>
                    </label>
                  </div>
                  <input
                    value={settingsForm.announcementText || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, announcementText: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Free Shipping Threshold (₹)</label>
                  <input
                    type="number"
                    value={settingsForm.freeShippingThreshold}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, freeShippingThreshold: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Standard Shipping Fee (₹)</label>
                  <input
                    type="number"
                    value={settingsForm.standardShippingCharge}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, standardShippingCharge: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Express Shipping Fee (₹)</label>
                  <input
                    type="number"
                    value={settingsForm.expressShippingCharge}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, expressShippingCharge: Number(e.target.value) })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Flash Sale Headline</label>
                  <input
                    value={settingsForm.flashSaleTitle || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, flashSaleTitle: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <button type="submit" className="px-5 h-9 rounded-lg bg-[#EA580C] text-white font-semibold">
                Save Configuration
              </button>

              <div className="pt-4 border-t border-slate-200 space-y-2 text-slate-600">
                <p className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#EA580C]" /> Private Admin Access & Live Credentials
                </p>
                <p>
                  Public Admin links are hidden from shoppers. Bookmark{' '}
                  <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[#0B1F3A] font-semibold">
                    {typeof window !== 'undefined' ? `${window.location.origin}/admin` : '/admin'}
                  </code>{' '}
                  to open the Admin Console anytime.
                </p>
                <p>
                  AAGAMAN MART runs smoothly out of the box in Sandbox Mode with zero required environment variables (universal password enabled — no{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">ADMIN_PASSCODE</code> needed).{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">RAZORPAY_KEY_ID</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">RAZORPAY_KEY_SECRET</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">SMTP_HOST</code>, and{' '}
                  <code className="font-mono bg-slate-100 px-1 rounded">TWILIO_ACCOUNT_SID</code> are completely optional.
                </p>
              </div>
            </form>

            {/* Support Tickets */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
              <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#EA580C]" /> Customer Support Tickets ({adminTickets.length})
              </h3>
              {adminTickets.length === 0 ? (
                <p className="text-slate-500">No support tickets yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {adminTickets.map((t) => (
                    <div key={t.id} className="py-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#0B1F3A]">{t.subject}</span>
                        <select
                          value={t.status}
                          onChange={async (e) => {
                            if (isStaticToken(adminToken)) {
                              updateStaticAdminTicketStatus(t.id, e.target.value);
                            } else {
                              await fetch(`/api/admin/support-tickets/${t.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                                body: JSON.stringify({ status: e.target.value }),
                              });
                            }
                            loadAllAdminData(adminToken);
                          }}
                          className="h-7 px-2 rounded border border-slate-300 bg-white text-[11px]"
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                      <p className="text-slate-600">{t.message}</p>
                      <p className="text-slate-400">
                        {t.name} ({t.email})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Homepage Hero Banners Manager */}
            {renderHeroBannersEditor()}
          </div>
        )}
      </main>

      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#0B1F3A] text-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <ProductThumbnail
                  src={editForm.imageUrls[0]}
                  alt={editForm.name || editingProduct.name}
                  className="w-11 h-11 border-white/20"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-orange-300 uppercase tracking-wider">
                    Edit Product · {editingProduct.sku}
                  </p>
                  <h2 className="font-display text-base font-bold truncate">
                    {editForm.name || editingProduct.name}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-200"
                aria-label="Close edit product modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editForm.imageUrls.length === 0) {
                  notify('Please keep at least one product image.', 'error');
                  return;
                }
                setEditSaving(true);
                try {
                  if (isStaticToken(adminToken)) {
                    updateStaticAdminProduct(editingProduct.id, editForm);
                    notify('Product details and images updated!', 'success');
                    setEditingProduct(null);
                    await loadAllAdminData(adminToken);
                    refreshStoreMeta();
                    return;
                  }
                  const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${adminToken}`,
                    },
                    body: JSON.stringify(editForm),
                  });
                  const json = await res.json();
                  if (!res.ok) {
                    notify(json.error || 'Failed to save product updates.', 'error');
                  } else {
                    notify('Product details and images updated!', 'success');
                    setEditingProduct(null);
                    await loadAllAdminData(adminToken);
                    refreshStoreMeta();
                  }
                } finally {
                  setEditSaving(false);
                }
              }}
              className="flex-1 overflow-y-auto p-6 space-y-6 text-xs"
            >
              {/* Image Gallery Manager */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#EA580C]" /> Product Images ({editForm.imageUrls.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">First image appears as the storefront thumbnail</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {editForm.imageUrls.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className={`bg-white border rounded-xl p-2 flex flex-col gap-2 ${
                        idx === 0 ? 'border-[#EA580C]' : 'border-slate-200'
                      }`}
                    >
                      <ProductThumbnail src={url} alt={`Product image ${idx + 1}`} className="w-full h-24" />
                      <input
                        value={url}
                        onChange={(e) => {
                          const next = [...editForm.imageUrls];
                          next[idx] = e.target.value;
                          setEditForm({ ...editForm, imageUrls: next });
                        }}
                        className="w-full h-7 px-2 rounded border border-slate-200 text-[11px] font-mono text-slate-600"
                        placeholder="Image URL"
                      />
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        {idx === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EA580C]">
                            <Star className="w-3 h-3 fill-[#EA580C]" /> Primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...editForm.imageUrls];
                              const [selected] = next.splice(idx, 1);
                              next.unshift(selected);
                              setEditForm({ ...editForm, imageUrls: next });
                            }}
                            className="text-[11px] font-semibold text-[#0B1F3A] hover:text-[#EA580C]"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={editForm.imageUrls.length <= 1}
                          onClick={() => {
                            if (editForm.imageUrls.length <= 1) return;
                            setEditForm({
                              ...editForm,
                              imageUrls: editForm.imageUrls.filter((_, i) => i !== idx),
                            });
                          }}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-12 gap-2 pt-1">
                  <input
                    value={newEditImageUrl}
                    onChange={(e) => setNewEditImageUrl(e.target.value)}
                    placeholder="Paste image URL (https://... or /src/assets/images/...)"
                    className="sm:col-span-6 h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newEditImageUrl.trim();
                      if (!trimmed) return;
                      setEditForm({ ...editForm, imageUrls: [...editForm.imageUrls, trimmed] });
                      setNewEditImageUrl('');
                    }}
                    className="sm:col-span-2 h-9 rounded-lg bg-[#0B1F3A] text-white font-semibold"
                  >
                    + Add URL
                  </button>
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setEditForm({ ...editForm, imageUrls: [...editForm.imageUrls, e.target.value] });
                    }}
                    className="sm:col-span-4 h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700"
                  >
                    <option value="">+ Quick-add Studio Photo...</option>
                    {STUDIO_IMAGE_PRESETS.map((preset) => (
                      <option key={preset.url} value={preset.url}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Details & Pricing */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-500 font-medium mb-1">Product Name</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">SKU</label>
                  <input
                    required
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Brand</label>
                  <input
                    required
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Category</label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                  >
                    {adminCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Return Policy</label>
                  <input
                    required
                    value={editForm.returnPolicy}
                    onChange={(e) => setEditForm({ ...editForm, returnPolicy: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.mrp}
                    onChange={(e) => setEditForm({ ...editForm, mrp: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.sellingPrice}
                    onChange={(e) => setEditForm({ ...editForm, sellingPrice: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Stock</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editForm.stock}
                      onChange={(e) => setEditForm({ ...editForm, stock: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">GST (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={28}
                      required
                      value={editForm.gstPercent}
                      onChange={(e) => setEditForm({ ...editForm, gstPercent: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Product Description</label>
                <textarea
                  required
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  { key: 'isActive', label: 'Active on Storefront' },
                  { key: 'isFeatured', label: 'Featured Collection' },
                  { key: 'isBestSeller', label: 'Best Seller' },
                  { key: 'isTrending', label: 'Trending Now' },
                  { key: 'isNewArrival', label: 'New Arrival' },
                  { key: 'isDealOfDay', label: 'Deal of the Day' },
                ].map((flag) => {
                  const checked = Boolean(editForm[flag.key as keyof typeof editForm]);
                  return (
                    <label
                      key={flag.key}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/70 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setEditForm({ ...editForm, [flag.key]: e.target.checked })}
                        className="accent-[#EA580C]"
                      />
                      <span className="font-medium text-[#0B1F3A]">{flag.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 h-9 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 h-9 rounded-lg bg-[#EA580C] hover:bg-[#dc4c05] text-white font-semibold disabled:opacity-60"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-xs">
            <div className="px-6 py-4 bg-[#0B1F3A] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedCustomer.photoUrl ? (
                  <img
                    src={selectedCustomer.photoUrl}
                    alt={selectedCustomer.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#EA580C] text-white font-bold text-sm flex items-center justify-center">
                    {(selectedCustomer.name || selectedCustomer.email || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-display text-base font-bold">{selectedCustomer.name}</h3>
                  <p className="text-[11px] text-slate-300">
                    Customer ID #{selectedCustomer.id} ·{' '}
                    {selectedCustomer.authMethod === 'google' ? 'Google Sign-In' : 'Email Registration'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span>
                    <strong className="text-[#0B1F3A]">Email:</strong> {selectedCustomer.email}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span>
                    <strong className="text-[#0B1F3A]">Mobile:</strong> {selectedCustomer.phone || 'Not provided'}
                  </span>
                </p>
                <p className="text-slate-600">
                  <strong className="text-[#0B1F3A]">Registered On:</strong>{' '}
                  {selectedCustomer.createdAt
                    ? new Date(selectedCustomer.createdAt).toLocaleString('en-IN')
                    : 'Not recorded'}
                </p>
                <p className="text-slate-600">
                  <strong className="text-[#0B1F3A]">Last Sign-In:</strong>{' '}
                  {selectedCustomer.lastLoginAt
                    ? new Date(selectedCustomer.lastLoginAt).toLocaleString('en-IN')
                    : 'Not recorded'}
                </p>
                <p className="text-slate-600">
                  <strong className="text-[#0B1F3A]">Verification:</strong>{' '}
                  {selectedCustomer.emailVerified ? 'Email Verified' : 'Email Unverified'} ·{' '}
                  {selectedCustomer.phoneVerified ? 'Mobile OTP Verified' : 'Mobile Unverified'}
                </p>
                <p className="text-slate-600">
                  <strong className="text-[#0B1F3A]">Account Status:</strong>{' '}
                  <span className={selectedCustomer.isBlocked ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                    {selectedCustomer.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-display text-sm font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#EA580C]" /> Saved Delivery Addresses ({(selectedCustomer.addresses || []).length})
                </h4>
                {(selectedCustomer.addresses || []).length === 0 ? (
                  <p className="text-slate-500">No saved delivery addresses yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {(selectedCustomer.addresses || []).map((a) => (
                      <div key={a.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-0.5">
                        <p className="font-bold text-[#0B1F3A]">
                          {a.fullName} · {a.addressType}
                        </p>
                        <p className="text-slate-600">{a.line1}</p>
                        <p className="text-slate-600">
                          {a.city}, {a.state} - <span className="font-mono">{a.pincode}</span>
                        </p>
                        <p className="text-slate-500 font-mono">{a.phone}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-display text-sm font-bold text-[#0B1F3A] flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#EA580C]" /> Order Summary ({selectedCustomer.orderCount} orders ·{' '}
                  {formatINR(selectedCustomer.totalSpent)})
                </h4>
                {(selectedCustomer.recentOrders || []).length === 0 ? (
                  <p className="text-slate-500">No orders placed yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {(selectedCustomer.recentOrders || []).map((o) => (
                      <div key={o.orderNumber} className="px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-[#0B1F3A]">{o.orderNumber}</span>
                          <span className="text-slate-400 ml-2">
                            {new Date(o.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {o.status}
                          </span>
                          <span className="font-mono font-bold text-[#0B1F3A]">{formatINR(o.grandTotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />
    </div>
  );
};
