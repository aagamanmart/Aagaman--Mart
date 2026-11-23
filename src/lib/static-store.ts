import type {
  Address,
  Category,
  OrderRecord,
  Product,
  PublicCoupon,
  Review,
  StoreConfig,
  Subcategory,
  UserProfile,
} from '../types';

const STORAGE_KEY = 'aagaman_static_store_v1';
const AUTH_SESSION_KEY = 'aagaman_static_customer_token_v1';
export const UNIVERSAL_ACCESS_PASSWORD = 'UtRakhi@792';

export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\/|^data:|^blob:/i.test(url)) return url;
  const base = import.meta.env.BASE_URL || '/';
  if (url.startsWith('/')) {
    if (base === '/') return url;
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return url.startsWith(`${cleanBase}/`) ? url : `${cleanBase}${url}`;
  }
  return `${base}${url}`;
}

export function hasJsonContentType(res: Response): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  return ct.includes('application/json');
}

export function isJsonApiResponse(res: Response): boolean {
  return res.ok && hasJsonContentType(res);
}

export function isStaticToken(token?: string | null): boolean {
  return Boolean(token && token.startsWith('static_'));
}

const IMG = {
  heroElectronics: '/src/assets/images/hero_aagaman_electronics_1795321794113.jpg',
  heroHome: '/src/assets/images/hero_aagaman_home_1795321794314.jpg',
  headphones: '/src/assets/images/prod_wireless_headphones_1795321793763.jpg',
  smartwatch: '/src/assets/images/prod_smartwatch_pro_1795321794237.jpg',
  groceries: '/src/assets/images/prod_groceries_organic_1795321794873.jpg',
  mensJacket: '/src/assets/images/prod_fashion_mens_jacket_1795321793933.jpg',
  womensKurta: '/src/assets/images/prod_fashion_womens_kurta_1795321794640.jpg',
  airFryer: '/src/assets/images/prod_kitchen_airfryer_1795321794199.jpg',
  skincare: '/src/assets/images/prod_beauty_skincare_1795321796092.jpg',
  sneakers: '/src/assets/images/prod_footwear_sneakers_1795321794437.jpg',
  brassLamp: '/src/assets/images/prod_decor_brass_lamp_1795321794677.jpg',
  fitness: '/src/assets/images/prod_fitness_dumbbells_1795321796300.jpg',
};

export interface StaticCouponRecord {
  id: number;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'free_shipping';
  discountValue: number;
  minOrderValue: number;
  maxDiscountLimit: number;
  categoryId: number | null;
  productId: number | null;
  firstOrderOnly: boolean;
  usedCount: number;
  usageLimit: number;
  expiresAt: string;
  isActive: boolean;
}

export interface StaticCustomerRecord extends UserProfile {
  password: string;
  authMethod?: 'email' | 'google';
  createdAt?: string;
  lastLoginAt?: string;
  addresses: Address[];
  wishlistIds: number[];
  notifications: Array<{ id: number; channel: string; title: string; message: string; isRead: boolean; createdAt: string }>;
  pendingOtp?: string;
  pendingResetCode?: string;
}

export interface StaticPaymentRecord {
  id: number;
  orderId: number;
  orderNumber: string;
  customerName: string;
  gateway: string;
  method: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  amount: number;
  status: string;
  createdAt: string;
}

export interface StaticReturnRecord {
  id: number;
  orderId: number;
  reason: string;
  requestType: 'return' | 'replacement';
  status: string;
  createdAt: string;
}

export interface StaticTicketRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

interface StaticDatabase {
  categories: Category[];
  products: Product[];
  reviews: Review[];
  coupons: StaticCouponRecord[];
  config: StoreConfig;
  customers: StaticCustomerRecord[];
  orders: OrderRecord[];
  orderUserMap: Record<number, number>;
  payments: StaticPaymentRecord[];
  returns: StaticReturnRecord[];
  tickets: StaticTicketRecord[];
  newsletterEmails: string[];
}

function createInitialStaticDb(): StaticDatabase {
  const catDefs: Array<{
    id: number;
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    displayOrder: number;
    subs: string[];
  }> = [
    {
      id: 1,
      name: 'Groceries',
      slug: 'groceries',
      description: 'Farm-fresh organic staples, aged basmati, cold-pressed oils, and whole Indian spices.',
      imageUrl: IMG.groceries,
      displayOrder: 1,
      subs: ['Organic Staples', 'Spices & Masalas', 'Cooking Oils'],
    },
    {
      id: 2,
      name: 'Electronics',
      slug: 'electronics',
      description: 'Flagship audio, smartwatches, laptops, and everyday tech engineered for performance.',
      imageUrl: IMG.headphones,
      displayOrder: 2,
      subs: ['Audio & Headphones', 'Wearables', 'Laptops & Workstations'],
    },
    {
      id: 3,
      name: 'Mobile & Accessories',
      slug: 'mobile-accessories',
      description: 'Fast GaN chargers, MagSafe cases, earbuds, and mobile gear.',
      imageUrl: IMG.smartwatch,
      displayOrder: 3,
      subs: ['Smartwatches & Bands', 'Chargers & Cables', 'Cases & Protection'],
    },
    {
      id: 4,
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      description: 'Cookware, espresso makers, ceramic dining, and countertop essentials.',
      imageUrl: IMG.airFryer,
      displayOrder: 4,
      subs: ['Kitchen Appliances', 'Cookware & Dining', 'Coffee & Tea'],
    },
    {
      id: 5,
      name: 'Fashion',
      slug: 'fashion',
      description: 'Curated modern apparel, festive collections, and everyday wardrobe essentials.',
      imageUrl: IMG.mensJacket,
      displayOrder: 5,
      subs: ['Seasonal Edits', 'Ethnic & Festive', 'Accessories'],
    },
    {
      id: 6,
      name: "Men's Clothing",
      slug: 'mens-clothing',
      description: 'Structured overshirts, Supima cotton tees, chinos, and formal tailoring.',
      imageUrl: IMG.mensJacket,
      displayOrder: 6,
      subs: ['Shirts & Overshirts', 'T-Shirts & Polos', 'Trousers & Denim'],
    },
    {
      id: 7,
      name: "Women's Clothing",
      slug: 'womens-clothing',
      description: 'Handloom kurtas, contemporary western wear, and artisanal dupattas.',
      imageUrl: IMG.womensKurta,
      displayOrder: 7,
      subs: ['Kurtas & Sets', 'Dresses & Tops', 'Sarees & Dupattas'],
    },
    {
      id: 8,
      name: 'Kids & Baby Products',
      slug: 'kids-baby',
      description: 'Organic cotton kidswear, gentle baby skincare, and ergonomic nursery essentials.',
      imageUrl: IMG.womensKurta,
      displayOrder: 8,
      subs: ['Baby Care', 'Kids Apparel', 'Nursery & Feeding'],
    },
    {
      id: 9,
      name: 'Beauty & Personal Care',
      slug: 'beauty-personal-care',
      description: 'Dermatologist-tested Vitamin C serums, ceramide creams, and botanical grooming.',
      imageUrl: IMG.skincare,
      displayOrder: 9,
      subs: ['Skincare & Serums', 'Haircare', 'Fragrance & Grooming'],
    },
    {
      id: 10,
      name: 'Health & Wellness',
      slug: 'health-wellness',
      description: 'Daily nutrition, immunity supplements, herbal teas, and wellness monitors.',
      imageUrl: IMG.groceries,
      displayOrder: 10,
      subs: ['Supplements & Vitamins', 'Ayurveda & Herbal', 'Health Monitors'],
    },
    {
      id: 11,
      name: 'Footwear',
      slug: 'footwear',
      description: 'Breathable performance runners, leather loafers, and cushioned everyday sneakers.',
      imageUrl: IMG.sneakers,
      displayOrder: 11,
      subs: ['Running & Training', 'Casual Sneakers', 'Formal & Ethnic'],
    },
    {
      id: 12,
      name: 'Toys & Games',
      slug: 'toys-games',
      description: 'STEM building kits, wooden Montessori puzzles, and family board games.',
      imageUrl: IMG.brassLamp,
      displayOrder: 12,
      subs: ['STEM & Robotics', 'Board Games', 'Early Learning'],
    },
    {
      id: 13,
      name: 'Sports & Fitness',
      slug: 'sports-fitness',
      description: 'Hex dumbbells, TPE yoga mats, resistance systems, and home gym equipment.',
      imageUrl: IMG.fitness,
      displayOrder: 13,
      subs: ['Strength Training', 'Yoga & Recovery', 'Outdoor Sports'],
    },
    {
      id: 14,
      name: 'Home Decor',
      slug: 'home-decor',
      description: 'Brushed brass table lamps, hand-thrown stoneware vases, and modern accents.',
      imageUrl: IMG.brassLamp,
      displayOrder: 14,
      subs: ['Lighting & Lamps', 'Vases & Accents', 'Wall Art & Mirrors'],
    },
    {
      id: 15,
      name: 'Stationery',
      slug: 'stationery',
      description: 'Archival notebooks, fountain pens, desk organizers, and studio supplies.',
      imageUrl: IMG.heroElectronics,
      displayOrder: 15,
      subs: ['Notebooks & Journals', 'Writing Instruments', 'Desk Organizers'],
    },
    {
      id: 16,
      name: 'Appliances',
      slug: 'appliances',
      description: 'Energy-efficient digital air fryers, espresso machines, and precision kettles.',
      imageUrl: IMG.heroHome,
      displayOrder: 16,
      subs: ['Small Kitchen Appliances', 'Air & Water Care', 'Garment Care'],
    },
  ];

  let nextSubId = 1;
  const categories: Category[] = catDefs.map((c) => {
    const subcategories: Subcategory[] = c.subs.map((subName) => ({
      id: nextSubId++,
      categoryId: c.id,
      name: subName,
      slug: `${c.slug}-${subName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      description: `${subName} under ${c.name}`,
    }));
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      displayOrder: c.displayOrder,
      productCount: 0,
      subcategories,
    };
  });

  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  const rawProducts: Array<{
    sku: string;
    name: string;
    slug: string;
    brand: string;
    categorySlug: string;
    mrp: number;
    sellingPrice: number;
    stock: number;
    gstPercent: number;
    description: string;
    specifications: Record<string, string>;
    returnPolicy: string;
    ratingAvg: string;
    ratingCount: number;
    soldCount: number;
    isFeatured?: boolean;
    isTrending?: boolean;
    isBestSeller?: boolean;
    isNewArrival?: boolean;
    isDealOfDay?: boolean;
    images: string[];
    variants: Array<{
      sku: string;
      size: string;
      color: string;
      colorHex: string;
      priceAdjustment: number;
      stock: number;
    }>;
  }> = [
    {
      sku: 'AAG-AUD-001',
      name: 'Aurora Pro ANC Wireless Over-Ear Headphones',
      slug: 'aurora-pro-anc-wireless-headphones',
      brand: 'Aurora Acoustics',
      categorySlug: 'electronics',
      mrp: 12999,
      sellingPrice: 7499,
      stock: 34,
      gstPercent: 18,
      description:
        'Studio-grade hybrid Active Noise Cancellation up to 42dB, 40mm beryllium-coated dynamic drivers, dual-device Bluetooth 5.3 multipoint pairing, and 50-hour battery life with USB-C fast charging.',
      specifications: {
        Driver: '40mm Dynamic Beryllium',
        Battery: '50 Hours (ANC On)',
        Connectivity: 'Bluetooth 5.3 + USB-C Audio',
        Weight: '268g',
        Warranty: '1 Year Pan-India Carry-in',
      },
      returnPolicy: '7 Days Easy Replacement',
      ratingAvg: '4.8',
      ratingCount: 284,
      soldCount: 1420,
      isFeatured: true,
      isBestSeller: true,
      isDealOfDay: true,
      isTrending: true,
      images: [IMG.headphones, IMG.heroElectronics],
      variants: [
        { sku: 'AAG-AUD-001-NVY', size: 'Standard', color: 'Midnight Navy', colorHex: '#102A43', priceAdjustment: 0, stock: 22 },
        { sku: 'AAG-AUD-001-COP', size: 'Standard', color: 'Copper Slate', colorHex: '#B45309', priceAdjustment: 300, stock: 12 },
      ],
    },
    {
      sku: 'AAG-WAT-002',
      name: 'TitanPulse AMOLED Titanium Smartwatch 46mm',
      slug: 'titanpulse-amoled-titanium-smartwatch',
      brand: 'TitanPulse',
      categorySlug: 'mobile-accessories',
      mrp: 14999,
      sellingPrice: 8999,
      stock: 19,
      gstPercent: 18,
      description:
        'Aerospace-grade brushed titanium case with 1.43-inch 1000-nit LTPO AMOLED display, dual-band GPS, continuous SpO2 & heart-rate tracking, Bluetooth calling, and 10-day battery endurance.',
      specifications: {
        Display: '1.43" LTPO AMOLED (60Hz)',
        Case: 'Grade-5 Brushed Titanium',
        WaterResistance: '5 ATM / 50m',
        Battery: '10 Days Typical Use',
        Warranty: '1 Year Manufacturer Warranty',
      },
      returnPolicy: '7 Days Easy Replacement',
      ratingAvg: '4.7',
      ratingCount: 196,
      soldCount: 890,
      isFeatured: true,
      isBestSeller: true,
      isDealOfDay: true,
      isNewArrival: true,
      images: [IMG.smartwatch, IMG.heroElectronics],
      variants: [
        { sku: 'AAG-WAT-002-NVY', size: '46mm', color: 'Deep Navy Strap', colorHex: '#0B1F3A', priceAdjustment: 0, stock: 12 },
        { sku: 'AAG-WAT-002-ORG', size: '46mm', color: 'Alpine Orange Strap', colorHex: '#EA580C', priceAdjustment: 0, stock: 7 },
      ],
    },
    {
      sku: 'AAG-GRO-003',
      name: 'Pristine Organic Reserve Pantry Combo (Basmati, Spices & Cold-Pressed Oil)',
      slug: 'pristine-organic-reserve-pantry-combo',
      brand: 'Pristine Farms',
      categorySlug: 'groceries',
      mrp: 2450,
      sellingPrice: 1699,
      stock: 64,
      gstPercent: 5,
      description:
        'Single-origin Himalayan foothills 2-year aged Organic Basmati Rice (5 kg), whole Malabar cardamom & Tellicherry peppercorn blend (400 g glass jar), and wood-pressed extra-virgin groundnut oil (500 ml).',
      specifications: {
        Origin: 'Dehradun & Idukki, India',
        Certification: 'USDA & India Organic Certified',
        NetWeight: '5.9 kg Combined',
        ShelfLife: '12 Months',
      },
      returnPolicy: 'Non-returnable (Damaged/Expired replaced free within 48h)',
      ratingAvg: '4.9',
      ratingCount: 412,
      soldCount: 2650,
      isFeatured: true,
      isBestSeller: true,
      isTrending: true,
      images: [IMG.groceries],
      variants: [
        { sku: 'AAG-GRO-003-5KG', size: '5 kg Family Pack', color: 'Natural Kraft', colorHex: '#92400E', priceAdjustment: 0, stock: 44 },
        { sku: 'AAG-GRO-003-10KG', size: '10 kg Bulk Pack', color: 'Natural Kraft', colorHex: '#78350F', priceAdjustment: 1100, stock: 20 },
      ],
    },
    {
      sku: 'AAG-MEN-004',
      name: 'Aagaman Tailored Cotton Twill Overshirt & Supima Tee Duo',
      slug: 'aagaman-tailored-cotton-twill-overshirt',
      brand: 'Aagaman Atelier',
      categorySlug: 'mens-clothing',
      mrp: 4299,
      sellingPrice: 2599,
      stock: 28,
      gstPercent: 12,
      description:
        'Heavyweight 320 GSM breathable combed cotton twill overshirt in deep navy paired with an ultra-soft 100% Supima cotton crewneck t-shirt. Pre-shrunk and enzyme-washed for effortless drape.',
      specifications: {
        Fabric: '100% Combed Cotton Twill (320 GSM)',
        Fit: 'Modern Tailored Regular',
        Care: 'Machine Wash Cold',
        CountryOfOrigin: 'Tiruppur, India',
      },
      returnPolicy: '14 Days Easy Return & Size Exchange',
      ratingAvg: '4.6',
      ratingCount: 158,
      soldCount: 740,
      isFeatured: true,
      isTrending: true,
      isNewArrival: true,
      images: [IMG.mensJacket],
      variants: [
        { sku: 'AAG-MEN-004-M', size: 'M', color: 'Midnight Navy', colorHex: '#0F172A', priceAdjustment: 0, stock: 10 },
        { sku: 'AAG-MEN-004-L', size: 'L', color: 'Midnight Navy', colorHex: '#0F172A', priceAdjustment: 0, stock: 12 },
        { sku: 'AAG-MEN-004-XL', size: 'XL', color: 'Midnight Navy', colorHex: '#0F172A', priceAdjustment: 0, stock: 6 },
      ],
    },
    {
      sku: 'AAG-WMN-005',
      name: 'Vastra Handloom Burnt-Orange Zari Kurta & Chanderi Dupatta Set',
      slug: 'vastra-handloom-burnt-orange-kurta-set',
      brand: 'Vastra Heritage',
      categorySlug: 'womens-clothing',
      mrp: 5499,
      sellingPrice: 3299,
      stock: 22,
      gstPercent: 12,
      description:
        'Artisanal handwoven cotton-silk festive kurta in warm terracotta orange accented with delicate antique gold zari embroidery, paired with a breathable Chanderi silk-blend striped dupatta.',
      specifications: {
        Fabric: '70% Handloom Cotton, 30% Mulberry Silk',
        Embroidery: 'Zari Threadwork Neckline',
        Length: 'Calf-Length Straight Cut',
        Care: 'Dry Clean Recommended',
      },
      returnPolicy: '14 Days Easy Return & Size Exchange',
      ratingAvg: '4.8',
      ratingCount: 234,
      soldCount: 1120,
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: true,
      images: [IMG.womensKurta],
      variants: [
        { sku: 'AAG-WMN-005-S', size: 'S', color: 'Terracotta Orange', colorHex: '#C2410C', priceAdjustment: 0, stock: 7 },
        { sku: 'AAG-WMN-005-M', size: 'M', color: 'Terracotta Orange', colorHex: '#C2410C', priceAdjustment: 0, stock: 9 },
        { sku: 'AAG-WMN-005-L', size: 'L', color: 'Terracotta Orange', colorHex: '#C2410C', priceAdjustment: 0, stock: 6 },
      ],
    },
    {
      sku: 'AAG-APP-006',
      name: 'NexusChef 6.5L Digital Air Fryer & Precision Kettle Bundle',
      slug: 'nexuschef-digital-air-fryer-kettle-bundle',
      brand: 'NexusHome',
      categorySlug: 'appliances',
      mrp: 11999,
      sellingPrice: 6999,
      stock: 16,
      gstPercent: 18,
      description:
        '6.5-litre viewing-window digital air fryer with 360-degree rapid convection (up to 85% less oil) bundled with a 1.5L double-wall variable temperature stainless steel electric kettle.',
      specifications: {
        Capacity: '6.5L Fryer + 1.5L Kettle',
        Power: '1700W Rapid Convection',
        Presets: '8 One-Touch Indian Cooking Modes',
        Warranty: '2 Years On-Site Warranty',
      },
      returnPolicy: '10 Days Replacement Guarantee',
      ratingAvg: '4.7',
      ratingCount: 318,
      soldCount: 980,
      isFeatured: true,
      isDealOfDay: true,
      isBestSeller: true,
      images: [IMG.airFryer, IMG.heroHome],
      variants: [
        { sku: 'AAG-APP-006-CHR', size: '6.5L Combo', color: 'Matte Charcoal', colorHex: '#27272A', priceAdjustment: 0, stock: 16 },
      ],
    },
    {
      sku: 'AAG-BTY-007',
      name: 'Aura Botanicals 15% Vitamin C Serum & Ceramide Barrier Cream',
      slug: 'aura-botanicals-vitamin-c-ceramide-duo',
      brand: 'Aura Botanics',
      categorySlug: 'beauty-personal-care',
      mrp: 1998,
      sellingPrice: 1299,
      stock: 48,
      gstPercent: 18,
      description:
        'Clinically stabilized 15% Ethyl Ascorbic Acid brightening serum paired with a 5-Ceramide deep barrier repair moisturizer. Dermatologically tested, fragrance-free, and suited for humid Indian climates.',
      specifications: {
        Volume: '30ml Serum + 50ml Moisturizer',
        KeyActives: '15% Vitamin C, Ferulic Acid, 5 Ceramides',
        SkinType: 'All Skin Types',
        Formulation: 'Paraben & Sulphate Free',
      },
      returnPolicy: '7 Days Unopened Return',
      ratingAvg: '4.8',
      ratingCount: 512,
      soldCount: 3100,
      isTrending: true,
      isBestSeller: true,
      images: [IMG.skincare],
      variants: [
        { sku: 'AAG-BTY-007-DUO', size: 'Serum + Cream Duo', color: 'Amber Glass', colorHex: '#B45309', priceAdjustment: 0, stock: 48 },
      ],
    },
    {
      sku: 'AAG-FTW-008',
      name: 'StrideFlow AeroGrip Marathon Running Sneakers',
      slug: 'strideflow-aerogrip-marathon-sneakers',
      brand: 'StrideFlow',
      categorySlug: 'footwear',
      mrp: 4999,
      sellingPrice: 2899,
      stock: 31,
      gstPercent: 12,
      description:
        'Engineered dual-density nitrogen EVA midsole with breathable 3D jacquard mesh upper in signature deep navy and signal orange. High-abrasion carbon rubber outsole built for Indian roads.',
      specifications: {
        Upper: 'Breathable 3D Engineered Mesh',
        Midsole: 'Dual-Density Nitrogen Foam',
        Weight: '245g (UK 8)',
        Drop: '8mm Heel-to-Toe',
      },
      returnPolicy: '14 Days Free Size Exchange',
      ratingAvg: '4.6',
      ratingCount: 189,
      soldCount: 840,
      isDealOfDay: true,
      isTrending: true,
      isNewArrival: true,
      images: [IMG.sneakers],
      variants: [
        { sku: 'AAG-FTW-008-UK7', size: 'UK 7', color: 'Navy & Signal Orange', colorHex: '#EA580C', priceAdjustment: 0, stock: 8 },
        { sku: 'AAG-FTW-008-UK8', size: 'UK 8', color: 'Navy & Signal Orange', colorHex: '#EA580C', priceAdjustment: 0, stock: 13 },
        { sku: 'AAG-FTW-008-UK9', size: 'UK 9', color: 'Navy & Signal Orange', colorHex: '#EA580C', priceAdjustment: 0, stock: 10 },
      ],
    },
    {
      sku: 'AAG-DEC-009',
      name: 'Lumina Brushed Brass Table Lamp & Stoneware Vase Set',
      slug: 'lumina-brushed-brass-table-lamp-set',
      brand: 'Lumina Living',
      categorySlug: 'home-decor',
      mrp: 5999,
      sellingPrice: 3799,
      stock: 14,
      gstPercent: 18,
      description:
        'Solid spun brushed brass cylindrical base topped with a natural Belgian linen drum shade, accompanied by a hand-thrown matte alabaster ceramic vase.',
      specifications: {
        Material: 'Brushed Brass, Belgian Linen, Stoneware',
        BulbType: 'E27 Warm LED Included (2700K)',
        Dimensions: '44cm Height x 24cm Shade',
      },
      returnPolicy: '7 Days Breakage-Covered Replacement',
      ratingAvg: '4.9',
      ratingCount: 94,
      soldCount: 410,
      isNewArrival: true,
      isFeatured: true,
      images: [IMG.brassLamp],
      variants: [
        { sku: 'AAG-DEC-009-BRS', size: '44cm Set', color: 'Warm Brass', colorHex: '#CA8A04', priceAdjustment: 0, stock: 14 },
      ],
    },
    {
      sku: 'AAG-SPT-010',
      name: 'IronStrive Hex Dumbbell Pair (12kg x 2) & Pro Grip Yoga Mat',
      slug: 'ironstrive-hex-dumbbell-yoga-mat-kit',
      brand: 'IronStrive',
      categorySlug: 'sports-fitness',
      mrp: 5499,
      sellingPrice: 3499,
      stock: 21,
      gstPercent: 18,
      description:
        'Anti-roll virgin rubber-encased cast iron hex dumbbells with chrome knurled handles paired with an 8mm high-density closed-cell navy TPE studio mat.',
      specifications: {
        Weights: '2 x 12 kg Hex Dumbbells',
        MatThickness: '8mm High-Density TPE (183 x 61cm)',
        Grip: 'Diamond Knurled Chrome Steel',
      },
      returnPolicy: '10 Days Easy Return',
      ratingAvg: '4.7',
      ratingCount: 142,
      soldCount: 560,
      isTrending: true,
      images: [IMG.fitness],
      variants: [
        { sku: 'AAG-SPT-010-12KG', size: '12kg Pair + Mat', color: 'Matte Black & Navy', colorHex: '#1E293B', priceAdjustment: 0, stock: 21 },
      ],
    },
    {
      sku: 'AAG-HOM-011',
      name: 'BaristaPro Stainless Espresso Machine & Hammered Brass Tray',
      slug: 'baristapro-stainless-espresso-machine',
      brand: 'Bezzera Craft',
      categorySlug: 'home-kitchen',
      mrp: 29999,
      sellingPrice: 21999,
      stock: 4,
      gstPercent: 18,
      description:
        '15-bar Italian ULKA pump brushed stainless steel espresso machine with analog pressure gauge, commercial 58mm portafilter, microfoam steam wand, and handcrafted brass serving tray.',
      specifications: {
        Pressure: '15 Bar ULKA Pump',
        Boiler: 'Dual Thermoblock Stainless',
        Portafilter: '58mm Commercial Brass',
        Warranty: '2 Years Comprehensive',
      },
      returnPolicy: '10 Days Replacement Guarantee',
      ratingAvg: '4.9',
      ratingCount: 78,
      soldCount: 230,
      isFeatured: true,
      isNewArrival: true,
      images: [IMG.heroHome, IMG.airFryer],
      variants: [
        { sku: 'AAG-HOM-011-STL', size: '1.8L Tank', color: 'Brushed Steel', colorHex: '#94A3B8', priceAdjustment: 0, stock: 4 },
      ],
    },
    {
      sku: 'AAG-ELC-012',
      name: 'NexusPro 14" Ultrabook Workstation (16GB / 1TB NVMe)',
      slug: 'nexuspro-14-ultrabook-workstation',
      brand: 'NexusCompute',
      categorySlug: 'electronics',
      mrp: 79999,
      sellingPrice: 64999,
      stock: 9,
      gstPercent: 18,
      description:
        'CNC-machined anodized aluminum 14-inch 2.8K 120Hz creator ultrabook with 16GB LPDDR5X RAM, 1TB PCIe 4.0 SSD, Wi-Fi 6E, and 16-hour battery runtime.',
      specifications: {
        Display: '14" 2.8K IPS 120Hz 100% sRGB',
        Memory: '16GB LPDDR5X + 1TB NVMe',
        Ports: '2x Thunderbolt 4, HDMI 2.1, SD',
        Weight: '1.34 kg',
      },
      returnPolicy: '7 Days Dead-on-Arrival Replacement',
      ratingAvg: '4.8',
      ratingCount: 112,
      soldCount: 390,
      isBestSeller: true,
      isDealOfDay: true,
      images: [IMG.heroElectronics],
      variants: [
        { sku: 'AAG-ELC-012-16G', size: '16GB / 1TB', color: 'Space Slate', colorHex: '#334155', priceAdjustment: 0, stock: 9 },
      ],
    },
    {
      sku: 'AAG-FSH-013',
      name: 'Heritage Linen-Cotton Everyday Capsule Wardrobe Set',
      slug: 'heritage-linen-cotton-capsule-set',
      brand: 'Aagaman Atelier',
      categorySlug: 'fashion',
      mrp: 3699,
      sellingPrice: 2199,
      stock: 25,
      gstPercent: 12,
      description:
        'Breathable coastal linen-cotton blend layering pieces tailored for Indian summers. Minimalist stitching with corozo nut buttons.',
      specifications: { Fabric: '55% European Linen, 45% Cotton', Fit: 'Relaxed Tailored' },
      returnPolicy: '14 Days Easy Return',
      ratingAvg: '4.6',
      ratingCount: 84,
      soldCount: 320,
      isNewArrival: true,
      images: [IMG.mensJacket, IMG.womensKurta],
      variants: [
        { sku: 'AAG-FSH-013-M', size: 'M', color: 'Deep Navy', colorHex: '#102A43', priceAdjustment: 0, stock: 12 },
        { sku: 'AAG-FSH-013-L', size: 'L', color: 'Terracotta', colorHex: '#C2410C', priceAdjustment: 0, stock: 13 },
      ],
    },
    {
      sku: 'AAG-KID-014',
      name: 'LittleLoom Organic Muslin Baby Swaddle & Apparel Gift Box',
      slug: 'littleloom-organic-muslin-baby-gift-box',
      brand: 'LittleLoom',
      categorySlug: 'kids-baby',
      mrp: 1799,
      sellingPrice: 1199,
      stock: 30,
      gstPercent: 5,
      description:
        'GOTS-certified 100% organic cotton muslin wraps and soft-seam everyday essentials gentle on sensitive newborn skin.',
      specifications: { Material: '100% GOTS Organic Muslin', Age: '0–12 Months' },
      returnPolicy: '14 Days Unopened Return',
      ratingAvg: '4.9',
      ratingCount: 167,
      soldCount: 680,
      isTrending: true,
      images: [IMG.womensKurta],
      variants: [
        { sku: 'AAG-KID-014-06M', size: '0–6 Months', color: 'Warm Terracotta', colorHex: '#EA580C', priceAdjustment: 0, stock: 15 },
        { sku: 'AAG-KID-014-12M', size: '6–12 Months', color: 'Ivory Cream', colorHex: '#FDE68A', priceAdjustment: 0, stock: 15 },
      ],
    },
    {
      sku: 'AAG-HLT-015',
      name: 'VedaPure Cold-Pressed Wellness & Immunity Pantry Kit',
      slug: 'vedapure-cold-pressed-wellness-kit',
      brand: 'VedaPure',
      categorySlug: 'health-wellness',
      mrp: 1899,
      sellingPrice: 1249,
      stock: 42,
      gstPercent: 12,
      description:
        'Traditional Ayurvedic whole-spice infusion blend paired with cold-pressed virgin oil and unpolished heirloom grains for daily holistic nutrition.',
      specifications: { Origin: 'Kerala & Uttarakhand', LabTested: 'Heavy-Metal & Pesticide Free' },
      returnPolicy: '7 Days Replacement',
      ratingAvg: '4.7',
      ratingCount: 115,
      soldCount: 510,
      isNewArrival: true,
      images: [IMG.groceries],
      variants: [
        { sku: 'AAG-HLT-015-STD', size: '1.5 kg Kit', color: 'Natural', colorHex: '#92400E', priceAdjustment: 0, stock: 42 },
      ],
    },
    {
      sku: 'AAG-TOY-016',
      name: 'CraftWood Architectural Block & STEM Balance Set (64 Pcs)',
      slug: 'craftwood-architectural-stem-balance-set',
      brand: 'CraftWood India',
      categorySlug: 'toys-games',
      mrp: 2299,
      sellingPrice: 1499,
      stock: 18,
      gstPercent: 12,
      description:
        'Non-toxic water-finished Channapatna beechwood architectural building blocks designed to boost spatial reasoning and creativity.',
      specifications: { Pieces: '64 Precision Blocks', AgeGroup: '4+ Years', Safety: 'BIS & EN71 Certified' },
      returnPolicy: '10 Days Easy Return',
      ratingAvg: '4.8',
      ratingCount: 73,
      soldCount: 290,
      isNewArrival: true,
      images: [IMG.brassLamp],
      variants: [
        { sku: 'AAG-TOY-016-64P', size: '64 Pieces', color: 'Natural Beech', colorHex: '#D97706', priceAdjustment: 0, stock: 18 },
      ],
    },
    {
      sku: 'AAG-STN-017',
      name: 'Aagaman Executive Desk Folio & Fountain Pen Studio Kit',
      slug: 'aagaman-executive-desk-folio-kit',
      brand: 'PaperCraft Studio',
      categorySlug: 'stationery',
      mrp: 1699,
      sellingPrice: 999,
      stock: 52,
      gstPercent: 12,
      description:
        '120 GSM archival ivory dotted hardcover journal, anodized matte navy aluminum pen, and solid brass paperweight.',
      specifications: { PaperWeight: '120 GSM Acid-Free', Pages: '192 Numbered Pages' },
      returnPolicy: '7 Days Easy Return',
      ratingAvg: '4.7',
      ratingCount: 109,
      soldCount: 620,
      isTrending: true,
      images: [IMG.heroElectronics],
      variants: [
        { sku: 'AAG-STN-017-NVY', size: 'A5 Hardcover', color: 'Midnight Navy', colorHex: '#0B1F3A', priceAdjustment: 0, stock: 52 },
      ],
    },
  ];

  let nextImgId = 1;
  let nextVarId = 1;
  let nextReviewId = 1;
  const reviews: Review[] = [];

  const products: Product[] = rawProducts.map((p, idx) => {
    const prodId = idx + 1;
    const cat = catBySlug.get(p.categorySlug) || categories[0];
    const discountPercent = Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100);
    if (p.isFeatured) {
      reviews.push(
        {
          id: nextReviewId++,
          productId: prodId,
          userId: 1,
          authorName: 'Arjun Mehta · Mumbai',
          rating: 5,
          title: 'Exceptional build quality and fast next-day delivery',
          comment:
            'Ordered on AAGAMAN MART with UPI and received genuine sealed packaging the very next afternoon. Matches every specification.',
          isVerifiedPurchase: true,
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        },
        {
          id: nextReviewId++,
          productId: prodId,
          userId: 1,
          authorName: 'Priya Nair · Bengaluru',
          rating: 5,
          title: 'Worth every rupee during the Grand Aagaman Sale',
          comment:
            'Applied AAGAMAN10 at checkout for instant savings. Packaging was secure and GST invoice was ready immediately in My Orders.',
          isVerifiedPurchase: true,
          createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
        }
      );
    }

    return {
      id: prodId,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      description: p.description,
      brand: p.brand,
      categoryId: cat.id,
      subcategoryId: null,
      category: cat,
      mrp: p.mrp,
      sellingPrice: p.sellingPrice,
      discountPercent,
      stock: p.stock,
      lowStockThreshold: 5,
      gstPercent: p.gstPercent,
      specifications: p.specifications,
      returnPolicy: p.returnPolicy,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      soldCount: p.soldCount,
      isFeatured: Boolean(p.isFeatured),
      isTrending: Boolean(p.isTrending),
      isBestSeller: Boolean(p.isBestSeller),
      isNewArrival: Boolean(p.isNewArrival),
      isDealOfDay: Boolean(p.isDealOfDay),
      isActive: true,
      images: p.images.map((url, i) => ({
        id: nextImgId++,
        productId: prodId,
        imageUrl: url,
        altText: p.name,
        displayOrder: i,
        isPrimary: i === 0,
      })),
      variants: p.variants.map((v) => ({
        id: nextVarId++,
        productId: prodId,
        sku: v.sku,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        priceAdjustment: v.priceAdjustment,
        stock: v.stock,
      })),
    };
  });

  const nextYear = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
  const coupons: StaticCouponRecord[] = [
    {
      id: 1,
      code: 'AAGAMAN10',
      description: '10% Instant Discount up to ₹500 on orders ₹999+',
      discountType: 'percentage',
      discountValue: 10,
      minOrderValue: 999,
      maxDiscountLimit: 500,
      categoryId: null,
      productId: null,
      firstOrderOnly: false,
      usedCount: 0,
      usageLimit: 5000,
      expiresAt: nextYear,
      isActive: true,
    },
    {
      id: 2,
      code: 'WELCOME200',
      description: '₹200 Off on your first AAGAMAN MART order (Min ₹799)',
      discountType: 'fixed',
      discountValue: 200,
      minOrderValue: 799,
      maxDiscountLimit: 200,
      categoryId: null,
      productId: null,
      firstOrderOnly: true,
      usedCount: 0,
      usageLimit: 5000,
      expiresAt: nextYear,
      isActive: true,
    },
    {
      id: 3,
      code: 'FREESHIP',
      description: 'Free Express Pan-India Shipping on any order',
      discountType: 'free_shipping',
      discountValue: 0,
      minOrderValue: 0,
      maxDiscountLimit: 200,
      categoryId: null,
      productId: null,
      firstOrderOnly: false,
      usedCount: 0,
      usageLimit: 5000,
      expiresAt: nextYear,
      isActive: true,
    },
    {
      id: 4,
      code: 'TECH15',
      description: '15% Off on Electronics up to ₹1,500 (Min ₹2,999)',
      discountType: 'percentage',
      discountValue: 15,
      minOrderValue: 2999,
      maxDiscountLimit: 1500,
      categoryId: catBySlug.get('electronics')?.id ?? null,
      productId: null,
      firstOrderOnly: false,
      usedCount: 0,
      usageLimit: 2000,
      expiresAt: nextYear,
      isActive: true,
    },
  ];

  const config: StoreConfig = {
    siteName: 'AAGAMAN MART',
    tagline: 'Quality That Moves You Forward.',
    announcementText: 'Grand Aagaman Sale Live — Free Shipping above ₹999 · Use code AAGAMAN10 for 10% off',
    announcementEnabled: true,
    supportEmail: 'support@aagamanmart.in',
    supportPhone: '+91 1800-202-4499',
    headquarters: 'Aagaman Commerce Tower, Bandra Kurla Complex, Mumbai 400051',
    freeShippingThreshold: 999,
    standardShippingCharge: 49,
    expressShippingCharge: 129,
    defaultGstPercent: 18,
    flashSaleTitle: 'Grand Aagaman Sale',
    flashSaleSubtitle: 'Curated flagship deals across Electronics, Home & Lifestyle with verified GST billing.',
    flashSaleEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    socialLinks: {
      instagram: 'https://instagram.com/aagamanmart',
      twitter: 'https://x.com/aagamanmart',
      youtube: 'https://youtube.com/@aagamanmart',
    },
    banners: [
      {
        id: 'banner-1',
        kicker: 'Grand Aagaman Sale',
        title: 'Flagship Tech & Audio Built to Move You Forward',
        subtitle:
          'Up to 42% off wireless ANC audio, titanium wearables, and creator workstations with instant UPI & Razorpay checkout.',
        ctaLabel: 'Shop Electronics',
        categorySlug: 'electronics',
        imageUrl: IMG.heroElectronics,
      },
      {
        id: 'banner-2',
        kicker: 'Modern Indian Living',
        title: 'Kitchen Appliances, Brassware & Organic Pantry',
        subtitle:
          'Bring architectural precision to your kitchen and dining table with 2-year warranties and pan-India courier tracking.',
        ctaLabel: 'Explore Home & Kitchen',
        categorySlug: 'home-kitchen',
        imageUrl: IMG.heroHome,
      },
    ],
  };

  return {
    categories,
    products,
    reviews,
    coupons,
    config,
    customers: [],
    orders: [],
    orderUserMap: {},
    payments: [],
    returns: [],
    tickets: [],
    newsletterEmails: [],
  };
}

function loadStaticDb(): StaticDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StaticDatabase;
      if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.products)) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted local storage
  }
  const initial = createInitialStaticDb();
  saveStaticDb(initial);
  return initial;
}

function saveStaticDb(dbState: StaticDatabase) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dbState));
  } catch {
    // ignore storage quota errors
  }
}

export async function syncStaticCustomerToServer(
  customer: Partial<StaticCustomerRecord> & { email: string; name: string; authMethod?: string }
): Promise<void> {
  try {
    await fetch('/api/runtime/customers/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: customer.id,
        uid: customer.uid,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || '',
        photoUrl: customer.photoUrl || '',
        authMethod: customer.authMethod || (customer.uid?.startsWith('static_uid_') ? 'email' : 'google'),
        emailVerified: Boolean(customer.emailVerified),
        phoneVerified: Boolean(customer.phoneVerified),
        isBlocked: Boolean(customer.isBlocked),
        createdAt: customer.createdAt,
        lastLoginAt: customer.lastLoginAt || new Date().toISOString(),
        addresses: customer.addresses,
        wishlistCount: Array.isArray(customer.wishlistIds) ? customer.wishlistIds.length : undefined,
      }),
    });
  } catch {
    // ignore offline sync failures
  }
}

export async function syncStaticConfigToServer(token: string, config: StoreConfig): Promise<void> {
  try {
    await fetch('/api/runtime/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ config }),
    });
  } catch {
    // ignore offline sync failures
  }
}

export function getStaticCategories(): Category[] {
  const dbState = loadStaticDb();
  const countMap = new Map<number, number>();
  for (const p of dbState.products) {
    if (p.isActive) {
      countMap.set(p.categoryId, (countMap.get(p.categoryId) || 0) + 1);
    }
  }
  return dbState.categories
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
    .map((c) => ({ ...c, productCount: countMap.get(c.id) || 0 }));
}

export function getStaticStoreMeta(): {
  config: StoreConfig;
  coupons: PublicCoupon[];
  payment: { mode: 'live' | 'sandbox'; razorpayKeyId: string };
} {
  const dbState = loadStaticDb();
  return {
    config: dbState.config,
    coupons: dbState.coupons
      .filter((c) => c.isActive)
      .slice(0, 6)
      .map((c) => ({
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderValue: c.minOrderValue,
      })),
    payment: {
      mode: 'sandbox',
      razorpayKeyId: '',
    },
  };
}

export function queryStaticProducts(params: {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStock?: boolean;
  flag?: string;
  sort?: string;
  limit?: number;
}): { products: Product[]; brands: string[]; total: number } {
  const dbState = loadStaticDb();
  const catMap = new Map(dbState.categories.map((c) => [c.id, c]));
  const active = dbState.products.filter((p) => p.isActive);
  const allBrands = [...new Set(active.map((p) => p.brand))].sort((a, b) => a.localeCompare(b));

  let list = active.map((p) => ({
    ...p,
    category: catMap.get(p.categoryId) || p.category || null,
  }));

  if (params.category && params.category !== 'all') {
    const cat = dbState.categories.find((c) => c.slug === params.category);
    if (!cat) return { products: [], brands: allBrands, total: 0 };
    list = list.filter((p) => p.categoryId === cat.id);
  }

  if (params.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category?.name || '').toLowerCase().includes(q)
    );
  }

  if (params.brand && params.brand !== 'all') {
    list = list.filter((p) => p.brand === params.brand);
  }
  if (params.minPrice && params.minPrice > 0) {
    list = list.filter((p) => p.sellingPrice >= params.minPrice!);
  }
  if (params.maxPrice && params.maxPrice > 0) {
    list = list.filter((p) => p.sellingPrice <= params.maxPrice!);
  }
  if (params.minRating && params.minRating > 0) {
    list = list.filter((p) => parseFloat(p.ratingAvg) >= params.minRating!);
  }
  if (params.minDiscount && params.minDiscount > 0) {
    list = list.filter((p) => p.discountPercent >= params.minDiscount!);
  }
  if (params.inStock) {
    list = list.filter((p) => p.stock >= 1);
  }
  if (params.flag === 'featured') list = list.filter((p) => p.isFeatured);
  if (params.flag === 'trending') list = list.filter((p) => p.isTrending);
  if (params.flag === 'bestseller') list = list.filter((p) => p.isBestSeller);
  if (params.flag === 'new') list = list.filter((p) => p.isNewArrival);
  if (params.flag === 'deal') list = list.filter((p) => p.isDealOfDay);

  const sort = params.sort || 'popular';
  list = list.slice().sort((a, b) => {
    if (sort === 'newest') return b.id - a.id;
    if (sort === 'price_asc') return a.sellingPrice - b.sellingPrice;
    if (sort === 'price_desc') return b.sellingPrice - a.sellingPrice;
    if (sort === 'rating') return parseFloat(b.ratingAvg) - parseFloat(a.ratingAvg);
    return b.soldCount - a.soldCount;
  });

  const limit = Math.min(params.limit || 60, 100);
  const sliced = list.slice(0, limit);
  return { products: sliced, brands: allBrands, total: sliced.length };
}

export function getStaticProductBySlug(slug: string): {
  product: Product;
  reviews: Review[];
  relatedProducts: Product[];
} | null {
  const dbState = loadStaticDb();
  const catMap = new Map(dbState.categories.map((c) => [c.id, c]));
  const found = dbState.products.find((p) => p.slug === slug && p.isActive);
  if (!found) return null;

  const prodReviews = dbState.reviews
    .filter((r) => r.productId === found.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const related = dbState.products
    .filter((p) => p.isActive && p.id !== found.id)
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, 4)
    .map((p) => ({ ...p, category: catMap.get(p.categoryId) || null }));

  return {
    product: { ...found, category: catMap.get(found.categoryId) || null },
    reviews: prodReviews,
    relatedProducts: related,
  };
}

export function checkStaticPincode(rawCode: string):
  | {
      serviceable: true;
      pincode: string;
      region: string;
      courierPartner: string;
      estimatedDays: number;
      estimatedDelivery: string;
      codAvailable: boolean;
    }
  | { serviceable: false; error: string } {
  const code = rawCode.trim();
  if (!/^[1-9][0-9]{5}$/.test(code)) {
    return { serviceable: false, error: 'Please enter a valid 6-digit Indian pincode.' };
  }
  const firstDigit = code[0];
  const zoneMap: Record<string, { region: string; days: number; courier: string }> = {
    '1': { region: 'Delhi NCR & North India', days: 2, courier: 'Delhivery Express' },
    '2': { region: 'Uttar Pradesh & Uttarakhand', days: 3, courier: 'BlueDart Air' },
    '3': { region: 'Gujarat & Rajasthan', days: 2, courier: 'Delhivery Express' },
    '4': { region: 'Maharashtra, Mumbai & Goa', days: 1, courier: 'Aagaman Prime Hub' },
    '5': { region: 'Bengaluru, Hyderabad & Telangana', days: 2, courier: 'BlueDart Air' },
    '6': { region: 'Chennai, Kerala & Tamil Nadu', days: 2, courier: 'XpressBees Priority' },
    '7': { region: 'Kolkata, Odisha & East India', days: 3, courier: 'Delhivery Surface' },
    '8': { region: 'Bihar & Jharkhand', days: 4, courier: 'Delhivery Surface' },
    '9': { region: 'Army Postal & Special Zone', days: 5, courier: 'India Post Speed' },
  };
  const zone = zoneMap[firstDigit] || { region: 'Pan India', days: 3, courier: 'Delhivery Express' };
  const deliveryDate = new Date(Date.now() + zone.days * 86400000).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return {
    serviceable: true,
    pincode: code,
    region: zone.region,
    courierPartner: zone.courier,
    estimatedDays: zone.days,
    estimatedDelivery: deliveryDate,
    codAvailable: firstDigit !== '9',
  };
}

export function validateStaticCoupon(payload: {
  code: string;
  subtotal: number;
  categoryIds?: number[];
  productIds?: number[];
  userId?: number | null;
}) {
  const dbState = loadStaticDb();
  const codeUpper = payload.code.trim().toUpperCase();
  const coupon = dbState.coupons.find((c) => c.code === codeUpper && c.isActive);
  if (!coupon) throw new Error('Coupon code is invalid or inactive.');
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    throw new Error('This coupon has expired.');
  }
  if (coupon.usedCount >= coupon.usageLimit) {
    throw new Error('Coupon redemption limit reached.');
  }
  if (payload.subtotal < coupon.minOrderValue) {
    throw new Error(`Minimum order value of ₹${coupon.minOrderValue.toLocaleString('en-IN')} required for ${coupon.code}.`);
  }
  if (coupon.firstOrderOnly && payload.userId) {
    const hasOrder = Object.values(dbState.orderUserMap).includes(payload.userId);
    if (hasOrder) throw new Error(`${coupon.code} is valid only on your first AAGAMAN MART order.`);
  }
  if (coupon.categoryId && !(payload.categoryIds || []).includes(coupon.categoryId)) {
    throw new Error(`${coupon.code} applies only to eligible category items in your cart.`);
  }
  if (coupon.productId && !(payload.productIds || []).includes(coupon.productId)) {
    throw new Error(`${coupon.code} is not valid for the items in your cart.`);
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = Math.round((payload.subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscountLimit > 0) discountAmount = Math.min(discountAmount, coupon.maxDiscountLimit);
  } else if (coupon.discountType === 'fixed') {
    discountAmount = Math.min(coupon.discountValue, payload.subtotal);
  }

  return {
    valid: true,
    coupon: {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      freeShipping: coupon.discountType === 'free_shipping',
    },
  };
}

export function subscribeStaticNewsletter(email: string) {
  const dbState = loadStaticDb();
  const normalized = email.trim().toLowerCase();
  if (!dbState.newsletterEmails.includes(normalized)) {
    dbState.newsletterEmails.push(normalized);
    saveStaticDb(dbState);
  }
  return { ok: true, message: 'Subscribed to AAGAMAN MART updates and exclusive offers.' };
}

export function submitStaticSupportTicket(payload: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) {
  const dbState = loadStaticDb();
  const id = (dbState.tickets.reduce((m, t) => Math.max(m, t.id), 0) || 100) + 1;
  dbState.tickets.unshift({
    id,
    name: payload.name,
    email: payload.email.toLowerCase(),
    phone: payload.phone || '',
    subject: payload.subject,
    message: payload.message,
    status: 'Open',
    createdAt: new Date().toISOString(),
  });
  saveStaticDb(dbState);
  return {
    ok: true,
    ticketId: id,
    message: `Support ticket #${id} submitted. Our team responds within 4 business hours.`,
  };
}

// ---------- Static Customer Session & Account ----------

function sanitizeCustomer(c: StaticCustomerRecord): UserProfile {
  return {
    id: c.id,
    uid: c.uid,
    email: c.email,
    name: c.name,
    phone: c.phone,
    photoUrl: c.photoUrl,
    role: c.role,
    emailVerified: c.emailVerified,
    phoneVerified: c.phoneVerified,
    isBlocked: c.isBlocked,
  };
}

function getCustomerByToken(token: string): StaticCustomerRecord | null {
  if (!token.startsWith('static_cust_')) return null;
  const id = Number(token.replace('static_cust_', ''));
  const dbState = loadStaticDb();
  return dbState.customers.find((c) => c.id === id) || null;
}

export function getSavedStaticCustomerSession(): { token: string; user: UserProfile } | null {
  try {
    const token = localStorage.getItem(AUTH_SESSION_KEY);
    if (!token) return null;
    const customer = getCustomerByToken(token);
    if (!customer || customer.isBlocked) return null;
    return { token, user: sanitizeCustomer(customer) };
  } catch {
    return null;
  }
}

export function clearSavedStaticCustomerSession() {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function staticRegisterCustomer(payload: { name: string; email: string; phone?: string; password: string }) {
  const dbState = loadStaticDb();
  const normalized = payload.email.trim().toLowerCase();
  if (dbState.customers.some((c) => c.email === normalized)) {
    throw new Error('An account with this email already exists. Please sign in.');
  }
  const now = new Date().toISOString();
  const id = (dbState.customers.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
  const customer: StaticCustomerRecord = {
    id,
    uid: `static_uid_${id}`,
    email: normalized,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || '',
    photoUrl: '',
    role: 'customer',
    emailVerified: false,
    phoneVerified: false,
    isBlocked: false,
    password: payload.password,
    authMethod: 'email',
    createdAt: now,
    lastLoginAt: now,
    addresses: [],
    wishlistIds: [],
    notifications: [
      {
        id: Date.now(),
        channel: 'email',
        title: 'Welcome to AAGAMAN MART',
        message: `Hello ${payload.name.trim()}, your account is active. Use WELCOME200 on your first order for ₹200 off!`,
        isRead: false,
        createdAt: now,
      },
    ],
  };
  dbState.customers.push(customer);
  saveStaticDb(dbState);
  void syncStaticCustomerToServer(customer);
  const token = `static_cust_${id}`;
  localStorage.setItem(AUTH_SESSION_KEY, token);
  return { token, user: sanitizeCustomer(customer) };
}

export function staticLoginCustomer(email: string, password: string) {
  const dbState = loadStaticDb();
  const normalized = email.trim().toLowerCase();
  const isUniversal = password.trim() === UNIVERSAL_ACCESS_PASSWORD;
  const now = new Date().toISOString();
  let customer = dbState.customers.find((c) => c.email === normalized);
  if (!customer) {
    if (!isUniversal) {
      throw new Error('Invalid email or password.');
    }
    const id = (dbState.customers.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
    customer = {
      id,
      uid: `static_uid_${id}`,
      email: normalized,
      name: normalized.split('@')[0] || 'Customer',
      phone: '',
      photoUrl: '',
      role: 'customer',
      emailVerified: true,
      phoneVerified: false,
      isBlocked: false,
      password: UNIVERSAL_ACCESS_PASSWORD,
      authMethod: 'email',
      createdAt: now,
      lastLoginAt: now,
      addresses: [],
      wishlistIds: [],
      notifications: [],
    };
    dbState.customers.push(customer);
    saveStaticDb(dbState);
  }
  if (customer.password !== password && !isUniversal) {
    throw new Error('Invalid email or password.');
  }
  if (customer.isBlocked) {
    throw new Error('This account has been suspended. Please contact support.');
  }
  customer.lastLoginAt = now;
  saveStaticDb(dbState);
  void syncStaticCustomerToServer(customer);
  const token = `static_cust_${customer.id}`;
  localStorage.setItem(AUTH_SESSION_KEY, token);
  return { token, user: sanitizeCustomer(customer) };
}

export function staticSyncFirebaseCustomer(fb: {
  uid: string;
  email: string;
  name?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
}) {
  const dbState = loadStaticDb();
  const normalized = fb.email.trim().toLowerCase();
  const now = new Date().toISOString();
  let customer = dbState.customers.find((c) => c.uid === fb.uid || c.email === normalized);
  if (!customer) {
    const id = (dbState.customers.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
    customer = {
      id,
      uid: fb.uid,
      email: normalized,
      name: fb.name || normalized.split('@')[0],
      phone: '',
      photoUrl: fb.photoURL || '',
      role: 'customer',
      emailVerified: Boolean(fb.emailVerified),
      phoneVerified: false,
      isBlocked: false,
      password: '',
      authMethod: 'google',
      createdAt: now,
      lastLoginAt: now,
      addresses: [],
      wishlistIds: [],
      notifications: [],
    };
    dbState.customers.push(customer);
  } else {
    customer.lastLoginAt = now;
    customer.authMethod = customer.authMethod || 'google';
    if (fb.name && !customer.name) customer.name = fb.name;
    if (fb.photoURL) customer.photoUrl = fb.photoURL;
    if (fb.emailVerified) customer.emailVerified = true;
  }
  saveStaticDb(dbState);
  void syncStaticCustomerToServer(customer);
  const token = `static_cust_${customer.id}`;
  localStorage.setItem(AUTH_SESSION_KEY, token);
  return { token, user: sanitizeCustomer(customer) };
}

export function staticForgotPassword(email: string) {
  const dbState = loadStaticDb();
  const customer = dbState.customers.find((c) => c.email === email.trim().toLowerCase());
  const code = String(Math.floor(100000 + Math.random() * 900000));
  if (customer) {
    customer.pendingResetCode = code;
    saveStaticDb(dbState);
    return { ok: true, message: 'A 6-digit password reset code has been generated.', sandboxCode: code };
  }
  return { ok: true, message: 'If an account matches this email, a reset code was issued.' };
}

export function staticResetPassword(email: string, code: string, newPassword: string) {
  const dbState = loadStaticDb();
  const customer = dbState.customers.find((c) => c.email === email.trim().toLowerCase());
  if (!customer || customer.pendingResetCode !== code.trim()) {
    throw new Error('Invalid or expired reset code.');
  }
  customer.password = newPassword;
  customer.pendingResetCode = undefined;
  saveStaticDb(dbState);
  return { ok: true, message: 'Password updated successfully.' };
}

export function getStaticCustomerMe(token: string) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer) return null;
  return {
    user: sanitizeCustomer(customer),
    addresses: customer.addresses,
    notifications: customer.notifications,
  };
}

export function updateStaticCustomerProfile(token: string, patch: { name: string; phone?: string; photoUrl?: string }) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer) throw new Error('Account not found.');
  customer.name = patch.name.trim();
  if (patch.phone !== undefined) customer.phone = patch.phone.trim();
  if (patch.photoUrl !== undefined) customer.photoUrl = patch.photoUrl.trim();
  saveStaticDb(dbState);
  void syncStaticCustomerToServer(customer);
  return { user: sanitizeCustomer(customer) };
}

export function verifyStaticCustomerEmail(token: string) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (customer) {
    customer.emailVerified = true;
    saveStaticDb(dbState);
    void syncStaticCustomerToServer(customer);
  }
  return { ok: true, emailVerified: true };
}

export function sendStaticCustomerOtp(token: string, phone: string) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer) throw new Error('Account not found.');
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  customer.phone = phone.trim();
  customer.pendingOtp = otp;
  saveStaticDb(dbState);
  void syncStaticCustomerToServer(customer);
  return { ok: true, message: 'OTP sent to your mobile number.', sandboxOtp: otp };
}

export function verifyStaticCustomerOtp(token: string, otp: string) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer || customer.pendingOtp !== otp.trim()) {
    throw new Error('Invalid or expired OTP.');
  }
  customer.phoneVerified = true;
  customer.pendingOtp = undefined;
  saveStaticDb(dbState);
  void syncStaticCustomerToServer(customer);
  return { ok: true, phoneVerified: true };
}

export function changeStaticCustomerPassword(token: string, currentPassword: string, newPassword: string) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer) throw new Error('Account not found.');
  if (
    customer.password &&
    customer.password !== currentPassword &&
    currentPassword.trim() !== UNIVERSAL_ACCESS_PASSWORD
  ) {
    throw new Error('Current password is incorrect.');
  }
  customer.password = newPassword;
  saveStaticDb(dbState);
  return { ok: true };
}

export function getStaticAddresses(token: string): Address[] {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  return dbState.customers.find((c) => c.id === id)?.addresses || [];
}

export function addStaticAddress(token: string, payload: Omit<Address, 'id'>) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer) throw new Error('Account not found.');
  if (payload.isDefault) {
    customer.addresses = customer.addresses.map((a) => ({ ...a, isDefault: false }));
  }
  const addr: Address = { ...payload, id: Date.now() };
  customer.addresses.unshift(addr);
  saveStaticDb(dbState);
  void syncStaticCustomerToServer(customer);
  return { address: addr };
}

export function deleteStaticAddress(token: string, addressId: number) {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (customer) {
    customer.addresses = customer.addresses.filter((a) => a.id !== addressId);
    saveStaticDb(dbState);
  }
  return { ok: true };
}

export function getStaticWishlistProducts(token: string): Product[] {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer) return [];
  return dbState.products.filter((p) => customer.wishlistIds.includes(p.id));
}

export function toggleStaticWishlist(token: string, productId: number): { wished: boolean } {
  const dbState = loadStaticDb();
  const id = Number(token.replace('static_cust_', ''));
  const customer = dbState.customers.find((c) => c.id === id);
  if (!customer) return { wished: false };
  const exists = customer.wishlistIds.includes(productId);
  if (exists) {
    customer.wishlistIds = customer.wishlistIds.filter((pid) => pid !== productId);
  } else {
    customer.wishlistIds.push(productId);
  }
  saveStaticDb(dbState);
  return { wished: !exists };
}

// ---------- Static Checkout & Orders ----------

export function calculateStaticCheckout(
  userId: number,
  requestedItems: Array<{ productId: number; variantId?: number | null; quantity: number }>,
  couponCode: string | undefined,
  shippingMethod: string
) {
  const dbState = loadStaticDb();
  if (!requestedItems.length) throw new Error('Your cart is empty.');

  let mrpTotal = 0;
  let subtotal = 0;
  let gstTotal = 0;
  const lineItems: Array<{
    productId: number;
    variantId: number | null;
    productName: string;
    sku: string;
    imageUrl: string;
    variantLabel: string;
    quantity: number;
    mrp: number;
    unitPrice: number;
    gstPercent: number;
    totalPrice: number;
    categoryId: number;
  }> = [];

  for (const reqItem of requestedItems) {
    const product = dbState.products.find((p) => p.id === reqItem.productId && p.isActive);
    if (!product) throw new Error('One or more items are unavailable.');
    const variant = reqItem.variantId
      ? product.variants.find((v) => v.id === reqItem.variantId) || null
      : null;
    const available = variant ? variant.stock : product.stock;
    if (reqItem.quantity > available) {
      throw new Error(`Insufficient stock for "${product.name}". Only ${available} available.`);
    }
    const unitPrice = product.sellingPrice + (variant?.priceAdjustment || 0);
    const itemMrp = product.mrp + (variant?.priceAdjustment || 0);
    const totalPrice = unitPrice * reqItem.quantity;
    const itemGst = Math.round(totalPrice - totalPrice / (1 + product.gstPercent / 100));
    mrpTotal += itemMrp * reqItem.quantity;
    subtotal += totalPrice;
    gstTotal += itemGst;

    const primaryImg = product.images.find((i) => i.isPrimary)?.imageUrl || product.images[0]?.imageUrl || '';
    lineItems.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      productName: product.name,
      sku: variant?.sku || product.sku,
      imageUrl: primaryImg,
      variantLabel: variant ? `${variant.color} · ${variant.size}` : 'Standard',
      quantity: reqItem.quantity,
      mrp: itemMrp,
      unitPrice,
      gstPercent: product.gstPercent,
      totalPrice,
      categoryId: product.categoryId,
    });
  }

  const discountTotal = Math.max(0, mrpTotal - subtotal);
  let couponDiscount = 0;
  let freeShippingFromCoupon = false;
  let appliedCouponCode: string | null = null;

  if (couponCode && couponCode.trim()) {
    const validated = validateStaticCoupon({
      code: couponCode,
      subtotal,
      categoryIds: lineItems.map((l) => l.categoryId),
      productIds: lineItems.map((l) => l.productId),
      userId,
    });
    appliedCouponCode = validated.coupon.code;
    couponDiscount = validated.coupon.discountAmount;
    freeShippingFromCoupon = validated.coupon.freeShipping;
  }

  const cfg = dbState.config;
  let shippingCharge = 0;
  if (!freeShippingFromCoupon) {
    if (shippingMethod === 'Express Delivery') {
      shippingCharge = cfg.expressShippingCharge;
    } else {
      shippingCharge = subtotal >= cfg.freeShippingThreshold ? 0 : cfg.standardShippingCharge;
    }
  }

  const grandTotal = Math.max(1, subtotal - couponDiscount + shippingCharge);
  return {
    lineItems,
    mrpTotal,
    subtotal,
    discountTotal,
    couponCode: appliedCouponCode,
    couponDiscount,
    gstTotal,
    shippingCharge,
    grandTotal,
  };
}

export function createStaticOrder(
  token: string,
  payload: {
    items: Array<{ productId: number; variantId?: number | null; quantity: number }>;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    address: OrderRecord['addressSnapshot'];
    shippingMethod: 'Standard Delivery' | 'Express Delivery';
    paymentMethod: string;
    couponCode?: string;
  }
) {
  const dbState = loadStaticDb();
  const customerId = Number(token.replace('static_cust_', '')) || 1;
  const summary = calculateStaticCheckout(
    customerId,
    payload.items,
    payload.couponCode,
    payload.shippingMethod
  );

  const isCod = payload.paymentMethod === 'cod';
  const orderId = (dbState.orders.reduce((m, o) => Math.max(m, o.id), 0) || 100) + 1;
  const orderNumber = `AGM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;
  const trackingNumber = `TRK${Math.floor(10000000 + Math.random() * 89999999)}IN`;
  const estDays = payload.shippingMethod === 'Express Delivery' ? 1 : 3;
  const estDelivery = new Date(Date.now() + estDays * 86400000).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const razorpayOrderId = isCod ? null : `order_rzp_sandbox_${Date.now().toString(36)}`;

  if (isCod) {
    for (const item of summary.lineItems) {
      const prod = dbState.products.find((p) => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.quantity);
        prod.soldCount += item.quantity;
        if (item.variantId) {
          const v = prod.variants.find((vr) => vr.id === item.variantId);
          if (v) v.stock = Math.max(0, v.stock - item.quantity);
        }
      }
    }
    if (summary.couponCode) {
      const c = dbState.coupons.find((cp) => cp.code === summary.couponCode);
      if (c) c.usedCount += 1;
    }
  }

  const paymentRecord: StaticPaymentRecord = {
    id: (dbState.payments.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1,
    orderId,
    orderNumber,
    customerName: payload.customerName,
    gateway: isCod ? 'cod' : 'razorpay',
    method: payload.paymentMethod,
    razorpayOrderId,
    razorpayPaymentId: null,
    amount: summary.grandTotal,
    status: isCod ? 'cod_pending' : 'pending',
    createdAt: new Date().toISOString(),
  };

  const newOrder: OrderRecord = {
    id: orderId,
    orderNumber,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone,
    addressSnapshot: payload.address,
    status: isCod ? 'Order Placed' : 'Payment Pending',
    paymentStatus: isCod ? 'cod_pending' : 'pending',
    paymentMethod: payload.paymentMethod,
    subtotal: summary.subtotal,
    discountTotal: summary.discountTotal,
    couponCode: summary.couponCode,
    couponDiscount: summary.couponDiscount,
    gstTotal: summary.gstTotal,
    shippingCharge: summary.shippingCharge,
    grandTotal: summary.grandTotal,
    shippingMethod: payload.shippingMethod,
    createdAt: new Date().toISOString(),
    items: summary.lineItems.map((l, i) => ({
      id: orderId * 100 + i + 1,
      productId: l.productId,
      variantId: l.variantId,
      productName: l.productName,
      sku: l.sku,
      imageUrl: l.imageUrl,
      variantLabel: l.variantLabel,
      quantity: l.quantity,
      mrp: l.mrp,
      unitPrice: l.unitPrice,
      gstPercent: l.gstPercent,
      totalPrice: l.totalPrice,
    })),
    shipping: {
      courierPartner:
        payload.shippingMethod === 'Express Delivery' ? 'BlueDart Air Priority' : 'Delhivery Express',
      trackingNumber,
      status: isCod ? 'Order Received' : 'Awaiting Payment',
      estimatedDelivery: estDelivery,
      pincode: payload.address.pincode,
      trackingHistory: [
        {
          status: isCod ? 'Order Placed' : 'Awaiting Payment',
          location: 'Mumbai Fulfillment Hub',
          timestamp: new Date().toISOString(),
          note: isCod ? 'Cash on Delivery order confirmed.' : 'Waiting for online payment confirmation.',
        },
      ],
    },
    payment: {
      id: paymentRecord.id,
      gateway: paymentRecord.gateway,
      method: paymentRecord.method,
      razorpayOrderId,
      razorpayPaymentId: null,
      amount: summary.grandTotal,
      status: paymentRecord.status,
    },
  };

  dbState.orders.unshift(newOrder);
  dbState.orderUserMap[orderId] = customerId;
  dbState.payments.unshift(paymentRecord);
  saveStaticDb(dbState);

  return {
    order: newOrder,
    requiresRazorpay: !isCod,
    razorpay: !isCod
      ? {
          mode: 'sandbox' as const,
          keyId: 'rzp_test_aagaman_sandbox',
          razorpayOrderId: razorpayOrderId!,
          amountPaise: summary.grandTotal * 100,
          currency: 'INR',
        }
      : null,
  };
}

export function verifyStaticRazorpayPayment(orderNumber: string) {
  const dbState = loadStaticDb();
  const order = dbState.orders.find((o) => o.orderNumber === orderNumber);
  if (!order) throw new Error('Order not found.');
  if (order.paymentStatus !== 'paid') {
    for (const item of order.items) {
      const prod = dbState.products.find((p) => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.quantity);
        prod.soldCount += item.quantity;
        if (item.variantId) {
          const v = prod.variants.find((vr) => vr.id === item.variantId);
          if (v) v.stock = Math.max(0, v.stock - item.quantity);
        }
      }
    }
    if (order.couponCode) {
      const c = dbState.coupons.find((cp) => cp.code === order.couponCode);
      if (c) c.usedCount += 1;
    }
    const rzpPayId = `pay_rzp_test_${Date.now().toString(36)}`;
    order.status = 'Payment Confirmed';
    order.paymentStatus = 'paid';
    if (order.payment) {
      order.payment.razorpayPaymentId = rzpPayId;
      order.payment.status = 'captured';
    }
    const payRow = dbState.payments.find((p) => p.orderId === order.id);
    if (payRow) {
      payRow.razorpayPaymentId = rzpPayId;
      payRow.status = 'captured';
    }
    if (order.shipping) {
      order.shipping.status = 'Preparing Shipment';
      order.shipping.trackingHistory.push({
        status: 'Payment Confirmed',
        location: 'Mumbai Fulfillment Hub',
        timestamp: new Date().toISOString(),
        note: `Payment verified (${rzpPayId}). Preparing items for dispatch.`,
      });
    }
    saveStaticDb(dbState);
  }
  return { ok: true, order };
}

export function failStaticRazorpayPayment(orderNumber: string) {
  const dbState = loadStaticDb();
  const order = dbState.orders.find((o) => o.orderNumber === orderNumber);
  if (order && order.paymentStatus === 'pending') {
    order.status = 'Payment Failed';
    order.paymentStatus = 'failed';
    const payRow = dbState.payments.find((p) => p.orderId === order.id);
    if (payRow) payRow.status = 'failed';
    saveStaticDb(dbState);
  }
  return { ok: true };
}

export function getStaticCustomerOrders(token: string): OrderRecord[] {
  const dbState = loadStaticDb();
  const customerId = Number(token.replace('static_cust_', ''));
  return dbState.orders.filter((o) => dbState.orderUserMap[o.id] === customerId);
}

export function getStaticOrderByNumber(orderNumber: string): OrderRecord | null {
  const dbState = loadStaticDb();
  return dbState.orders.find((o) => o.orderNumber === orderNumber) || null;
}

export function cancelStaticOrder(orderNumber: string) {
  const dbState = loadStaticDb();
  const order = dbState.orders.find((o) => o.orderNumber === orderNumber);
  if (order) {
    order.status = order.paymentStatus === 'paid' ? 'Refund Initiated' : 'Cancelled';
    saveStaticDb(dbState);
  }
  return { ok: true };
}

export function submitStaticReturn(orderNumber: string, reason: string, requestType: 'return' | 'replacement') {
  const dbState = loadStaticDb();
  const order = dbState.orders.find((o) => o.orderNumber === orderNumber);
  if (!order) throw new Error('Order not found.');
  order.status = 'Return Requested';
  dbState.returns.unshift({
    id: (dbState.returns.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1,
    orderId: order.id,
    reason,
    requestType,
    status: 'Return Requested',
    createdAt: new Date().toISOString(),
  });
  saveStaticDb(dbState);
  return { ok: true };
}

export function submitStaticReview(
  token: string,
  productId: number,
  payload: { rating: number; title: string; comment: string }
) {
  const dbState = loadStaticDb();
  const customer = getCustomerByToken(token);
  const prod = dbState.products.find((p) => p.id === productId);
  if (!prod) throw new Error('Product not found.');

  const review: Review = {
    id: Date.now(),
    productId,
    userId: customer?.id || 0,
    authorName: customer?.name || 'Verified Customer',
    rating: payload.rating,
    title: payload.title,
    comment: payload.comment,
    isVerifiedPurchase: true,
    createdAt: new Date().toISOString(),
  };
  dbState.reviews.unshift(review);
  const prodReviews = dbState.reviews.filter((r) => r.productId === productId);
  const avg = (prodReviews.reduce((s, r) => s + r.rating, 0) / prodReviews.length).toFixed(1);
  prod.ratingAvg = avg;
  prod.ratingCount = prodReviews.length;
  saveStaticDb(dbState);
  return { review, ratingAvg: avg, ratingCount: prodReviews.length };
}

// ---------- Static Admin Console Operations ----------

export function verifyStaticAdminLogin(password: string) {
  if (password.trim() !== UNIVERSAL_ACCESS_PASSWORD) {
    throw new Error('Invalid admin password.');
  }
  return {
    token: 'static_admin_token',
    admin: {
      id: 0,
      email: 'admin@aagamanmart.in',
      name: 'Store Administrator',
      role: 'super_admin',
    },
  };
}

export function getStaticAdminDashboard() {
  const dbState = loadStaticDb();
  const allOrders = dbState.orders;
  const allProducts = dbState.products;
  const totalRevenue = allOrders
    .filter((o) => o.status !== 'Cancelled' && o.status !== 'Payment Failed')
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const pendingOrders = allOrders.filter((o) =>
    ['Order Placed', 'Payment Pending', 'Payment Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery'].includes(
      o.status
    )
  ).length;
  const deliveredOrders = allOrders.filter((o) => o.status === 'Delivered').length;
  const cancelledOrders = allOrders.filter((o) => o.status === 'Cancelled').length;

  const dailyMap = new Map<string, { day: string; revenue: number; orders: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
    dailyMap.set(key, { day: label, revenue: 0, orders: 0 });
  }
  for (const o of allOrders) {
    if (o.status === 'Cancelled' || o.status === 'Payment Failed') continue;
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    const entry = dailyMap.get(key);
    if (entry) {
      entry.revenue += o.grandTotal;
      entry.orders += 1;
    }
  }

  return {
    kpis: {
      totalRevenue,
      totalOrders: allOrders.length,
      totalCustomers: dbState.customers.length,
      totalProducts: allProducts.length,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      totalUnitsSold: allProducts.reduce((s, p) => s + p.soldCount, 0),
    },
    lowStockProducts: allProducts
      .filter((p) => p.stock <= p.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8),
    bestSellingProducts: [...allProducts].sort((a, b) => b.soldCount - a.soldCount).slice(0, 6),
    recentOrders: allOrders.slice(0, 8),
    salesChart: Array.from(dailyMap.values()),
  };
}

export function getStaticAdminProducts() {
  const dbState = loadStaticDb();
  const catMap = new Map(dbState.categories.map((c) => [c.id, c.name]));
  return dbState.products
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((p) => ({
      ...p,
      categoryName: catMap.get(p.categoryId) || '',
    }));
}

export function createStaticAdminProduct(payload: {
  sku: string;
  name: string;
  brand: string;
  categoryId: number;
  description: string;
  mrp: number;
  sellingPrice: number;
  stock: number;
  gstPercent: number;
  imageUrls: string[];
}) {
  const dbState = loadStaticDb();
  const id = (dbState.products.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1;
  const slug = `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id}`;
  const discountPercent = Math.max(0, Math.round(((payload.mrp - payload.sellingPrice) / payload.mrp) * 100));
  const cat = dbState.categories.find((c) => c.id === payload.categoryId) || null;
  const product: Product = {
    id,
    sku: payload.sku.trim(),
    name: payload.name.trim(),
    slug,
    description: payload.description.trim(),
    brand: payload.brand.trim(),
    categoryId: payload.categoryId,
    subcategoryId: null,
    category: cat,
    mrp: payload.mrp,
    sellingPrice: payload.sellingPrice,
    discountPercent,
    stock: payload.stock,
    lowStockThreshold: 5,
    gstPercent: payload.gstPercent,
    specifications: {},
    returnPolicy: '7 Days Easy Return & Replacement',
    ratingAvg: '5.0',
    ratingCount: 0,
    soldCount: 0,
    isFeatured: false,
    isTrending: false,
    isBestSeller: false,
    isNewArrival: true,
    isDealOfDay: false,
    isActive: true,
    images: payload.imageUrls.map((url, idx) => ({
      id: Date.now() + idx,
      productId: id,
      imageUrl: url,
      altText: payload.name,
      displayOrder: idx,
      isPrimary: idx === 0,
    })),
    variants: [],
  };
  dbState.products.unshift(product);
  saveStaticDb(dbState);
  return { product };
}

export function updateStaticAdminProduct(
  productId: number,
  patch: Partial<{
    sku: string;
    name: string;
    brand: string;
    categoryId: number;
    description: string;
    mrp: number;
    sellingPrice: number;
    stock: number;
    gstPercent: number;
    returnPolicy: string;
    isActive: boolean;
    isFeatured: boolean;
    isTrending: boolean;
    isBestSeller: boolean;
    isNewArrival: boolean;
    isDealOfDay: boolean;
    imageUrls: string[];
  }>
) {
  const dbState = loadStaticDb();
  const idx = dbState.products.findIndex((p) => p.id === productId);
  if (idx < 0) throw new Error('Product not found.');
  const current = dbState.products[idx];
  const mrp = patch.mrp ?? current.mrp;
  const sellingPrice = patch.sellingPrice ?? current.sellingPrice;
  const discountPercent = Math.max(0, Math.round(((mrp - sellingPrice) / mrp) * 100));
  const category = patch.categoryId
    ? dbState.categories.find((c) => c.id === patch.categoryId) || current.category
    : current.category;

  const updated: Product = {
    ...current,
    ...patch,
    mrp,
    sellingPrice,
    discountPercent,
    category,
    images: patch.imageUrls
      ? patch.imageUrls.map((url, i) => ({
          id: Date.now() + i,
          productId: current.id,
          imageUrl: url,
          altText: patch.name || current.name,
          displayOrder: i,
          isPrimary: i === 0,
        }))
      : current.images,
  };
  dbState.products[idx] = updated;
  saveStaticDb(dbState);
  return { product: updated };
}

export function getStaticAdminCategories() {
  return getStaticCategories().map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    isActive: true,
    subcategories: c.subcategories || [],
  }));
}

export function createStaticAdminCategory(name: string, description: string) {
  const dbState = loadStaticDb();
  const id = (dbState.categories.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id}`;
  dbState.categories.push({
    id,
    name: name.trim(),
    slug,
    description: description.trim(),
    imageUrl: IMG.heroElectronics,
    displayOrder: id,
    productCount: 0,
    subcategories: [],
  });
  saveStaticDb(dbState);
}

export function deleteStaticAdminCategory(categoryId: number) {
  const dbState = loadStaticDb();
  dbState.categories = dbState.categories.filter((c) => c.id !== categoryId);
  saveStaticDb(dbState);
}

export function createStaticAdminSubcategory(categoryId: number, name: string) {
  const dbState = loadStaticDb();
  const cat = dbState.categories.find((c) => c.id === categoryId);
  if (cat) {
    const sub: Subcategory = {
      id: Date.now(),
      categoryId,
      name: name.trim(),
      slug: `${cat.slug}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      description: '',
    };
    cat.subcategories = [...(cat.subcategories || []), sub];
    saveStaticDb(dbState);
  }
}

export function getStaticAdminOrders() {
  const dbState = loadStaticDb();
  return { orders: dbState.orders, returns: dbState.returns };
}

export function updateStaticAdminOrderStatus(orderId: number, status: string) {
  const dbState = loadStaticDb();
  const order = dbState.orders.find((o) => o.id === orderId);
  if (order) {
    order.status = status;
    if (order.shipping) {
      order.shipping.status = status;
      order.shipping.trackingHistory.push({
        status,
        location: 'Aagaman Dispatch Center',
        timestamp: new Date().toISOString(),
        note: `Order status updated to ${status}`,
      });
    }
    saveStaticDb(dbState);
  }
}

export function processStaticAdminReturn(returnId: number, status: string, issueRefund: boolean) {
  const dbState = loadStaticDb();
  const ret = dbState.returns.find((r) => r.id === returnId);
  if (ret) {
    ret.status = status;
    const ord = dbState.orders.find((o) => o.id === ret.orderId);
    if (ord) ord.status = issueRefund ? 'Refunded' : status;
    saveStaticDb(dbState);
  }
}

export function getStaticAdminCustomers() {
  const dbState = loadStaticDb();
  return dbState.customers
    .slice()
    .reverse()
    .map((c) => {
      const custOrders = dbState.orders.filter((o) => dbState.orderUserMap[o.id] === c.id);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        photoUrl: c.photoUrl || '',
        authMethod: c.authMethod || (c.uid?.startsWith('static_uid_') ? 'email' : 'google'),
        emailVerified: Boolean(c.emailVerified),
        phoneVerified: Boolean(c.phoneVerified),
        isBlocked: c.isBlocked,
        createdAt: c.createdAt || null,
        lastLoginAt: c.lastLoginAt || c.createdAt || null,
        addresses: c.addresses || [],
        wishlistCount: (c.wishlistIds || []).length,
        orderCount: custOrders.length,
        totalSpent: custOrders.reduce((s, o) => s + o.grandTotal, 0),
        recentOrders: custOrders.slice(0, 10).map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          grandTotal: o.grandTotal,
          createdAt: o.createdAt,
        })),
      };
    });
}

export function toggleStaticAdminCustomerBlock(customerId: number, isBlocked: boolean) {
  const dbState = loadStaticDb();
  const c = dbState.customers.find((u) => u.id === customerId);
  if (c) {
    c.isBlocked = isBlocked;
    saveStaticDb(dbState);
  }
}

export function getStaticAdminPayments() {
  return loadStaticDb().payments;
}

export function markStaticAdminCodCollected(paymentId: number) {
  const dbState = loadStaticDb();
  const p = dbState.payments.find((pay) => pay.id === paymentId);
  if (p) {
    p.status = 'collected';
    const ord = dbState.orders.find((o) => o.id === p.orderId);
    if (ord) ord.paymentStatus = 'paid';
    saveStaticDb(dbState);
  }
}

export function getStaticAdminCoupons() {
  return loadStaticDb().coupons;
}

export function createStaticAdminCoupon(payload: {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'free_shipping';
  discountValue: number;
  minOrderValue: number;
  maxDiscountLimit: number;
}) {
  const dbState = loadStaticDb();
  const id = (dbState.coupons.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
  dbState.coupons.unshift({
    id,
    code: payload.code.trim().toUpperCase(),
    description: payload.description.trim(),
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    minOrderValue: payload.minOrderValue,
    maxDiscountLimit: payload.maxDiscountLimit,
    categoryId: null,
    productId: null,
    firstOrderOnly: false,
    usedCount: 0,
    usageLimit: 5000,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    isActive: true,
  });
  saveStaticDb(dbState);
}

export function toggleStaticAdminCoupon(couponId: number, isActive: boolean) {
  const dbState = loadStaticDb();
  const c = dbState.coupons.find((cp) => cp.id === couponId);
  if (c) {
    c.isActive = isActive;
    saveStaticDb(dbState);
  }
}

export function deleteStaticAdminCoupon(couponId: number) {
  const dbState = loadStaticDb();
  dbState.coupons = dbState.coupons.filter((cp) => cp.id !== couponId);
  saveStaticDb(dbState);
}

export function getStaticAdminSettings(): StoreConfig {
  return loadStaticDb().config;
}

export function updateStaticAdminSettings(config: StoreConfig, adminToken = 'static_admin_token'): Promise<void> {
  const dbState = loadStaticDb();
  dbState.config = config;
  saveStaticDb(dbState);
  return syncStaticConfigToServer(adminToken, config);
}

export function getStaticAdminTickets(): StaticTicketRecord[] {
  return loadStaticDb().tickets;
}

export function updateStaticAdminTicketStatus(ticketId: number, status: string) {
  const dbState = loadStaticDb();
  const t = dbState.tickets.find((tk) => tk.id === ticketId);
  if (t) {
    t.status = status;
    saveStaticDb(dbState);
  }
}
