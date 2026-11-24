import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { Lock, Mail, Phone, User, X } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, googleAuthProvider } from '../lib/firebase';
import { syncGoogleCustomerToFirestore } from '../lib/firestore-sync';
import { useStore } from '../context/StoreContext';
import {
  clearSavedStaticCustomerSession,
  hasJsonContentType,
  staticForgotPassword,
  staticLoginCustomer,
  staticRegisterCustomer,
  staticResetPassword,
  staticSyncFirebaseCustomer,
  syncStaticCustomerToServer,
  upsertStaticCustomerSession,
} from '../lib/static-store';

class AuthRequestError extends Error {}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
            use_fedcm_for_prompt?: boolean;
            itp_support?: boolean;
            auto_select?: boolean;
          }) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

const LAST_GOOGLE_EMAIL_KEY = 'aagaman_last_google_email';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, setCustomerSession, notify } = useStore();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [sandboxResetHint, setSandboxResetHint] = useState('');
  const [error, setError] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [loading, setLoading] = useState(false);

  const savedGoogleEmail =
    typeof window !== 'undefined' ? window.localStorage.getItem(LAST_GOOGLE_EMAIL_KEY) || '' : '';

  const completeFirebaseCustomerSignIn = useCallback(async (fbUser: NonNullable<typeof auth.currentUser>) => {
    const idToken = await fbUser.getIdToken();
    if (fbUser.email && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_GOOGLE_EMAIL_KEY, fbUser.email);
    }
    try {
      const res = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (hasJsonContentType(res) && res.status < 500) {
        const json = await res.json();
        if (!res.ok) throw new AuthRequestError(json.error || 'Google sign-in failed.');
        await setCustomerSession(idToken, json.user);
        setIsAuthModalOpen(false);
        notify(`Welcome back, ${json.user.name}!`, 'success');
        return;
      }
    } catch (innerErr) {
      if (innerErr instanceof AuthRequestError) throw innerErr;
    }

    const staticSession = staticSyncFirebaseCustomer({
      uid: fbUser.uid,
      email: fbUser.email || 'shopper@aagamanmart.in',
      name: fbUser.displayName,
      photoURL: fbUser.photoURL,
      emailVerified: fbUser.emailVerified,
    });

    try {
      const fsRes = await syncGoogleCustomerToFirestore({
        uid: fbUser.uid,
        name: staticSession.user.name,
        email: staticSession.user.email,
        phone: staticSession.user.phone,
        photoUrl: staticSession.user.photoUrl,
        emailVerified: fbUser.emailVerified,
        phoneVerified: staticSession.user.phoneVerified,
      });
      if (fsRes.isBlocked) {
        clearSavedStaticCustomerSession();
        await firebaseSignOut(auth).catch(() => {});
        throw new AuthRequestError('This account has been suspended. Please contact support.');
      }
    } catch (fsErr) {
      if (fsErr instanceof AuthRequestError) throw fsErr;
    }

    await syncStaticCustomerToServer({
      ...staticSession.user,
      authMethod: 'google',
    });
    await setCustomerSession(staticSession.token, staticSession.user);
    setIsAuthModalOpen(false);
    notify(`Welcome back, ${staticSession.user.name}!`, 'success');
  }, [notify, setCustomerSession, setIsAuthModalOpen]);

  const completeSignInRef = useRef(completeFirebaseCustomerSignIn);
  completeSignInRef.current = completeFirebaseCustomerSignIn;

  useEffect(() => {
    if (!isAuthModalOpen || mode === 'forgot' || auth.currentUser) return;
    const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
    if (!clientId) return;

    let cancelled = false;
    const initOneTap = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          use_fedcm_for_prompt: true,
          itp_support: true,
          auto_select: false,
          callback: async (response: { credential?: string }) => {
            if (!response?.credential || cancelled) return;
            setLoading(true);
            setError('');
            setGoogleError('');
            try {
              const credential = GoogleAuthProvider.credential(response.credential);
              const cred = await signInWithCredential(auth, credential);
              await completeSignInRef.current(cred.user);
            } catch (err: unknown) {
              if (!cancelled) {
                setGoogleError(err instanceof Error ? err.message : 'Google Sign-In failed.');
              }
            } finally {
              if (!cancelled) setLoading(false);
            }
          },
        });
        window.google.accounts.id.prompt();
      } catch {
        // Ignore silent One-Tap errors (e.g., cross-origin iframe or non-allowlisted GIS origin)
      }
    };

    if (window.google?.accounts?.id) {
      initOneTap();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-gsi-client="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', initOneTap, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.gsiClient = 'true';
        script.onload = initOneTap;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        // ignore
      }
    };
  }, [isAuthModalOpen, mode]);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async (forceAccountSelect = false) => {
    setError('');
    setGoogleError('');
    setLoading(true);
    try {
      if (!forceAccountSelect && auth.currentUser && auth.currentUser.emailVerified) {
        await completeFirebaseCustomerSignIn(auth.currentUser);
        return;
      }

      if (forceAccountSelect) {
        googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
      } else if (savedGoogleEmail) {
        googleAuthProvider.setCustomParameters({ login_hint: savedGoogleEmail });
      } else {
        googleAuthProvider.setCustomParameters({});
      }

      const cred = await signInWithPopup(auth, googleAuthProvider);
      await completeFirebaseCustomerSignIn(cred.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      if (msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setGoogleError(
          `Google Sign-In requires "${host}" to be added in Firebase Console → Authentication → Settings → Authorized domains. Use the email form below in the meantime.`
        );
      } else if (msg.includes('popup-blocked')) {
        setGoogleError('Google Sign-In popup was blocked by your browser. Allow popups or use the email form below.');
      } else if (msg.includes('popup-closed-by-user')) {
        setGoogleError('Google Sign-In was closed before completing. Try again or use the email form below.');
      } else if (msg.toLowerCase().includes('missing initial state') || msg.toLowerCase().includes('sessionstorage')) {
        setGoogleError(
          'Browser storage blocked the Google popup (common in Incognito or in-app browsers). Open in normal Chrome or sign in with Email below.'
        );
      } else {
        setGoogleError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGoogleError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          if (hasJsonContentType(res) && res.status < 500) {
            const json = await res.json();
            if (!res.ok) throw new AuthRequestError(json.error || 'Sign in failed.');
            await setCustomerSession(json.token, json.user);
            setIsAuthModalOpen(false);
            notify(`Welcome back, ${json.user.name}!`, 'success');
            return;
          }
        } catch (err) {
          if (err instanceof AuthRequestError) throw err;
        }

        try {
          const rtRes = await fetch('/api/runtime/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          if (hasJsonContentType(rtRes) && rtRes.status < 500) {
            const rtJson = await rtRes.json();
            if (!rtRes.ok) throw new AuthRequestError(rtJson.error || 'Invalid email or password.');
            const session = upsertStaticCustomerSession(rtJson.user, password);
            await setCustomerSession(session.token, session.user);
            setIsAuthModalOpen(false);
            notify(`Welcome back, ${session.user.name}!`, 'success');
            return;
          }
        } catch (err) {
          if (err instanceof AuthRequestError) throw err;
        }

        const session = staticLoginCustomer(email, password);
        await syncStaticCustomerToServer({ ...session.user, authMethod: 'email' });
        await setCustomerSession(session.token, session.user);
        setIsAuthModalOpen(false);
        notify(`Welcome back, ${session.user.name}!`, 'success');
      } else if (mode === 'register') {
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
          throw new Error('Please enter a valid 10-digit Indian mobile number.');
        }
        const formattedPhone = `+91 ${phoneDigits}`;
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone: formattedPhone, password }),
          });
          if (hasJsonContentType(res) && res.status < 500) {
            const json = await res.json();
            if (!res.ok) throw new AuthRequestError(json.error || 'Registration failed.');
            await setCustomerSession(json.token, json.user);
            setIsAuthModalOpen(false);
            notify('Account created! Welcome to AAGAMAN MART.', 'success');
            return;
          }
        } catch (err) {
          if (err instanceof AuthRequestError) throw err;
        }

        try {
          const rtRes = await fetch('/api/runtime/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone: formattedPhone, password }),
          });
          if (hasJsonContentType(rtRes) && rtRes.status < 500) {
            const rtJson = await rtRes.json();
            if (!rtRes.ok) throw new AuthRequestError(rtJson.error || 'Registration failed.');
            const session = upsertStaticCustomerSession(rtJson.user, password);
            await setCustomerSession(session.token, session.user);
            setIsAuthModalOpen(false);
            notify('Account created! Welcome to AAGAMAN MART.', 'success');
            return;
          }
        } catch (err) {
          if (err instanceof AuthRequestError) throw err;
        }

        const session = staticRegisterCustomer({ name, email, phone: formattedPhone, password });
        await syncStaticCustomerToServer({ ...session.user, authMethod: 'email' });
        await setCustomerSession(session.token, session.user);
        setIsAuthModalOpen(false);
        notify('Account created! Welcome to AAGAMAN MART.', 'success');
      } else if (mode === 'forgot') {
        if (resetStep === 'request') {
          try {
            const res = await fetch('/api/auth/forgot-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            if (hasJsonContentType(res) && res.status < 500) {
              const json = await res.json();
              if (!res.ok) throw new AuthRequestError(json.error || 'Could not initiate reset.');
              if (json.sandboxCode) setSandboxResetHint(json.sandboxCode);
              setResetStep('confirm');
              notify('Password reset code issued.', 'info');
              return;
            }
          } catch (err) {
            if (err instanceof AuthRequestError) throw err;
          }
          try {
            const rtRes = await fetch('/api/runtime/auth/forgot-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            if (hasJsonContentType(rtRes) && rtRes.status < 500) {
              const rtJson = await rtRes.json();
              if (!rtRes.ok) throw new AuthRequestError(rtJson.error || 'Could not initiate reset.');
              if (rtJson.sandboxCode) setSandboxResetHint(rtJson.sandboxCode);
              setResetStep('confirm');
              notify('Password reset code issued.', 'info');
              return;
            }
          } catch (err) {
            if (err instanceof AuthRequestError) throw err;
          }
          const json = staticForgotPassword(email);
          if (json.sandboxCode) setSandboxResetHint(json.sandboxCode);
          setResetStep('confirm');
          notify('Password reset code issued.', 'info');
        } else {
          try {
            const res = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, code: resetCode, newPassword: password }),
            });
            if (hasJsonContentType(res) && res.status < 500) {
              const json = await res.json();
              if (!res.ok) throw new AuthRequestError(json.error || 'Reset failed.');
              setMode('login');
              setResetStep('request');
              setSandboxResetHint('');
              notify('Password updated! Please sign in.', 'success');
              return;
            }
          } catch (err) {
            if (err instanceof AuthRequestError) throw err;
          }
          try {
            const rtRes = await fetch('/api/runtime/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, code: resetCode, newPassword: password }),
            });
            if (hasJsonContentType(rtRes) && rtRes.status < 500) {
              const rtJson = await rtRes.json();
              if (!rtRes.ok) throw new AuthRequestError(rtJson.error || 'Reset failed.');
              setMode('login');
              setResetStep('request');
              setSandboxResetHint('');
              notify('Password updated! Please sign in.', 'success');
              return;
            }
          } catch (err) {
            if (err instanceof AuthRequestError) throw err;
          }
          staticResetPassword(email, resetCode, password);
          setMode('login');
          setResetStep('request');
          setSandboxResetHint('');
          notify('Password updated! Please sign in.', 'success');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        <div className="px-6 py-5 bg-[#0B1F3A] text-white flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">
              {mode === 'login'
                ? 'Sign In to AAGAMAN MART'
                : mode === 'register'
                ? 'Create Your Account'
                : 'Reset Password'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">Quality That Moves You Forward.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleGoogleSignIn(false)}
                className="w-full h-11 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>
                  {savedGoogleEmail ? `Continue as ${savedGoogleEmail}` : 'Continue with Google'}
                </span>
              </button>

              {savedGoogleEmail && (
                <div className="text-center">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleGoogleSignIn(true)}
                    className="text-[11px] font-medium text-slate-500 hover:text-[#0B1F3A] underline"
                  >
                    Use a different Google account
                  </button>
                </div>
              )}

              {googleError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 space-y-1">
                  <p className="font-medium">{googleError}</p>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setError('');
                      }}
                      className="font-semibold text-[#EA580C] hover:underline"
                    >
                      Register with Email &amp; +91 Mobile below →
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="flex-1 h-px bg-slate-200" />
                <span>or with email</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  />
                </div>
                <div className="flex items-center h-10 rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-[#EA580C] bg-white overflow-hidden">
                  <div className="flex items-center gap-1.5 pl-3 pr-2.5 h-full bg-slate-50 border-r border-slate-200 shrink-0 select-none">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-[#0B1F3A] font-mono">+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="flex-1 h-full px-3 text-sm font-mono focus:outline-none"
                  />
                  <span className="pr-3 text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                    {phone.length}/10
                  </span>
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
              />
            </div>

            {mode === 'forgot' && resetStep === 'confirm' && (
              <div className="space-y-2">
                {sandboxResetHint && (
                  <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg">
                    Sandbox Reset Code: <strong className="font-mono">{sandboxResetHint}</strong>
                  </p>
                )}
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="Enter 6-digit reset code"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                />
              </div>
            )}

            {(mode !== 'forgot' || resetStep === 'confirm') && (
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'forgot' ? 'New Password (min 6 chars)' : 'Password'}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : resetStep === 'request'
                ? 'Send Reset Code'
                : 'Update Password'}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setGoogleError('');
                  }}
                  className="hover:text-[#EA580C] font-medium"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setGoogleError('');
                  }}
                  className="text-[#0B1F3A] font-semibold hover:text-[#EA580C]"
                >
                  New customer? Register
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setGoogleError('');
                }}
                className="text-[#0B1F3A] font-semibold hover:text-[#EA580C]"
              >
                Already have an account? Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
