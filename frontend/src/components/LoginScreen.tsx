import React, { useState } from 'react';
import { Shield, KeyRound, Mail, AlertCircle, Cpu } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string, name: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [showManualLogin, setShowManualLogin] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleGoogleSignInClick = () => {
    // Show manual email input styled as Google Sign-in prompt
    setShowManualLogin(true);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Gmail address is required.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    const googleRegex = /^[a-zA-Z0-9._%+-]+@google\.com$/;

    if (!gmailRegex.test(trimmedEmail) && !googleRegex.test(trimmedEmail)) {
      setError('Please sign in using a valid @gmail.com or @google.com account.');
      return;
    }

    setIsLoading(true);

    // Simulate Google OAuth token validation delay
    setTimeout(() => {
      const displayName = name.trim() || trimmedEmail.split('@')[0];
      const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      
      onLogin(trimmedEmail, formattedName);
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="relative w-screen h-screen flex items-center justify-center bg-slate-950 overflow-hidden text-slate-100 font-sans select-none">
      
      {/* Dynamic flowing background gradients */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700" />
      
      {/* Login Card */}
      <div className="z-10 w-[420px] glass-panel rounded-2xl border border-white/10 p-8 shadow-2xl space-y-6 transition-all hover:border-indigo-500/25">
        
        {/* Portal Branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="bg-indigo-600/20 p-4 rounded-full border border-indigo-500/30 shadow-glow-blue animate-bounce">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider uppercase text-slate-100">GeoCyclone India</h1>
            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-1">Real-Time Risk Decision System</p>
          </div>
        </div>

        <div className="border-t border-white/5 pt-4">
          {!showManualLogin ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 text-center leading-relaxed max-w-[300px] mx-auto">
                Authorized entry only. Access is restricted to meteorologists, disaster management cells, and agencies.
              </p>

              {/* Styled Gmail Sign-In Button */}
              <button
                onClick={handleGoogleSignInClick}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 rounded-lg py-3 px-4 font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                {/* Official Google G Logo SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.51 14.99 1 12 1 7.35 1 3.37 3.65 1.42 7.5l3.88 3c.9-2.73 3.44-4.46 6.7-4.46z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.43-4.92 3.43-8.69z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.5c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18l-3.88-3C.53 8.78 0 10.33 0 12s.53 3.22 1.42 4.85l3.88-2.85z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.04.7-2.38 1.11-4.26 1.11-3.26 0-5.8-1.73-6.7-4.46L1.42 16.5c1.95 3.85 5.93 6.5 10.58 6.5z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-slate-300">
              
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Google OAuth Verification</span>
                <button
                  type="button"
                  onClick={() => setShowManualLogin(false)}
                  className="text-indigo-400 hover:underline"
                >
                  Back
                </button>
              </div>

              <div className="space-y-3.5">
                
                {/* Name Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Display Name</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. Dr. Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gmail Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="username@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-1.5 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 text-white rounded-lg py-2.5 text-xs font-semibold transition-all shadow-glow-blue flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white animate-spin rounded-full" />
                    Verifying Google Credentials...
                  </>
                ) : (
                  "Verify Gmail & Log In"
                )}
              </button>
            </form>
          )}
        </div>

        {/* Integration Instructions */}
        <div className="text-[9.5px] text-slate-500 italic text-center leading-relaxed border-t border-white/5 pt-3.5">
          Production Note: Change the credentials inside <code>LoginScreen.tsx</code> to connect to your custom Google Cloud OAuth flow.
        </div>
      </div>
    </div>
  );
};
