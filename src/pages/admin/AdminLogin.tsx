import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import brandLogo from "@/assets/tplum-logo-dark.png";
import { useNavigate } from "@/lib/router-compat";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // "Forgot password?": email a reset link (it opens /account/, where a new password is chosen, then back here)
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState("");

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const addr = email.trim().toLowerCase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: `${window.location.origin}/account/` });
    setLoading(false);
    if (resetError) {
      setError(/rate limit|too many/i.test(resetError.message) ? "Too many reset emails were sent just now. Please wait an hour and try again." : resetError.message);
      return;
    }
    setSent(addr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message || "Invalid credentials");
      setLoading(false);
      return;
    }

    // Redirect to /admin on success
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <img src={brandLogo} alt="Tplum Photography" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-2">{forgot ? "Reset your password" : "Please sign in to continue"}</p>
        </div>

        {forgot ? (
          sent ? (
            <div className="space-y-6 text-center">
              <p className="text-sm font-body leading-relaxed">If <b>{sent}</b> has a dashboard account, a reset link is on its way. Open it on this device, choose a new password, and you'll come back to the dashboard. Check the spam folder if it isn't there in a few minutes.</p>
              <button type="button" onClick={() => { setForgot(false); setSent(""); }} className="text-sm font-body underline underline-offset-4">Back to sign in</button>
            </div>
          ) : (
            <form onSubmit={sendReset} className="space-y-6">
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive font-body">{error}</p>
                </div>
              )}
              <div>
                <label htmlFor="reset-email" className="block text-xs font-body font-bold tracking-widest mb-2">EMAIL</label>
                <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"
                  className="w-full border border-border bg-background px-5 py-4 text-sm font-body outline-none focus:border-foreground transition-colors" />
              </div>
              <button type="submit" disabled={loading} className={`w-full px-6 py-4 text-sm font-body font-medium transition-colors ${loading ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                {loading ? "SENDING..." : "EMAIL ME A RESET LINK"}
              </button>
              <button type="button" onClick={() => { setForgot(false); setError(""); }} className="block mx-auto text-sm font-body underline underline-offset-4">Back to sign in</button>
            </form>
          )
        ) : (
        /* Login Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-body">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-body font-bold tracking-widest mb-2">
                EMAIL
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-border bg-background px-5 py-4 text-sm font-body outline-none focus:border-foreground transition-colors"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-body font-bold tracking-widest mb-2">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full border border-border bg-background pl-5 pr-12 py-4 text-sm font-body outline-none focus:border-foreground transition-colors"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 text-sm font-body font-medium transition-colors ${
              loading
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
          </button>
          <button type="button" onClick={() => { setForgot(true); setError(""); }} className="block mx-auto text-sm font-body text-muted-foreground hover:text-foreground underline underline-offset-4">
            Forgot password?
          </button>
        </form>
        )}
      </motion.div>
    </div>
  );
};

export default AdminLogin;