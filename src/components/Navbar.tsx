import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Heart,
  Loader2,
  MapPin,
  Menu,
  Search,
  ShoppingCart,
  Truck,
  User,
  X,
  ArrowRightLeft,
} from 'lucide-react';
import { formatINR, useStore } from '../context/StoreContext';
import type { PincodeCheckResult } from '../lib/pincode';
import {
  checkAuthenticPincode,
  isJsonApiResponse,
  queryStaticProducts,
  resolveAssetUrl,
} from '../lib/static-store';
import type { Product } from '../types';

export const Navbar: React.FC = () => {
  const {
    config,
    categories,
    navigate,
    route,
    user,
    cartCount,
    wishlistIds,
    compareProducts,
    recentSearches,
    addRecentSearch,
    setIsCartOpen,
    setIsAuthModalOpen,
    setIsCompareOpen,
  } = useStore();

  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pincodeModalOpen, setPincodeModalOpen] = useState(false);
  const [pincodeInput, setPincodeInput] = useState('400051');
  const [pincodeChecking, setPincodeChecking] = useState(false);
  const [pincodeInfo, setPincodeInfo] = useState<Extract<PincodeCheckResult, { serviceable: true }> | null>(null);
  const [pincodeError, setPincodeError] = useState('');
  const [pincodeNoMatch, setPincodeNoMatch] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=5`);
        if (isJsonApiResponse(res)) {
          const json = await res.json();
          setSuggestions(json.products || []);
          return;
        }
      } catch {
        // fall back to static search below
      }
      setSuggestions(queryStaticProducts({ q, limit: 5 }).products);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) addRecentSearch(q);
    setSearchFocused(false);
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  };

  const checkPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPincodeError('');
    setPincodeNoMatch(false);
    setPincodeChecking(true);
    try {
      const result = await checkAuthenticPincode(pincodeInput.trim(), config, 'Standard Delivery', false);
      if (!result.serviceable) {
        setPincodeError(result.error);
        setPincodeNoMatch(Boolean(result.noMatch));
        setPincodeInfo(null);
      } else {
        setPincodeInfo(result);
      }
    } finally {
      setPincodeChecking(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-x-clip bg-[#0B1F3A] text-white shadow-sm">
      {/* Slim Dismissible Announcement Bar */}
      {(() => {
        const announcementMsg =
          config?.announcementText !== undefined
            ? config.announcementText.trim()
            : 'Grand Aagaman Sale Live — Free Shipping above ₹999 · Use code AAGAMAN10 for 10% off';
        const isEnabled = config?.announcementEnabled !== false && Boolean(announcementMsg);
        if (!showAnnouncement || !isEnabled) return null;
        return (
          <div className="bg-[#EA580C] text-white text-xs font-medium px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 w-full overflow-hidden">
            <div className="hidden sm:block w-6 shrink-0" />
            <p className="min-w-0 flex-1 truncate text-center">{announcementMsg}</p>
            <button
              onClick={() => setShowAnnouncement(false)}
              aria-label="Dismiss announcement"
              className="p-0.5 hover:bg-white/20 rounded transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}

      {/* Main Header Row */}
      <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 min-w-0">
        {/* Left: Brand Wordmark + Mobile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="lg:hidden p-1.5 sm:p-2 -ml-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="font-display text-base sm:text-xl lg:text-2xl font-bold tracking-tight text-white whitespace-nowrap min-w-0 flex items-center gap-1.5 sm:gap-2"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#EA580C] text-white font-extrabold text-xs sm:text-sm shrink-0">
              AM
            </span>
            <span className="truncate">AAGAMAN MART</span>
          </a>
        </div>

        {/* Center: Search Bar with Autocomplete & Recent Searches */}
        <div ref={searchContainerRef} className="hidden md:block relative flex-1 max-w-2xl">
          <form onSubmit={handleSearchSubmit} className="flex items-center w-full">
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groceries, electronics, fashion, appliances, brands..."
              className="w-full h-10 pl-4 pr-12 rounded-lg bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
            />
            <button
              type="submit"
              aria-label="Search products"
              className="absolute right-1 top-1 h-8 px-3 rounded-md bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {searchFocused && (suggestions.length > 0 || recentSearches.length > 0) && (
            <div className="absolute left-0 right-0 top-11 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400">
                    Product Suggestions
                  </div>
                  {suggestions.map((p) => {
                    const img = p.images?.find((i) => i.isPrimary)?.imageUrl || p.images?.[0]?.imageUrl;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          addRecentSearch(p.name);
                          navigate(`/product/${p.slug}`);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                      >
                        {img && (
                          <img
                            src={resolveAssetUrl(img)}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded object-cover bg-slate-100 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                          <p className="text-xs text-slate-500">
                            {p.brand} · {p.category?.name}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                          {formatINR(p.sellingPrice)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {recentSearches.length > 0 && (
                <div className="border-t border-slate-100 p-2 bg-slate-50/70">
                  <div className="px-3 py-1 text-xs font-semibold text-slate-400">Recent Searches</div>
                  <div className="flex flex-wrap gap-1.5 px-3 py-1.5">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setSearchQuery(term);
                          setSearchFocused(false);
                          navigate(`/shop?q=${encodeURIComponent(term)}`);
                        }}
                        className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700 hover:border-[#EA580C] hover:text-[#EA580C] transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions (Pincode, Compare, Account, Wishlist, Cart) */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setPincodeModalOpen(true)}
            className="hidden xl:flex items-center gap-1.5 text-xs text-slate-200 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4 text-[#F97316]" />
            <span>
              {pincodeInfo
                ? `${pincodeInfo.pincode} · ${pincodeInfo.city || pincodeInfo.region}`
                : 'Deliver to India'}
            </span>
          </button>

          {compareProducts.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Compare ({compareProducts.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (user ? navigate('/account') : setIsAuthModalOpen(true))}
            aria-label={user ? 'Account' : 'Sign In'}
            className="flex items-center gap-1.5 sm:gap-2 p-2 sm:px-3 sm:py-2 rounded-lg hover:bg-white/10 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <User className="w-4 h-4 text-[#F97316]" />
            <span className="hidden sm:inline max-w-[110px] truncate">
              {user ? user.name.split(' ')[0] : 'Sign In'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => (user ? navigate('/account?tab=wishlist') : setIsAuthModalOpen(true))}
            aria-label="Wishlist"
            className="relative p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <Heart className="w-5 h-5" />
            {wishlistIds.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EA580C] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {wishlistIds.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label="Shopping Cart"
            className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Cart</span>
            <span className="min-w-[20px] h-5 px-1.5 rounded bg-[#0B1F3A] text-white text-xs font-mono font-bold flex items-center justify-center tabular-nums">
              {cartCount}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="md:hidden px-3 sm:px-4 pb-3 w-full">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands..."
            className="w-full min-w-0 h-10 pl-3.5 pr-11 rounded-lg bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-1 top-1 h-8 px-3 rounded-md bg-[#EA580C] text-white"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Clean Secondary Category & Navigation Strip */}
      <nav className="bg-[#102A43] border-t border-white/10 w-full overflow-hidden">
        <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-4 lg:px-8 h-10 flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar text-xs font-medium text-slate-200">
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className={`whitespace-nowrap shrink-0 hover:text-white transition-colors py-1 border-b-2 ${
              route === '/shop' ? 'border-[#EA580C] text-white' : 'border-transparent'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/category/${cat.slug}`)}
              className={`whitespace-nowrap shrink-0 hover:text-white transition-colors py-1 border-b-2 ${
                route === `/category/${cat.slug}` ? 'border-[#EA580C] text-white' : 'border-transparent'
              }`}
            >
              {cat.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="whitespace-nowrap shrink-0 hover:text-white transition-colors py-1 border-b-2 border-transparent ml-auto"
          >
            Support
          </button>
        </div>
      </nav>

      {/* Mobile Slide-down Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0B1F3A] border-t border-white/10 px-4 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/');
              }}
              className="text-left px-3 py-2 rounded-lg bg-white/5 text-sm font-medium"
            >
              Home
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/shop');
              }}
              className="text-left px-3 py-2 rounded-lg bg-white/5 text-sm font-medium"
            >
              All Products
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/account');
              }}
              className="text-left px-3 py-2 rounded-lg bg-white/5 text-sm font-medium"
            >
              My Account & Orders
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/support');
              }}
              className="text-left px-3 py-2 rounded-lg bg-white/5 text-sm font-medium"
            >
              Support
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setPincodeModalOpen(true);
              }}
              className="col-span-2 text-left px-3 py-2 rounded-lg bg-white/5 text-sm font-medium flex items-center gap-2"
            >
              <MapPin className="w-4 h-4 text-[#F97316]" />
              <span>
                {pincodeInfo
                  ? `Deliver to ${pincodeInfo.pincode} (${pincodeInfo.city})`
                  : 'Check Delivery Pincode'}
              </span>
            </button>
          </div>
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs font-semibold text-slate-400 mb-2">Shop Categories</p>
            <div className="grid grid-cols-2 gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(`/category/${cat.slug}`);
                  }}
                  className="text-left px-2.5 py-1.5 rounded text-xs text-slate-200 hover:bg-white/10 truncate"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pincode Serviceability Quick Modal */}
      {pincodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                Check Delivery & Pincode Serviceability
              </h3>
              <button
                onClick={() => setPincodeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={checkPincode} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pincodeInput}
                onChange={(e) => {
                  setPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setPincodeError('');
                  setPincodeNoMatch(false);
                }}
                placeholder="Enter 6-digit Indian pincode"
                className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
              />
              <button
                type="submit"
                disabled={pincodeChecking}
                className="px-4 h-10 rounded-lg bg-[#0B1F3A] hover:bg-[#102A43] text-white text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 disabled:opacity-60"
              >
                {pincodeChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{pincodeChecking ? 'Checking' : 'Check'}</span>
              </button>
            </form>
            {pincodeError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  {pincodeNoMatch && (
                    <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide">
                      No Match
                    </span>
                  )}
                  <span className="font-medium">{pincodeError}</span>
                </div>
              </div>
            )}
            {pincodeInfo && (
              <div className="mt-4 p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-sm space-y-1.5">
                <p className="font-semibold text-[#0B1F3A] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#EA580C] shrink-0" />
                  <span>Deliverable to {pincodeInfo.pincode}</span>
                </p>
                <p className="text-slate-800 text-xs font-medium">
                  Location: <span className="font-bold text-[#0B1F3A]">{pincodeInfo.region}</span>
                </p>
                <p className="text-slate-600 text-xs">
                  Courier: {pincodeInfo.courierPartner} ·{' '}
                  {pincodeInfo.codAvailable ? 'Cash on Delivery Available' : 'Prepaid Only'}
                </p>
                <p className="text-emerald-800 font-semibold text-xs flex items-center gap-1.5 pt-0.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>
                    Estimated Delivery by {pincodeInfo.estimatedDelivery} (
                    {pincodeInfo.estimatedDays === 0
                      ? 'Same Day'
                      : `${pincodeInfo.estimatedDays} day${pincodeInfo.estimatedDays > 1 ? 's' : ''}`}
                    )
                  </span>
                </p>
                {pincodeInfo.cutoffNote && (
                  <p className="text-[11px] text-slate-500">{pincodeInfo.cutoffNote}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
