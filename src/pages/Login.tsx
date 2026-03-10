import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Check if MFA is required
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
      // User has MFA enrolled, need verification
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find(f => f.status === 'verified');
      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
        setMfaRequired(true);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  };

  const handleMFAVerify = async () => {
    if (!totpCode || totpCode.length !== 6) return;
    setVerifying(true);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (challengeError) {
      toast.error(challengeError.message);
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: totpCode,
    });

    if (verifyError) {
      toast.error('Invalid code. Please try again.');
      setTotpCode('');
      setVerifying(false);
      return;
    }

    // MFA verified, session will auto-update
    setVerifying(false);
  };

  if (mfaRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-7 w-7 text-brand" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Two-Factor Authentication</h2>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
          </div>
          <div className="space-y-4">
            <Input
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="font-mono text-center text-2xl tracking-[0.5em] h-14"
              maxLength={6}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleMFAVerify()}
            />
            <Button
              onClick={handleMFAVerify}
              className="w-full gap-2"
              disabled={verifying || totpCode.length !== 6}
            >
              {verifying ? 'Verifying...' : (
                <>
                  Verify
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setMfaRequired(false); setTotpCode(''); supabase.auth.signOut(); }}
            >
              Back to login
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary relative overflow-hidden flex-col justify-between p-12">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-primary-foreground">Lead CRM</h1>
        </div>
        <div className="relative z-10 space-y-4">
          <h2 className="text-4xl font-bold leading-tight text-primary-foreground">
            Manage your leads<br />with precision.
          </h2>
          <p className="text-primary-foreground/60 text-lg max-w-md">
            Track, schedule, and close — all from one streamlined workspace.
          </p>
        </div>
        <div className="relative z-10">
          <p className="text-primary-foreground/40 text-sm">© 2026 Lead CRM</p>
        </div>
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-primary-foreground/10" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full border border-primary-foreground/5" />
        <div className="absolute top-1/2 right-12 w-48 h-48 rounded-full bg-brand/20 blur-3xl" />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden mb-4">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Lead CRM</h1>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-10"
                />
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? 'Signing in...' : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground">
            Accounts are created by your administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
