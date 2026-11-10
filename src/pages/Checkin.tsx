import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Eye, EyeOff, LogOut, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import brandLogo from "@/assets/tplum-logo-dark.png";
import StaffReport from "./StaffReport";
import { localDateOf } from "@/lib/attendanceRules";

type Row = { id: string; check_date: string; checked_in_at: string };

const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(new Date());
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-CA", { timeZone: "America/Edmonton", hour: "2-digit", minute: "2-digit" });
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const inputCls =
  "w-full border border-border bg-background px-5 py-4 text-sm font-body outline-none focus:border-foreground transition-colors";

// A random ID kept in this phone's browser. The server allows one check-in per device per day,
// so a staff member can't check in a colleague from their own phone.
const getDeviceId = () => {
  try {
    let id = localStorage.getItem("dmi_device_id");
    if (!id || id.length < 16) {
      id = crypto.randomUUID();
      localStorage.setItem("dmi_device_id", id);
    }
    return id;
  } catch {
    return "";
  }
};

const geoErrorMessage = (err: GeolocationPositionError) => {
  if (err.code === err.PERMISSION_DENIED) return "Location access is blocked. Allow location for this site in your browser settings, then try again.";
  if (err.code === err.POSITION_UNAVAILABLE) return "Couldn't determine your location. Turn on GPS/Wi-Fi and try again.";
  return "Getting your location timed out. Try again.";
};

const Checkin = () => {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState("");
  // null = signed in but not on the team (yet)
  const [staff, setStaff] = useState<{ id: string; role: string; job_title: string; startedOn: string | null } | null>(null);
  const [reportKey, setReportKey] = useState(0);
  const [history, setHistory] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const autoTried = useRef(false);

  const today = localToday();
  const checkedInToday = history.find((r) => r.check_date === today);

  const loadProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setSignedIn(false);
      setReady(true);
      return;
    }
    const [{ data: staff }, { data: rows }] = await Promise.all([
      supabase.from("staff").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("attendance").select("id, check_date, checked_in_at").eq("staff_id", user.id).order("check_date", { ascending: false }).limit(7),
    ]);
    setName(staff?.full_name || user.email || "");
    setStaff(staff ? { id: user.id, role: staff.role, job_title: staff.job_title ?? "", startedOn: staff.created_at ? localDateOf(staff.created_at) : null } : null);
    setReportKey((k) => k + 1);
    setHistory((rows as Row[]) || []);
    setSignedIn(true);
    setReady(true);
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(error.message || "Invalid credentials");
      setBusy(false);
      return;
    }
    setPassword("");
    await loadProfile();
    setBusy(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSignedIn(false);
    setMessage(null);
    setHistory([]);
  };

  const handleCheckIn = () => {
    if (busy) return;
    if (!navigator.geolocation) {
      setMessage({ ok: false, text: "This device doesn't support location." });
      return;
    }
    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { data, error } = await supabase.rpc("check_in", {
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
          p_device: getDeviceId(),
        });
        if (error) {
          setMessage({ ok: false, text: error.message });
        } else if (data?.already) {
          setMessage({ ok: true, text: `You already checked in today at ${fmtTime(data.checked_in_at)}.` });
        } else {
          setMessage({ ok: true, text: `Checked in at ${fmtTime(data.checked_in_at)}. Have a great day!` });
        }
        await loadProfile();
        setBusy(false);
      },
      (err) => {
        setMessage({ ok: false, text: geoErrorMessage(err) });
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  // Check in automatically the moment this page opens (no button to tap) — as long as
  // the phone is within range of the office. Runs once per visit; the button below still
  // works as a manual retry if the automatic attempt fails (denied permission, out of range, etc).
  useEffect(() => {
    if (ready && signedIn && staff && !checkedInToday && !autoTried.current) {
      autoTried.current = true;
      handleCheckIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, staff, checkedInToday]);

  if (!ready) {
    return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">Loading...</div>;
  }

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={brandLogo} alt="DMI" className="h-16 w-auto mx-auto mb-4" />
            <h1 className="font-display text-3xl font-bold">Staff Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-2">Sign in with your DMI account to check in and see your attendance</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive font-body">{loginError}</p>
              </div>
            )}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputCls} />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={inputCls + " pr-12"}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Toggle password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground px-8 py-4 text-sm font-body font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "SIGNING IN…" : "SIGN IN"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs font-body text-muted-foreground">
            New to the team? <a href="/account" className="underline underline-offset-2 text-foreground">Create an account</a>, then ask the admin to make it a staff account.
          </p>
        </motion.div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <img src={brandLogo} alt="DMI" className="h-16 w-auto mx-auto mb-6" />
          <h1 className="font-display text-3xl font-bold">Not a staff account yet</h1>
          <p className="text-sm font-body text-muted-foreground mt-3">
            You're signed in as {name}. Ask the admin to set your account to Staff in Dashboard → Team &amp; Accounts, then reload this page.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <a href="/account" className="px-5 py-3 text-sm font-body border border-border hover:bg-muted/50">My account</a>
            <button onClick={() => void handleLogout()} className="px-5 py-3 text-sm font-body border border-border hover:bg-muted/50">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <img src={brandLogo} alt="DMI" className="h-10 w-auto" />
          <div className="flex items-center gap-2">
          {staff.role === "admin" && (
            <a href="/admin" className="inline-flex items-center px-4 py-2 text-sm font-body border border-border hover:bg-muted/50 rounded-md">ADMIN DASHBOARD</a>
          )}
          <button onClick={() => void handleLogout()} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body border border-border hover:bg-muted/50 rounded-md">
            <LogOut size={16} /> LOGOUT
          </button>
          </div>
        </div>

        <p className="text-xs font-body font-bold tracking-widest text-muted-foreground">WELCOME{staff.job_title ? ` · ${staff.job_title.toUpperCase()}` : ""}</p>
        <h1 className="font-display text-4xl font-bold mb-1">{name}</h1>
        <p className="text-sm font-body text-muted-foreground mb-8">{fmtDate(today)}</p>

        {checkedInToday ? (
          <div className="border border-foreground bg-foreground text-background p-8 text-center mb-6">
            <Check size={36} className="mx-auto mb-3" />
            <p className="font-display text-2xl font-bold">CHECKED IN</p>
            <p className="text-sm font-body opacity-80 mt-1">Today at {fmtTime(checkedInToday.checked_in_at)}</p>
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={busy}
            className="w-full bg-accent text-accent-foreground py-10 mb-6 flex flex-col items-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <MapPin size={36} />
            <span className="font-display text-3xl font-bold">
              {busy ? "CHECKING LOCATION…" : autoTried.current ? "TRY AGAIN" : "CHECK IN"}
            </span>
            <span className="text-xs font-body opacity-80">
              {busy ? "Please allow location access if asked" : "You must be at the office · checked automatically when this page opens"}
            </span>
          </button>
        )}

        {message && (
          <div className={`p-4 mb-6 border text-sm font-body ${message.ok ? "border-foreground" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
            {message.text}
          </div>
        )}

        <StaffReport userId={staff.id} startedOn={staff.startedOn} refreshKey={reportKey} />
      </div>
    </div>
  );
};

export default Checkin;
