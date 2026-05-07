import { useState, useEffect, useRef } from "react";
import LegioEditor from "./LegioEditor";
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, deleteField,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, sendPasswordResetEmail,
} from "firebase/auth";
import { db, auth } from "./firebase";

/* ── Google Fonts ── */
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Share+Tech+Mono&family=Inter:wght@400;500;600&display=swap";
document.head.appendChild(fontLink);

/* ── Palette ── */
const C = {
  bg:       "#111214",
  surface:  "#1a1b1e",
  surface2: "#1e1f22",
  border:   "rgba(100, 18, 18, 0.25)",
  accent:   "#C9A24A",
  accentDim:"#8a6e2a",
  red:      "#8B1010",
  redBright:"#c0392b",
  text:     "#e8e0d0",
  muted:    "#7a7a82",
  danger:   "#c0392b",
  green:    "#4caf50",
};

/* ── Styles ── */
const S = {
  page: {
    minHeight: "100vh", background: C.bg, color: C.text,
    fontFamily: "'Inter', sans-serif", fontSize: 15,
  },
  nav: {
    position: "sticky", top: 0, zIndex: 100, height: 96,
    background: "rgba(42,10,10,0.97)", borderBottom: `1px solid ${C.border}`,
    backdropFilter: "blur(10px)",
    display: "flex", alignItems: "center", padding: "0 40px", gap: 40,
  },
  navLogo: {
    display: "flex", alignItems: "center", gap: 16, marginRight: "auto",
  },
  navLogoText: {
    fontFamily: "'Oswald', sans-serif", fontSize: 30, fontWeight: 700,
    color: C.accent, letterSpacing: 5, lineHeight: 1,
  },
  navLogoSub: {
    fontFamily: "'Share Tech Mono', monospace", fontSize: 11,
    color: C.muted, letterSpacing: 4, display: "block",
  },
  navItem: (active) => ({
    fontFamily: "'Oswald', sans-serif", fontSize: 17, letterSpacing: 3,
    color: active ? C.accent : C.muted, cursor: "pointer",
    borderBottom: active ? `3px solid ${C.accent}` : "3px solid transparent",
    paddingBottom: 4, textTransform: "uppercase",
  }),
  card: {
    background: C.surface,
    border: "1px solid rgba(100, 18, 18, 0.12)",
    borderRadius: 8, padding: 28,
    boxShadow: "0 0 18px rgba(90, 12, 12, 0.25), 0 4px 14px rgba(0,0,0,0.45)",
  },
  input: {
    width: "100%", background: "#16171a", border: `1px solid ${C.border}`,
    borderRadius: 4, color: C.text, padding: "10px 14px", fontSize: 15,
    fontFamily: "'Share Tech Mono', monospace", outline: "none", boxSizing: "border-box",
  },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? C.accent : variant === "danger" ? C.danger : C.border,
    color: variant === "primary" ? "#0a0c08" : C.text,
    border: "none", borderRadius: 4, padding: "10px 24px",
    fontFamily: "'Oswald', sans-serif", fontSize: 14, letterSpacing: 2,
    cursor: "pointer", textTransform: "uppercase", fontWeight: 600,
  }),
  label: { display: "block", color: C.muted, fontSize: 13, marginBottom: 6, letterSpacing: 1 },
  divider: {
    borderTop: `1px solid ${C.border}`, margin: "24px 0",
  },
  h2: {
    fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 600,
    color: C.accent, letterSpacing: 3, marginBottom: 20, textTransform: "uppercase",
  },
  h3: {
    fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600,
    color: C.text, letterSpacing: 1, marginBottom: 14,
  },
  badge: (color = C.accentDim) => ({
    display: "inline-block", background: color + "33",
    color: color, border: `1px solid ${color}55`,
    borderRadius: 4, fontSize: 12, padding: "3px 10px",
    fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1,
  }),
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", padding: "10px 14px",
    borderBottom: `1px solid ${C.border}`,
    fontFamily: "'Oswald', sans-serif", fontSize: 13,
    color: C.muted, letterSpacing: 2, textTransform: "uppercase",
  },
  td: {
    padding: "12px 14px", borderBottom: `1px solid ${C.border}20`,
    fontSize: 14, verticalAlign: "middle",
  },
};

/* ── Tipos y estados de operaciones ── */
const OP_TIPOS = ["COIN", "Asalto", "Reconocimiento", "Defensa", "Evacuación", "QRF", "CASEVAC", "Entrenamiento", "Otra"];
const OP_ESTADOS = {
  planificada: { label: "Planificada", color: "#8a6e2a" },
  en_curso:    { label: "En curso",    color: "#4caf50" },
  completada:  { label: "Completada",  color: "#7a7a82" },
  cancelada:   { label: "Cancelada",   color: "#c0392b" },
};

/* ── Permisos disponibles ── */
const ALL_PERMS = [
  { id: "manage_members",   label: "Gestionar legionarios" },
  { id: "manage_roles",     label: "Gestionar rangos" },
  { id: "approve_requests", label: "Aprobar solicitudes" },
  { id: "manage_ops",       label: "Gestionar operaciones" },
  { id: "post_sitrep",      label: "Publicar SITREP" },
  { id: "manage_orbat",     label: "Gestionar ORBAT" },
  { id: "manage_doctrina",  label: "Gestionar doctrina" },
];

/* ── Helpers Firestore ── */
const useCollection = (col, ...constraints) => {
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    const q = constraints.length ? query(collection(db, col), ...constraints) : collection(db, col);
    return onSnapshot(q, snap =>
      setDocs(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    );
  }, [col]);
  return docs;
};

const fbAdd = (col, data)       => addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() });
const fbSet = (col, id, data)   => setDoc(doc(db, col, id), data, { merge: true });
const fbUpd = (col, id, data)   => updateDoc(doc(db, col, id), data);
const fbDel = (col, id)         => deleteDoc(doc(db, col, id));

/* ── Multi-rol helpers ── */
const getMemberRoleIds = m => m.roleIds?.length ? m.roleIds : (m.roleId ? [m.roleId] : []);

/* ─────────────────────────────────────── */
/*  APP                                    */
/* ─────────────────────────────────────── */
export default function App() {
  const [user, setUser]     = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]     = useState("inicio");

  const roles           = useCollection("roles");
  const orbatUnidades   = useCollection("orbat_unidades", orderBy("orden"));
  const orbatMiembros   = useCollection("orbat_miembros");
  const doctrina        = useCollection("doctrina", orderBy("createdAt", "desc"));
  const especialidades  = useCollection("especialidades", orderBy("nombre"));
  const operaciones     = useCollection("operaciones", orderBy("fecha", "desc"));
  const condecoraciones = useCollection("condecoraciones", orderBy("createdAt", "desc"));
  const salaFama        = useCollection("sala_fama", orderBy("orden"));
  const salaMandos      = useCollection("sala_mandos", orderBy("orden"));

  /* Auth listener */
  useEffect(() => {
    return onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        const snap = await getDoc(doc(db, "members", fbUser.uid));
        if (snap.exists()) {
          setUser(fbUser);
          setMember({ _id: snap.id, ...snap.data() });
        } else {
          setUser(fbUser);
          setMember(null);
        }
      } else {
        setUser(null);
        setMember(null);
      }
      setLoading(false);
    });
  }, []);

  /* Keep member in sync */
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "members", user.uid), snap => {
      if (snap.exists()) setMember({ _id: snap.id, ...snap.data() });
    });
  }, [user?.uid]);

  if (loading) return <Splash />;

  /* Derived permissions */
  const isJefe = member?.isJefe === true;
  const isSuperAdmin = member?.isSuperAdmin === true;
  const userRoleIds = member ? getMemberRoleIds(member) : [];
  const userRoles   = roles.filter(r => userRoleIds.includes(r._id));
  const canDo = p => isJefe || userRoles.some(r => (r.permissions || []).includes(p));

  /* Auth gates */
  if (!user) return <LoginScreen />;

  if (!member) {
    /* Logged in but no member doc — shouldn't happen normally */
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: C.muted }}>Sin perfil asociado. Contacta con el Legatus.</p>
          <button style={S.btn("ghost")} onClick={() => signOut(auth)}>Salir</button>
        </div>
      </div>
    );
  }

  if (member.accessStatus === "pendiente") return <PendingScreen member={member} />;
  if (member.accessStatus === "rechazado") return <RejectedScreen member={member} />;
  if (member.accessStatus === "expulsado") return <ExpelledScreen member={member} />;

  const navItems = [
    { id: "inicio",         label: "Inicio" },
    { id: "servicio",       label: "Mi Hoja" },
    { id: "especialidades", label: "Especialidades" },
    { id: "doctrina",       label: "Doctrina" },
    ...(isJefe || canDo("approve_requests") || canDo("manage_roles") || canDo("manage_members") || canDo("manage_orbat") || canDo("manage_doctrina") || canDo("manage_ops")
      ? [{ id: "admin", label: "Mando" }]
      : []),
  ];

  const orbatActive = view === "orbat" || view === "sala_fama";
  const opsActive   = view === "operaciones" || view === "calendario";

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={S.navLogo}>
          <img src="/logo.png" alt="Legio Invicta" style={{ height: 64, width: 64, borderRadius: "50%", border: `1px solid ${C.border}` }} />
          <div>
            <span style={S.navLogoText}>LEGIO INVICTA</span>
            <span style={S.navLogoSub}>HONOR Y VICTORIA</span>
          </div>
        </div>
        {navItems.map(n => (
          <span key={n.id} style={S.navItem(view === n.id)} onClick={() => setView(n.id)}>
            {n.label}
          </span>
        ))}
        <NavDropdown
          label="Operaciones"
          active={opsActive}
          items={[
            { id: "operaciones", label: "Operaciones" },
            { id: "calendario",  label: "Calendario" },
          ]}
          currentView={view}
          onSelect={setView}
        />
        <NavDropdown
          label="ORBAT"
          active={orbatActive}
          items={[
            { id: "orbat",     label: "ORBAT" },
            { id: "sala_fama", label: "Sala de la Fama" },
          ]}
          currentView={view}
          onSelect={setView}
        />
        <span style={{ ...S.navItem(false), marginLeft: 8 }} onClick={() => signOut(auth)}>
          Salir
        </span>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        {view === "inicio"         && <InicioView member={member} roles={roles} operaciones={operaciones} condecoraciones={condecoraciones} orbatMiembros={orbatMiembros} salaMandos={salaMandos} />}
        {view === "servicio"       && <HojaServicioView member={member} roles={roles} operaciones={operaciones} orbatMiembros={orbatMiembros} orbatUnidades={orbatUnidades} especialidades={especialidades} condecoraciones={condecoraciones} />}
        {view === "operaciones"    && <OperacionesView ops={operaciones} member={member} />}
        {view === "calendario"     && <CalendarioView ops={operaciones} member={member} />}
        {view === "orbat"          && <OrbatView unidades={orbatUnidades} miembros={orbatMiembros} roles={roles} especialidades={especialidades} condecoraciones={condecoraciones} salaFama={salaFama} />}
        {view === "sala_fama"      && <SalaFamaView salaFama={salaFama} condecoraciones={condecoraciones} />}
        {view === "especialidades" && <EspecialidadesView especialidades={especialidades} />}
        {view === "doctrina"       && <DoctrinaView docs={doctrina} member={member} isJefe={isJefe} canDo={canDo} />}
        {view === "admin"          && <AdminPanel roles={roles} isJefe={isJefe} isSuperAdmin={isSuperAdmin} canDo={canDo} orbatUnidades={orbatUnidades} orbatMiembros={orbatMiembros} doctrina={doctrina} member={member} especialidades={especialidades} operaciones={operaciones} condecoraciones={condecoraciones} salaFama={salaFama} salaMandos={salaMandos} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  NAV DROPDOWN                           */
/* ─────────────────────────────────────── */
function NavDropdown({ label, active, items, currentView, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span style={{ ...S.navItem(active), display: "flex", alignItems: "center", gap: 5, userSelect: "none", cursor: "pointer" }}>
        {label}
        <span style={{ fontSize: 9, color: active ? C.accent : C.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>▼</span>
      </span>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 200,
          background: "rgba(22,23,26,0.98)", border: `1px solid ${C.border}`,
          borderRadius: "0 0 6px 6px", minWidth: 180,
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          paddingTop: 4, paddingBottom: 4,
        }}>
          {items.map(item => (
            <div
              key={item.id}
              onClick={() => { onSelect(item.id); setOpen(false); }}
              style={{
                padding: "10px 18px",
                fontFamily: "'Oswald', sans-serif", fontSize: 14, letterSpacing: 2,
                textTransform: "uppercase", cursor: "pointer",
                color: currentView === item.id ? C.accent : C.muted,
                borderLeft: currentView === item.id ? `3px solid ${C.accent}` : "3px solid transparent",
                background: currentView === item.id ? "rgba(201,162,74,0.06)" : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (currentView !== item.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (currentView !== item.id) e.currentTarget.style.background = "transparent"; }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  SPLASH                                 */
/* ─────────────────────────────────────── */
function Splash() {
  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "'Oswald', sans-serif", color: C.accent, fontSize: 18, letterSpacing: 4 }}>
        CARGANDO…
      </span>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  LOGIN / REGISTRO                       */
/* ─────────────────────────────────────── */
function LoginScreen() {
  const [mode, setMode]         = useState("login"); // login | register | reset
  const [usuario, setUsuario]   = useState("");
  const [correo, setCorreo]     = useState("");
  const [pin, setPin]           = useState("");
  const [pin2, setPin2]         = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = m => { setMode(m); setError(""); setResetSent(false); };

  const handleLogin = async e => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const snap = await getDoc(doc(db, "handles", usuario.trim().toLowerCase()));
      if (!snap.exists()) { setError("Usuario o PIN incorrecto."); setBusy(false); return; }
      await signInWithEmailAndPassword(auth, snap.data().email, pin);
    } catch {
      setError("Usuario o PIN incorrecto.");
    }
    setBusy(false);
  };

  const handleRegister = async e => {
    e.preventDefault();
    setError(""); setBusy(true);
    if (pin !== pin2) { setError("Los PINs no coinciden."); setBusy(false); return; }
    if (pin.length < 4) { setError("El PIN debe tener al menos 4 caracteres."); setBusy(false); return; }
    const handleKey = usuario.trim().toLowerCase();
    try {
      const existing = await getDoc(doc(db, "handles", handleKey));
      if (existing.exists()) { setError("Ese usuario ya está en uso."); setBusy(false); return; }
      const cred = await createUserWithEmailAndPassword(auth, correo.trim(), pin);
      await setDoc(doc(db, "handles", handleKey), { email: correo.trim(), uid: cred.user.uid });
      await setDoc(doc(db, "members", cred.user.uid), {
        handle: usuario.trim(),
        displayName: usuario.trim(),
        email: correo.trim(),
        accessStatus: "pendiente",
        isJefe: false,
        isSuperAdmin: false,
        roleIds: [],
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Ese correo ya está en uso.");
      else setError("Error al registrar. Inténtalo de nuevo.");
    }
    setBusy(false);
  };

  const handleReset = async e => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await sendPasswordResetEmail(auth, correo.trim());
      setResetSent(true);
    } catch {
      setError("No se encontró ninguna cuenta con ese correo.");
    }
    setBusy(false);
  };

  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="Legio Invicta"
            style={{ width: 120, height: 120, borderRadius: "50%", border: `2px solid ${C.border}`, marginBottom: 16 }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700,
            color: C.accent, letterSpacing: 6, marginBottom: 4,
          }}>LEGIO INVICTA</div>
          <div style={{ color: C.muted, fontSize: 11, letterSpacing: 4, fontFamily: "'Share Tech Mono', monospace" }}>
            HONOR Y VICTORIA
          </div>
        </div>

        <div style={{ ...S.card, borderColor: C.border }}>
          {mode !== "reset" && (
            <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `1px solid ${C.border}` }}>
              {["login", "register"].map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  style={{
                    flex: 1, background: "none", border: "none",
                    borderBottom: mode === m ? `2px solid ${C.accent}` : "2px solid transparent",
                    color: mode === m ? C.accent : C.muted,
                    fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 2,
                    cursor: "pointer", padding: "0 0 10px", textTransform: "uppercase",
                  }}>
                  {m === "login" ? "Acceder" : "Solicitar Registro"}
                </button>
              ))}
            </div>
          )}

          {mode === "reset" ? (
            resetSent ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ color: C.green, fontSize: 14, marginBottom: 16 }}>
                  Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu PIN.
                </div>
                <button style={S.btn("ghost")} onClick={() => switchMode("login")}>Volver al acceso</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: C.accent, letterSpacing: 2, marginBottom: 20 }}>
                  RECUPERAR CONTRASEÑA
                </div>
                <form onSubmit={handleReset}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>Correo electrónico</label>
                    <input style={S.input} type="email" value={correo} onChange={e => setCorreo(e.target.value)}
                      placeholder="tu@correo.com" autoComplete="email" required />
                  </div>
                  {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
                  <button style={{ ...S.btn("primary"), width: "100%" }} disabled={busy}>
                    {busy ? "…" : "Enviar enlace"}
                  </button>
                </form>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button onClick={() => switchMode("login")}
                    style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", letterSpacing: 1 }}>
                    Volver al acceso
                  </button>
                </div>
              </>
            )
          ) : (
            <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Usuario</label>
                <input style={S.input} value={usuario} onChange={e => setUsuario(e.target.value)}
                  placeholder="tu_usuario" autoComplete="username" required />
              </div>
              {mode === "register" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={S.label}>Correo electrónico</label>
                  <input style={S.input} type="email" value={correo} onChange={e => setCorreo(e.target.value)}
                    placeholder="tu@correo.com" autoComplete="email" required />
                </div>
              )}
              <div style={{ marginBottom: mode === "register" ? 16 : 8 }}>
                <label style={S.label}>PIN</label>
                <input style={S.input} type="password" value={pin} onChange={e => setPin(e.target.value)}
                  placeholder="••••••" autoComplete="current-password" required />
              </div>
              {mode === "register" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={S.label}>Confirmar PIN</label>
                  <input style={S.input} type="password" value={pin2} onChange={e => setPin2(e.target.value)}
                    placeholder="••••••" autoComplete="new-password" required />
                </div>
              )}
              {mode === "login" && (
                <div style={{ textAlign: "right", marginBottom: 16 }}>
                  <button type="button" onClick={() => switchMode("reset")}
                    style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", letterSpacing: 1 }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
              {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
              <button style={{ ...S.btn("primary"), width: "100%" }} disabled={busy}>
                {busy ? "…" : mode === "login" ? "Acceder" : "Enviar Solicitud"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  PANTALLAS DE ESTADO                    */
/* ─────────────────────────────────────── */
function PendingScreen({ member }) {
  return (
    <StatusScreen color={C.accentDim} icon="⏳"
      title="SOLICITUD PENDIENTE"
      lines={[`Handle: ${member.handle}`, "Tu solicitud está siendo revisada por el mando.", "Espera confirmación antes de acceder."]}
    />
  );
}
function RejectedScreen({ member }) {
  return (
    <StatusScreen color={C.danger} icon="✗"
      title="SOLICITUD RECHAZADA"
      lines={[`Handle: ${member.handle}`, member.accessNote || "Tu solicitud fue rechazada.", "Contacta con el mando para más información."]}
    />
  );
}
function ExpelledScreen({ member }) {
  return (
    <StatusScreen color={C.danger} icon="☠"
      title="ACCESO REVOCADO"
      lines={[
        `Legionario: ${member.handle}`,
        member.accessNote ? `Motivo: ${member.accessNote}` : "Tu acceso ha sido revocado.",
        member.expelledAt ? `Fecha: ${new Date(member.expelledAt?.seconds * 1000).toLocaleDateString("es-ES")}` : "",
      ].filter(Boolean)}
    />
  );
}
function StatusScreen({ color, icon, title, lines }) {
  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.card, width: 420, textAlign: "center", borderColor: color + "66" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color, letterSpacing: 3, marginBottom: 16 }}>
          {title}
        </div>
        {lines.map((l, i) => <div key={i} style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>{l}</div>)}
        <button style={{ ...S.btn("ghost"), marginTop: 20 }} onClick={() => signOut(auth)}>Cerrar sesión</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  COLLAPSIBLE GENÉRICO                   */
/* ─────────────────────────────────────── */
function Collapsible({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 24 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "14px 0", borderTop: `1px solid ${C.border}`, userSelect: "none" }}
      >
        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: C.accent, letterSpacing: 3, textTransform: "uppercase", flex: 1 }}>
          {title}
        </span>
        {badge != null && <span style={{ ...S.badge(C.accentDim) }}>{badge}</span>}
        <span style={{ color: C.muted, fontSize: 12, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </div>
      {open && <div style={{ paddingBottom: 8 }}>{children}</div>}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA INICIO — TABLERO DE MANDOS       */
/* ─────────────────────────────────────── */
function InicioView({ member, roles, operaciones, condecoraciones, orbatMiembros, salaMandos }) {
  const allMembers = useCollection("members");
  const activos    = allMembers.filter(m => m.accessStatus === "activo");

  /* Stats */
  const opsCompletadas = operaciones.filter(o => o.estado === "completada");
  const opsActivas     = operaciones.filter(o => o.estado === "en_curso" || o.estado === "planificada");
  const opsPlanif      = operaciones.filter(o => o.estado === "planificada");

  const avgAsistencia = (() => {
    const base = opsCompletadas.filter(op => Object.keys(op.asistencia || {}).length > 0);
    if (!base.length) return null;
    const total = base.reduce((sum, op) => {
      const vals = Object.values(op.asistencia);
      const conf = vals.filter(v => v === "confirmada").length;
      return sum + (vals.length ? conf / vals.length * 100 : 0);
    }, 0);
    return Math.round(total / base.length);
  })();

  const roleNames = roles.filter(r => getMemberRoleIds(member).includes(r._id)).map(r => r.name).join(" · ");

  const statCards = [
    { label: "Legionarios activos",   value: activos.length,          color: C.accent },
    { label: "Ops completadas",        value: opsCompletadas.length,   color: C.green },
    { label: "En cartera",             value: opsActivas.length,       color: C.accentDim },
    { label: "Asistencia media",       value: avgAsistencia !== null ? `${avgAsistencia}%` : "—", color: avgAsistencia >= 70 ? C.green : avgAsistencia >= 40 ? C.accentDim : C.danger },
  ];

  const proximas     = [...opsPlanif].sort((a, b) => a.fecha > b.fecha ? 1 : -1).slice(0, 5);
  const ultimasDecos = condecoraciones.slice(0, 5);

  return (
    <div>
      {/* Bienvenida */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ ...S.h2, margin: 0 }}>Tablero de Mandos</h2>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>
            Bienvenido, @{member.handle}{roleNames ? ` · ${roleNames}` : ""}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ ...S.card, textAlign: "center", padding: "20px 16px" }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 38, color: s.color, lineHeight: 1, marginBottom: 8 }}>{s.value}</div>
            <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dos columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>

        {/* Próximas operaciones */}
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            Próximas operaciones
            <span style={S.badge(C.accentDim)}>{opsPlanif.length}</span>
          </h3>
          {proximas.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13 }}>Sin operaciones planificadas.</p>
          ) : proximas.map(op => {
            const est = OP_ESTADOS[op.estado] || OP_ESTADOS.planificada;
            const myVal = op.asistencia?.[member._id] || null;
            return (
              <div key={op._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}20` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13 }}>{op.nombre}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={S.badge(est.color)}>{est.label}</span>
                    <span style={S.badge(C.accentDim)}>{op.tipo}</span>
                    {op.fecha && (
                      <span style={{ color: C.muted, fontSize: 11 }}>
                        {new Date(op.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>
                {myVal && (
                  <span style={S.badge(myVal === "confirmada" ? C.green : C.danger)}>
                    {myVal === "confirmada" ? "✓" : "✗"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Últimas condecoraciones */}
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            Condecoraciones recientes
            <span style={S.badge(C.accentDim)}>{condecoraciones.length}</span>
          </h3>
          {ultimasDecos.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13 }}>Sin condecoraciones registradas.</p>
          ) : ultimasDecos.map(d => (
            <div key={d._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}20` }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>🎖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: C.accent }}>{d.nombre}</div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  @{d.memberHandle}
                  {d.fecha && ` · ${new Date(d.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operaciones recientes completadas */}
      {opsCompletadas.length > 0 && (
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginBottom: 16 }}>Operaciones completadas</h3>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Operación</th>
                <th style={S.th}>Tipo</th>
                <th style={S.th}>Fecha</th>
                <th style={S.th}>Confirmados</th>
                <th style={S.th}>Bajas</th>
              </tr>
            </thead>
            <tbody>
              {opsCompletadas.slice(0, 8).map(op => {
                const vals  = Object.values(op.asistencia || {});
                const conf  = vals.filter(v => v === "confirmada").length;
                const bajas = vals.filter(v => v === "baja").length;
                return (
                  <tr key={op._id}>
                    <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif" }}>{op.nombre}</td>
                    <td style={S.td}><span style={S.badge(C.accentDim)}>{op.tipo}</span></td>
                    <td style={{ ...S.td, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.muted }}>
                      {op.fecha ? new Date(op.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ ...S.td, color: C.green, fontFamily: "'Oswald', sans-serif" }}>{conf}</td>
                    <td style={{ ...S.td, color: conf + bajas > 0 ? C.danger : C.muted, fontFamily: "'Oswald', sans-serif" }}>{bajas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sala de Mandos — secciones informativas del clan */}
      {salaMandos && [...salaMandos].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(sec => (
        <div key={sec._id} style={{ marginBottom: 32 }}>
          <div style={{ borderLeft: `4px solid ${C.accent}`, paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: C.accent, letterSpacing: 3, textTransform: "uppercase" }}>
              {sec.titulo}
            </div>
          </div>
          <div style={S.card}>
            <div className="legio-render" style={{ color: C.text, lineHeight: 1.8, fontSize: 15 }}
              dangerouslySetInnerHTML={{ __html: sec.contenido || "" }} />
          </div>
        </div>
      ))}

    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA LEGIONARIOS                      */
/* ─────────────────────────────────────── */
function MiembrosView({ roles, canDo, isJefe }) {
  const members = useCollection("members");
  const active  = members.filter(m => m.accessStatus === "activo");

  return (
    <div>
      <h2 style={S.h2}>Legionarios</h2>
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Handle</th>
              <th style={S.th}>Nombre</th>
              <th style={S.th}>Rango / Rol</th>
              <th style={S.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {active.map(m => {
              const rNames = roles.filter(r => getMemberRoleIds(m).includes(r._id)).map(r => r.name).join(" · ");
              const label = m.isSuperAdmin ? (rNames || "—")
                : m.isJefe ? (rNames || "⚜ Legatus")
                : (rNames || "—");
              return (
                <tr key={m._id}>
                  <td style={{ ...S.td, fontFamily: "'Share Tech Mono', monospace", color: C.accent }}>
                    @{m.handle}
                  </td>
                  <td style={S.td}>{m.displayName || m.handle}</td>
                  <td style={S.td}>
                    {label !== "—"
                      ? <span style={S.badge(C.accentDim)}>{label}</span>
                      : <span style={{ color: C.muted }}>—</span>
                    }
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(C.green)}>Activo</span>
                  </td>
                </tr>
              );
            })}
            {active.length === 0 && (
              <tr><td colSpan={4} style={{ ...S.td, color: C.muted, textAlign: "center" }}>Sin legionarios activos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  PANEL ADMIN (MANDO)                    */
/* ─────────────────────────────────────── */
function AdminPanel({ roles, isJefe, isSuperAdmin, canDo, orbatUnidades, orbatMiembros, doctrina, member, especialidades, operaciones, condecoraciones, salaFama, salaMandos }) {
  const [tab, setTab] = useState("solicitudes");

  const tabs = [
    { id: "solicitudes",    label: "Solicitudes",    show: isJefe || canDo("approve_requests") },
    { id: "rangos",         label: "Rangos",          show: isJefe || canDo("manage_roles") },
    { id: "especialidades", label: "Especialidades",  show: isJefe || canDo("manage_roles") },
    { id: "bajas",          label: "Bajas",           show: isJefe || canDo("manage_members") },
    { id: "orbat",             label: "ORBAT",            show: isJefe || canDo("manage_orbat") },
    { id: "operaciones",       label: "Operaciones",      show: isJefe || canDo("manage_ops") },
    { id: "condecoraciones",   label: "Condecoraciones",  show: isJefe || canDo("manage_members") },
    { id: "sala_fama",         label: "Sala de la Fama",  show: isJefe || canDo("manage_members") },
    { id: "sala_mandos",       label: "Sala de Mandos",   show: isJefe || canDo("manage_doctrina") },
    { id: "doctrina",          label: "Doctrina",         show: isJefe || canDo("manage_doctrina") },
  ].filter(t => t.show);

  return (
    <div>
      <h2 style={S.h2}>Centro de Mando</h2>
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: "none", border: "none",
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: tab === t.id ? C.accent : C.muted,
              fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 2,
              cursor: "pointer", padding: "0 16px 10px", textTransform: "uppercase",
            }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "solicitudes"    && <TabSolicitudes roles={roles} />}
      {tab === "rangos"         && <TabRangos roles={roles} isJefe={isJefe} isSuperAdmin={isSuperAdmin} />}
      {tab === "especialidades" && <TabEspecialidades especialidades={especialidades} isJefe={isJefe} canDo={canDo} />}
      {tab === "bajas"          && <TabBajas />}
      {tab === "orbat"          && <TabOrbat unidades={orbatUnidades} miembros={orbatMiembros} isJefe={isJefe} canDo={canDo} roles={roles} especialidades={especialidades} />}
      {tab === "operaciones"     && <TabOperaciones ops={operaciones} member={member} isJefe={isJefe} canDo={canDo} />}
      {tab === "condecoraciones" && <TabCondecoraciones condecoraciones={condecoraciones} member={member} isJefe={isJefe} canDo={canDo} />}
      {tab === "sala_fama"       && <TabSalaFama salaFama={salaFama} condecoraciones={condecoraciones} isJefe={isJefe} canDo={canDo} />}
      {tab === "sala_mandos"     && <TabSalaMandos secciones={salaMandos} member={member} isJefe={isJefe} canDo={canDo} />}
      {tab === "doctrina"        && <TabDoctrina docs={doctrina} member={member} isJefe={isJefe} canDo={canDo} />}
    </div>
  );
}

/* ── Tab: Solicitudes ── */
function TabSolicitudes({ roles }) {
  const members = useCollection("members");
  const pending = members.filter(m => m.accessStatus === "pendiente");

  const approve = async m => {
    await fbUpd("members", m._id, { accessStatus: "activo" });
  };
  const reject = async m => {
    const note = prompt("Motivo del rechazo (opcional):") || "";
    await fbUpd("members", m._id, { accessStatus: "rechazado", accessNote: note });
  };

  return (
    <div>
      <h3 style={S.h3}>Solicitudes pendientes ({pending.length})</h3>
      {pending.length === 0
        ? <p style={{ color: C.muted }}>Sin solicitudes pendientes.</p>
        : pending.map(m => (
          <div key={m._id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: C.accent }}>@{m.handle}</span>
              <span style={{ color: C.muted, fontSize: 12, marginLeft: 12 }}>
                {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleDateString("es-ES") : "—"}
              </span>
            </div>
            <button style={S.btn("primary")} onClick={() => approve(m)}>Aprobar</button>
            <button style={S.btn("danger")}  onClick={() => reject(m)}>Rechazar</button>
          </div>
        ))
      }
    </div>
  );
}

/* ── Tab: Rangos ── */
function TabRangos({ roles, isJefe, isSuperAdmin }) {
  const [name,       setName]      = useState("");
  const [insigniaUrl,setInsignia]  = useState("");
  const [perms,      setPerms]     = useState([]);
  const [editId,     setEditId]    = useState(null);

  const canEdit = isJefe || isSuperAdmin;

  const togglePerm = p => setPerms(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);

  const save = async () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), insigniaUrl: insigniaUrl.trim(), permissions: perms };
    if (editId) {
      await fbUpd("roles", editId, data);
      setEditId(null);
    } else {
      await fbAdd("roles", data);
    }
    setName(""); setInsignia(""); setPerms([]);
  };

  const startEdit = r => {
    setEditId(r._id); setName(r.name); setInsignia(r.insigniaUrl || ""); setPerms(r.permissions || []);
  };

  const del = async r => {
    if (!confirm(`¿Eliminar el rango "${r.name}"?`)) return;
    await fbDel("roles", r._id);
  };

  return (
    <div>
      {canEdit && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <h3 style={S.h3}>{editId ? "Editar rango" : "Nuevo rango"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Izquierda: nombre + insignia + botones */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Nombre del rango</label>
                <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Soldado" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Ruta de la insignia (PNG)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input style={{ ...S.input, flex: 1 }} value={insigniaUrl} onChange={e => setInsignia(e.target.value)}
                    placeholder="/imagenes de pruebas/soldado.png" />
                  {insigniaUrl && (
                    <img src={insigniaUrl} alt="preview"
                      style={{ width: 36, height: 44, objectFit: "contain", flexShrink: 0, background: "rgba(255,255,255,0.04)", borderRadius: 3 }} />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn("primary")} onClick={save}>{editId ? "Guardar" : "Crear rango"}</button>
                {editId && <button style={S.btn("ghost")} onClick={() => { setEditId(null); setName(""); setInsignia(""); setPerms([]); }}>Cancelar</button>}
              </div>
            </div>
            {/* Derecha: permisos */}
            <div>
              <label style={S.label}>Permisos</label>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {ALL_PERMS.map(p => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0", borderBottom: `1px solid ${C.border}20` }}>
                    <input type="checkbox" checked={perms.includes(p.id)} onChange={() => togglePerm(p.id)}
                      style={{ accentColor: C.accent, width: 14, height: 14, cursor: "pointer" }} />
                    <span style={{ fontSize: 13, color: perms.includes(p.id) ? C.text : C.muted }}>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ ...S.card, marginBottom: 24 }}>
        <h3 style={S.h3}>Rangos ({roles.length})</h3>
        {roles.length === 0
          ? <p style={{ color: C.muted }}>Sin rangos creados.</p>
          : roles.map(r => (
            <div key={r._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}20` }}>
              {r.insigniaUrl
                ? <img src={r.insigniaUrl} alt={r.name} style={{ width: 28, height: 36, objectFit: "contain", flexShrink: 0 }} />
                : <div style={{ width: 28, flexShrink: 0 }} />
              }
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {(r.permissions || []).map(p => {
                    const def = ALL_PERMS.find(x => x.id === p);
                    return def ? <span key={p} style={S.badge(C.accentDim)}>{def.label}</span> : null;
                  })}
                  {!(r.permissions || []).length && <span style={{ color: C.muted, fontSize: 12 }}>Sin permisos</span>}
                </div>
              </div>
              {canEdit && (
                <>
                  <button style={S.btn("ghost")} onClick={() => startEdit(r)}>Editar</button>
                  <button style={S.btn("danger")} onClick={() => del(r)}>✕</button>
                </>
              )}
            </div>
          ))
        }
      </div>

      <AsignacionRangos roles={roles} canEdit={canEdit} />
    </div>
  );
}

function AsignacionRangos({ roles, canEdit }) {
  const allMembers    = useCollection("members");
  const activeMembers = allMembers.filter(m => m.accessStatus === "activo");
  const [search, setSearch] = useState("");

  const filtered = activeMembers.filter(m =>
    (m.handle || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.displayName || "").toLowerCase().includes(search.toLowerCase())
  );

  const addRole = async (m, roleId) => {
    if (!roleId) return;
    const current = getMemberRoleIds(m);
    if (current.includes(roleId)) return;
    await fbUpd("members", m._id, { roleIds: [...current, roleId] });
  };

  const delRole = async (m, roleId) => {
    const current = getMemberRoleIds(m);
    await fbUpd("members", m._id, { roleIds: current.filter(id => id !== roleId) });
  };

  return (
    <div style={S.card}>
      <h3 style={{ ...S.h3, marginBottom: 16 }}>Asignación de rangos</h3>
      <input style={{ ...S.input, maxWidth: 320, marginBottom: 16 }} value={search}
        onChange={e => setSearch(e.target.value)} placeholder="Buscar legionario…" />
      {filtered.length === 0 && <p style={{ color: C.muted }}>Sin legionarios activos.</p>}
      {filtered.map(m => {
        const memberRoleIds  = getMemberRoleIds(m);
        const memberRoles    = roles.filter(r => memberRoleIds.includes(r._id));
        const availableRoles = roles.filter(r => !memberRoleIds.includes(r._id));
        return (
          <div key={m._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}20`, flexWrap: "wrap" }}>
            <div style={{ minWidth: 140 }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: C.accent, fontSize: 13 }}>@{m.handle}</span>
              {m.displayName && m.displayName !== m.handle && (
                <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>{m.displayName}</span>
              )}
            </div>
            <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {memberRoles.map(r => (
                <span key={r._id} style={{ ...S.badge(C.accent), display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {r.insigniaUrl && <img src={r.insigniaUrl} alt="" style={{ width: 12, height: 16, objectFit: "contain" }} />}
                  {r.name}
                  {canEdit && (
                    <span onClick={() => delRole(m, r._id)}
                      style={{ cursor: "pointer", color: C.danger, fontWeight: 700, marginLeft: 2 }}>×</span>
                  )}
                </span>
              ))}
              {memberRoles.length === 0 && <span style={{ color: C.muted, fontSize: 12 }}>Sin rango</span>}
            </div>
            {canEdit && availableRoles.length > 0 && (
              <select defaultValue="" style={{ ...S.input, width: "auto", minWidth: 160 }}
                onChange={e => { addRole(m, e.target.value); e.target.value = ""; }}>
                <option value="" disabled>+ Asignar rango</option>
                {availableRoles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab: Legionarios ── */
function TabLegionarios({ roles }) {
  const members = useCollection("members");
  const active  = members.filter(m => m.accessStatus === "activo");
  const [search, setSearch] = useState("");

  const filtered = active.filter(m =>
    (m.handle || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.displayName || "").toLowerCase().includes(search.toLowerCase())
  );

  const addRole = async (m, roleId) => {
    if (!roleId) return;
    const current = getMemberRoleIds(m);
    if (current.includes(roleId)) return;
    await fbUpd("members", m._id, { roleIds: [...current, roleId] });
  };

  const delRole = async (m, roleId) => {
    const current = getMemberRoleIds(m);
    await fbUpd("members", m._id, { roleIds: current.filter(id => id !== roleId) });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input style={{ ...S.input, maxWidth: 320 }} value={search}
          onChange={e => setSearch(e.target.value)} placeholder="Buscar por handle o nombre…" />
      </div>
      {filtered.map(m => {
        const memberRoleIds   = getMemberRoleIds(m);
        const memberRoles     = roles.filter(r => memberRoleIds.includes(r._id));
        const availableRoles  = roles.filter(r => !memberRoleIds.includes(r._id));

        return (
          <div key={m._id} style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", color: C.accent }}>@{m.handle}</span>
                {m.displayName && m.displayName !== m.handle && (
                  <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>{m.displayName}</span>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {memberRoles.map(r => (
                    <span key={r._id} style={{ ...S.badge(C.accentDim), display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {r.name}
                      <span onClick={() => delRole(m, r._id)}
                        style={{ cursor: "pointer", marginLeft: 2, color: C.danger, fontWeight: 700 }}>×</span>
                    </span>
                  ))}
                  {memberRoles.length === 0 && <span style={{ color: C.muted, fontSize: 12 }}>Sin rango</span>}
                </div>
              </div>
              {availableRoles.length > 0 && (
                <select defaultValue="" style={{ ...S.input, width: "auto", minWidth: 180 }}
                  onChange={e => { addRole(m, e.target.value); e.target.value = ""; }}>
                  <option value="" disabled>+ Asignar rango</option>
                  {availableRoles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              )}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <p style={{ color: C.muted }}>Sin legionarios que coincidan.</p>}
    </div>
  );
}

/* ── Tab: Bajas ── */
function TabBajas() {
  const members = useCollection("members");
  const active  = members.filter(m => m.accessStatus === "activo");
  const expelled = members.filter(m => m.accessStatus === "expulsado");
  const [sel, setSel] = useState("");
  const [note, setNote] = useState("");

  const expel = async () => {
    if (!sel) return;
    if (!confirm("¿Confirmar baja del legionario?")) return;
    await fbUpd("members", sel, {
      accessStatus: "expulsado",
      accessNote: note.trim() || null,
      expelledAt: serverTimestamp(),
    });
    setSel(""); setNote("");
  };

  const reinstate = async m => {
    if (!confirm(`¿Reinstaurar a @${m.handle}?`)) return;
    await fbUpd("members", m._id, { accessStatus: "activo", accessNote: null, expelledAt: null });
  };

  return (
    <div>
      <div style={{ ...S.card, marginBottom: 24 }}>
        <h3 style={S.h3}>Dar de baja</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Legionario</label>
          <select style={{ ...S.input, maxWidth: 320 }} value={sel} onChange={e => setSel(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {active.map(m => <option key={m._id} value={m._id}>@{m.handle}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Motivo (opcional)</label>
          <input style={{ ...S.input, maxWidth: 400 }} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Motivo de la baja…" />
        </div>
        <button style={S.btn("danger")} onClick={expel} disabled={!sel}>Dar de baja</button>
      </div>

      {expelled.length > 0 && (
        <div style={S.card}>
          <h3 style={S.h3}>Bajas ({expelled.length})</h3>
          {expelled.map(m => (
            <div key={m._id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderBottom: `1px solid ${C.border}20`,
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", color: C.danger }}>@{m.handle}</span>
                {m.accessNote && <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>{m.accessNote}</span>}
              </div>
              <button style={S.btn("ghost")} onClick={() => reinstate(m)}>Reinstaurar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB ORBAT (ADMIN)                      */
/* ─────────────────────────────────────── */
function TabOrbat({ unidades, miembros, isJefe, canDo, roles, especialidades }) {
  const allMembers    = useCollection("members");
  const activeMembers = allMembers.filter(m => m.accessStatus === "activo");

  const [uNombre,   setUNombre]   = useState("");
  const [uColor,    setUColor]    = useState("#C9A24A");
  const [uEmblem,   setUEmblem]   = useState("");
  const [uParentId, setUParentId] = useState("");
  const [editUId,   setEditUId]   = useState(null);

  const [mMemberId, setMMemberId] = useState("");
  const [mEspIds,   setMEspIds]   = useState([]);
  const [mUnidadId, setMUnidadId] = useState("");
  const [editMId,   setEditMId]   = useState(null);

  const toggleEsp = id => setMEspIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const canEdit = isJefe || canDo("manage_orbat");
  const sorted  = [...unidades].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const getMemberRoles = (memberId) => {
    if (!memberId) return [];
    const mem = allMembers.find(m => m._id === memberId);
    if (!mem) return [];
    return roles.filter(r => getMemberRoleIds(mem).includes(r._id));
  };

  const saveUnidad = async () => {
    if (!uNombre.trim()) return;
    const data = { nombre: uNombre.trim(), color: uColor, emblemUrl: uEmblem.trim(), parentId: uParentId || null };
    if (editUId) {
      await fbUpd("orbat_unidades", editUId, data);
      setEditUId(null);
    } else {
      const maxOrden = unidades.reduce((m, u) => Math.max(m, u.orden || 0), 0);
      await fbAdd("orbat_unidades", { ...data, orden: maxOrden + 1 });
    }
    setUNombre(""); setUColor("#C9A24A"); setUEmblem(""); setUParentId("");
  };

  const moveUnidad = (id, dir) => {
    const i = sorted.findIndex(u => u._id === id);
    if (dir === "up" && i > 0) {
      fbSet("orbat_unidades", sorted[i]._id,   { orden: sorted[i-1].orden });
      fbSet("orbat_unidades", sorted[i-1]._id, { orden: sorted[i].orden });
    }
    if (dir === "down" && i < sorted.length - 1) {
      fbSet("orbat_unidades", sorted[i]._id,   { orden: sorted[i+1].orden });
      fbSet("orbat_unidades", sorted[i+1]._id, { orden: sorted[i].orden });
    }
  };

  const delUnidad = async u => {
    const hasM = miembros.some(m => m.unidadId === u._id);
    if (!confirm(hasM
      ? `"${u.nombre}" tiene efectivos asignados. ¿Eliminar de todos modos?`
      : `¿Eliminar la unidad "${u.nombre}"?`)) return;
    await fbDel("orbat_unidades", u._id);
  };

  const saveMiembro = async () => {
    if (!mMemberId || !mUnidadId) return;
    const mem = allMembers.find(m => m._id === mMemberId);
    const data = {
      memberId: mMemberId,
      nombre:   mem?.displayName || mem?.handle || "",
      handle:   mem?.handle || "",
      espIds:   mEspIds,
      unidadId: mUnidadId,
    };
    if (editMId) {
      await fbUpd("orbat_miembros", editMId, data);
      setEditMId(null);
    } else {
      const maxOrden = miembros.filter(m => m.unidadId === mUnidadId).reduce((mx, m) => Math.max(mx, m.orden || 0), 0);
      await fbAdd("orbat_miembros", { ...data, orden: maxOrden + 1 });
    }
    setMMemberId(""); setMEspIds([]); setMUnidadId("");
  };

  const delMiembro = async m => {
    if (!confirm(`¿Eliminar a "${m.nombre}" del ORBAT?`)) return;
    await fbDel("orbat_miembros", m._id);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Izquierda — Unidades */}
      <div>
        {canEdit && (
          <div style={{ ...S.card, marginBottom: 16 }}>
            <h3 style={S.h3}>{editUId ? "Editar unidad" : "Nueva unidad"}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Nombre</label>
              <input style={S.input} value={uNombre} onChange={e => setUNombre(e.target.value)} placeholder="Ej: I Cohorte" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={uColor} onChange={e => setUColor(e.target.value)}
                  style={{ width: 40, height: 32, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.muted }}>{uColor}</span>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Emblema de unidad (URL)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...S.input, flex: 1 }} value={uEmblem} onChange={e => setUEmblem(e.target.value)} placeholder="/emblemas/foxtrot.png" />
                {uEmblem && <img src={uEmblem} alt="emblema" style={{ width: 40, height: 40, objectFit: "contain", background: "rgba(255,255,255,0.04)", borderRadius: 4 }} />}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Unidad padre (opcional)</label>
              <select style={S.input} value={uParentId} onChange={e => setUParentId(e.target.value)}>
                <option value="">— Ninguna (raíz) —</option>
                {sorted.filter(u => u._id !== editUId).map(u => (
                  <option key={u._id} value={u._id}>{u.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("primary")} onClick={saveUnidad}>{editUId ? "Guardar" : "Crear unidad"}</button>
              {editUId && (
                <button style={S.btn("ghost")} onClick={() => { setEditUId(null); setUNombre(""); setUColor("#C9A24A"); setUEmblem(""); setUParentId(""); }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        <div style={S.card}>
          <h3 style={S.h3}>Unidades ({unidades.length})</h3>
          {sorted.length === 0
            ? <p style={{ color: C.muted }}>Sin unidades creadas.</p>
            : sorted.map((u, i) => (
              <div key={u._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${C.border}20` }}>
                {u.emblemUrl
                  ? <img src={u.emblemUrl} alt="" style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
                  : <div style={{ width: 12, height: 12, borderRadius: 2, background: u.color || C.accent, flexShrink: 0 }} />
                }
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{u.nombre}</span>
                {u.parentId
                  ? <span style={S.badge(C.accentDim)}>↳ {unidades.find(p => p._id === u.parentId)?.nombre || "?"}</span>
                  : <span style={S.badge(C.accentDim)}>raíz</span>
                }
                {canEdit && (
                  <>
                    <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => moveUnidad(u._id, "up")} disabled={i === 0}>▲</button>
                    <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => moveUnidad(u._id, "down")} disabled={i === sorted.length - 1}>▼</button>
                    <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => { setEditUId(u._id); setUNombre(u.nombre); setUColor(u.color || "#C9A24A"); setUEmblem(u.emblemUrl || ""); setUParentId(u.parentId || ""); }}>✎</button>
                    <button style={{ ...S.btn("danger"), padding: "4px 8px", fontSize: 11 }} onClick={() => delUnidad(u)}>✕</button>
                  </>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {/* Derecha — Efectivos */}
      <div>
        {canEdit && (
          <div style={{ ...S.card, marginBottom: 16 }}>
            <h3 style={S.h3}>{editMId ? "Editar efectivo" : "Añadir al ORBAT"}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Legionario</label>
              <select style={S.input} value={mMemberId} onChange={e => setMMemberId(e.target.value)}>
                <option value="">— Seleccionar legionario —</option>
                {activeMembers.map(m => (
                  <option key={m._id} value={m._id}>
                    @{m.handle}{m.displayName && m.displayName !== m.handle ? ` — ${m.displayName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Especialidades</label>
              {especialidades.length === 0
                ? <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Crea especialidades primero.</p>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    {especialidades.map(e => (
                      <label key={e._id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0", borderBottom: `1px solid ${C.border}20` }}>
                        <input type="checkbox" checked={mEspIds.includes(e._id)} onChange={() => toggleEsp(e._id)}
                          style={{ accentColor: e.color || C.accent, width: 14, height: 14, cursor: "pointer" }} />
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color || C.accent }} />
                        <span style={{ fontSize: 13, color: mEspIds.includes(e._id) ? C.text : C.muted }}>{e.nombre}</span>
                      </label>
                    ))}
                  </div>
                )
              }
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Unidad</label>
              <select style={S.input} value={mUnidadId} onChange={e => setMUnidadId(e.target.value)}>
                <option value="">— Seleccionar unidad —</option>
                {sorted.map(u => <option key={u._id} value={u._id}>{u.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("primary")} onClick={saveMiembro}>{editMId ? "Guardar" : "Añadir"}</button>
              {editMId && (
                <button style={S.btn("ghost")} onClick={() => { setEditMId(null); setMMemberId(""); setMEspIds([]); setMUnidadId(""); }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        <div style={S.card}>
          <h3 style={S.h3}>Efectivos en ORBAT ({miembros.length})</h3>
          {sorted.map(u => {
            const uM = miembros.filter(m => m.unidadId === u._id);
            if (!uM.length) return null;
            return (
              <div key={u._id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: u.color || C.accent, textTransform: "uppercase", marginBottom: 6, fontFamily: "'Oswald', sans-serif" }}>
                  {u.nombre}
                </div>
                {uM.map(m => (
                  <div key={m._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}20` }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13 }}>{m.nombre}</span>
                      {m.handle && <span style={{ color: C.muted, fontSize: 11, marginLeft: 8, fontFamily: "'Share Tech Mono', monospace" }}>@{m.handle}</span>}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                        {(m.espIds || []).map(id => {
                          const esp = especialidades.find(e => e._id === id);
                          return esp ? <span key={id} style={S.badge(esp.color || C.accentDim)}>{esp.nombre}</span> : null;
                        })}
                        {getMemberRoles(m.memberId).map(r => (
                          <span key={r._id} style={S.badge(C.accent)}>{r.name}</span>
                        ))}
                      </div>
                    </div>
                    {canEdit && (
                      <>
                        <button style={{ ...S.btn("ghost"), padding: "3px 7px", fontSize: 11 }}
                          onClick={() => { setEditMId(m._id); setMMemberId(m.memberId || ""); setMEspIds(m.espIds || []); setMUnidadId(m.unidadId); }}>✎</button>
                        <button style={{ ...S.btn("danger"), padding: "3px 7px", fontSize: 11 }} onClick={() => delMiembro(m)}>✕</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {miembros.length === 0 && <p style={{ color: C.muted }}>Sin efectivos en el ORBAT.</p>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA PÚBLICA ORBAT                    */
/* ─────────────────────────────────────── */
function OrbatView({ unidades, miembros, roles, especialidades, condecoraciones, salaFama }) {
  const allMembers = useCollection("members");
  const sorted = [...unidades].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  // Árbol recursivo por parentId
  const hijos = parentId => sorted.filter(u => (u.parentId || null) === (parentId || null));

  const getMemberRoles = memberId => {
    if (!memberId) return [];
    const mem = allMembers.find(m => m._id === memberId);
    if (!mem) return [];
    return roles.filter(r => getMemberRoleIds(mem).includes(r._id));
  };

  const getMemberDecos = memberId =>
    (condecoraciones || []).filter(d => d.memberId === memberId && d.imagenUrl);

  const OrbatCard = ({ m, color }) => {
    const memberRoles = getMemberRoles(m.memberId);
    const decos       = getMemberDecos(m.memberId);
    const rangoP      = memberRoles.find(r => r.insigniaUrl) || memberRoles[0] || null;
    const bc          = color || C.accent;
    return (
      <div style={{
        border: `1px solid ${bc}66`,
        borderRadius: 6,
        padding: "10px 16px",
        textAlign: "center",
        minWidth: 150,
        background: "rgba(17,18,20,0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        boxShadow: `0 0 12px ${bc}1a`,
      }}>
        {rangoP?.insigniaUrl && (
          <img src={rangoP.insigniaUrl} alt={rangoP.name} style={{ width: 28, height: 36, objectFit: "contain", marginBottom: 2 }} />
        )}
        {rangoP && (
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 9, color: C.accentDim, letterSpacing: 2, textTransform: "uppercase" }}>
            {rangoP.name}
          </div>
        )}
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: C.text }}>{m.nombre}</div>
        {m.handle && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: bc }}>@{m.handle}</div>
        )}
        {(m.espIds || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", marginTop: 3 }}>
            {(m.espIds || []).map(id => {
              const esp = especialidades.find(e => e._id === id);
              return esp ? (
                <span key={id} style={{ fontSize: 9, fontFamily: "'Share Tech Mono', monospace", color: esp.color || C.accentDim }}>
                  {esp.nombre}
                </span>
              ) : null;
            })}
          </div>
        )}
        {decos.length > 0 && (
          <div style={{ display: "flex", gap: 3, marginTop: 3, justifyContent: "center" }}>
            {decos.map(d => (
              <img key={d._id} src={d.imagenUrl} alt={d.nombre} title={d.nombre} style={{ width: 18, height: 18, objectFit: "contain" }} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const VLine = ({ color, h = 24 }) => (
    <div style={{ width: 2, height: h, background: color || C.accent, flexShrink: 0 }} />
  );

  return (
    <div>
      <h2 style={S.h2}>Jerarquía</h2>

      {unidades.length === 0 ? (
        <p style={{ color: C.muted }}>ORBAT no configurado. Accede al Panel de Mando para configurarlo.</p>
      ) : (
        <div style={{ overflowX: "auto", paddingBottom: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "max-content", margin: "0 auto", paddingTop: 8 }}>

            {/* Nodo raíz */}
            <div style={{
              border: `2px solid ${C.accent}`,
              borderRadius: 6,
              padding: "10px 40px",
              fontFamily: "'Oswald', sans-serif",
              fontSize: 18,
              letterSpacing: 4,
              color: C.accent,
              textTransform: "uppercase",
              background: "rgba(201,162,74,0.08)",
              boxShadow: `0 0 20px rgba(201,162,74,0.15)`,
            }}>
              LEGIO INVICTA
            </div>

            {/* Árbol recursivo */}
            {(function renderNivel(parentId) {
              const nivel = hijos(parentId);
              if (!nivel.length) return null;
              return (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                  <VLine />
                  <div className="orbat-units-row">
                    {nivel.map(u => {
                      const color = u.color || C.accent;
                      const uM = [...miembros.filter(m => m.unidadId === u._id)]
                        .sort((a, b) => (a.orden || 0) - (b.orden || 0));
                      const subHijos = hijos(u._id);
                      return (
                        <div key={u._id} className="orbat-unit-col">
                          <div style={{ width: 2, height: 20, background: color }} />
                          {/* Cabecera de unidad */}
                          <div style={{
                            border: `2px solid ${color}`,
                            borderRadius: 6,
                            padding: "8px 20px",
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: 13,
                            letterSpacing: 3,
                            textTransform: "uppercase",
                            color,
                            background: "rgba(17,18,20,0.97)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            minWidth: 110,
                            textAlign: "center",
                            boxShadow: `0 0 14px ${color}22`,
                          }}>
                            {u.emblemUrl && (
                              <img src={u.emblemUrl} alt={u.nombre} style={{ width: 36, height: 36, objectFit: "contain" }} />
                            )}
                            {u.nombre}
                          </div>
                          {/* Miembros de la unidad */}
                          {uM.map(m => (
                            <div key={m._id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{ width: 2, height: 16, background: `${color}88` }} />
                              <OrbatCard m={m} color={color} />
                            </div>
                          ))}
                          {/* Sub-unidades hijas */}
                          {subHijos.length > 0 && renderNivel(u._id)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })(null)}
          </div>
        </div>
      )}

      {/* Sala de la Fama */}
      {salaFama?.length > 0 && (
        <Collapsible title="Sala de la Fama" badge={salaFama.length}>
          <SalaFamaGrid salaFama={salaFama} condecoraciones={condecoraciones} />
        </Collapsible>
      )}

      <style>{`
        .orbat-units-row {
          display: flex;
          align-items: flex-start;
        }
        .orbat-unit-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 28px;
          position: relative;
        }
        .orbat-unit-col::before,
        .orbat-unit-col::after {
          content: '';
          position: absolute;
          top: 0;
          height: 2px;
          background: ${C.accent};
          width: 50%;
        }
        .orbat-unit-col::before { left: 0; }
        .orbat-unit-col::after  { right: 0; }
        .orbat-unit-col:first-child::before { display: none; }
        .orbat-unit-col:last-child::after   { display: none; }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA NAV SALA DE LA FAMA              */
/* ─────────────────────────────────────── */
function SalaFamaView({ salaFama, condecoraciones }) {
  return (
    <div>
      <h2 style={S.h2}>Sala de la Fama</h2>
      {salaFama.length === 0 ? (
        <p style={{ color: C.muted }}>La Sala de la Fama está vacía. Configúrala desde el Panel de Mando.</p>
      ) : (
        <SalaFamaGrid salaFama={salaFama} condecoraciones={condecoraciones} />
      )}
    </div>
  );
}

function SalaFamaGrid({ salaFama, condecoraciones }) {
  const sorted = [...salaFama].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {sorted.map(entry => {
        const decos = condecoraciones.filter(d => (entry.decoIds || []).includes(d._id));
        return (
          <div key={entry._id} style={{ ...S.card, borderTop: `3px solid ${C.accent}`, textAlign: "center", padding: 24 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: C.accent, letterSpacing: 3, marginBottom: 4 }}>
              {entry.memberHandle}
            </div>
            {entry.descripcion && (
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>{entry.descripcion}</div>
            )}
            {decos.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {decos.map(d => (
                  d.imagenUrl
                    ? <img key={d._id} src={d.imagenUrl} alt={d.nombre} title={d.nombre} style={{ width: 52, height: 52, objectFit: "contain" }} />
                    : <span key={d._id} title={d.nombre} style={{ fontSize: 32 }}>🎖</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB DOCTRINA (ADMIN)                   */
/* ─────────────────────────────────────── */
function TabDoctrina({ docs, member, isJefe, canDo }) {
  const [editId,    setEditId]    = useState(null); // null = lista, "new" = nuevo, id = editar
  const [titulo,    setTitulo]    = useState("");
  const [categoria, setCategoria] = useState("");
  const [contenido, setContenido] = useState("");

  const canEdit = isJefe || canDo("manage_doctrina");

  const startNew = () => { setEditId("new"); setTitulo(""); setCategoria(""); setContenido(""); };
  const startEdit = d => { setEditId(d._id); setTitulo(d.titulo); setCategoria(d.categoria || ""); setContenido(d.contenido || ""); };
  const cancel = () => setEditId(null);

  const save = async () => {
    if (!titulo.trim()) return;
    const data = { titulo: titulo.trim(), categoria: categoria.trim(), contenido, autor: member.handle };
    if (editId === "new") {
      await fbAdd("doctrina", data);
    } else {
      await fbUpd("doctrina", editId, data);
    }
    setEditId(null);
  };

  const del = async d => {
    if (!confirm(`¿Eliminar "${d.titulo}"?`)) return;
    await fbDel("doctrina", d._id);
  };

  if (editId !== null) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button style={S.btn("ghost")} onClick={cancel}>← Volver</button>
          <h2 style={{ ...S.h2, margin: 0 }}>{editId === "new" ? "Nueva guía" : "Editar guía"}</h2>
        </div>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Título</label>
              <input style={S.input} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Procedimiento de asalto urbano" />
            </div>
            <div>
              <label style={S.label}>Categoría</label>
              <input style={S.input} value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ej: Táctica, ROE, Logística…" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.label, marginBottom: 8 }}>Contenido</label>
            <LegioEditor content={contenido} onChange={setContenido} minHeight={360} stickyTop={96} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary")} onClick={save}>Guardar</button>
            <button style={S.btn("ghost")} onClick={cancel}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ ...S.h2, margin: 0 }}>Doctrina ({docs.length})</h2>
        {canEdit && <button style={S.btn("primary")} onClick={startNew}>+ Nueva guía</button>}
      </div>
      {docs.length === 0
        ? <p style={{ color: C.muted }}>Sin guías de doctrina.</p>
        : docs.map(d => (
          <div key={d._id} style={{ ...S.card, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, marginBottom: 4 }}>{d.titulo}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {d.categoria && <span style={S.badge(C.accentDim)}>{d.categoria}</span>}
                <span style={{ color: C.muted, fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>@{d.autor}</span>
                {d.createdAt?.seconds && (
                  <span style={{ color: C.muted, fontSize: 11 }}>
                    {new Date(d.createdAt.seconds * 1000).toLocaleDateString("es-ES")}
                  </span>
                )}
              </div>
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={S.btn("ghost")} onClick={() => startEdit(d)}>✎ Editar</button>
                <button style={S.btn("danger")} onClick={() => del(d)}>✕</button>
              </div>
            )}
          </div>
        ))
      }
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA PÚBLICA DOCTRINA                 */
/* ─────────────────────────────────────── */
function DoctrinaView({ docs, member, isJefe, canDo }) {
  const [sel, setSel] = useState(null);

  const canEdit = isJefe || canDo("manage_doctrina");

  if (sel) {
    return (
      <div>
        <button style={{ ...S.btn("ghost"), marginBottom: 20 }} onClick={() => setSel(null)}>← Volver</button>
        <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {sel.categoria && <span style={S.badge(C.accentDim)}>{sel.categoria}</span>}
          <span style={{ color: C.muted, fontSize: 12, fontFamily: "'Share Tech Mono', monospace" }}>@{sel.autor}</span>
          {sel.createdAt?.seconds && (
            <span style={{ color: C.muted, fontSize: 12 }}>
              {new Date(sel.createdAt.seconds * 1000).toLocaleDateString("es-ES")}
            </span>
          )}
        </div>
        <h2 style={S.h2}>{sel.titulo}</h2>
        <div style={{ ...S.card }}>
          <div
            className="legio-render"
            style={{ color: C.text, lineHeight: 1.7, fontSize: 14 }}
            dangerouslySetInnerHTML={{ __html: sel.contenido || "" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={S.h2}>Doctrina</h2>
      {docs.length === 0 ? (
        <p style={{ color: C.muted }}>
          Sin guías de doctrina.{canEdit && " Créalas desde el Panel de Mando → Doctrina."}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {docs.map(d => (
            <div key={d._id} style={{ ...S.card, cursor: "pointer", borderLeft: `3px solid ${C.accent}55`, transition: "border-color 0.2s" }}
              onClick={() => setSel(d)}
              onMouseEnter={e => e.currentTarget.style.borderLeftColor = C.accent}
              onMouseLeave={e => e.currentTarget.style.borderLeftColor = C.accent + "55"}
            >
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, marginBottom: 8 }}>{d.titulo}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {d.categoria && <span style={S.badge(C.accentDim)}>{d.categoria}</span>}
                <span style={{ color: C.muted, fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>@{d.autor}</span>
              </div>
              {d.createdAt?.seconds && (
                <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>
                  {new Date(d.createdAt.seconds * 1000).toLocaleDateString("es-ES")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB ESPECIALIDADES (ADMIN)             */
/* ─────────────────────────────────────── */
function TabEspecialidades({ especialidades, isJefe, canDo }) {
  const [nombre,      setNombre] = useState("");
  const [descripcion, setDesc]   = useState("");
  const [color,       setColor]  = useState("#C9A24A");
  const [editId,      setEditId] = useState(null);

  const canEdit = isJefe || canDo("manage_roles");

  const save = async () => {
    if (!nombre.trim()) return;
    const data = { nombre: nombre.trim(), descripcion: descripcion.trim(), color };
    if (editId) {
      await fbUpd("especialidades", editId, data);
      setEditId(null);
    } else {
      await fbAdd("especialidades", data);
    }
    setNombre(""); setDesc(""); setColor("#C9A24A");
  };

  const del = async e => {
    if (!confirm(`¿Eliminar la especialidad "${e.nombre}"?`)) return;
    await fbDel("especialidades", e._id);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {canEdit && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <h3 style={S.h3}>{editId ? "Editar especialidad" : "Nueva especialidad"}</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Nombre</label>
            <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Médico de combate" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Descripción</label>
            <input style={S.input} value={descripcion} onChange={e => setDesc(e.target.value)} placeholder="Breve descripción del rol…" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                style={{ width: 40, height: 32, border: "none", background: "none", cursor: "pointer" }} />
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.muted }}>{color}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary")} onClick={save}>{editId ? "Guardar" : "Crear"}</button>
            {editId && (
              <button style={S.btn("ghost")} onClick={() => { setEditId(null); setNombre(""); setDesc(""); setColor("#C9A24A"); }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.h3}>Especialidades ({especialidades.length})</h3>
        {especialidades.length === 0
          ? <p style={{ color: C.muted }}>Sin especialidades creadas.</p>
          : especialidades.map(e => (
            <div key={e._id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: e.color || C.accent, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{e.nombre}</span>
                {canEdit && (
                  <>
                    <button style={{ ...S.btn("ghost"), padding: "3px 8px", fontSize: 11 }}
                      onClick={() => { setEditId(e._id); setNombre(e.nombre); setDesc(e.descripcion || ""); setColor(e.color || "#C9A24A"); }}>✎</button>
                    <button style={{ ...S.btn("danger"), padding: "3px 8px", fontSize: 11 }} onClick={() => del(e)}>✕</button>
                  </>
                )}
              </div>
              {e.descripcion && <div style={{ color: C.muted, fontSize: 12, marginTop: 4, paddingLeft: 18 }}>{e.descripcion}</div>}
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA PÚBLICA HOJA DE SERVICIO         */
/* ─────────────────────────────────────── */
function HojaServicioView({ member, roles, operaciones, orbatMiembros, orbatUnidades, especialidades, condecoraciones }) {
  const orbatEntry  = orbatMiembros.find(m => m.memberId === member._id);
  const unidad      = orbatEntry ? orbatUnidades.find(u => u._id === orbatEntry.unidadId) : null;
  const memberRoles = roles.filter(r => getMemberRoleIds(member).includes(r._id));
  const memberEsps  = orbatEntry ? especialidades.filter(e => (orbatEntry.espIds || []).includes(e._id)) : [];

  const opsHistory     = operaciones.filter(op => op.asistencia?.[member._id]);
  const opsConfirmadas = opsHistory.filter(op => op.asistencia[member._id] === "confirmada");
  const myDecos        = condecoraciones.filter(d => d.memberId === member._id);

  return (
    <div>
      <h2 style={S.h2}>Hoja de Servicio</h2>

      {/* Cabecera */}
      <div style={{ ...S.card, marginBottom: 24, borderLeft: `4px solid ${C.accent}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, marginBottom: 4 }}>
              {member.displayName || member.handle}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.accent, marginBottom: 10 }}>
              @{member.handle}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {memberRoles.map(r => <span key={r._id} style={S.badge(C.accent)}>{r.name}</span>)}
              {!memberRoles.length && <span style={{ color: C.muted, fontSize: 12 }}>Sin rango asignado</span>}
            </div>
            {memberEsps.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {memberEsps.map(e => <span key={e._id} style={S.badge(e.color || C.accentDim)}>{e.nombre}</span>)}
              </div>
            )}
          </div>
          {unidad && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, fontFamily: "'Oswald', sans-serif", marginBottom: 4 }}>UNIDAD</div>
              <div style={{ color: unidad.color || C.accent, fontFamily: "'Oswald', sans-serif", fontSize: 14, letterSpacing: 2 }}>{unidad.nombre}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Ops. confirmadas", value: opsConfirmadas.length, color: C.green },
          { label: "Total en registro", value: opsHistory.length,    color: C.accent },
          { label: "Condecoraciones",   value: myDecos.length,       color: C.accentDim },
        ].map(s => (
          <div key={s.label} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 36, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1, marginTop: 8, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Historial + Condecoraciones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={S.card}>
          <h3 style={S.h3}>Historial de operaciones</h3>
          {opsHistory.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13 }}>Sin operaciones registradas.</p>
          ) : opsHistory.map(op => {
            const asVal = op.asistencia[member._id];
            return (
              <div key={op._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}20` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13 }}>{op.nombre}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={S.badge(C.accentDim)}>{op.tipo}</span>
                    {op.fecha && (
                      <span style={{ color: C.muted, fontSize: 11 }}>
                        {new Date(op.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <span style={S.badge(asVal === "confirmada" ? C.green : C.danger)}>
                  {asVal === "confirmada" ? "Asistió" : "Baja"}
                </span>
              </div>
            );
          })}
        </div>

        <div style={S.card}>
          <h3 style={S.h3}>Condecoraciones</h3>
          {myDecos.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13 }}>Sin condecoraciones.</p>
          ) : myDecos.map(d => (
            <div key={d._id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 18 }}>🎖</span>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: C.accent }}>{d.nombre}</span>
              </div>
              {d.descripcion && <div style={{ color: C.muted, fontSize: 12, paddingLeft: 26 }}>{d.descripcion}</div>}
              <div style={{ display: "flex", gap: 10, paddingLeft: 26, marginTop: 4 }}>
                {d.fecha && (
                  <span style={{ color: C.muted, fontSize: 11 }}>
                    {new Date(d.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
                {d.otorgadoPor && <span style={{ color: C.muted, fontSize: 11 }}>por @{d.otorgadoPor}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA PÚBLICA SALA DE MANDOS           */
/* ─────────────────────────────────────── */
function SalaMandosView({ secciones }) {
  const sorted = [...secciones].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  return (
    <div>
      <h2 style={S.h2}>Sala de Mandos</h2>
      {sorted.length === 0 ? (
        <p style={{ color: C.muted }}>Contenido pendiente de configuración.</p>
      ) : sorted.map(sec => (
        <div key={sec._id} style={{ marginBottom: 40 }}>
          <div style={{ borderLeft: `4px solid ${C.accent}`, paddingLeft: 16, marginBottom: 20 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: C.accent, letterSpacing: 3, textTransform: "uppercase" }}>
              {sec.titulo}
            </div>
          </div>
          <div style={S.card}>
            <div
              className="legio-render"
              style={{ color: C.text, lineHeight: 1.8, fontSize: 15 }}
              dangerouslySetInnerHTML={{ __html: sec.contenido || "" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB SALA DE MANDOS (ADMIN)             */
/* ─────────────────────────────────────── */
function TabSalaMandos({ secciones, member, isJefe, canDo }) {
  const canEdit = isJefe || canDo("manage_doctrina");
  const sorted  = [...secciones].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const [editId,    setEditId]    = useState(null);
  const [titulo,    setTitulo]    = useState("");
  const [contenido, setContenido] = useState("");

  const resetForm = () => { setEditId(null); setTitulo(""); setContenido(""); };

  const startEdit = sec => { setEditId(sec._id); setTitulo(sec.titulo); setContenido(sec.contenido || ""); };

  const save = async () => {
    if (!titulo.trim()) return;
    if (editId) {
      await fbUpd("sala_mandos", editId, { titulo: titulo.trim(), contenido, autor: member.handle });
    } else {
      const maxOrden = secciones.reduce((mx, s) => Math.max(mx, s.orden || 0), 0);
      await fbAdd("sala_mandos", { titulo: titulo.trim(), contenido, autor: member.handle, orden: maxOrden + 1 });
    }
    resetForm();
  };

  const del = async sec => {
    if (!confirm(`¿Eliminar la sección "${sec.titulo}"?`)) return;
    await fbDel("sala_mandos", sec._id);
  };

  const move = (id, dir) => {
    const i = sorted.findIndex(s => s._id === id);
    if (dir === "up" && i > 0) {
      fbSet("sala_mandos", sorted[i]._id,     { orden: sorted[i - 1].orden });
      fbSet("sala_mandos", sorted[i - 1]._id, { orden: sorted[i].orden });
    }
    if (dir === "down" && i < sorted.length - 1) {
      fbSet("sala_mandos", sorted[i]._id,     { orden: sorted[i + 1].orden });
      fbSet("sala_mandos", sorted[i + 1]._id, { orden: sorted[i].orden });
    }
  };

  if (editId !== null) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button style={S.btn("ghost")} onClick={resetForm}>← Volver</button>
          <h2 style={{ ...S.h2, margin: 0 }}>{editId === "new" ? "Nueva sección" : "Editar sección"}</h2>
        </div>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Título de la sección</label>
            <input style={S.input} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Historia, Valores, Misión…" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.label, marginBottom: 8 }}>Contenido</label>
            <LegioEditor content={contenido} onChange={setContenido} minHeight={400} stickyTop={96} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary")} onClick={save}>Guardar</button>
            <button style={S.btn("ghost")} onClick={resetForm}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ ...S.h3, margin: 0 }}>Secciones ({secciones.length})</h3>
        {canEdit && (
          <button style={S.btn("primary")} onClick={() => { setEditId("new"); setTitulo(""); setContenido(""); }}>
            + Nueva sección
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p style={{ color: C.muted }}>Sin secciones. Crea la primera con el botón de arriba.</p>
      ) : sorted.map((sec, i) => (
        <div key={sec._id} style={{ ...S.card, display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, color: C.accent, letterSpacing: 1 }}>{sec.titulo}</div>
            {sec.autor && <div style={{ color: C.muted, fontSize: 11, marginTop: 4, fontFamily: "'Share Tech Mono', monospace" }}>@{sec.autor}</div>}
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => move(sec._id, "up")} disabled={i === 0}>▲</button>
              <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => move(sec._id, "down")} disabled={i === sorted.length - 1}>▼</button>
              <button style={S.btn("ghost")} onClick={() => startEdit(sec)}>✎ Editar</button>
              <button style={S.btn("danger")} onClick={() => del(sec)}>✕</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB SALA DE LA FAMA (ADMIN)            */
/* ─────────────────────────────────────── */
function TabSalaFama({ salaFama, condecoraciones, isJefe, canDo }) {
  const allMembers    = useCollection("members");
  const activeMembers = allMembers.filter(m => m.accessStatus === "activo");

  const [selId,   setSelId]   = useState("");
  const [desc,    setDesc]    = useState("");
  const [decoIds, setDecoIds] = useState([]);

  const canEdit = isJefe || canDo("manage_members");
  const sorted  = [...salaFama].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  /* Condecoraciones del miembro seleccionado */
  const selDecos = condecoraciones.filter(d => d.memberId === selId);

  const toggleDeco = id => setDecoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (!selId) return;
    const mem = activeMembers.find(m => m._id === selId);
    const maxOrden = salaFama.reduce((mx, e) => Math.max(mx, e.orden || 0), 0);
    await fbAdd("sala_fama", {
      memberId:     selId,
      memberHandle: mem?.handle || "",
      descripcion:  desc.trim(),
      decoIds,
      orden:        maxOrden + 1,
    });
    setSelId(""); setDesc(""); setDecoIds([]);
  };

  const del = async entry => {
    if (!confirm(`¿Retirar a @${entry.memberHandle} de la Sala de la Fama?`)) return;
    await fbDel("sala_fama", entry._id);
  };

  const move = (id, dir) => {
    const i = sorted.findIndex(e => e._id === id);
    if (dir === "up" && i > 0) {
      fbSet("sala_fama", sorted[i]._id,   { orden: sorted[i - 1].orden });
      fbSet("sala_fama", sorted[i - 1]._id, { orden: sorted[i].orden });
    }
    if (dir === "down" && i < sorted.length - 1) {
      fbSet("sala_fama", sorted[i]._id,   { orden: sorted[i + 1].orden });
      fbSet("sala_fama", sorted[i + 1]._id, { orden: sorted[i].orden });
    }
  };

  return (
    <div>
      {canEdit && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <h3 style={S.h3}>Añadir a la Sala de la Fama</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Legionario</label>
              <select style={S.input} value={selId} onChange={e => { setSelId(e.target.value); setDecoIds([]); }}>
                <option value="">— Seleccionar —</option>
                {activeMembers.map(m => (
                  <option key={m._id} value={m._id}>@{m.handle}{m.displayName && m.displayName !== m.handle ? ` — ${m.displayName}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <input style={S.input} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Motivo del reconocimiento…" />
            </div>
          </div>

          {selId && (
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Insignias a mostrar</label>
              {selDecos.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Este legionario no tiene condecoraciones registradas.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {selDecos.map(d => (
                    <label key={d._id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 0", borderBottom: `1px solid ${C.border}20` }}>
                      <input type="checkbox" checked={decoIds.includes(d._id)} onChange={() => toggleDeco(d._id)}
                        style={{ accentColor: C.accent, width: 14, height: 14, cursor: "pointer" }} />
                      {d.imagenUrl
                        ? <img src={d.imagenUrl} alt={d.nombre} style={{ width: 24, height: 24, objectFit: "contain" }} />
                        : <span style={{ fontSize: 18 }}>🎖</span>
                      }
                      <span style={{ fontSize: 13, color: decoIds.includes(d._id) ? C.text : C.muted }}>{d.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button style={S.btn("primary")} onClick={save} disabled={!selId}>Añadir</button>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.h3}>Sala de la Fama ({salaFama.length})</h3>
        {sorted.length === 0 ? (
          <p style={{ color: C.muted }}>Sin entradas.</p>
        ) : sorted.map((entry, i) => {
          const decos = condecoraciones.filter(d => (entry.decoIds || []).includes(d._id));
          return (
            <div key={entry._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}20` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, color: C.accent }}>{entry.memberHandle}</div>
                {entry.descripcion && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{entry.descripcion}</div>}
                {decos.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {decos.map(d => (
                      d.imagenUrl
                        ? <img key={d._id} src={d.imagenUrl} alt={d.nombre} title={d.nombre} style={{ width: 24, height: 24, objectFit: "contain" }} />
                        : <span key={d._id} title={d.nombre} style={{ fontSize: 18 }}>🎖</span>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button style={{ ...S.btn("ghost"), padding: "3px 7px", fontSize: 11 }} onClick={() => move(entry._id, "up")} disabled={i === 0}>▲</button>
                  <button style={{ ...S.btn("ghost"), padding: "3px 7px", fontSize: 11 }} onClick={() => move(entry._id, "down")} disabled={i === sorted.length - 1}>▼</button>
                  <button style={{ ...S.btn("danger"), padding: "3px 7px", fontSize: 11 }} onClick={() => del(entry)}>✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB CONDECORACIONES (ADMIN)            */
/* ─────────────────────────────────────── */
function TabCondecoraciones({ condecoraciones, member, isJefe, canDo }) {
  const allMembers    = useCollection("members");
  const activeMembers = allMembers.filter(m => m.accessStatus === "activo");

  const [selId,  setSelId]  = useState("");
  const [nombre, setNombre] = useState("");
  const [desc,   setDesc]   = useState("");
  const [fecha,  setFecha]  = useState("");

  const canEdit = isJefe || canDo("manage_members");

  const save = async () => {
    if (!selId || !nombre.trim()) return;
    const mem = activeMembers.find(m => m._id === selId);
    await fbAdd("condecoraciones", {
      memberId:     selId,
      memberHandle: mem?.handle || "",
      nombre:       nombre.trim(),
      descripcion:  desc.trim(),
      fecha:        fecha || null,
      otorgadoPor:  member.handle,
    });
    setSelId(""); setNombre(""); setDesc(""); setFecha("");
  };

  const del = async d => {
    if (!confirm(`¿Retirar "${d.nombre}" de @${d.memberHandle}?`)) return;
    await fbDel("condecoraciones", d._id);
  };

  /* Agrupar por miembro */
  const byMember = condecoraciones.reduce((acc, d) => {
    if (!acc[d.memberId]) acc[d.memberId] = { handle: d.memberHandle, decos: [] };
    acc[d.memberId].decos.push(d);
    return acc;
  }, {});

  return (
    <div>
      {canEdit && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <h3 style={S.h3}>Otorgar condecoración</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Legionario</label>
              <select style={S.input} value={selId} onChange={e => setSelId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {activeMembers.map(m => <option key={m._id} value={m._id}>@{m.handle}{m.displayName && m.displayName !== m.handle ? ` — ${m.displayName}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Fecha</label>
              <input style={{ ...S.input, colorScheme: "dark" }} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Nombre de la condecoración</label>
              <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Cruz al Valor, Medalla de Honor…" />
            </div>
            <div>
              <label style={S.label}>Descripción / Motivo</label>
              <input style={S.input} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Motivo de la distinción…" />
            </div>
          </div>
          <button style={S.btn("primary")} onClick={save} disabled={!selId || !nombre.trim()}>Otorgar</button>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.h3}>Registro de condecoraciones ({condecoraciones.length})</h3>
        {condecoraciones.length === 0 ? (
          <p style={{ color: C.muted }}>Sin condecoraciones registradas.</p>
        ) : Object.entries(byMember).map(([memberId, { handle, decos }]) => (
          <div key={memberId} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: C.accent, fontFamily: "'Oswald', sans-serif", marginBottom: 6, textTransform: "uppercase" }}>
              @{handle}
            </div>
            {decos.map(d => (
              <div key={d._id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0 6px 12px", borderBottom: `1px solid ${C.border}20` }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🎖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13 }}>{d.nombre}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                    {d.descripcion && <span style={{ color: C.muted, fontSize: 12 }}>{d.descripcion}</span>}
                    {d.fecha && (
                      <span style={{ color: C.muted, fontSize: 11 }}>
                        {new Date(d.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {d.otorgadoPor && <span style={{ color: C.muted, fontSize: 11 }}>por @{d.otorgadoPor}</span>}
                  </div>
                </div>
                {canEdit && (
                  <button style={{ ...S.btn("danger"), padding: "3px 8px", fontSize: 11, flexShrink: 0 }} onClick={() => del(d)}>✕</button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB OPERACIONES (ADMIN)                */
/* ─────────────────────────────────────── */
function TabOperaciones({ ops, member, isJefe, canDo }) {
  const canEdit = isJefe || canDo("manage_ops");
  const [editId,   setEditId]   = useState(null);
  const [nombre,   setNombre]   = useState("");
  const [tipo,     setTipo]     = useState(OP_TIPOS[0]);
  const [fecha,    setFecha]    = useState("");
  const [estado,   setEstado]   = useState("planificada");
  const [desc,     setDesc]     = useState("");

  const resetForm = () => { setEditId(null); setNombre(""); setTipo(OP_TIPOS[0]); setFecha(""); setEstado("planificada"); setDesc(""); };

  const startEdit = op => {
    setEditId(op._id);
    setNombre(op.nombre || "");
    setTipo(op.tipo || OP_TIPOS[0]);
    setFecha(op.fecha || "");
    setEstado(op.estado || "planificada");
    setDesc(op.descripcion || "");
  };

  const save = async () => {
    if (!nombre.trim() || !fecha) return;
    const data = { nombre: nombre.trim(), tipo, fecha, estado, descripcion: desc.trim(), autor: member.handle };
    if (editId) {
      await fbUpd("operaciones", editId, data);
    } else {
      await fbAdd("operaciones", data);
    }
    resetForm();
  };

  const del = async op => {
    if (!confirm(`¿Eliminar la operación "${op.nombre}"?`)) return;
    await fbDel("operaciones", op._id);
  };

  const confirmados = op => Object.values(op.asistencia || {}).filter(v => v === "confirmada").length;
  const bajas       = op => Object.values(op.asistencia || {}).filter(v => v === "baja").length;

  return (
    <div>
      {canEdit && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <h3 style={S.h3}>{editId ? "Editar operación" : "Nueva operación"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Nombre / Designación</label>
              <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: OP TRUENO ROJO" />
            </div>
            <div>
              <label style={S.label}>Fecha</label>
              <input style={{ ...S.input, colorScheme: "dark" }} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Tipo</label>
              <select style={S.input} value={tipo} onChange={e => setTipo(e.target.value)}>
                {OP_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Estado</label>
              <select style={S.input} value={estado} onChange={e => setEstado(e.target.value)}>
                {Object.entries(OP_ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.label, marginBottom: 8 }}>Descripción / Briefing</label>
            <LegioEditor content={desc} onChange={setDesc} minHeight={200} stickyTop={96} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary")} onClick={save}>{editId ? "Guardar" : "Crear operación"}</button>
            {editId && <button style={S.btn("ghost")} onClick={resetForm}>Cancelar</button>}
          </div>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.h3}>Operaciones ({ops.length})</h3>
        {ops.length === 0 ? (
          <p style={{ color: C.muted }}>Sin operaciones registradas.</p>
        ) : ops.map(op => {
          const est = OP_ESTADOS[op.estado] || OP_ESTADOS.planificada;
          return (
            <div key={op._id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.border}20` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600 }}>{op.nombre}</span>
                  <span style={S.badge(est.color)}>{est.label}</span>
                  <span style={S.badge(C.accentDim)}>{op.tipo}</span>
                </div>
                <div style={{ display: "flex", gap: 12, color: C.muted, fontSize: 12, flexWrap: "wrap" }}>
                  {op.fecha && <span>{new Date(op.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                  <span>Confirmados: <span style={{ color: C.green }}>{confirmados(op)}</span></span>
                  <span>Bajas: <span style={{ color: C.danger }}>{bajas(op)}</span></span>
                  {op.autor && <span>@{op.autor}</span>}
                </div>
                {op.descripcion && <div style={{ color: C.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>Con briefing</div>}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(op)}>✎</button>
                  <button style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 12 }} onClick={() => del(op)}>✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  CALENDARIO DE OPERACIONES              */
/* ─────────────────────────────────────── */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

function CalendarioView({ ops, member }) {
  const hoy = new Date();
  const [year,  setYear]  = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());
  const [selOp, setSelOp] = useState(null);

  const prevMes = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMes = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const diasEnMes  = new Date(year, month + 1, 0).getDate();
  const primerDia  = new Date(year, month, 1).getDay();
  const offsetLun  = (primerDia + 6) % 7; // lunes = 0

  /* Agrupar operaciones del mes por día */
  const opsPorDia = {};
  ops.forEach(op => {
    if (!op.fecha) return;
    const [y, m, d] = op.fecha.split("-").map(Number);
    if (y === year && m === month + 1) {
      if (!opsPorDia[d]) opsPorDia[d] = [];
      opsPorDia[d].push(op);
    }
  });

  /* Celdas: null para huecos iniciales, número de día para el resto */
  const celdas = [...Array(offsetLun).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];

  const setAsistencia = async (op, valor) => {
    const field = `asistencia.${member._id}`;
    await fbUpd("operaciones", op._id, { [field]: valor === null ? deleteField() : valor });
    setSelOp(prev => {
      if (!prev) return prev;
      const a = { ...(prev.asistencia || {}) };
      if (valor === null) delete a[member._id]; else a[member._id] = valor;
      return { ...prev, asistencia: a };
    });
  };

  return (
    <div>
      <h2 style={S.h2}>Calendario de Operaciones</h2>

      {/* Navegación de mes */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button style={{ ...S.btn("ghost"), padding: "6px 14px" }} onClick={prevMes}>◄</button>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, color: C.accent, letterSpacing: 3, minWidth: 240, textAlign: "center", textTransform: "uppercase" }}>
          {MESES[month]} {year}
        </span>
        <button style={{ ...S.btn("ghost"), padding: "6px 14px" }} onClick={nextMes}>►</button>
        <button style={{ ...S.btn("ghost"), padding: "6px 14px", marginLeft: 8 }}
          onClick={() => { setYear(hoy.getFullYear()); setMonth(hoy.getMonth()); }}>
          Hoy
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Calendario */}
        <div style={S.card}>
          {/* Cabecera días de la semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
            {DIAS.map(d => (
              <div key={d} style={{ textAlign: "center", padding: "4px 0", fontFamily: "'Oswald', sans-serif", fontSize: 11, color: C.muted, letterSpacing: 2 }}>
                {d}
              </div>
            ))}
          </div>
          {/* Celdas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {celdas.map((dia, i) => {
              if (!dia) return <div key={`v-${i}`} />;
              const esHoy = dia === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();
              const dayOps = opsPorDia[dia] || [];
              return (
                <div key={dia} style={{
                  minHeight: 64, padding: "4px 5px",
                  background: esHoy ? "rgba(201,162,74,0.08)" : C.surface2,
                  border: esHoy ? `1px solid ${C.accent}66` : `1px solid ${C.border}20`,
                  borderRadius: 4,
                }}>
                  <div style={{ fontSize: 12, color: esHoy ? C.accent : C.muted, fontFamily: "'Oswald', sans-serif", marginBottom: 3, fontWeight: esHoy ? 700 : 400 }}>
                    {dia}
                  </div>
                  {dayOps.map(op => {
                    const est   = OP_ESTADOS[op.estado] || OP_ESTADOS.planificada;
                    const myVal = op.asistencia?.[member._id];
                    const isSel = selOp?._id === op._id;
                    return (
                      <div key={op._id}
                        onClick={() => setSelOp(isSel ? null : op)}
                        title={op.nombre}
                        style={{
                          background: isSel ? est.color + "44" : est.color + "18",
                          border: `1px solid ${isSel ? est.color : est.color + "55"}`,
                          borderRadius: 3, padding: "2px 5px", marginBottom: 2,
                          fontSize: 10, color: est.color, cursor: "pointer",
                          fontFamily: "'Share Tech Mono', monospace",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          display: "flex", alignItems: "center", gap: 3,
                        }}
                      >
                        {myVal === "confirmada" ? "✓" : myVal === "baja" ? "✗" : "·"}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{op.nombre}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            {Object.entries(OP_ESTADOS).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Share Tech Mono', monospace" }}>{v.label}</span>
              </div>
            ))}
            <span style={{ fontSize: 11, color: C.muted }}>· pendiente · ✓ confirmado · ✗ baja</span>
          </div>
        </div>

        {/* Panel de detalle */}
        <div>
          {!selOp ? (
            <div style={{ ...S.card, textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>
              Selecciona una operación del calendario para ver su detalle.
            </div>
          ) : (() => {
            const est    = OP_ESTADOS[selOp.estado] || OP_ESTADOS.planificada;
            const myVal  = selOp.asistencia?.[member._id] || null;
            const conf   = Object.values(selOp.asistencia || {}).filter(v => v === "confirmada").length;
            const bajasN = Object.values(selOp.asistencia || {}).filter(v => v === "baja").length;

            const AsBtn = ({ valor, label, color }) => (
              <button onClick={() => setAsistencia(selOp, myVal === valor ? null : valor)}
                style={{
                  ...S.btn("ghost"),
                  background: myVal === valor ? color + "22" : "transparent",
                  border: `1px solid ${color}`,
                  color: myVal === valor ? color : C.muted,
                  padding: "7px 16px", fontSize: 12, flex: 1,
                }}>
                {label}
              </button>
            );

            return (
              <div style={{ ...S.card, borderTop: `3px solid ${est.color}` }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                  <span style={S.badge(est.color)}>{est.label}</span>
                  <span style={S.badge(C.accentDim)}>{selOp.tipo}</span>
                  {selOp.fecha && (
                    <span style={{ color: C.muted, fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
                      {new Date(selOp.fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" })}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, color: C.accent, letterSpacing: 2, marginBottom: 12 }}>
                  {selOp.nombre}
                </div>

                {selOp.descripcion && (
                  <div className="legio-render" style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}
                    dangerouslySetInnerHTML={{ __html: selOp.descripcion }} />
                )}

                <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
                  <span style={{ fontSize: 13 }}><span style={{ color: C.green, fontWeight: 700 }}>{conf}</span> <span style={{ color: C.muted }}>confirmados</span></span>
                  <span style={{ fontSize: 13 }}><span style={{ color: C.danger, fontWeight: 700 }}>{bajasN}</span> <span style={{ color: C.muted }}>bajas</span></span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <AsBtn valor="confirmada" label="Confirmo asistencia" color={C.green} />
                  <AsBtn valor="baja"       label="Doy baja"            color={C.danger} />
                </div>
                {myVal && (
                  <div style={{ fontSize: 12, color: myVal === "confirmada" ? C.green : C.danger, marginTop: 8 }}>
                    Tu estado: {myVal === "confirmada" ? "Confirmado" : "Baja"}
                    <span style={{ color: C.muted, marginLeft: 8, cursor: "pointer" }} onClick={() => setAsistencia(selOp, null)}>
                      (cancelar)
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA PÚBLICA OPERACIONES              */
/* ─────────────────────────────────────── */
function OperacionesView({ ops, member }) {
  const [sel, setSel] = useState(null);

  const setAsistencia = async (op, valor) => {
    const field = `asistencia.${member._id}`;
    await fbUpd("operaciones", op._id, { [field]: valor === null ? deleteField() : valor });
    setSel(prev => {
      if (!prev) return prev;
      const a = { ...(prev.asistencia || {}) };
      if (valor === null) delete a[member._id]; else a[member._id] = valor;
      return { ...prev, asistencia: a };
    });
  };

  if (sel) {
    const est     = OP_ESTADOS[sel.estado] || OP_ESTADOS.planificada;
    const myVal   = sel.asistencia?.[member._id] || null;
    const conf    = Object.values(sel.asistencia || {}).filter(v => v === "confirmada").length;
    const bajasN  = Object.values(sel.asistencia || {}).filter(v => v === "baja").length;

    const AsBtn = ({ valor, label, color }) => (
      <button
        onClick={() => setAsistencia(sel, valor)}
        style={{
          ...S.btn(myVal === valor ? "primary" : "ghost"),
          background: myVal === valor ? color : "transparent",
          border: `1px solid ${color}`,
          color: myVal === valor ? "#0a0c08" : color,
          padding: "8px 20px", fontSize: 13,
        }}>
        {label}
      </button>
    );

    return (
      <div>
        <button style={{ ...S.btn("ghost"), marginBottom: 20 }} onClick={() => setSel(null)}>← Volver</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={S.badge(est.color)}>{est.label}</span>
          <span style={S.badge(C.accentDim)}>{sel.tipo}</span>
          {sel.fecha && (
            <span style={{ color: C.muted, fontSize: 12, fontFamily: "'Share Tech Mono', monospace" }}>
              {new Date(sel.fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </span>
          )}
        </div>
        <h2 style={S.h2}>{sel.nombre}</h2>

        {sel.descripcion && (
          <div style={{ ...S.card, marginBottom: 24, borderLeft: `3px solid ${C.accent}55` }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>BRIEFING</div>
            <div
              className="legio-render"
              style={{ color: C.text, lineHeight: 1.7, fontSize: 14 }}
              dangerouslySetInnerHTML={{ __html: sel.descripcion }}
            />
          </div>
        )}

        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: C.muted, letterSpacing: 2, marginBottom: 16 }}>ASISTENCIA</div>
          <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: C.green, fontWeight: 700, marginRight: 4 }}>{conf}</span>
              <span style={{ color: C.muted }}>confirmados</span>
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: C.danger, fontWeight: 700, marginRight: 4 }}>{bajasN}</span>
              <span style={{ color: C.muted }}>bajas</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <AsBtn valor="confirmada" label="Confirmo asistencia" color={C.green} />
            <AsBtn valor="baja"       label="Doy baja"            color={C.danger} />
            {myVal && (
              <button style={{ ...S.btn("ghost"), padding: "8px 16px", fontSize: 13 }}
                onClick={() => setAsistencia(sel, null)}>
                Cancelar respuesta
              </button>
            )}
          </div>
          {myVal && (
            <div style={{ fontSize: 12, color: myVal === "confirmada" ? C.green : C.danger, marginTop: 4 }}>
              Tu estado: {myVal === "confirmada" ? "Confirmado" : "Baja"}
            </div>
          )}
        </div>
      </div>
    );
  }

  const grupos = {
    en_curso:    ops.filter(o => o.estado === "en_curso"),
    planificada: ops.filter(o => o.estado === "planificada"),
    completada:  ops.filter(o => o.estado === "completada"),
    cancelada:   ops.filter(o => o.estado === "cancelada"),
  };

  return (
    <div>
      <h2 style={S.h2}>Operaciones</h2>
      {ops.length === 0 && <p style={{ color: C.muted }}>Sin operaciones registradas.</p>}
      {Object.entries(grupos).map(([estadoKey, lista]) => {
        if (!lista.length) return null;
        const est = OP_ESTADOS[estadoKey];
        return (
          <div key={estadoKey} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: `4px solid ${est.color}`, paddingLeft: 16, marginBottom: 16 }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, color: est.color, letterSpacing: 3, textTransform: "uppercase" }}>
                {est.label}
              </span>
              <span style={S.badge(est.color)}>{lista.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 20 }}>
              {lista.map(op => {
                const myVal  = op.asistencia?.[member._id] || null;
                const conf   = Object.values(op.asistencia || {}).filter(v => v === "confirmada").length;
                return (
                  <div key={op._id}
                    style={{ ...S.card, cursor: "pointer", borderLeft: `2px solid ${est.color}55`, display: "flex", alignItems: "center", gap: 16, transition: "border-color 0.2s" }}
                    onClick={() => setSel(op)}
                    onMouseEnter={e => e.currentTarget.style.borderLeftColor = est.color}
                    onMouseLeave={e => e.currentTarget.style.borderLeftColor = est.color + "55"}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600 }}>{op.nombre}</span>
                        <span style={S.badge(C.accentDim)}>{op.tipo}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, color: C.muted, fontSize: 12 }}>
                        {op.fecha && <span>{new Date(op.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                        <span style={{ color: C.green }}>{conf} confirmados</span>
                      </div>
                    </div>
                    {myVal && (
                      <span style={S.badge(myVal === "confirmada" ? C.green : C.danger)}>
                        {myVal === "confirmada" ? "Confirmado" : "Baja"}
                      </span>
                    )}
                    <span style={{ color: C.muted, fontSize: 18 }}>›</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA PÚBLICA ESPECIALIDADES           */
/* ─────────────────────────────────────── */
function EspecialidadesView({ especialidades }) {
  const orbatMiembros = useCollection("orbat_miembros");

  const getEfectivosWithEsp = (espId) =>
    orbatMiembros.filter(m => (m.espIds || []).includes(espId));

  return (
    <div>
      <h2 style={S.h2}>Especialidades</h2>
      {especialidades.length === 0 ? (
        <p style={{ color: C.muted }}>Sin especialidades definidas.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {especialidades.map(e => {
            const efectivos = getEfectivosWithEsp(e._id);
            const color     = e.color || C.accent;
            return (
              <div key={e._id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${color}`, paddingLeft: 16, marginBottom: 12 }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 17, color, letterSpacing: 3, textTransform: "uppercase" }}>
                    {e.nombre}
                  </span>
                  <span style={S.badge(color)}>{efectivos.length} efectivos</span>
                </div>
                {e.descripcion && (
                  <p style={{ color: C.muted, fontSize: 13, paddingLeft: 20, marginBottom: 12 }}>{e.descripcion}</p>
                )}
                {efectivos.length === 0 ? (
                  <p style={{ color: C.muted, paddingLeft: 20, fontSize: 13 }}>Sin efectivos asignados en el ORBAT.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 20 }}>
                    {efectivos.map(m => (
                      <div key={m._id} style={{ ...S.card, padding: "8px 14px", borderLeft: `2px solid ${color}55`, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color }}>@{m.handle}</span>
                        {m.nombre && m.nombre !== m.handle && (
                          <span style={{ fontSize: 13 }}>{m.nombre}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
