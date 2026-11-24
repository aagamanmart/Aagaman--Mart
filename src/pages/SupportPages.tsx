import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Mail, MapPin, Phone } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { syncSupportTicketToFirestore } from '../lib/firestore-sync';
import { hasJsonContentType, submitStaticSupportTicket } from '../lib/static-store';

export const SupportPage: React.FC = () => {
  const { config, authToken, user, notify } = useStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState<{
    message: string;
    routedToEmail: string;
    emailStatus?: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || '');
      setEmail((prev) => prev || user.email || '');
      setPhone((prev) => prev || user.phone || '');
    }
  }, [user]);

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
          submitStaticSupportTicket({
            id: rtJson.ticketId,
            ticketId: rtJson.ticket?.ticketId || ticketRef,
            name,
            email,
            phone,
            subject,
            message,
            routedToEmail: routed,
            emailStatus: rtJson.emailStatus || 'pending_smtp',
          });
          await syncSupportTicketToFirestore({
            ticketId: rtJson.ticket?.ticketId || ticketRef,
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
