import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

export type SupportEmailDeliveryStatus = 'sent' | 'pending_smtp' | 'failed';

interface MailConfigStatus {
  configured: boolean;
  provider: 'resend' | 'smtp' | 'none';
}

interface FirestoreDocFields {
  fields?: {
    supportEmail?: { stringValue?: string };
  };
}

let cachedFirebaseCfg: { projectId?: string; firestoreDatabaseId?: string } | null = null;

function readFirebaseConfig(): { projectId?: string; firestoreDatabaseId?: string } {
  if (cachedFirebaseCfg) return cachedFirebaseCfg;
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      cachedFirebaseCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {
        projectId?: string;
        firestoreDatabaseId?: string;
      };
      return cachedFirebaseCfg;
    }
  } catch {
    // ignore missing config
  }
  return {};
}

function isValidEmail(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 200;
}

function stripHeaderBreaks(val: string): string {
  return val.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getResolvedSmtpConfig() {
  const user = process.env.SMTP_USER?.trim() || '';
  const rawPass = process.env.SMTP_PASS?.trim() || '';
  const explicitHost = process.env.SMTP_HOST?.trim() || '';
  const isGmailUser = /@(gmail|googlemail)\.com$/i.test(user);
  const host = explicitHost || (isGmailUser ? 'smtp.gmail.com' : '');
  const port = Number(process.env.SMTP_PORT) || (host === 'smtp.gmail.com' ? 465 : 587);
  // Google displays 16-char App Passwords in groups of 4 separated by spaces; strip spaces for Gmail SMTP.
  const pass = host === 'smtp.gmail.com' ? rawPass.replace(/\s+/g, '') : rawPass;
  return { host, port, user, pass };
}

export function getMailConfigStatus(): MailConfigStatus {
  if (process.env.RESEND_API_KEY?.trim()) {
    return { configured: true, provider: 'resend' };
  }
  const smtp = getResolvedSmtpConfig();
  if (smtp.host && smtp.user && smtp.pass) {
    return { configured: true, provider: 'smtp' };
  }
  return { configured: false, provider: 'none' };
}

export async function resolveLiveSupportEmail(options?: {
  pgSupportEmail?: unknown;
  runtimeSupportEmail?: unknown;
  fallbackSupportEmail?: unknown;
}): Promise<string> {
  if (isValidEmail(options?.pgSupportEmail)) {
    return options.pgSupportEmail.trim();
  }
  if (isValidEmail(options?.runtimeSupportEmail)) {
    return options.runtimeSupportEmail.trim();
  }

  // Fallback read from Firestore public storeConfig/main so Admin email updates persist across restarts
  try {
    const fb = readFirebaseConfig();
    if (fb.projectId && fb.firestoreDatabaseId) {
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        fb.projectId
      )}/databases/${encodeURIComponent(fb.firestoreDatabaseId)}/documents/storeConfig/main`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const doc = (await res.json()) as FirestoreDocFields;
        const fsEmail = doc.fields?.supportEmail?.stringValue;
        if (isValidEmail(fsEmail)) {
          return fsEmail.trim();
        }
      }
    }
  } catch {
    // Ignore transient Firestore lookup errors
  }

  if (isValidEmail(options?.fallbackSupportEmail)) {
    return options.fallbackSupportEmail.trim();
  }
  return 'utkarshjaiswar137@gmail.com';
}

export async function dispatchSupportTicketEmail(
  ticket: {
    ticketId: string | number;
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    createdAt: string;
  },
  targetSupportEmail: string
): Promise<{
  emailStatus: SupportEmailDeliveryStatus;
  provider: 'resend' | 'smtp' | 'none';
}> {
  const status = getMailConfigStatus();
  if (!status.configured) {
    return { emailStatus: 'pending_smtp', provider: 'none' };
  }

  const cleanTarget = stripHeaderBreaks(targetSupportEmail);
  const cleanCustomerEmail = stripHeaderBreaks(ticket.email);
  const cleanName = stripHeaderBreaks(ticket.name);
  const cleanPhone = stripHeaderBreaks(ticket.phone || 'Not provided');
  const cleanSubject = stripHeaderBreaks(ticket.subject);
  const mailSubject = `[AAGAMAN MART Support #${ticket.ticketId}] ${cleanSubject}`;

  const textBody = [
    `New Customer Support Query (#${ticket.ticketId})`,
    `--------------------------------------------------`,
    `Customer Name : ${cleanName}`,
    `Customer Email: ${cleanCustomerEmail}`,
    `Customer Phone: ${cleanPhone}`,
    `Subject       : ${cleanSubject}`,
    `Submitted At  : ${ticket.createdAt}`,
    `Routed To     : ${cleanTarget}`,
    ``,
    `Message:`,
    ticket.message,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #0B1F3A; color: #ffffff; padding: 18px 24px;">
        <h2 style="margin: 0; font-size: 18px;">AAGAMAN MART · Customer Support Query</h2>
        <p style="margin: 4px 0 0; font-size: 12px; color: #cbd5e1;">Ticket #${escapeHtml(String(ticket.ticketId))} · Routed to ${escapeHtml(cleanTarget)}</p>
      </div>
      <div style="padding: 20px 24px; color: #1e293b; font-size: 14px; line-height: 1.5;">
        <p style="margin: 0 0 8px;"><strong>Customer:</strong> ${escapeHtml(cleanName)} (${escapeHtml(cleanCustomerEmail)})</p>
        <p style="margin: 0 0 8px;"><strong>Phone:</strong> ${escapeHtml(cleanPhone)}</p>
        <p style="margin: 0 0 14px;"><strong>Subject:</strong> ${escapeHtml(cleanSubject)}</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; white-space: pre-wrap;">${escapeHtml(ticket.message)}</div>
        <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">Reply directly to this email to respond to ${escapeHtml(cleanCustomerEmail)}.</p>
      </div>
    </div>
  `;

  if (status.provider === 'resend') {
    try {
      const fromAddr =
        process.env.SMTP_FROM?.trim() || 'AAGAMAN MART Support <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [cleanTarget],
          reply_to: cleanCustomerEmail,
          subject: mailSubject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('Resend support email error:', res.status, errText);
        return { emailStatus: 'failed', provider: 'resend' };
      }
      return { emailStatus: 'sent', provider: 'resend' };
    } catch (error) {
      console.error('Resend dispatch failed:', error);
      return { emailStatus: 'failed', provider: 'resend' };
    }
  }

  try {
    const smtp = getResolvedSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });
    const fromAddr =
      process.env.SMTP_FROM?.trim() ||
      `AAGAMAN MART Support <${smtp.user}>`;
    await transporter.sendMail({
      from: fromAddr,
      to: cleanTarget,
      replyTo: cleanCustomerEmail,
      subject: mailSubject,
      text: textBody,
      html: htmlBody,
    });
    return { emailStatus: 'sent', provider: 'smtp' };
  } catch (error) {
    console.error('SMTP dispatch failed:', error);
    return { emailStatus: 'failed', provider: 'smtp' };
  }
}
