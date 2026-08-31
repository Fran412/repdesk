import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";
import * as XLSX from "xlsx";

const T = {
  paper:    "#F5F4F0",
  ink:      "#0E1423",
  inkMid:   "#3D4A63",
  inkFaint: "#8C96A8",
  rule:     "#DDD9D0",
  ruleHard: "#B8B2A7",
  vermil:   "#E8400C",
  vermilBg: "#FDF0EB",
  navy:     "#0E1423",
  pass:     "#1A7A4A",
  passBg:   "#EBF7F1",
  warn:     "#B56A00",
  warnBg:   "#FDF5E6",
  fail:     "#C0281A",
  failBg:   "#FDF0EE",
};

const F = {
  display: "'Georgia', 'Times New Roman', serif",
  body:    "'Inter', 'DM Sans', system-ui, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
};

const fmt   = n => `\u20a6${Number(n).toLocaleString()}`;
const today = () => new Date().toISOString().slice(0,10);

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

function parseBulk(text) {
  return text.trim().split("\n").filter(Boolean).map((line) => {
    const clean = line.replace(/^\d+[\.\)\-\s]+/, "").trim();
    const parts = clean.split(/[\t,|;]+/).map(s => s.trim()).filter(Boolean);
    return parts.length >= 2 ? { name: parts[0], matric: parts[1] } : { name: parts[0]||clean, matric: "" };
  }).filter(r => r.name);
}

const Chip = ({ status }) => {
  const map = {
    verified: { bg: T.passBg, color: T.pass,  border: "#A8D9BE", label: "Paid" },
    flagged:  { bg: T.failBg, color: T.fail,  border: "#F0B8B3", label: "Flagged" },
    pending:  { bg: T.warnBg, color: T.warn,  border: "#E8CFA0", label: "Unpaid" },
  };
  const s = map[status] || map.pending;
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    padding: "2px 10px", borderRadius: 3, fontSize: 11, fontWeight: 700,
    fontFamily: F.body, letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.label}</span>;
};

const PrimaryBtn = ({ children, style, disabled, ...p }) => (
  <button disabled={disabled} style={{ background: disabled ? T.ruleHard : T.vermil, color: "#fff", border: "none",
    padding: "11px 24px", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: F.body, fontWeight: 700, fontSize: 13.5, transition: "background .15s",
    opacity: disabled ? 0.6 : 1, ...style }} {...p}>{children}</button>
);

const GhostBtn = ({ children, style, ...p }) => (
  <button style={{ background: "transparent", color: T.inkMid, border: `1px solid ${T.rule}`,
    padding: "10px 20px", borderRadius: 4, cursor: "pointer", fontFamily: F.body,
    fontWeight: 600, fontSize: 13.5, ...style }} {...p}>{children}</button>
);

const DangerBtn = ({ children, style, ...p }) => (
  <button style={{ background: T.failBg, color: T.fail, border: `1px solid #F0B8B3`,
    padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontFamily: F.body,
    fontWeight: 700, fontSize: 12.5, ...style }} {...p}>{children}</button>
);

const SuccessBtn = ({ children, style, ...p }) => (
  <button style={{ background: T.passBg, color: T.pass, border: `1px solid #A8D9BE`,
    padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontFamily: F.body,
    fontWeight: 700, fontSize: 12.5, ...style }} {...p}>{children}</button>
);

const inp = {
  width: "100%", boxSizing: "border-box", background: "#fff",
  border: `1px solid ${T.rule}`, borderRadius: 4, color: T.ink,
  padding: "10px 13px", fontSize: 14, fontFamily: F.body, outline: "none",
};

const Input = ({ label, ...p }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 11.5, fontFamily: F.body, fontWeight: 700,
      color: T.inkFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>}
    <input style={inp} onFocus={e => e.target.style.borderColor = T.vermil}
      onBlur={e => e.target.style.borderColor = T.rule} {...p} />
  </div>
);

function Toast({ msg, type, onDone }) {
  const colors = { success: T.pass, error: T.fail, warn: T.warn, info: T.inkMid };
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: T.navy, color: T.paper, padding: "13px 22px", borderRadius: 4,
      fontSize: 13.5, fontFamily: F.body, zIndex: 999, display: "flex",
      alignItems: "center", gap: 12, minWidth: 260, maxWidth: "90vw",
      boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
      borderLeft: `4px solid ${colors[type] || T.vermil}` }}>
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onDone} style={{ background: "none", border: "none",
        color: T.inkFaint, cursor: "pointer", fontSize: 18 }}>x</button>
    </div>
  );
}

const NavItem = ({ label, active, count, onClick }) => (
  <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer",
    padding: "0 0 12px", fontFamily: F.body, fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? T.vermil : T.inkFaint,
    borderBottom: active ? `2px solid ${T.vermil}` : "2px solid transparent",
    transition: "color .15s", display: "flex", alignItems: "center", gap: 6,
    marginRight: 20, whiteSpace: "nowrap" }}>
    {label}
    {count !== undefined && (
      <span style={{ background: active ? T.vermil : T.rule, color: active ? "#fff" : T.inkFaint,
        borderRadius: 10, padding: "1px 6px", fontSize: 10.5, fontWeight: 700 }}>{count}</span>
    )}
  </button>
);

// ── LANDING ────────────────────────────────────────────────────────────────────
function Landing({ onSelect }) {
  const mob = useIsMobile();
  const hasRep = new URLSearchParams(window.location.search).get("rep");
  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: F.body, color: T.ink, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 3, background: T.vermil }} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: mob ? "32px 20px" : "40px 20px" }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div style={{ marginBottom: mob ? 32 : 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: T.inkFaint, textTransform: "uppercase", marginBottom: 16 }}>
              University Payment Tracking
            </div>
            <h1 style={{ fontFamily: F.display, fontSize: mob ? 44 : 64, fontWeight: 400, color: T.ink, margin: 0, lineHeight: 1, letterSpacing: "-1px" }}>
              Rep<span style={{ color: T.vermil }}>Desk</span>
            </h1>
            <p style={{ color: T.inkMid, fontSize: mob ? 14 : 15.5, marginTop: 16, lineHeight: 1.65, maxWidth: 420 }}>
              No more WhatsApp chaos. No more chasing people. Works for any university, any department.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : hasRep ? "1fr 1fr" : "1fr", gap: 1,
            background: T.rule, border: `1px solid ${T.rule}`, borderRadius: 6, overflow: "hidden" }}>
            {[
              { key: "rep", label: "Course Rep", sub: "Sign in to your dashboard. Manage your class, track payments, review receipts." },
              ...(hasRep ? [{ key: "student", label: "Student", sub: "Submit proof of payment. No account needed." }] : []),
            ].map(p => (
              <div key={p.key} onClick={() => onSelect(p.key)}
                style={{ background: T.paper, padding: mob ? "24px 20px" : "32px 28px", cursor: "pointer", transition: "background .2s" }}
                onMouseEnter={e => e.currentTarget.style.background = T.vermilBg}
                onMouseLeave={e => e.currentTarget.style.background = T.paper}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.vermil, marginBottom: 10 }}>{p.label}</div>
                <div style={{ color: T.inkMid, fontSize: 13.5, lineHeight: 1.6 }}>{p.sub}</div>
                <div style={{ color: T.vermil, fontSize: 13, fontWeight: 700, marginTop: 16 }}>Enter &rarr;</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${T.rule}`, padding: "14px 24px",
        display: "flex", justifyContent: "space-between", fontSize: 12, color: T.inkFaint }}>
        <span style={{ fontFamily: F.display, fontStyle: "italic" }}>RepDesk</span>
        <span>Built for Nigerian universities</span>
      </div>
    </div>
  );
}

// ── REP AUTH ──────────────────────────────────────────────────────────────────
function RepAuth({ onBack, onLogin }) {
  const mob = useIsMobile();
  const [mode,    setMode]  = useState("login");
  const [email,   setEmail] = useState("");
  const [pass,    setPass]  = useState("");
  const [name,    setName]  = useState("");
  const [uni,     setUni]   = useState("");
  const [dept,    setDept]  = useState("");
  const [level,   setLevel] = useState("");
  const [err,     setErr]   = useState("");
  const [loading, setLoad]  = useState(false);

  const submit = async () => {
    setErr(""); setLoad(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) { setErr(error.message); setLoad(false); return; }
        const { data: profile } = await supabase.from("reps").select("*").eq("id", data.user.id).single();
        onLogin(profile);
      } else {
        if (!name || !uni || !dept) { setErr("Please fill in all fields."); setLoad(false); return; }
        const { data, error } = await supabase.auth.signUp({ email, password: pass });
        if (error) { setErr(error.message); setLoad(false); return; }
        await supabase.from("reps").insert({ id: data.user.id, name, university: uni, department: dept, level });
        const { data: profile } = await supabase.from("reps").select("*").eq("id", data.user.id).single();
        onLogin(profile);
      }
    } catch(e) { setErr("Something went wrong. Try again."); }
    setLoad(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: F.body, color: T.ink }}>
      <div style={{ height: 3, background: T.vermil }} />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: mob ? "32px 20px" : "60px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.inkFaint,
          cursor: "pointer", fontSize: 13, fontFamily: F.body, padding: 0, marginBottom: 32 }}>&larr; Back</button>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: F.display, fontSize: 36, fontWeight: 400, margin: "0 0 6px", letterSpacing: "-0.5px" }}>
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p style={{ color: T.inkMid, fontSize: 14, margin: 0 }}>
            {mode === "login" ? "Access your rep dashboard." : "Set up your class dashboard."}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "register" && (
            <>
              <Input label="Full name" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              <Input label="University" placeholder="e.g. Fountain University, Osogbo" value={uni} onChange={e => setUni(e.target.value)} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Department" placeholder="e.g. Nursing Science" value={dept} onChange={e => setDept(e.target.value)} />
                <Input label="Level" placeholder="e.g. 200" value={level} onChange={e => setLevel(e.target.value)} />
              </div>
            </>
          )}
          <Input label="Email address" type="email" placeholder="you@school.edu.ng" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Password" type="password" placeholder="..." value={pass} onChange={e => setPass(e.target.value)} />
          {err && <div style={{ color: T.fail, fontSize: 13, padding: "10px 14px",
            background: T.failBg, borderRadius: 4, borderLeft: `3px solid ${T.fail}` }}>{err}</div>}
          <PrimaryBtn onClick={submit} disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </PrimaryBtn>
          <div style={{ textAlign: "center", fontSize: 13, color: T.inkFaint }}>
            {mode === "login"
              ? <>New rep? <span style={{ color: T.vermil, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => { setMode("register"); setErr(""); }}>Create account</span></>
              : <>Have an account? <span style={{ color: T.vermil, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => { setMode("login"); setErr(""); }}>Sign in</span></>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REP DASHBOARD ─────────────────────────────────────────────────────────────
function RepDashboard({ rep, setRep, onLogout }) {
  const mob = useIsMobile();
  const [drives,      setDrives]      = useState([]);
  const [activeDrive, setActiveDrive] = useState(null);
  const [students,    setStudents]    = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loadingD,    setLoadingD]    = useState(true);
  const [loadingS,    setLoadingS]    = useState(false);
  const [tab,         setTab]         = useState("overview");
  const [toast,       setToast]       = useState(null);
  const show = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); };

  // Load all drives for this rep
  useEffect(() => {
    supabase.from("drives").select("*").eq("rep_id", rep.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        setDrives(data || []);
        if (data?.length) setActiveDrive(data[0]);
        setLoadingD(false);
      });
  }, [rep.id]);

  // Load students and submissions when active drive changes
  useEffect(() => {
    if (!activeDrive) return;
    setLoadingS(true);
    Promise.all([
      supabase.from("students").select("*").eq("drive_id", activeDrive.id).order("name"),
      supabase.from("submissions").select("*").eq("drive_id", activeDrive.id).order("created_at", { ascending: false }),
    ]).then(([{ data: s }, { data: sub }]) => {
      setStudents(s || []);
      setSubmissions(sub || []);
      setLoadingS(false);
    });

    const channel = supabase.channel("subs-" + activeDrive.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "submissions",
        filter: `drive_id=eq.${activeDrive.id}` },
        payload => setSubmissions(p => [payload.new, ...p])
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [activeDrive?.id]);

  const verified = submissions.filter(s => s.status === "verified");
  const flagged  = submissions.filter(s => s.status === "flagged");
  const paidSet  = new Set(verified.map(s => s.matric));
  const unpaid   = students.filter(s => !paidSet.has(s.matric));

  const approve = async (id) => {
    await supabase.from("submissions").update({ status: "verified", flag_reason: null }).eq("id", id);
    setSubmissions(p => p.map(s => s.id===id ? {...s, status:"verified", flag_reason:null} : s));
    show("Submission approved.");
  };

  const reject = async (id) => {
    await supabase.from("submissions").delete().eq("id", id);
    setSubmissions(p => p.filter(s => s.id!==id));
    show("Submission rejected.", "warn");
  };

  const exportToExcel = () => {
    const paidRows   = verified.map(s => ({ Name: s.name, Matric: s.matric, Reference: s.ref_no, Amount: s.amount, Bank: s.bank, Date: s.date }));
    const unpaidRows = unpaid.map(s => ({ Name: s.name, Matric: s.matric }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paidRows),   "Paid");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unpaidRows), "Unpaid");
    XLSX.writeFile(wb, `${activeDrive?.name || "RepDesk"}-export.xlsx`);
    show("Export downloaded.");
  };

  const updateDrive = (updated) => {
    setActiveDrive(updated);
    setDrives(p => p.map(d => d.id === updated.id ? updated : d));
  };

  if (loadingD) return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.body, color: T.inkFaint }}>
      Loading...
    </div>
  );

  // No drives yet — show drive creation first
  if (!drives.length) return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: F.body, color: T.ink }}>
      <div style={{ height: 3, background: T.vermil }} />
      <div style={{ background: "#fff", borderBottom: `1px solid ${T.rule}`, padding: "0 24px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: F.display, fontSize: 18, fontStyle: "italic" }}>Rep<span style={{ color: T.vermil }}>Desk</span></span>
        <GhostBtn style={{ padding: "5px 12px", fontSize: 12 }} onClick={onLogout}>Sign out</GhostBtn>
      </div>
      <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 20px" }}>
        <div style={{ fontFamily: F.display, fontSize: 28, marginBottom: 8 }}>Welcome, {rep.name.split(" ")[0]}.</div>
        <p style={{ color: T.inkMid, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          You don't have any payment drives yet. Create your first one to get started.
        </p>
        <CreateDriveForm repId={rep.id} onCreated={d => { setDrives([d]); setActiveDrive(d); }} show={show} />
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: F.body, color: T.ink }}>
      <div style={{ height: 3, background: T.vermil }} />
      {/* Top bar */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${T.rule}`,
        padding: mob ? "0 16px" : "0 32px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 20 }}>
          <span style={{ fontFamily: F.display, fontSize: 18, fontStyle: "italic" }}>Rep<span style={{ color: T.vermil }}>Desk</span></span>
          {!mob && <><span style={{ color: T.rule }}>|</span>
          <span style={{ fontSize: 13, color: T.inkFaint }}>{rep.department} &mdash; {rep.university}</span></>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: T.inkMid }}>{rep.name.split(" ")[0]}</span>
          <GhostBtn style={{ padding: "5px 12px", fontSize: 12 }} onClick={onLogout}>Sign out</GhostBtn>
        </div>
      </div>

      {/* Drive selector bar */}
      <div style={{ background: T.navy, padding: mob ? "0 16px" : "0 32px",
        display: "flex", alignItems: "center", gap: 0, overflowX: "auto", minHeight: 44 }}>
        {drives.map(d => (
          <button key={d.id} onClick={() => { setActiveDrive(d); setTab("overview"); }}
            style={{ background: activeDrive?.id===d.id ? T.vermil : "transparent",
              color: activeDrive?.id===d.id ? "#fff" : "#6B7280",
              border: "none", padding: "10px 16px", cursor: "pointer", fontFamily: F.body,
              fontSize: 12.5, fontWeight: activeDrive?.id===d.id ? 700 : 500,
              whiteSpace: "nowrap", transition: "background .15s" }}>
            {d.name}
            {d.closed && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>(closed)</span>}
          </button>
        ))}
        <button onClick={() => setTab("newdrive")}
          style={{ background: "transparent", color: "#4A5568", border: "none",
            padding: "10px 16px", cursor: "pointer", fontFamily: F.body, fontSize: 12.5,
            whiteSpace: "nowrap" }}>
          + New drive
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: mob ? "0 12px" : "0 32px" }}>
        {tab !== "newdrive" && (
          <div style={{ display: "flex", alignItems: "flex-end", borderBottom: `1px solid ${T.rule}`,
            paddingTop: 20, marginBottom: 24, overflowX: "auto" }}>
            <NavItem label="Overview"    active={tab==="overview"}    onClick={() => setTab("overview")} />
            <NavItem label="Submissions" active={tab==="submissions"} onClick={() => setTab("submissions")} count={submissions.length} />
            <NavItem label="Class List"  active={tab==="classlist"}   onClick={() => setTab("classlist")}  count={students.length} />
            <NavItem label="Flagged"     active={tab==="flags"}       onClick={() => setTab("flags")}       count={flagged.length} />
            <NavItem label="Drive Setup" active={tab==="drive"}       onClick={() => setTab("drive")} />
            <NavItem label="Export"      active={tab==="export"}      onClick={() => setTab("export")} />
          </div>
        )}

        {tab === "newdrive" && (
          <div style={{ maxWidth: 480, paddingTop: 32 }}>
            <button onClick={() => setTab("overview")} style={{ background: "none", border: "none",
              color: T.inkFaint, cursor: "pointer", fontSize: 13, fontFamily: F.body,
              padding: 0, marginBottom: 24 }}>&larr; Back</button>
            <div style={{ fontFamily: F.display, fontSize: 24, marginBottom: 8 }}>New payment drive</div>
            <p style={{ color: T.inkMid, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Each drive has its own class list, student link, and submissions.
            </p>
            <CreateDriveForm repId={rep.id} onCreated={d => {
              setDrives(p => [d, ...p]); setActiveDrive(d);
              setStudents([]); setSubmissions([]); setTab("overview");
              show("New drive created.");
            }} show={show} />
          </div>
        )}

        {loadingS && tab !== "newdrive"
          ? <div style={{ textAlign: "center", padding: "60px 0", color: T.inkFaint }}>Loading...</div>
          : <>
              {tab==="overview"    && <RepOverview verified={verified} flagged={flagged} unpaid={unpaid} students={students} drive={activeDrive} mob={mob} />}
              {tab==="submissions" && <RepSubmissions submissions={submissions} onApprove={approve} onReject={reject} mob={mob} />}
              {tab==="classlist"   && <RepClassList repId={rep.id} driveId={activeDrive?.id} students={students} setStudents={setStudents} paidSet={paidSet} show={show} mob={mob} />}
              {tab==="flags"       && <RepFlags flagged={flagged} onApprove={approve} onReject={reject} />}
              {tab==="drive"       && <DriveSetup drive={activeDrive} repId={rep.id} onUpdated={updateDrive} show={show} rep={rep} setRep={setRep} />}
              {tab==="export"      && <ExportTab verified={verified} unpaid={unpaid} drive={activeDrive} onExport={exportToExcel} onUpdated={updateDrive} show={show} />}
            </>
        }
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ── CREATE DRIVE FORM ─────────────────────────────────────────────────────────
function CreateDriveForm({ repId, onCreated, show }) {
  const [name,     setName]     = useState("");
  const [amount,   setAmount]   = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving,   setSaving]   = useState(false);

  const create = async () => {
    if (!name.trim() || !amount) { show("Fill in drive name and amount.", "warn"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("drives").insert({
      rep_id: repId, name: name.trim(), amount: parseFloat(amount), deadline,
    }).select().single();
    if (!error) { onCreated(data); }
    else show(error.message, "error");
    setSaving(false);
  };

  return (
    <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 24, background: "#fff",
      display: "flex", flexDirection: "column", gap: 16 }}>
      <Input label="Payment purpose" placeholder="e.g. Departmental Excursion Levy" value={name} onChange={e => setName(e.target.value)} />
      <Input label="Amount (NGN)" type="number" placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)} />
      <Input label="Deadline (optional)" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
      <PrimaryBtn onClick={create} disabled={saving}>{saving ? "Creating..." : "Create drive"}</PrimaryBtn>
    </div>
  );
}

// ── DRIVE SETUP ───────────────────────────────────────────────────────────────
function DriveSetup({ drive, repId, onUpdated, show, rep, setRep }) {
  const [name,     setName]     = useState(drive?.name || "");
  const [amount,   setAmount]   = useState(drive?.amount || "");
  const [deadline, setDeadline] = useState(drive?.deadline || "");
  const [accName,  setAccName]  = useState(rep?.account_name || "");
  const [accNum,   setAccNum]   = useState(rep?.account_number || "");
  const [bankName, setBankName] = useState(rep?.bank_name || "");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    setName(drive?.name || "");
    setAmount(drive?.amount || "");
    setDeadline(drive?.deadline || "");
  }, [drive?.id]);

  const save = async () => {
    if (!name.trim() || !amount) { show("Fill in drive name and amount.", "warn"); return; }
    setSaving(true);
    const [{ data: driveData, error: driveErr }, { error: repErr }] = await Promise.all([
      supabase.from("drives").update({ name: name.trim(), amount: parseFloat(amount), deadline }).eq("id", drive.id).select().single(),
      supabase.from("reps").update({ account_name: accName.trim(), account_number: accNum.trim(), bank_name: bankName.trim() }).eq("id", repId),
    ]);
    if (!driveErr && !repErr) {
      onUpdated(driveData);
      setRep(r => ({ ...r, account_name: accName.trim(), account_number: accNum.trim(), bank_name: bankName.trim() }));
      show("Drive and account details saved.");
    } else show((driveErr || repErr).message, "error");
    setSaving(false);
  };

  const studentLink = `${window.location.origin}?rep=${repId}&drive=${drive?.id}`;

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 24, background: "#fff",
        display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint }}>Drive details</div>
        <Input label="Payment purpose" placeholder="e.g. Departmental Excursion Levy" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Amount (NGN)" type="number" placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)} />
        <Input label="Deadline (optional)" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
      </div>

      <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 24, background: "#fff",
        display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 4 }}>Your account details</div>
        <p style={{ color: T.inkMid, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Students will see this when they submit. The scanner will also check that their receipt shows a transfer to this account number.
        </p>
        <Input label="Account name" placeholder="e.g. ADEBAYO MUSA" value={accName} onChange={e => setAccName(e.target.value)} />
        <Input label="Account number" placeholder="e.g. 0123456789" value={accNum} onChange={e => setAccNum(e.target.value)} />
        <Input label="Bank" placeholder="e.g. GTBank" value={bankName} onChange={e => setBankName(e.target.value)} />
      </div>

      <PrimaryBtn onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</PrimaryBtn>

      <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 18, background: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 8 }}>Student portal link</div>
        <p style={{ color: T.inkMid, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
          Share this with your class. Students will only see this drive's class list.
        </p>
        <div style={{ background: T.paper, border: `1px solid ${T.rule}`, borderRadius: 4,
          padding: "10px 14px", fontFamily: F.mono, fontSize: 12, color: T.inkMid,
          wordBreak: "break-all", marginBottom: 12 }}>
          {studentLink}
        </div>
        <GhostBtn style={{ width: "100%" }} onClick={() => {
          navigator.clipboard.writeText(studentLink);
          show("Link copied to clipboard.");
        }}>Copy link</GhostBtn>
      </div>
    </div>
  );
}

// ── EXPORT TAB ────────────────────────────────────────────────────────────────
function ExportTab({ verified, unpaid, drive, onExport, onUpdated, show }) {
  const [saving, setSaving] = useState(false);

  const toggleClose = async () => {
    const newState = !drive.closed;
    if (newState && !window.confirm("Close this drive? Students will no longer be able to submit.")) return;
    setSaving(true);
    const { data, error } = await supabase.from("drives").update({ closed: newState }).eq("id", drive.id).select().single();
    if (!error) { onUpdated(data); show(newState ? "Drive closed." : "Drive reopened."); }
    else show(error.message, "error");
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 24, background: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 8 }}>Export register</div>
        <p style={{ color: T.inkMid, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          Download an Excel file with two sheets — Paid and Unpaid. Share with your lecturer or HOD.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
          background: T.rule, borderRadius: 6, overflow: "hidden", marginBottom: 20 }}>
          {[
            { label: "Paid",   val: verified.length, color: T.pass },
            { label: "Unpaid", val: unpaid.length,   color: T.warn },
            { label: "Total",  val: verified.length + unpaid.length, color: T.ink },
          ].map(s => (
            <div key={s.label} style={{ background: T.paper, padding: "16px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: F.display }}>{s.val}</div>
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <PrimaryBtn onClick={onExport} style={{ width: "100%" }}>Download Excel file</PrimaryBtn>
      </div>

      <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 24, background: "#fff" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 8 }}>Drive status</div>
        <p style={{ color: T.inkMid, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          {drive?.closed ? "This drive is closed. Students cannot submit." : "This drive is open. Students can still submit."}
        </p>
        {drive?.closed
          ? <GhostBtn onClick={toggleClose} disabled={saving} style={{ width: "100%" }}>Reopen drive</GhostBtn>
          : <DangerBtn onClick={toggleClose} disabled={saving} style={{ width: "100%", padding: "11px 24px", fontSize: 13.5 }}>
              {saving ? "Closing..." : "Close drive"}
            </DangerBtn>
        }
      </div>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function RepOverview({ verified, flagged, unpaid, students, drive, mob }) {
  const pct = students.length ? Math.round((verified.length / students.length) * 100) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 280px", gap: 24, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(3,1fr)", gap: 1,
          background: T.rule, borderRadius: 6, overflow: "hidden" }}>
          {[
            { label: "Confirmed paid",   val: verified.length, sub: drive?.amount ? fmt(verified.length * drive.amount) : "—", color: T.pass },
            { label: "Not yet paid",     val: unpaid.length,   sub: drive?.amount ? fmt(unpaid.length * drive.amount) + " outstanding" : "—", color: T.warn },
            { label: "Flagged receipts", val: flagged.length,  sub: "requires review", color: T.fail },
          ].map((s,i) => (
            <div key={s.label} style={{ background: T.paper, padding: mob ? "16px 14px" : "22px 20px",
              gridColumn: mob && i===2 ? "span 2" : "auto" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: mob ? 32 : 40, fontWeight: 900, color: s.color, fontFamily: F.display, lineHeight: 1, letterSpacing: "-1px" }}>{s.val}</div>
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 5 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: T.inkFaint, marginBottom: 12 }}>Still waiting on</div>
          {unpaid.length === 0
            ? <div style={{ color: T.pass, fontSize: 14, fontWeight: 600 }}>All students have paid.</div>
            : <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, overflow: "hidden" }}>
                {unpaid.map((s,i) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "11px 14px", borderBottom: i<unpaid.length-1 ? `1px solid ${T.rule}` : "none",
                    background: i%2===0 ? "#fff" : T.paper, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 11.5, color: T.inkFaint }}>{s.matric}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {!mob && (
        <div style={{ position: "sticky", top: 80 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: T.inkFaint, marginBottom: 14 }}>Collection Register</div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 72, fontWeight: 400,
              color: pct===100 ? T.pass : T.ink, lineHeight: 1, letterSpacing: "-2px" }}>
              {pct}<span style={{ fontSize: 32, color: T.inkFaint }}>%</span>
            </div>
            <div style={{ fontSize: 13, color: T.inkFaint, marginTop: 4 }}>{verified.length} of {students.length} students</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {students.map((st,i) => {
              const isPaid = !!verified.find(v => v.matric === st.matric);
              return (
                <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 10, opacity: isPaid ? 1 : 0.45 }}>
                  <div style={{ width: 3, height: 22, borderRadius: 2, background: isPaid ? T.vermil : T.rule, flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, color: isPaid ? T.ink : T.inkFaint, fontWeight: isPaid ? 600 : 400,
                    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.name}</div>
                  {isPaid && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.pass, flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mob && (
        <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 16, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkFaint }}>Collection</div>
            <div style={{ fontFamily: F.display, fontSize: 32, fontWeight: 400, color: pct===100 ? T.pass : T.ink, letterSpacing: "-1px" }}>
              {pct}<span style={{ fontSize: 18, color: T.inkFaint }}>%</span>
            </div>
          </div>
          <div style={{ background: T.rule, borderRadius: 2, height: 5, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct===100 ? T.pass : T.vermil, borderRadius: 2, transition: "width .6s" }} />
          </div>
          <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 8 }}>{verified.length} of {students.length} students confirmed</div>
        </div>
      )}
    </div>
  );
}

// ── SUBMISSIONS ───────────────────────────────────────────────────────────────
function RepSubmissions({ submissions, onApprove, onReject, mob }) {
  if (!submissions.length) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: T.inkFaint }}>No submissions yet.</div>
  );

  if (mob) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {submissions.map(s => (
        <div key={s.id} style={{ border: `1px solid ${T.rule}`, borderRadius: 4, background: "#fff", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11.5, color: T.inkFaint }}>{s.matric}</div>
            </div>
            <Chip status={s.status} />
          </div>
          {[["Ref", s.ref_no], ["Amount", fmt(s.amount)], ["Bank", s.bank], ["Date", s.date]].map(([k,v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13,
              padding: "5px 0", borderBottom: `1px solid ${T.rule}` }}>
              <span style={{ color: T.inkFaint }}>{k}</span>
              <span style={{ fontWeight: 500, fontFamily: k==="Ref" ? F.mono : F.body, fontSize: k==="Ref" ? 11 : 13 }}>{v}</span>
            </div>
          ))}
          {s.flag_reason && <div style={{ color: T.fail, fontSize: 12, marginTop: 8 }}>{s.flag_reason}</div>}
          {s.status==="flagged" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <SuccessBtn onClick={() => onApprove(s.id)} style={{ flex: 1 }}>Approve</SuccessBtn>
              <DangerBtn  onClick={() => onReject(s.id)}  style={{ flex: 1 }}>Reject</DangerBtn>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 700 }}>
          <thead>
            <tr style={{ background: T.ink }}>
              {["Student","Matric","Reference","Amount","Bank","Date","Status",""].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10.5,
                  color: "#6B7280", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map((s,i) => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${T.rule}`, background: i%2===0 ? "#fff" : T.paper }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: "12px 14px", fontFamily: F.mono, color: T.inkFaint, fontSize: 12 }}>{s.matric}</td>
                <td style={{ padding: "12px 14px", fontFamily: F.mono, color: T.inkMid, fontSize: 12 }}>{s.ref_no}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{fmt(s.amount)}</td>
                <td style={{ padding: "12px 14px", color: T.inkFaint }}>{s.bank}</td>
                <td style={{ padding: "12px 14px", color: T.inkFaint, fontSize: 12 }}>{s.date}</td>
                <td style={{ padding: "12px 14px" }}>
                  <Chip status={s.status} />
                  {s.flag_reason && <div style={{ color: T.fail, fontSize: 11, marginTop: 4 }}>{s.flag_reason}</div>}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {s.status==="flagged" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <SuccessBtn onClick={() => onApprove(s.id)}>Approve</SuccessBtn>
                      <DangerBtn  onClick={() => onReject(s.id)}>Reject</DangerBtn>
                    </div>
                  )}
                  {s.status==="verified" && <span style={{ color: T.pass, fontSize: 12, fontWeight: 700 }}>Confirmed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CLASS LIST ────────────────────────────────────────────────────────────────
function RepClassList({ repId, driveId, students, setStudents, paidSet, show, mob }) {
  const [addName,   setAddName]   = useState("");
  const [addMatric, setAddMatric] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [preview,   setPreview]   = useState([]);
  const [saving,    setSaving]    = useState(false);
  const fileRef = useRef();

  const addOne = async () => {
    if (!addName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("students")
      .insert({ rep_id: repId, drive_id: driveId, name: addName.trim(), matric: addMatric.trim() }).select().single();
    if (!error) { setStudents(p => [...p, data]); show("Student added."); }
    else show(error.message, "error");
    setAddName(""); setAddMatric(""); setSaving(false);
  };

  const remove = async (id) => {
    await supabase.from("students").delete().eq("id", id);
    setStudents(p => p.filter(s => s.id !== id));
    show("Student removed.", "warn");
  };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = ev => {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const text = rows.map(r => r.join("\t")).join("\n");
        setPasteText(text); setPasteMode(true);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const r = new FileReader();
      r.onload = ev => { setPasteText(ev.target.result); setPasteMode(true); };
      r.readAsText(file);
    }
  };

  const confirmImport = async () => {
    const existing = new Set(students.map(s => s.matric));
    const toAdd = preview.filter(p => !existing.has(p.matric)).map(p => ({ rep_id: repId, drive_id: driveId, name: p.name, matric: p.matric }));
    if (!toAdd.length) { show("No new students to add.", "warn"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("students").insert(toAdd).select();
    if (!error) { setStudents(p => [...p, ...data]); show(`${data.length} student${data.length!==1?"s":""} imported.`); }
    else show(error.message, "error");
    setPasteText(""); setPreview([]); setPasteMode(false); setSaving(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 300px", gap: 20, alignItems: "start" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 12 }}>
          Registered students ({students.length})
        </div>
        {students.length === 0
          ? <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: "40px 20px",
              textAlign: "center", color: T.inkFaint, background: "#fff" }}>
              No students yet. Add them using the panel {mob ? "below" : "on the right"}.
            </div>
          : <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.ink }}>
                    {["#","Name","Matric","Payment",""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5,
                        color: "#6B7280", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((st,i) => (
                    <tr key={st.id} style={{ borderBottom: `1px solid ${T.rule}`, background: i%2===0 ? "#fff" : T.paper }}>
                      <td style={{ padding: "10px 12px", color: T.inkFaint, fontSize: 12, fontFamily: F.mono }}>{String(i+1).padStart(2,"0")}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 500, fontSize: 13 }}>{st.name}</td>
                      <td style={{ padding: "10px 12px", fontFamily: F.mono, color: T.inkFaint, fontSize: 11.5 }}>{st.matric||"—"}</td>
                      <td style={{ padding: "10px 12px" }}><Chip status={paidSet.has(st.matric) ? "verified" : "pending"} /></td>
                      <td style={{ padding: "10px 12px" }}>
                        <button onClick={() => remove(st.id)} style={{ background: "none", border: "none",
                          color: T.inkFaint, cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 18, background: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 14 }}>Add student</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Full name" placeholder="Student's full name" value={addName} onChange={e => setAddName(e.target.value)} />
            <Input label="Matric number" placeholder="Any format" value={addMatric} onChange={e => setAddMatric(e.target.value)} />
            <PrimaryBtn onClick={addOne} disabled={saving}>Add student</PrimaryBtn>
          </div>
        </div>

        <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: 18, background: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 6 }}>Bulk import</div>
          <div style={{ color: T.inkFaint, fontSize: 12.5, lineHeight: 1.6, marginBottom: 14 }}>Upload any file or paste a list. One student per line.</div>
          {!pasteMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div onClick={() => fileRef.current.click()}
                style={{ border: `1px dashed ${T.ruleHard}`, borderRadius: 4, padding: "20px 14px", textAlign: "center", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=T.vermil; e.currentTarget.style.background=T.vermilBg; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=T.ruleHard; e.currentTarget.style.background=""; }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.inkMid, marginBottom: 3 }}>Upload file</div>
                <div style={{ fontSize: 12, color: T.inkFaint }}>Excel, PDF, Word, CSV, TXT</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,.docx,.doc,.csv,.txt" style={{ display: "none" }} onChange={handleFile} />
              <GhostBtn onClick={() => setPasteMode(true)}>Paste list instead</GhostBtn>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea style={{ ...inp, resize: "vertical", minHeight: 90, lineHeight: 1.7 }}
                placeholder={"Adebayo Musa\tXX/25/001\nFatima Yusuf\tXX/25/002"}
                value={pasteText} onChange={e => setPasteText(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <PrimaryBtn onClick={() => setPreview(parseBulk(pasteText))}>Preview</PrimaryBtn>
                <GhostBtn onClick={() => { setPasteMode(false); setPasteText(""); setPreview([]); }}>Cancel</GhostBtn>
              </div>
              {preview.length > 0 && (
                <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ background: T.passBg, padding: "8px 14px", fontSize: 12.5, color: T.pass, fontWeight: 700, borderBottom: `1px solid ${T.rule}` }}>
                    {preview.length} students detected
                  </div>
                  {preview.slice(0,4).map((p,i) => (
                    <div key={i} style={{ padding: "8px 14px", fontSize: 12.5, color: T.inkMid, borderBottom: `1px solid ${T.rule}` }}>
                      {p.name} {p.matric && <span style={{ color: T.inkFaint, fontFamily: F.mono, fontSize: 11 }}>{p.matric}</span>}
                    </div>
                  ))}
                  {preview.length > 4 && <div style={{ padding: "8px 14px", fontSize: 12, color: T.inkFaint }}>+{preview.length-4} more</div>}
                  <div style={{ padding: "12px 14px" }}>
                    <PrimaryBtn onClick={confirmImport} disabled={saving} style={{ width: "100%" }}>
                      {saving ? "Importing..." : "Confirm import"}
                    </PrimaryBtn>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FLAGGED ───────────────────────────────────────────────────────────────────
function RepFlags({ flagged, onApprove, onReject }) {
  if (!flagged.length) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: T.inkFaint }}>No flagged submissions. All clear.</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {flagged.map(s => (
        <div key={s.id} style={{ border: `1px solid ${T.rule}`, borderLeft: `4px solid ${T.fail}`, borderRadius: 4, background: "#fff" }}>
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
              <div style={{ color: T.inkFaint, fontSize: 12, fontFamily: F.mono, marginTop: 2 }}>{s.matric}</div>
            </div>
            <Chip status="flagged" />
          </div>
          <div style={{ padding: "10px 18px", background: T.failBg, borderBottom: `1px solid #F0B8B3`, fontSize: 13, color: T.fail }}>{s.flag_reason}</div>
          <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderBottom: `1px solid ${T.rule}` }}>
            {[["Reference",s.ref_no,true],["Amount",fmt(s.amount),false],["Bank",s.bank,false],["Date",s.date,false]].map(([k,v,mono]) => (
              <div key={k}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 4 }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: 13, fontFamily: mono ? F.mono : F.body }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 18px", display: "flex", gap: 10 }}>
            <SuccessBtn onClick={() => onApprove(s.id)}>Approve</SuccessBtn>
            <DangerBtn  onClick={() => onReject(s.id)}>Reject &amp; remove</DangerBtn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── STUDENT PORTAL ────────────────────────────────────────────────────────────
function StudentPortal({ students, submissions, setSubmissions, repId, driveId, drive, repAccount, onBack }) {
  const mob = useIsMobile();
  const [step,    setSt]    = useState("pick");
  const [sel,     setSel]   = useState(null);
  const [scanning,setScan]  = useState(false);
  const [scanned, setScnd]  = useState(null);
  const [saving,  setSaving]= useState(false);
  const [toast,   setToast] = useState(null);
  const [search,  setSearch]= useState("");
  const fileRef = useRef();

  const show = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const validate = (data) => {
    if (submissions.map(s=>s.ref_no).includes(data.refNo)) return "Duplicate reference number";
    const expected = parseFloat(drive?.amount);
    const received = parseFloat(data.amount);
    if (expected && received && received !== expected) {
      return `Amount mismatch — expected ${fmt(expected)}, found ${fmt(received)}`;
    }
    if (repAccount?.account_number && data.accountNumber) {
      const repAcc = repAccount.account_number.replace(/\s/g, "");
      const receiptAcc = data.accountNumber.replace(/\s/g, "");
      if (receiptAcc && !receiptAcc.includes(repAcc) && !repAcc.includes(receiptAcc)) {
        return `Account number mismatch — payment not sent to the rep's account`;
      }
    }
    return null;
  };

  const scanReceipt = async (file) => {
    setScan(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(",")[1];
        const mediaType = file.type || "image/jpeg";
        const res = await fetch("/.netlify/functions/scan-receipt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        });
        const data = await res.json();
        if (data.error) { show("Could not read receipt. Please try a clearer image.", "error"); setScan(false); return; }
        setScnd({
          refNo: data.refNo||"UNKNOWN",
          amount: data.amount||0,
          bank: data.bank||"Unknown Bank",
          date: data.date||today(),
          accountNumber: data.accountNumber||"",
        });
        setScan(false);
      };
      reader.readAsDataURL(file);
    } catch (err) { show("Something went wrong scanning the receipt.", "error"); setScan(false); }
  };

  const submitReceipt = async () => {
    if (!sel||!scanned) return;
    setSaving(true);
    const flag = validate(scanned);
    const { data, error } = await supabase.from("submissions").insert({
      rep_id: repId, drive_id: driveId, student_id: sel.id,
      name: sel.name, matric: sel.matric, method: "receipt",
      ref_no: scanned.refNo, amount: scanned.amount, bank: scanned.bank, date: scanned.date,
      status: flag ? "flagged" : "verified", flag_reason: flag||null,
    }).select().single();
    if (!error) { setSubmissions(p=>[...p,data]); setSt("done"); }
    else show(error.message,"error");
    setSaving(false);
  };

  const finalSub = sel ? submissions.slice().reverse().find(s=>s.matric===sel.matric) : null;

  const TopBar = ({ back }) => (
    <>
      <div style={{ height: 3, background: T.vermil }} />
      <div style={{ background: "#fff", borderBottom: `1px solid ${T.rule}`,
        padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: F.display, fontSize: 18, fontStyle: "italic" }}>Rep<span style={{ color: T.vermil }}>Desk</span></span>
        <GhostBtn style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={back}>Back</GhostBtn>
      </div>
      {drive?.name && (
        <div style={{ background: T.navy, padding: "9px 20px", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, flexWrap: "wrap" }}>
          <span style={{ color: T.vermil, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Drive</span>
          <span style={{ color: "#4A5568" }}>—</span>
          <span style={{ color: T.paper }}>{drive.name}</span>
          {drive.amount > 0 && <><span style={{ color: "#4A5568" }}>/</span>
          <span style={{ color: T.vermil, fontWeight: 700 }}>{fmt(drive.amount)}</span></>}
        </div>
      )}
    </>
  );

  const Wrap = ({ children, back }) => (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: F.body, color: T.ink }}>
      <TopBar back={back} />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: mob ? "24px 16px" : "36px 20px" }}>{children}</div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );

  if (step==="pick") return (
    <Wrap back={onBack}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 8 }}>Step 1 of 2</div>
        <h2 style={{ fontFamily: F.display, fontSize: mob ? 26 : 32, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.5px" }}>Find your name</h2>
        <p style={{ color: T.inkMid, fontSize: 14, margin: 0, lineHeight: 1.6 }}>Select your name from the class list. No account or login required.</p>
      </div>

      {drive?.closed && (
        <div style={{ background: T.failBg, border: `1px solid #F0B8B3`, borderRadius: 4,
          padding: "12px 16px", marginBottom: 16, fontSize: 13.5, color: T.fail }}>
          This payment drive has been closed by the course rep. No more submissions are being accepted.
        </div>
      )}

      {!drive?.closed && students.length > 0 && (
        <input style={{ ...inp, marginBottom: 14 }} placeholder="Search your name..."
          value={search} onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor = T.vermil}
          onBlur={e => e.target.style.borderColor = T.rule} />
      )}

      {students.length===0
        ? <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: "36px 20px", textAlign: "center", color: T.inkFaint, background: "#fff" }}>
            Your course rep has not added the class list yet.
          </div>
        : (() => {
            const filtered = students.filter(st =>
              st.name.toLowerCase().includes(search.toLowerCase()) ||
              (st.matric && st.matric.toLowerCase().includes(search.toLowerCase()))
            );
            return filtered.length === 0
              ? <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: "28px 20px",
                  textAlign: "center", color: T.inkFaint, background: "#fff", fontSize: 14 }}>
                  No results for "{search}"
                </div>
              : <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, overflow: "hidden" }}>
                  {filtered.map((st,i) => {
                    const sub = submissions.find(s=>s.matric===st.matric);
                    return (
                      <div key={st.id}
                        onClick={() => { if (drive?.closed) return; if (!sub||sub.status==="flagged") { setSel(st); setSt("upload"); } }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: mob ? "14px 14px" : "14px 18px",
                          borderBottom: i<filtered.length-1 ? `1px solid ${T.rule}` : "none",
                          background: i%2===0 ? "#fff" : T.paper,
                          cursor: sub&&sub.status==="verified" ? "default" : "pointer", transition: "background .15s" }}
                        onMouseEnter={e => { if (!sub||sub.status!=="verified") e.currentTarget.style.background=T.vermilBg; }}
                        onMouseLeave={e => { e.currentTarget.style.background=i%2===0?"#fff":T.paper; }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{st.name}</div>
                          {st.matric && <div style={{ fontFamily: F.mono, fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>{st.matric}</div>}
                        </div>
                        {sub ? <Chip status={sub.status} /> : <span style={{ fontSize: 12.5, color: T.inkFaint, whiteSpace: "nowrap" }}>Select &rarr;</span>}
                      </div>
                    );
                  })}
                </div>;
          })()
      }
    </Wrap>
  );

  if (step==="upload") return (
    <Wrap back={() => { setSt("pick"); setSel(null); setScnd(null); }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 8 }}>Step 2 of 2</div>
        <h2 style={{ fontFamily: F.display, fontSize: mob ? 26 : 32, fontWeight: 400, margin: "0 0 12px", letterSpacing: "-0.5px" }}>Upload receipt</h2>
        <div style={{ background: T.vermilBg, border: `1px solid #F5C4B3`, borderRadius: 4, padding: "10px 14px", marginBottom: 14, fontSize: 13.5 }}>
          Submitting as: <strong>{sel?.name}</strong>
          {sel?.matric && <span style={{ color: T.inkFaint, fontFamily: F.mono, fontSize: 12, marginLeft: 8 }}>{sel?.matric}</span>}
        </div>

        {repAccount?.account_number && (
          <div style={{ background: T.passBg, border: `1px solid #A8D9BE`, borderRadius: 4, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.pass, marginBottom: 8 }}>Pay to this account</div>
            {[
              ["Account name",   repAccount.account_name],
              ["Account number", repAccount.account_number],
              ["Bank",           repAccount.bank_name],
            ].filter(([,v]) => v).map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5,
                padding: "5px 0", borderBottom: `1px solid #A8D9BE` }}>
                <span style={{ color: T.inkFaint }}>{k}</span>
                <span style={{ fontWeight: 700, fontFamily: k === "Account number" ? F.mono : F.body }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ color: T.inkMid, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Upload a screenshot or photo of your bank receipt. The scanner reads all details automatically.
        </p>
      </div>

      {!scanning && !scanned && (
        <>
          <div onClick={() => fileRef.current.click()}
            style={{ border: `1px dashed ${T.ruleHard}`, borderRadius: 4,
              padding: mob ? "36px 16px" : "52px 20px", textAlign: "center", cursor: "pointer", background: "#fff" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=T.vermil; e.currentTarget.style.background=T.vermilBg; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=T.ruleHard; e.currentTarget.style.background="#fff"; }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.inkMid, marginBottom: 6 }}>Tap to upload receipt</div>
            <div style={{ fontSize: 12.5, color: T.inkFaint }}>Screenshot, photo, or PDF</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }}
            onChange={e => { if (e.target.files[0]) scanReceipt(e.target.files[0]); }} />
        </>
      )}

      {scanning && (
        <div style={{ border: `1px solid ${T.rule}`, borderRadius: 4, padding: "40px 24px", textAlign: "center", background: "#fff" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.inkMid, marginBottom: 14 }}>Reading receipt...</div>
          <div style={{ background: T.rule, borderRadius: 2, height: 4, overflow: "hidden", maxWidth: 200, margin: "0 auto" }}>
            <div style={{ width: "65%", height: "100%", background: T.vermil, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 12.5, color: T.inkFaint, marginTop: 12 }}>Extracting reference number, amount, bank and date</div>
        </div>
      )}

      {scanned && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ border: `1px solid #A8D9BE`, borderRadius: 4, overflow: "hidden", background: "#fff" }}>
            <div style={{ background: T.passBg, padding: "10px 18px", borderBottom: `1px solid #A8D9BE`, fontSize: 12.5, color: T.pass, fontWeight: 700 }}>
              Receipt scanned successfully
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {[["Reference number",scanned.refNo,true],["Amount",fmt(scanned.amount),false],["Bank",scanned.bank,false],["Date",scanned.date,false]].map(([k,v,mono],i) => (
                <div key={k} style={{ padding: "14px 16px", borderBottom: i<2?`1px solid ${T.rule}`:"none", borderRight: i%2===0?`1px solid ${T.rule}`:"none" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.inkFaint, marginBottom: 4 }}>{k}</div>
                  <div style={{ fontWeight: 700, fontSize: mob ? 13 : 14, fontFamily: mono?F.mono:F.body, wordBreak: "break-all" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: T.inkFaint }}>If anything looks wrong, upload a clearer image.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <PrimaryBtn onClick={submitReceipt} disabled={saving} style={{ flex: 1 }}>
              {saving ? "Submitting..." : "Confirm & submit"}
            </PrimaryBtn>
            <GhostBtn onClick={() => setScnd(null)}>Re-upload</GhostBtn>
          </div>
        </div>
      )}
    </Wrap>
  );

  if (step==="done") return (
    <Wrap back={onBack}>
      <div style={{ border: `1px solid ${finalSub?.status==="verified"?"#A8D9BE":"#E8CFA0"}`,
        borderLeft: `4px solid ${finalSub?.status==="verified"?T.pass:T.warn}`,
        borderRadius: 4, overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${T.rule}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            color: finalSub?.status==="verified"?T.pass:T.warn, marginBottom: 8 }}>
            {finalSub?.status==="verified" ? "Payment confirmed" : "Under review"}
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: mob ? 24 : 28, fontWeight: 400, margin: "0 0 8px" }}>
            {finalSub?.status==="verified" ? "You're all set." : "Submitted successfully."}
          </h2>
          <p style={{ color: T.inkMid, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            {finalSub?.status==="verified"
              ? "Your payment has been verified and recorded."
              : "Your receipt has been flagged for manual review. The course rep will confirm shortly."}
          </p>
        </div>
        {finalSub && (
          <div>
            {[["Name",finalSub.name],["Matric",finalSub.matric],
              ["Reference",finalSub.ref_no],["Amount",fmt(finalSub.amount)],["Status",finalSub.status]
            ].map(([k,v],i,arr) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 20px", fontSize: 13.5, borderBottom: i<arr.length-1?`1px solid ${T.rule}`:"none" }}>
                <span style={{ color: T.inkFaint, fontWeight: 500 }}>{k}</span>
                <span style={{ fontWeight: 600, fontFamily: ["Reference","Matric"].includes(k)?F.mono:F.body,
                  fontSize: ["Reference","Matric"].includes(k)?11.5:13.5,
                  color: k==="Status"?(finalSub.status==="verified"?T.pass:T.warn):T.ink,
                  wordBreak: "break-all", textAlign: "right", maxWidth: "60%" }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <GhostBtn onClick={onBack} style={{ marginTop: 16, width: "100%" }}>Back to home</GhostBtn>
    </Wrap>
  );
}

// ── STUDENT PUBLIC WRAPPER ────────────────────────────────────────────────────
function StudentPublicPortal({ onBack }) {
  const [students,    setStudents]    = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [repId,       setRepId]       = useState(null);
  const [driveId,     setDriveId]     = useState(null);
  const [drive,       setDrive]       = useState(null);
  const [repAccount,  setRepAccount]  = useState(null);
  const [notFound,    setNotFound]    = useState(false);

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const rid      = params.get("rep");
    const did      = params.get("drive");
    if (!rid || !did) { setNotFound(true); return; }
    setRepId(rid); setDriveId(did);

    supabase.from("drives").select("*").eq("id", did).eq("rep_id", rid).single()
      .then(({ data }) => { if (data) setDrive(data); else setNotFound(true); });

    supabase.from("reps").select("account_name, account_number, bank_name").eq("id", rid).single()
      .then(({ data }) => { if (data) setRepAccount(data); });

    supabase.from("students").select("*").eq("drive_id", did).order("name")
      .then(({ data }) => setStudents(data || []));

    supabase.from("submissions").select("*").eq("drive_id", did)
      .then(({ data }) => setSubmissions(data || []));
  }, []);

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#F5F4F0", fontFamily: "'Inter', sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ height: 3, background: "#E8400C", marginBottom: 40 }} />
        <div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#0E1423", marginBottom: 12 }}>No class found</div>
        <p style={{ color: "#3D4A63", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          This link is invalid or has expired. Ask your course rep to share the correct link from their Drive Setup page.
        </p>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #DDD9D0",
          color: "#3D4A63", borderRadius: 4, padding: "10px 20px", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13.5 }}>Back to home</button>
      </div>
    </div>
  );

  if (!drive) return (
    <div style={{ minHeight: "100vh", background: "#F5F4F0", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "'Inter', sans-serif", color: "#8C96A8" }}>Loading...</div>
  );

  return <StudentPortal students={students} submissions={submissions}
    setSubmissions={setSubmissions} repId={repId} driveId={driveId}
    drive={drive} repAccount={repAccount} onBack={onBack} />;
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,  setScreen]  = useState("landing");
  const [repUser, setRepUser] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("rep")) { setScreen("student"); return; }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase.from("reps").select("*").eq("id", session.user.id).single();
        if (profile) { setRepUser(profile); setScreen("rep"); }
      }
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setRepUser(null); setScreen("landing");
  };

  if (screen==="landing")  return <Landing onSelect={s => setScreen(s==="rep"?"rep-auth":"student")} />;
  if (screen==="rep-auth") return <RepAuth onBack={() => setScreen("landing")} onLogin={rep => { setRepUser(rep); setScreen("rep"); }} />;
  if (screen==="rep")      return <RepDashboard rep={repUser} setRep={setRepUser} onLogout={logout} />;
  if (screen==="student")  return <StudentPublicPortal onBack={() => setScreen("landing")} />;
}