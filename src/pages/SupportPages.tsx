import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Mail, MapPin, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { fetchMyFirestoreSupportTickets, syncSupportTicketToFirestore } from '../lib/firestore-sync';
import {
  getStaticCustomerTickets,
  hasJsonContentType,
  submitStaticSupportTicket,
  type StaticTicketRecord,
  type StaticTicketReply,
} from '../lib/static-store';

const MY_TICKETS_ACCESS_STORAGE = 'aagaman_my_support_tickets_v1';
const DEVICE_KEYS_STORAGE = 'aagaman_email_device_keys_v1';

interface SavedTicketAccess {
  ticketId: string;
  accessKey: string;
}

function getSavedTicketAccesses(): SavedTicketAccess[] {
  try {
    const raw = window.localStorage.getItem(MY_TICKETS_ACCESS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x) => x && typeof x.ticketId === 'string' && typeof x.accessKey === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveTicketAccess(ticketId?: string, accessKey?: string) {
  if (!ticketId || !accessKey) return;
  try {
    const list = getSavedTicketAccesses().filter((x) => x.ticketId !== ticketId);
    list.unshift({ ticketId, accessKey });
    window.localStorage.setItem(MY_TICKETS_ACCESS_STORAGE, JSON.stringify(list.slice(0, 30)));
  } catch {
    // ignore storage errors
  }
}

function getStoredEmailDeviceKey(email?: string): string {
  if (!email) return '';
  try {
    const raw = window.localStorage.getItem(DEVICE_KEYS_STORAGE);
    if (!raw) return '';
    const map = JSON.parse(raw) as Record<string, string>;
    return map[email.trim().toLowerCase()] || '';
  } catch {
    return '';
  }
}

export const SupportPage: React.FC = () => {
  const { config, authToken, user, notify } = useStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myTickets, setMyTickets] = useState<StaticTicketRecord[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState<{
    message: string;
    routedToEmail: string;
    emailStatus?: string;
  } | null>(null);

  const loadMyTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const accesses = getSavedTicketAccesses();
      const targetEmail = (user?.email || email || '').trim().toLowerCase();
      const deviceKey = user?.email ? getStoredEmailDeviceKey(user.email) : '';

      const merged = new Map<string, StaticTicketRecord>();
      const mergeReplies = (a?: StaticTicketReply[], b?: StaticTicketReply[]): StaticTicketReply[] => {
        const rMap = new Map<string, StaticTicketReply>();
        for (const r of [...(a || []), ...(b || [])]) {
          if (r?.replyId) rMap.set(r.replyId, r);
        }
        return Array.from(rMap.values()).sort(
          (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
        );
      };
      const addTicket = (t: Partial<StaticTicketRecord> & { subject: string; message: string; email: string; createdAt: string }) => {
        const key = t.ticketId || `${t.email.toLowerCase()}|${t.subject.trim()}|${t.message.slice(0, 40)}`;
        const prev = merged.get(key);
        const normalized: StaticTicketRecord = {
          id: Number(t.id || prev?.id || 0),
          ticketId: t.ticketId || prev?.ticketId,
          name: t.name || prev?.name || 'Customer',
          email: t.email || prev?.email || '',
          phone: t.phone || prev?.phone || '',
          subject: t.subject,
          message: t.message,
          status: t.status || prev?.status || 'Open',
          routedToEmail: t.routedToEmail || prev?.routedToEmail,
          emailStatus: t.emailStatus || prev?.emailStatus,
          replies: mergeReplies(prev?.replies, t.replies),
          createdAt: t.createdAt || prev?.createdAt || new Date().toISOString(),
        };
        merged.set(key, normalized);
      };

      const savedIds = accesses.map((a) => a.ticketId);
      for (const localTk of getStaticCustomerTickets(targetEmail, savedIds)) {
        addTicket(localTk);
      }

      if (accesses.length > 0 || (user?.email && deviceKey)) {
        const rtRes = await fetch('/api/runtime/support/my-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketAccesses: accesses,
            email: user?.email || undefined,
            deviceKey: deviceKey || undefined,
          }),
        }).catch(() => null);
        if (rtRes && hasJsonContentType(rtRes) && rtRes.ok) {
          const rtJson = await rtRes.json();
          if (Array.isArray(rtJson.tickets)) {
            for (const rtTk of rtJson.tickets) addTicket(rtTk);
          }
        }
      }

      const fsTickets = await fetchMyFirestoreSupportTickets().catch(() => []);
      for (const ft of fsTickets) {
        addTicket(ft);
      }

      setMyTickets(
        Array.from(merged.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
    } finally {
      setLoadingTickets(false);
    }
  }, [email, user?.email]);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || '');
      setEmail((prev) => prev || user.email || '');
      setPhone((prev) => prev || user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    void loadMyTickets();
  }, [loadMyTickets]);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ticketRef = `TKT-${Date.now().toString(36).toUpperCase()}`;

    try {
      // 1. Primary PostgreSQL endpoint when database is connected
      try {
        const res = await fetch('/api/support', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ name, email, phone, subject, message }),
        });
        if (hasJsonContentType(res) && res.status < 500) {
          const json = await res.json();
          if (!res.ok) {
            notify(json.error || 'Unable to submit ticket', 'error');
          } else {
            const routed = json.routedToEmail || config?.supportEmail || 'support@aagamanmart.in';
            await syncSupportTicketToFirestore({
              ticketId: String(json.ticketId || ticketRef),
              name,
              email,
              phone,
              subject,
              message,
              routedToEmail: routed,
              emailStatus: json.emailStatus || 'pending_smtp',
            }).catch(() => {});
            setSubmittedInfo({
              message: json.message,
              routedToEmail: routed,
              emailStatus: json.emailStatus,
            });
            setSubject('');
            setMessage('');
            notify('Support ticket received!', 'success');
          }
          return;
        }
      } catch {
        // Fall through to runtime endpoint
      }

      // 2. Always-on Express runtime endpoint (persists to server store across devices + dispatches live email)
      try {
        const rtRes = await fetch('/api/runtime/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: ticketRef,
            name,
            email,
            phone,
            subject,
            message,
            clientSupportEmail: config?.supportEmail || undefined,
          }),
        });
        if (hasJsonContentType(rtRes) && rtRes.status < 500) {
          const rtJson = await rtRes.json();
          if (!rtRes.ok) {
            notify(rtJson.error || 'Unable to submit ticket', 'error');
            return;
          }
          const routed = rtJson.routedToEmail || config?.supportEmail || 'utkarshjaiswar137@gmail.com';
          const savedRef = rtJson.ticket?.ticketId || ticketRef;
          saveTicketAccess(savedRef, rtJson.accessKey);
          submitStaticSupportTicket({
            id: rtJson.ticketId,
            ticketId: savedRef,
            name,
            email,
            phone,
            subject,
            message,
            routedToEmail: routed,
            emailStatus: rtJson.emailStatus || 'pending_smtp',
          });
          await syncSupportTicketToFirestore({
            ticketId: savedRef,
            name,
            email,
            phone,
            subject,
            message,
            routedToEmail: routed,
            emailStatus: rtJson.emailStatus || 'pending_smtp',
          }).catch(() => {});
          setSubmittedInfo({
            message: rtJson.message,
            routedToEmail: routed,
            emailStatus: rtJson.emailStatus,
          });
          setSubject('');
          setMessage('');
          void loadMyTickets();
          notify('Support ticket sent to Admin Support Channel!', 'success');
          return;
        }
      } catch {
        // Fall through to browser-only static storage if server is unreachable
      }

      const local = submitStaticSupportTicket({
        ticketId: ticketRef,
        name,
        email,
        phone,
        subject,
        message,
        routedToEmail: config?.supportEmail || 'utkarshjaiswar137@gmail.com',
      });
      await syncSupportTicketToFirestore({
        ticketId: ticketRef,
        name,
        email,
        phone,
        subject,
        message,
        routedToEmail: local.routedToEmail,
        emailStatus: 'pending_smtp',
      }).catch(() => {});
      setSubmittedInfo({
        message: local.message,
        routedToEmail: local.routedToEmail,
        emailStatus: 'pending_smtp',
      });
      setSubject('');
      setMessage('');
      void loadMyTickets();
      notify('Support ticket received!', 'success');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-5xl w-full min-w-0 mx-auto px-4 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
      <div className="bg-[#0B1F3A] text-white rounded-2xl p-6 sm:p-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Contact AAGAMAN MART Support</h1>
        <p className="text-sm text-slate-300 mt-1">
          Dedicated assistance for orders, GST invoices, returns, and corporate procurement.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-6 sm:gap-8">
        <div className="md:col-span-5 min-w-0 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-sm">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Reach Us Directly</h2>
            <p className="flex items-center gap-2.5 text-slate-700">
              <Phone className="w-4 h-4 text-[#EA580C] shrink-0" />
              <span>{config?.supportPhone || '+91 1800-202-4499'}</span>
            </p>
            <p className="flex items-center gap-2.5 text-slate-700 break-all">
              <Mail className="w-4 h-4 text-[#EA580C] shrink-0" />
              <span>{config?.supportEmail || 'support@aagamanmart.in'}</span>
            </p>
            <p className="flex items-start gap-2.5 text-slate-700">
              <MapPin className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
              <span className="break-words">{config?.headquarters || 'Bandra Kurla Complex, Mumbai 400051'}</span>
            </p>
          </div>
        </div>

        <form onSubmit={submitTicket} className="md:col-span-7 min-w-0 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Submit a Support Ticket</h2>
            <span className="text-[11px] text-slate-500">
              Routes to <strong className="text-[#0B1F3A]">{config?.supportEmail || 'support@aagamanmart.in'}</strong>
            </span>
          </div>
          {submittedInfo && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {submittedInfo.message}
              </p>
              <p className="text-emerald-700">
                Support Desk Email: <strong className="font-mono">{submittedInfo.routedToEmail}</strong>
              </p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm w-full min-w-0"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm w-full min-w-0"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile Number (Optional)"
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm w-full min-w-0"
            />
            <input
              required
              minLength={2}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject / Order Number"
              className="h-10 px-3 rounded-lg border border-slate-300 text-sm w-full min-w-0"
            />
          </div>
          <textarea
            required
            minLength={3}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can our support team assist you?"
            className="w-full p-3 rounded-lg border border-slate-300 text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-6 h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? 'Submitting Ticket...' : 'Submit Ticket'}
          </button>
        </form>
      </div>

      {/* Live Customer Support Tickets & Admin Replies */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#EA580C]" /> Your Support Queries &amp; Admin Replies ({myTickets.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track your ticket status and read replies from our support team right here (as well as in your email).
            </p>
          </div>
          <button
            type="button"
            disabled={loadingTickets}
            onClick={() => void loadMyTickets()}
            className="px-3.5 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0B1F3A] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin' : ''}`} />
            {loadingTickets ? 'Refreshing...' : 'Refresh Replies'}
          </button>
        </div>

        {myTickets.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-6 text-center text-xs text-slate-500">
            No support tickets submitted on this account/device yet. Submit a query above and Admin replies will appear here automatically.
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map((tk) => (
              <div key={tk.ticketId || `${tk.id}-${tk.createdAt}`} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {tk.ticketId && (
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200/70 text-[#0B1F3A]">
                        {tk.ticketId}
                      </span>
                    )}
                    <h3 className="font-display text-sm font-bold text-[#0B1F3A]">{tk.subject}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-semibold ${
                        tk.status === 'Resolved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tk.status === 'In Progress'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {tk.status}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(tk.createdAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white border border-slate-200/80 rounded-lg p-3">
                  {tk.message}
                </p>

                {tk.replies && tk.replies.length > 0 ? (
                  <div className="space-y-2 pl-3 border-l-2 border-[#EA580C]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#EA580C]">
                      Support Team Replies ({tk.replies.length})
                    </p>
                    {tk.replies.map((r) => (
                      <div key={r.replyId} className="bg-orange-50/70 border border-orange-200 rounded-lg p-3 space-y-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-[#0B1F3A]">{r.senderName || 'AAGAMAN MART Support'}</span>
                          <span className="text-slate-400">{new Date(r.createdAt).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Awaiting reply from our support team...
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export const FaqPage: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const faqs = [
    {
      q: 'What payment methods are accepted on AAGAMAN MART?',
      a: 'We accept UPI (Google Pay, PhonePe, Paytm, BHIM), Credit & Debit Cards (Visa, Mastercard, RuPay), Net Banking across major Indian banks, Wallets, and Cash on Delivery (COD) for eligible pincodes.',
    },
    {
      q: 'How fast is delivery and how do I track my shipment?',
      a: 'Standard pan-India delivery takes 2–4 business days (Free above ₹999). Express Air Priority delivers next business day in metro cities. Every order receives a live courier tracking number in My Orders.',
    },
    {
      q: 'How do returns, replacements, and refunds work?',
      a: 'Eligible items can be returned or replaced within 7 to 14 days from delivery directly in My Orders. Approved refunds for prepaid orders are credited back to your original UPI/card source within 3–5 business days.',
    },
    {
      q: 'Do I receive a GST Tax Invoice?',
      a: 'Yes. Every order generates a downloadable GST Tax Invoice accessible immediately from the order confirmation screen and your Account Order History.',
    },
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="font-display text-3xl font-bold text-[#0B1F3A]">Frequently Asked Questions</h1>
      <div className="space-y-3">
        {faqs.map((item, idx) => (
          <div key={item.q} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full px-5 py-4 flex items-center justify-between text-left font-semibold text-sm text-[#0B1F3A]"
            >
              <span>{item.q}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${openIdx === idx ? 'rotate-180' : ''}`} />
            </button>
            {openIdx === idx && <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{item.a}</p>}
          </div>
        ))}
      </div>
    </main>
  );
};

export const PolicyPage: React.FC<{ type: string }> = ({ type }) => {
  const titles: Record<string, { title: string; body: string[] }> = {
    returns: {
      title: 'Return & Refund Policy',
      body: [
        'AAGAMAN MART offers a transparent 7 to 14 day return and replacement window depending on product category. Items must be unused, in original packaging, and accompanied by tags or serial numbers.',
        'For damaged, defective, or expired grocery deliveries, instant free replacement or full refund is initiated within 48 hours of delivery.',
        'Prepaid refunds are processed back to the original Razorpay payment source (UPI/Card/Bank) within 3–5 business days after pickup verification.',
      ],
    },
    shipping: {
      title: 'Shipping & Delivery Policy',
      body: [
        'Orders placed before 2:00 PM IST are dispatched the same business day from our regional fulfillment hubs in Mumbai, Bengaluru, and Delhi NCR.',
        'Standard Pan-India delivery is FREE on orders above ₹999 (₹49 flat below threshold). Express Air Priority shipping is available for ₹129.',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      body: [
        'AAGAMAN MART encrypts personal account information, delivery addresses, and order records using industry-standard transport and database security.',
        'We never store credit/debit card numbers, CVV codes, or UPI PINs. Online transactions are authenticated directly by PCI-DSS compliant Razorpay gateways.',
      ],
    },
    terms: {
      title: 'Terms & Conditions',
      body: [
        'All prices listed on AAGAMAN MART are in Indian Rupees (INR) and inclusive of applicable Goods & Services Tax (GST).',
        'Promotional coupon codes are subject to minimum order value, category eligibility, and expiry dates validated at checkout.',
      ],
    },
  };

  const doc = titles[type] || titles.terms;
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4">
        <h1 className="font-display text-3xl font-bold text-[#0B1F3A]">{doc.title}</h1>
        {doc.body.map((para, i) => (
          <p key={i} className="text-sm text-slate-700 leading-relaxed">
            {para}
          </p>
        ))}
      </div>
    </main>
  );
};
