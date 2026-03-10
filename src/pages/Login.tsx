import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, ShieldCheck, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';
import { heroTitle, fadeUp, premiumEase } from '@/lib/motion';

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

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
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

    setVerifying(false);
  };

  if (mfaRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/8 blur-[80px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: premiumEase }}
          className="w-full max-w-sm space-y-8 relative z-10"
        >
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto shadow-brand"
            >
              <ShieldCheck className="h-8 w-8 text-primary-foreground" />
            </motion.div>
            <motion.h2
              variants={heroTitle}
              initial="initial"
              animate="animate"
              className="text-2xl font-bold tracking-tight text-foreground"
            >
              Two-Factor Authentication
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-muted-foreground"
            >
              Enter the 6-digit code from your authenticator app
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="space-y-4"
          >
            <Input
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="font-mono text-center text-2xl tracking-[0.5em] h-14 bg-card border-border/60 shadow-premium-sm"
              maxLength={6}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleMFAVerify()}
            />
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleMFAVerify}
                className="w-full gap-2 h-11 shadow-brand btn-glow"
                disabled={verifying || totpCode.length !== 6}
              >
                {verifying ? 'Verifying...' : (
                  <>
                    Verify
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
            <Button
              variant="ghost"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => { setMfaRequired(false); setTotpCode(''); supabase.auth.signOut(); }}
            >
              Back to login
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Left brand panel - Premium animated gradient */}
      <div className="hidden lg:flex lg:w-[45%] animated-gradient relative overflow-hidden flex-col justify-between p-12">
        {/* Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Lead CRM</h1>
        </motion.div>

        <div className="relative z-10 space-y-6">
          <motion.h2
            variants={heroTitle}
            initial="initial"
            animate="animate"
            className="text-5xl font-extrabold leading-[1.1] text-white"
          >
            Manage your<br />leads with<br />precision.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-white/70 text-lg max-w-md leading-relaxed"
          >
            Track, schedule, and close — all from one streamlined workspace designed for teams that move fast.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-wrap gap-2"
          >
            {['Real-time Tracking', 'Team Scheduling', 'Smart Analytics'].map((feature, i) => (
              <motion.span
                key={feature}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white/90 text-xs font-medium border border-white/10"
              >
                {feature}
              </motion.span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10"
        >
          <p className="text-white/30 text-sm">© 2026 Lead CRM · Built for modern teams</p>
        </motion.div>

        {/* Decorative elements */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full border border-white/5"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full border border-white/5"
        />
        <div className="absolute top-1/3 right-8 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-1/3 left-8 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--primary)/0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: premiumEase }}
          className="w-full max-w-sm space-y-8 relative z-10"
        >
          <div className="lg:hidden mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-brand">
              <Wrench className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Lead CRM</h1>
          </div>

          <div>
            <motion.h2
              variants={heroTitle}
              initial="initial"
              animate="animate"
              className="text-3xl font-bold tracking-tight text-foreground"
            >
              Welcome back
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-sm text-muted-foreground"
            >
              Sign in to your account to continue
            </motion.p>
          </div>

          <motion.form
            onSubmit={handleLogin}
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="pl-10 h-11 bg-card border-border/60 shadow-premium-sm transition-all duration-200 focus:shadow-premium-md focus:border-primary/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-10 h-11 bg-card border-border/60 shadow-premium-sm transition-all duration-200 focus:shadow-premium-md focus:border-primary/30"
                />
              </div>
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button type="submit" className="w-full gap-2 h-11 text-sm font-semibold shadow-brand btn-glow" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-xs text-center text-muted-foreground/60"
          >
            Accounts are created by your administrator
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
