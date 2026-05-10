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
    minHeight: "100vh", color: C.text,
    fontFamily: "'Inter', sans-serif", fontSize: 15,
    backgroundImage: "url(/imagenparainicio.jpg)",
    backgroundSize: "cover", backgroundPosition: "center",
    backgroundAttachment: "fixed", backgroundRepeat: "no-repeat",
    position: "relative",
  },
  pageOverlay: {
    position: "fixed", inset: 0, zIndex: 0,
    background: "rgba(6,5,4,0.72)",
    pointerEvents: "none",
  },
  nav: {
    position: "sticky", top: 0, zIndex: 100, height: 96,
    background: "rgba(55,8,8,0.72)", borderBottom: "1px solid rgba(201,162,74,0.12)",
    backdropFilter: "blur(14px)",
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
  fallida:     { label: "Fallida",     color: "#8b5cf6" },
  cancelada:   { label: "Cancelada",   color: "#c0392b" },
};

/* ── Permisos disponibles ── */
const ALL_PERMS = [
  { id: "approve_requests",      label: "Aprobar solicitudes de registro" },
  { id: "manage_roles",          label: "Gestionar rangos" },
  { id: "manage_members",        label: "Gestionar militares (bajas y reinstauración)" },
  { id: "manage_orbat",          label: "Gestionar ORBAT" },
  { id: "manage_ops",            label: "Gestionar operaciones" },
  { id: "manage_especialidades", label: "Gestionar especialidades y formación" },
  { id: "manage_condecoraciones",label: "Otorgar y revocar condecoraciones" },
  { id: "manage_sala_fama",      label: "Gestionar Sala de la Fama" },
  { id: "post_sitrep",           label: "Publicar SITREP" },
  { id: "forum_post",            label: "Publicar en el foro" },
  { id: "forum_mod",             label: "Moderar el foro" },
  { id: "forum_sugerencias",     label: "Ver y publicar en Sugerencias de misiones" },
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
  const [espId, setEspId]   = useState(null);

  const roles           = useCollection("roles");
  const orbatUnidades   = useCollection("orbat_unidades", orderBy("orden"));
  const orbatMiembros   = useCollection("orbat_miembros");
  const especialidades  = useCollection("especialidades", orderBy("nombre"));
  const operaciones     = useCollection("operaciones", orderBy("fecha", "desc"));
  const condecoraciones = useCollection("condecoraciones", orderBy("createdAt", "desc"));
  const salaFama        = useCollection("sala_fama", orderBy("orden"));
  const salaMandos      = useCollection("sala_mandos", orderBy("orden"));
  const foroHilos       = useCollection("foro_hilos", orderBy("createdAt", "desc"));

  /* Auth listener — uses onSnapshot so member updates as soon as Firestore doc is created */
  useEffect(() => {
    let unsubMember = null;
    const unsubAuth = onAuthStateChanged(auth, fbUser => {
      if (unsubMember) { unsubMember(); unsubMember = null; }
      if (fbUser) {
        setUser(fbUser);
        unsubMember = onSnapshot(doc(db, "members", fbUser.uid), snap => {
          setMember(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          setLoading(false);
        });
      } else {
        setUser(null);
        setMember(null);
        setLoading(false);
      }
    });
    return () => { unsubAuth(); if (unsubMember) unsubMember(); };
  }, []);

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

  const canAdmin = isJefe || canDo("approve_requests") || canDo("manage_roles") || canDo("manage_members") || canDo("manage_orbat") || canDo("manage_ops") || canDo("forum_mod") || canDo("manage_especialidades") || canDo("manage_condecoraciones") || canDo("manage_sala_fama") || canDo("forum_sugerencias");
  const orbatActive = view === "orbat" || view === "sala_fama";
  const opsActive   = view === "operaciones" || view === "calendario";

  return (
    <div style={{ ...S.page, overflowY: view === "inicio" ? "hidden" : "auto" }}>
      <div style={S.pageOverlay} />
      <nav style={S.nav}>
        <div style={S.navLogo}>
          <img src="/logo.png" alt="Legio Invicta" style={{ height: 64, width: 64, borderRadius: "50%", border: `1px solid ${C.border}` }} />
          <div>
            <span style={S.navLogoText}>LEGIO INVICTA</span>
            <span style={S.navLogoSub}>HONOR Y VICTORIA</span>
          </div>
        </div>
        <span style={S.navItem(view === "inicio")} onClick={() => setView("inicio")}>Inicio</span>
        <NavDropdown
          label="ORBAT"
          active={orbatActive}
          items={[
            { id: "orbat",     label: "Jerarquía" },
            { id: "sala_fama", label: "Sala de la Fama" },
          ]}
          currentView={view}
          onSelect={setView}
        />
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
        <span style={S.navItem(view === "foro")} onClick={() => setView("foro")}>Foro (Beta)</span>
        <NavDropdown
          label="Especialidades"
          active={view === "especialidades" || view === "especialidad"}
          items={[
            { id: "especialidades", label: "Todas" },
            ...especialidades.map(e => ({ id: `esp_${e._id}`, label: e.nombre })),
          ]}
          currentView={view === "especialidad" ? `esp_${espId}` : view}
          onSelect={id => {
            if (id.startsWith("esp_")) { setEspId(id.slice(4)); setView("especialidad"); }
            else setView(id);
          }}
        />
        <span style={S.navItem(view === "servicio")} onClick={() => setView("servicio")}>Mi Hoja</span>
        {canAdmin && (
          <span style={S.navItem(view === "admin")} onClick={() => setView("admin")}>Mando</span>
        )}
        <span style={{ ...S.navItem(false), marginLeft: 8 }} onClick={() => signOut(auth)}>
          Salir
        </span>
      </nav>

      <div style={{ position: "relative", zIndex: 1 }}>
        {view === "inicio"         && <InicioView member={member} roles={roles} operaciones={operaciones} condecoraciones={condecoraciones} orbatMiembros={orbatMiembros} salaMandos={salaMandos} />}
        {view !== "inicio" && (
          <div style={{ padding: "40px 36px" }}>
            {view === "servicio"       && <HojaServicioView member={member} roles={roles} operaciones={operaciones} orbatMiembros={orbatMiembros} orbatUnidades={orbatUnidades} especialidades={especialidades} condecoraciones={condecoraciones} />}
            {view === "operaciones"    && <OperacionesView ops={operaciones} member={member} />}
            {view === "calendario"     && <CalendarioView ops={operaciones} member={member} />}
            {view === "orbat"          && <OrbatView unidades={orbatUnidades} miembros={orbatMiembros} roles={roles} especialidades={especialidades} condecoraciones={condecoraciones} salaFama={salaFama} />}
            {view === "sala_fama"      && <SalaFamaView condecoraciones={condecoraciones} roles={roles} />}
            {view === "especialidades" && <EspecialidadesView especialidades={especialidades} />}
            {view === "especialidad"  && espId && <EspecialidadDetalleView espId={espId} member={member} isJefe={isJefe} canDo={canDo} especialidades={especialidades} />}
            {view === "foro"           && <ForoView member={member} isJefe={isJefe} canDo={canDo} hilos={foroHilos} />}
            {view === "admin"          && <AdminPanel roles={roles} isJefe={isJefe} isSuperAdmin={isSuperAdmin} canDo={canDo} orbatUnidades={orbatUnidades} orbatMiembros={orbatMiembros} member={member} especialidades={especialidades} operaciones={operaciones} condecoraciones={condecoraciones} salaFama={salaFama} salaMandos={salaMandos} foroHilos={foroHilos} />}
          </div>
        )}
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
    let cred = null;
    try {
      const existing = await getDoc(doc(db, "handles", handleKey));
      if (existing.exists()) { setError("Ese usuario ya está en uso."); setBusy(false); return; }
      cred = await createUserWithEmailAndPassword(auth, correo.trim(), pin);
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
      if (cred) await cred.user.delete().catch(() => {});
      if (err.code === "auth/email-already-in-use") setError("Ese correo ya está en uso.");
      else setError(`Error al registrar: ${err.message}`);
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
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      backgroundImage: "url(/pantallaregistro.jpg)",
      backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
      position: "relative",
    }}>
      {/* Overlay oscuro */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(8,6,4,0.45)" }} />

      <div style={{ position: "relative", zIndex: 1, width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo.png" alt="Legio Invicta"
            style={{ width: 110, height: 110, borderRadius: "50%", border: `2px solid ${C.accent}55`, marginBottom: 16, filter: "drop-shadow(0 0 18px rgba(201,162,74,0.4))" }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 30, fontWeight: 700,
            color: C.accent, letterSpacing: 8, marginBottom: 4,
            textShadow: "0 0 30px rgba(201,162,74,0.5)",
          }}>LEGIO INVICTA</div>
          <div style={{ color: "rgba(232,224,208,0.5)", fontSize: 11, letterSpacing: 5, fontFamily: "'Share Tech Mono', monospace" }}>
            HONOR Y VICTORIA
          </div>
        </div>

        <div style={{
          background: "rgba(17,18,20,0.75)", backdropFilter: "blur(18px)",
          border: `1px solid rgba(201,162,74,0.2)`, borderRadius: 10, padding: 28,
        }}>
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
        `Militar: ${member.handle}`,
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

  const memberRolesList = roles.filter(r => getMemberRoleIds(member).includes(r._id));
  const roleNames  = memberRolesList.map(r => r.name).join(" · ");
  const firstRank  = memberRolesList[0]?.name || "";
  const RANGOS_SIN_MI = ["Recluta", "Soldado", "Soldado 1º"];
  const welcomeText = firstRank
    ? RANGOS_SIN_MI.includes(firstRank)
      ? `BIENVENIDO, ${firstRank.toUpperCase()}`
      : `BIENVENIDO, MI ${firstRank.toUpperCase()}`
    : "BIENVENIDO, RECLUTA";

  const statCards = [
    { label: "Militares activos",   value: activos.length,          color: C.accent },
    { label: "Ops completadas",        value: opsCompletadas.length,   color: C.green },
    { label: "En cartera",             value: opsActivas.length,       color: C.accentDim },
    { label: "Asistencia media",       value: avgAsistencia !== null ? `${avgAsistencia}%` : "—", color: avgAsistencia >= 70 ? C.green : avgAsistencia >= 40 ? C.accentDim : C.danger },
  ];

  const proximas     = [...opsPlanif].sort((a, b) => a.fecha > b.fecha ? 1 : -1).slice(0, 5);
  const ultimasDecos = condecoraciones.slice(0, 5);

  const panelStyle = {
    background: "rgba(17,18,20,0.72)", backdropFilter: "blur(12px)",
    border: `1px solid rgba(201,162,74,0.15)`, borderRadius: 10,
    padding: "16px 20px",
  };
  const panelTitle = {
    fontFamily: "'Oswald', sans-serif", fontSize: 12, color: C.accent,
    letterSpacing: 3, textTransform: "uppercase", marginBottom: 12,
  };

  return (
    <div style={{ height: "calc(100vh - 96px)", overflow: "hidden", position: "relative", boxSizing: "border-box" }}>
      {/* Gradiente */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(6,5,4,0.9) 0%, rgba(6,5,4,0.2) 60%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Ops arriba a la derecha */}
      <div style={{ position: "absolute", top: 28, right: 56, zIndex: 1, width: 300, ...panelStyle }}>
        <div style={panelTitle}>Próximas operaciones</div>
        {proximas.length === 0
          ? <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Sin operaciones planificadas.</p>
          : proximas.map(op => {
            const est = OP_ESTADOS[op.estado] || OP_ESTADOS.planificada;
            return (
              <div key={op._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid rgba(201,162,74,0.08)` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13 }}>{op.nombre}</div>
                  <div style={{ display: "flex", gap: 5, marginTop: 2, alignItems: "center" }}>
                    <span style={S.badge(est.color)}>{est.label}</span>
                    {op.fecha && <span style={{ color: C.muted, fontSize: 11 }}>{new Date(op.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>}
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>

      {/* Centro — bienvenida */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: C.accent, letterSpacing: 6, marginBottom: 14, opacity: 0.85, textTransform: "uppercase" }}>
          {welcomeText}
        </div>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 64, fontWeight: 700, color: C.text, lineHeight: 1, letterSpacing: 4, textAlign: "center", textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>
          {member.displayName || member.handle}
        </div>
        {roleNames && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: C.accent, letterSpacing: 4, marginTop: 10 }}>
            {roleNames}
          </div>
        )}
      </div>

      {/* Abajo izquierda — stats */}
      <div style={{ position: "absolute", bottom: 48, left: 56, zIndex: 1, display: "flex", gap: 36 }}>
        {statCards.map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 36, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: "rgba(232,224,208,0.4)", fontSize: 10, letterSpacing: 2, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Abajo derecha — condecoraciones */}
      <div style={{ position: "absolute", bottom: 48, right: 56, zIndex: 1, width: 300, ...panelStyle }}>
        <div style={panelTitle}>Condecoraciones recientes</div>
        {ultimasDecos.length === 0
          ? <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Sin condecoraciones registradas.</p>
          : ultimasDecos.map(d => (
            <div key={d._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid rgba(201,162,74,0.08)` }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🎖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, color: C.accent }}>{d.nombre}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>{d.memberHandle}</div>
              </div>
            </div>
          ))
        }
      </div>
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
      <h2 style={S.h2}>Militares</h2>
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
              <tr><td colSpan={4} style={{ ...S.td, color: C.muted, textAlign: "center" }}>Sin militares activos</td></tr>
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
function AdminPanel({ roles, isJefe, isSuperAdmin, canDo, orbatUnidades, orbatMiembros, member, especialidades, operaciones, condecoraciones, salaFama, salaMandos, foroHilos }) {
  const [tab, setTab] = useState("solicitudes");

  const tabs = [
    { id: "solicitudes",    label: "Solicitudes",    show: isJefe || canDo("approve_requests") },
    { id: "rangos",         label: "Rangos",          show: isJefe || canDo("manage_roles") },
    { id: "especialidades", label: "Especialidades",  show: isJefe || canDo("manage_especialidades") },
    { id: "bajas",          label: "Bajas",           show: isJefe || canDo("manage_members") },
    { id: "orbat",             label: "ORBAT",            show: isJefe || canDo("manage_orbat") },
    { id: "operaciones",       label: "Operaciones",      show: isJefe || canDo("manage_ops") },
    { id: "condecoraciones",   label: "Condecoraciones",  show: isJefe || canDo("manage_condecoraciones") },
    { id: "sala_fama",         label: "Sala de la Fama",  show: false },
    { id: "sala_mandos",       label: "Sala de Mandos",   show: isJefe },
    { id: "foro",              label: "Foro",             show: isJefe || canDo("forum_mod") },
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
      {tab === "solicitudes"    && <TabSolicitudes roles={roles} member={member} />}
      {tab === "rangos"         && <TabRangos roles={roles} isJefe={isJefe} isSuperAdmin={isSuperAdmin} />}
      {tab === "especialidades" && <TabEspecialidades especialidades={especialidades} isJefe={isJefe} canDo={canDo} />}
      {tab === "bajas"          && <TabBajas />}
      {tab === "orbat"          && <TabOrbat unidades={orbatUnidades} miembros={orbatMiembros} isJefe={isJefe} canDo={canDo} roles={roles} especialidades={especialidades} />}
      {tab === "operaciones"     && <TabOperaciones ops={operaciones} member={member} isJefe={isJefe} canDo={canDo} />}
      {tab === "condecoraciones" && <TabCondecoraciones condecoraciones={condecoraciones} member={member} isJefe={isJefe} canDo={canDo} />}
      {tab === "sala_fama"       && <TabSalaFama salaFama={salaFama} condecoraciones={condecoraciones} isJefe={isJefe} canDo={canDo} />}
      {tab === "sala_mandos"     && <TabSalaMandos secciones={salaMandos} member={member} isJefe={isJefe} canDo={canDo} />}
      {tab === "foro"            && <TabForo hilos={foroHilos} member={member} isJefe={isJefe} canDo={canDo} />}
    </div>
  );
}

/* ── Tab: Solicitudes ── */
const ESP_ESTADOS = [
  { value: "pendiente",      label: "Pendiente",       color: "#f59e0b" },
  { value: "tramitando",     label: "Tramitando",      color: "#3b82f6" },
  { value: "curso_por_hacer",label: "Curso por hacer", color: "#8b5cf6" },
  { value: "admitido",       label: "Admitido",        color: "#06b6d4" },
  { value: "aprobado",       label: "Aprobado",        color: "#4caf50" },
  { value: "suspendido",     label: "Suspendido",      color: "#f97316" },
  { value: "rechazado",      label: "Rechazado",       color: "#c0392b" },
];

function espEstadoColor(estado) {
  return ESP_ESTADOS.find(e => e.value === estado)?.color || C.muted;
}
function espEstadoLabel(estado) {
  return ESP_ESTADOS.find(e => e.value === estado)?.label || estado;
}

function TabSolicitudes({ roles, member }) {
  const members     = useCollection("members");
  const espAccesos  = useCollection("especialidad_accesos", orderBy("createdAt", "desc"));
  const pending     = members.filter(m => m.accessStatus === "pendiente");

  const approve = async m => {
    const reclutas = roles.find(r => r.name.toLowerCase() === "recluta");
    const roleIds  = reclutas ? [reclutas._id] : [];
    await fbUpd("members", m._id, { accessStatus: "activo", ...(roleIds.length ? { roleIds } : {}) });
  };
  const reject = async m => {
    const note = prompt("Motivo del rechazo (opcional):") || "";
    await fbUpd("members", m._id, { accessStatus: "rechazado", accessNote: note });
  };
  const delEspAcceso = async a => {
    if (!window.confirm(`¿Eliminar la solicitud de ${a.memberHandle} para ${a.espNombre}? El miembro podrá volver a solicitarla.`)) return;
    await fbDel("especialidad_accesos", a._id);
  };

  const setEspEstado = async (a, estado) => {
    const data = { estado, otorgadoPor: member?.handle || "mando", otorgadoAt: serverTimestamp() };
    if (estado === "rechazado" || estado === "suspendido") {
      const motivo = prompt(`Motivo de ${estado === "rechazado" ? "rechazo" : "suspensión"} (visible al miembro):`);
      if (motivo === null) return;
      data.motivo = motivo.trim();
    } else {
      data.motivo = "";
    }
    await fbUpd("especialidad_accesos", a._id, data);
  };

  return (
    <div>
      <h3 style={S.h3}>Solicitudes de registro ({pending.length})</h3>
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

      <div style={S.divider} />

      <h3 style={S.h3}>Formación — gestión de accesos ({espAccesos.length})</h3>
      {espAccesos.length === 0
        ? <p style={{ color: C.muted }}>Sin solicitudes de formación.</p>
        : espAccesos.map(a => (
          <div key={a._id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", color: C.accent }}>{a.memberHandle}</span>
              <span style={{ ...S.badge(C.accentDim), marginLeft: 10 }}>{a.espNombre}</span>
              {a.otorgadoPor && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Gestionado por {a.otorgadoPor}</div>}
              {a.motivo && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Motivo: {a.motivo}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...S.badge(espEstadoColor(a.estado)), minWidth: 120, textAlign: "center" }}>
                {espEstadoLabel(a.estado)}
              </span>
              <select
                value={a.estado}
                onChange={e => setEspEstado(a, e.target.value)}
                style={{ ...S.input, padding: "4px 8px", width: "auto", fontSize: 12 }}
              >
                {ESP_ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <button style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 11 }} onClick={() => delEspAcceso(a)}>Eliminar</button>
            </div>
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
  const [orden,      setOrden]     = useState(0);
  const [editId,     setEditId]    = useState(null);

  const canEdit = isJefe || isSuperAdmin;

  const togglePerm = p => setPerms(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);

  const save = async () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), insigniaUrl: insigniaUrl.trim(), permissions: perms, orden: Number(orden) };
    if (editId) {
      await fbUpd("roles", editId, data);
      setEditId(null);
    } else {
      await fbAdd("roles", data);
    }
    setName(""); setInsignia(""); setPerms([]); setOrden(0);
  };

  const startEdit = r => {
    setEditId(r._id); setName(r.name); setInsignia(r.insigniaUrl || ""); setPerms(r.permissions || []); setOrden(r.orden ?? 0);
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
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Orden de importancia (mayor = más alto)</label>
                <input style={{ ...S.input, maxWidth: 100 }} type="number" min={0} value={orden} onChange={e => setOrden(e.target.value)} placeholder="0" />
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "'Share Tech Mono', monospace" }}>orden {r.orden ?? 0}</span>
                </div>
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
        onChange={e => setSearch(e.target.value)} placeholder="Buscar militar…" />
      {filtered.length === 0 && <p style={{ color: C.muted }}>Sin militares activos.</p>}
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
      {filtered.length === 0 && <p style={{ color: C.muted }}>Sin militares que coincidan.</p>}
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
    if (!confirm("¿Confirmar baja del militar?")) return;
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
          <label style={S.label}>Militar</label>
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
              <label style={S.label}>Militar</label>
              <select style={S.input} value={mMemberId} onChange={e => setMMemberId(e.target.value)}>
                <option value="">— Seleccionar militar —</option>
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
    const sorted      = [...memberRoles].sort((a, b) => (b.orden ?? 0) - (a.orden ?? 0));
    const rangoP      = sorted.find(r => r.insigniaUrl) || sorted[0] || null;
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
                      const getRangoOrden = m => {
                        const rs = getMemberRoles(m.memberId);
                        return rs.length ? Math.max(...rs.map(r => r.orden ?? 0)) : -1;
                      };
                      const uM = [...miembros.filter(m => m.unidadId === u._id)]
                        .sort((a, b) => getRangoOrden(b) - getRangoOrden(a));
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
function SalaFamaView({ condecoraciones, roles }) {
  const allMembers = useCollection("members");

  const byMember = condecoraciones.filter(d => d.memberId).reduce((acc, d) => {
    if (!acc[d.memberId]) acc[d.memberId] = { handle: d.memberHandle, decos: [] };
    acc[d.memberId].decos.push(d);
    return acc;
  }, {});

  const entries = Object.entries(byMember).sort((a, b) => b[1].decos.length - a[1].decos.length);

  const abrevRango = name => {
    if (!name) return "";
    const words = name.trim().split(/\s+/).filter(w => !/^[0-9º]+$/.test(w));
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map(w => w[0]).join("").toUpperCase();
  };

  return (
    <div style={{
      margin: "-40px -36px 0",
      minHeight: "calc(100vh - 96px)",
      position: "relative",
      backgroundImage: "url('/capturas/salondelafama.png')",
      backgroundSize: "cover",
      backgroundPosition: "center top",
      overflow: "hidden",
    }}>
      {/* Overlay */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,4,3,0.45) 0%, rgba(6,4,3,0.72) 30%, rgba(6,4,3,0.92) 60%, rgba(6,4,3,1) 100%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, padding: "70px 48px 80px", maxWidth: 1300, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 56, fontWeight: 700, letterSpacing: 10, color: C.accent, textTransform: "uppercase", textShadow: `0 0 60px ${C.accent}55, 0 2px 4px rgba(0,0,0,0.8)`, lineHeight: 1 }}>
            SALÓN DE LA FAMA
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, letterSpacing: 7, color: C.accentDim, marginTop: 12, textTransform: "uppercase" }}>
            HONOR · SACRIFICIO · HERMANDAD
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginTop: 14, maxWidth: 560, margin: "14px auto 0", lineHeight: 1.8 }}>
            En reconocimiento a quienes han dado todo por sus camaradas y por Legio Invicta. Sus nombres quedan grabados para siempre.
          </div>
        </div>

        {/* Grid */}
        {entries.length === 0 ? (
          <p style={{ textAlign: "center", color: C.muted, letterSpacing: 3, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>SIN CONDECORADOS TODAVÍA</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 14 }}>
            {entries.map(([memberId, { handle, decos }]) => {
              const mem = allMembers.find(m => m._id === memberId);
              const memberRoles = roles.filter(r => getMemberRoleIds(mem || {}).includes(r._id));
              const rangoP = [...memberRoles].sort((a, b) => (b.orden ?? 0) - (a.orden ?? 0))[0] || null;
              const decoConImg = decos.filter(d => d.imagenUrl);
              return (
                <div key={memberId} style={{
                  background: "rgba(6,4,3,0.72)",
                  border: `1px solid ${C.accent}30`,
                  borderTop: `2px solid ${C.accent}99`,
                  borderRadius: 3,
                  padding: "18px 14px 14px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  backdropFilter: "blur(6px)",
                  boxShadow: `0 4px 24px rgba(0,0,0,0.7), inset 0 0 40px rgba(201,162,74,0.02)`,
                }}>
                  {/* Rango abreviado */}
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: C.accentDim, letterSpacing: 4, textTransform: "uppercase" }}>
                    {abrevRango(rangoP?.name)}
                  </div>
                  {/* Insignia */}
                  {rangoP?.insigniaUrl
                    ? <img src={rangoP.insigniaUrl} alt={rangoP.name} style={{ width: 30, height: 40, objectFit: "contain" }} />
                    : <div style={{ width: 30, height: 40 }} />
                  }
                  {/* Nombre */}
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: C.text, letterSpacing: 2, textAlign: "center", textTransform: "uppercase", marginTop: 2 }}>
                    {handle}
                  </div>
                  {/* Medallas */}
                  {decoConImg.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.accent}22`, width: "100%" }}>
                      {decoConImg.map(d => (
                        <img key={d._id} src={d.imagenUrl} alt={d.nombre} title={d.nombre} style={{ width: 26, height: 26, objectFit: "contain" }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 72, paddingTop: 24, borderTop: `1px solid ${C.accent}18` }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: 5, color: `${C.accent}40`, textTransform: "uppercase" }}>
            TODO EL HONOR ES TUYO · HONOR DE LOS QUE DAN SU VIDA
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  TAB DOCTRINA (ADMIN)                   */

/* ─────────────────────────────────────── */
/*  TAB ESPECIALIDADES (ADMIN)             */
/* ─────────────────────────────────────── */
function TabEspecialidades({ especialidades, isJefe, canDo }) {
  const guias       = useCollection("especialidad_guias", orderBy("orden"));
  const [nombre,      setNombre]    = useState("");
  const [descripcion, setDesc]      = useState("");
  const [color,       setColor]     = useState("#C9A24A");
  const [portadaUrl,  setPortada]   = useState("");
  const [editId,      setEditId]    = useState(null);
  const [gestionando, setGestionando] = useState(null); // esp object para gestionar guías

  const canEdit = isJefe || canDo("manage_especialidades");

  const save = async () => {
    if (!nombre.trim()) return;
    const data = { nombre: nombre.trim(), descripcion: descripcion.trim(), color, portadaUrl: portadaUrl.trim() };
    if (editId) {
      await fbUpd("especialidades", editId, data);
      setEditId(null);
    } else {
      await fbAdd("especialidades", data);
    }
    setNombre(""); setDesc(""); setColor("#C9A24A"); setPortada("");
  };

  const del = async e => {
    if (!confirm(`¿Eliminar la especialidad "${e.nombre}"?`)) return;
    await fbDel("especialidades", e._id);
  };

  const startEdit = e => {
    setEditId(e._id); setNombre(e.nombre); setDesc(e.descripcion || "");
    setColor(e.color || "#C9A24A"); setPortada(e.portadaUrl || "");
  };

  if (gestionando) {
    return <TabEspGuias esp={gestionando} guias={guias.filter(g => g.espId === gestionando._id)} onBack={() => setGestionando(null)} />;
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {canEdit && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <h3 style={S.h3}>{editId ? "Editar especialidad" : "Nueva especialidad"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={S.label}>Nombre</label>
              <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Médico de combate" />
            </div>
            <div>
              <label style={S.label}>Color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ width: 40, height: 32, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.muted }}>{color}</span>
              </div>
            </div>
            <div>
              <label style={S.label}>Descripción</label>
              <input style={S.input} value={descripcion} onChange={e => setDesc(e.target.value)} placeholder="Breve descripción del rol…" />
            </div>
            <div>
              <label style={S.label}>URL de portada</label>
              <input style={S.input} value={portadaUrl} onChange={e => setPortada(e.target.value)} placeholder="/especialidades/medico.jpg" />
            </div>
          </div>
          {portadaUrl.trim() && (
            <img src={portadaUrl.trim()} alt="portada" style={{ height: 80, objectFit: "cover", borderRadius: 4, marginBottom: 12, width: "100%" }} />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary")} onClick={save}>{editId ? "Guardar" : "Crear"}</button>
            {editId && (
              <button style={S.btn("ghost")} onClick={() => { setEditId(null); setNombre(""); setDesc(""); setColor("#C9A24A"); setPortada(""); }}>
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
            <div key={e._id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: e.color || C.accent, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{e.nombre}</span>
                <span style={{ color: C.muted, fontSize: 12 }}>{guias.filter(g => g.espId === e._id).length} guías</span>
                {canEdit && (
                  <>
                    <button style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 12 }} onClick={() => setGestionando(e)}>Guías</button>
                    <button style={{ ...S.btn("ghost"), padding: "3px 8px", fontSize: 11 }} onClick={() => startEdit(e)}>✎</button>
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

function TabEspGuias({ esp, guias, onBack }) {
  const sorted = [...guias].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const [editId,    setEditId]    = useState(null);
  const [titulo,    setTitulo]    = useState("");
  const [contenido, setContenido] = useState("");

  const startNew  = () => { setEditId("new"); setTitulo(""); setContenido(""); };
  const startEdit = g => { setEditId(g._id); setTitulo(g.titulo); setContenido(g.contenido || ""); };
  const cancel    = () => setEditId(null);

  const save = async () => {
    if (!titulo.trim()) return;
    const maxOrden = guias.reduce((mx, g) => Math.max(mx, g.orden || 0), 0);
    if (editId === "new") {
      await fbAdd("especialidad_guias", { espId: esp._id, espNombre: esp.nombre, titulo: titulo.trim(), contenido, orden: maxOrden + 1 });
    } else {
      await fbUpd("especialidad_guias", editId, { titulo: titulo.trim(), contenido });
    }
    cancel();
  };

  const del = async g => {
    if (!confirm(`¿Eliminar la guía "${g.titulo}"?`)) return;
    await fbDel("especialidad_guias", g._id);
  };

  if (editId !== null) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button style={S.btn("ghost")} onClick={cancel}>← Volver</button>
          <h2 style={{ ...S.h2, margin: 0 }}>{editId === "new" ? "Nueva guía" : "Editar guía"} — {esp.nombre}</h2>
        </div>
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Título</label>
            <input style={S.input} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título de la guía…" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...S.label, marginBottom: 8 }}>Contenido</label>
            <LegioEditor content={contenido} onChange={setContenido} minHeight={400} stickyTop={96} />
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={S.btn("ghost")} onClick={onBack}>← Especialidades</button>
          <h2 style={{ ...S.h2, margin: 0 }}>Guías — {esp.nombre}</h2>
        </div>
        <button style={S.btn("primary")} onClick={startNew}>+ Añadir guía</button>
      </div>
      {sorted.length === 0
        ? <p style={{ color: C.muted }}>Sin guías. Crea la primera con el botón de arriba.</p>
        : sorted.map(g => (
          <div key={g._id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, color: C.text }}>{g.titulo}</div>
            </div>
            <button style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 12 }} onClick={() => startEdit(g)}>✎ Editar</button>
            <button style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 12 }} onClick={() => del(g)}>✕</button>
          </div>
        ))
      }
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
  const misAccesos  = useCollection("especialidad_accesos", orderBy("createdAt", "desc")).filter(a => a.memberId === member._id);

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
            {member.displayName && member.displayName !== member.handle && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.accent, marginBottom: 10 }}>
                @{member.handle}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {memberRoles.map(r => <span key={r._id} style={S.badge(C.accent)}>{r.name}</span>)}
              {!memberRoles.length && <span style={{ color: C.muted, fontSize: 12 }}>Sin rango asignado</span>}
            </div>
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
                <span style={S.badge(asVal === "confirmada" ? C.green : asVal === "duda" ? "#f59e0b" : C.danger)}>
                  {asVal === "confirmada" ? "Asistió" : asVal === "duda" ? "Duda" : "Baja"}
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
                {d.imagenUrl
                  ? <img src={d.imagenUrl} alt={d.nombre} style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
                  : <span style={{ fontSize: 18 }}>🎖</span>
                }
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: C.accent }}>{d.nombre}</span>
                {d.fecha && <span style={{ color: C.muted, fontSize: 11 }}>{new Date(d.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>}
              </div>
              {d.motivo && <div className="rich-text" style={{ color: C.muted, fontSize: 12, paddingLeft: 30, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: d.motivo }} />}
              {!d.motivo && d.descripcion && <div style={{ color: C.muted, fontSize: 12, paddingLeft: 30 }}>{d.descripcion}</div>}
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

      {/* Formación especializada */}
      <div style={{ ...S.card, marginTop: 24 }}>
        <h3 style={S.h3}>Formación especializada</h3>
        {misAccesos.length === 0
          ? <p style={{ color: C.muted, fontSize: 13 }}>Sin solicitudes de formación registradas.</p>
          : <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {misAccesos.map(a => (
                <div key={a._id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", minWidth: 180 }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: C.text, marginBottom: 6 }}>{a.espNombre}</div>
                  <span style={{ ...S.badge(espEstadoColor(a.estado)), fontSize: 11 }}>{espEstadoLabel(a.estado)}</span>
                  {a.otorgadoPor && (
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>por {a.otorgadoPor}</div>
                  )}
                </div>
              ))}
            </div>
        }
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
  const canEdit = isJefe;
  const sorted  = [...secciones].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const [editId,    setEditId]    = useState(null);
  const [titulo,    setTitulo]    = useState("");
  const [contenido, setContenido] = useState("");

  const resetForm = () => { setEditId(null); setTitulo(""); setContenido(""); };

  const startEdit = sec => { setEditId(sec._id); setTitulo(sec.titulo); setContenido(sec.contenido || ""); };

  const save = async () => {
    if (!titulo.trim()) return;
    if (editId && editId !== "new") {
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

  const canEdit = isJefe || canDo("manage_sala_fama");
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
              <label style={S.label}>Militar</label>
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
                <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Este militar no tiene condecoraciones registradas.</p>
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
const DECO_CATEGORIAS = ["Combate", "Mando", "Servicio", "Especialidades", "Internos"];
const DECO_CAT_COLOR  = { Combate:"#ef4444", Mando:"#C9A24A", Servicio:"#3b82f6", Especialidades:"#8b5cf6", Internos:"#6b7280" };
const MEDALLAS_CATALOGO = [
  { nombre:"Cruz de Valor",                         categoria:"Combate",       imagenUrl:"/condecoraciones/combate/1cruzdevalor.png" },
  { nombre:"Sangre y Acero",                        categoria:"Combate",       imagenUrl:"/condecoraciones/combate/2sangreyacero.png" },
  { nombre:"Orden de la Legión de Hierro",          categoria:"Combate",       imagenUrl:"/condecoraciones/combate/3Orden de la Legión de Hierro.png" },
  { nombre:"Cruz del Fénix Negro",                  categoria:"Combate",       imagenUrl:"/condecoraciones/combate/4Cruz del Fénix Negro.png" },
  { nombre:"Orden Invicta Suprema",                 categoria:"Combate",       imagenUrl:"/condecoraciones/combate/5Orden Invicta Suprema.png" },
  { nombre:"Distinción de Mando Táctico",           categoria:"Mando",         imagenUrl:"/condecoraciones/mando/1Distinción de Mando Táctico.png" },
  { nombre:"Orden de Estrategia Operacional",       categoria:"Mando",         imagenUrl:"/condecoraciones/mando/2Orden de Estrategia Operacional.png" },
  { nombre:"Cruz de Autoridad Legionaria",          categoria:"Mando",         imagenUrl:"/condecoraciones/mando/3Cruz de Autoridad Legionaria.png" },
  { nombre:"Orden NEXO de Comando",                 categoria:"Mando",         imagenUrl:"/condecoraciones/mando/4Orden NEXO de Comando.png" },
  { nombre:"Insignia Suprema de Alto Mando",        categoria:"Mando",         imagenUrl:"/condecoraciones/mando/5Insignia Suprema de Alto Mando.png" },
  { nombre:"Medalla de Servicio Activo",            categoria:"Servicio",      imagenUrl:"/condecoraciones/servicio/1Medalla de Servicio Activo.png" },
  { nombre:"Distinción de Veteranía Operacional",   categoria:"Servicio",      imagenUrl:"/condecoraciones/servicio/2Distinción de Veteranía Operacional.png" },
  { nombre:"Orden de Constancia Legionaria",        categoria:"Servicio",      imagenUrl:"/condecoraciones/servicio/3Orden de Constancia Legionaria.png" },
  { nombre:"Cruz de Campaña Invicta",               categoria:"Servicio",      imagenUrl:"/condecoraciones/servicio/4Cruz de Campaña Invicta.png" },
  { nombre:"Insignia de Legado Eterno",             categoria:"Servicio",      imagenUrl:"/condecoraciones/servicio/5Insignia de Legado Eterno.png" },
  { nombre:"Cruz de Sanidad Táctica",               categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/1Cruz de Sanidad Táctica.png" },
  { nombre:"Insignia de Comunicaciones Operacionales",categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/Insignia de Comunicaciones Operacionales.png" },
  { nombre:"Orden del Ojo del Cuervo",              categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/Orden del Ojo del Cuervo.png" },
  { nombre:"Cruz de Asalto Operacional",            categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/Cruz de Asalto Operacional.png" },
  { nombre:"Orden del Escudo Defensivo",            categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/Orden del Escudo Defensivo.png" },
  { nombre:"Insignia de Reconocimiento Avanzado",   categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/Insignia de Reconocimiento Avanzado.png" },
  { nombre:"Distinción Aérea Táctica",              categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/Distinción Aérea Táctica.png" },
  { nombre:"Orden FIB de Instrucción",              categoria:"Especialidades",imagenUrl:"/condecoraciones/especialidades/Orden FIB de Instrucción.png" },
  { nombre:"Espíritu de Legión",                    categoria:"Internos",      imagenUrl:"/condecoraciones/internos/Espíritu de Legión.png" },
  { nombre:"Hierro Inquebrantable",                 categoria:"Internos",      imagenUrl:"/condecoraciones/internos/Hierro Inquebrantable.png" },
  { nombre:"Legado Invicta",                        categoria:"Internos",      imagenUrl:"/condecoraciones/internos/Legado Invicta.png" },
  { nombre:"Honor de la Hermandad",                 categoria:"Internos",      imagenUrl:"/condecoraciones/internos/Honor de la Hermandad.png" },
];

function TabCondecoraciones({ condecoraciones, member, isJefe, canDo }) {
  const allMembers    = useCollection("members");
  const activeMembers = allMembers.filter(m => m.accessStatus === "activo");

  const [selId,     setSelId]     = useState("");
  const [nombre,    setNombre]    = useState("");
  const [categoria, setCategoria] = useState("Combate");
  const [descripcion, setDescripcion] = useState("");
  const [motivo,    setMotivo]    = useState("");
  const [fecha,     setFecha]     = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [asignarId, setAsignarId] = useState(null);
  const [asignarSelId, setAsignarSelId] = useState("");

  const canEdit = isJefe || canDo("manage_condecoraciones");

  const resetForm = () => { setSelId(""); setNombre(""); setCategoria("Combate"); setDescripcion(""); setMotivo(""); setFecha(""); setImagenUrl(""); };

  const pickMedalla = e => {
    const m = MEDALLAS_CATALOGO.find(x => x.nombre === e.target.value);
    if (!m) return;
    setNombre(m.nombre);
    setCategoria(m.categoria);
    setImagenUrl(m.imagenUrl);
  };

  const save = async () => {
    if (!nombre.trim()) return;
    if (selId && condecoraciones.some(d => d.memberId === selId && d.nombre === nombre.trim())) {
      alert(`Este militar ya tiene la condecoración "${nombre.trim()}".`);
      return;
    }
    const mem = activeMembers.find(m => m._id === selId);
    await fbAdd("condecoraciones", {
      memberId:     selId || null,
      memberHandle: mem?.handle || null,
      nombre:       nombre.trim(),
      categoria,
      descripcion,
      motivo,
      fecha:        fecha || null,
      imagenUrl:    imagenUrl.trim() || null,
      otorgadoPor:  member.handle,
    });
    resetForm();
  };

  const confirmarAsignacion = async () => {
    if (!asignarSelId || !asignarId) return;
    const deco = condecoraciones.find(d => d._id === asignarId);
    if (deco && condecoraciones.some(d => d.memberId === asignarSelId && d.nombre === deco.nombre)) {
      alert(`Este militar ya tiene la condecoración "${deco.nombre}".`);
      return;
    }
    const mem = activeMembers.find(m => m._id === asignarSelId);
    await fbSet("condecoraciones", asignarId, { memberId: asignarSelId, memberHandle: mem?.handle || "" });
    setAsignarId(null); setAsignarSelId("");
  };

  const del = async d => {
    if (!confirm(`¿Retirar "${d.nombre}" de @${d.memberHandle}?`)) return;
    await fbDel("condecoraciones", d._id);
  };

  const sinAsignar = condecoraciones.filter(d => !d.memberId);
  const byMember = condecoraciones.filter(d => d.memberId).reduce((acc, d) => {
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
              <label style={S.label}>Militar <span style={{ color: C.muted, fontWeight: 400 }}>(opcional — se puede asignar después)</span></label>
              <select style={S.input} value={selId} onChange={e => setSelId(e.target.value)}>
                <option value="">— Sin asignar de momento —</option>
                {activeMembers.map(m => <option key={m._id} value={m._id}>@{m.handle}{m.displayName && m.displayName !== m.handle ? ` — ${m.displayName}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Fecha</label>
              <input style={{ ...S.input, colorScheme: "dark" }} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>Medalla del catálogo</label>
              <select style={S.input} value={nombre} onChange={pickMedalla}>
                <option value="">— Seleccionar medalla —</option>
                {DECO_CATEGORIAS.map(cat => (
                  <optgroup key={cat} label={cat}>
                    {MEDALLAS_CATALOGO.filter(m => m.categoria === cat).map(m => (
                      <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Nombre (editable)</label>
              <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Cruz al Valor…" />
            </div>
            <div>
              <label style={S.label}>Categoría</label>
              <select style={S.input} value={categoria} onChange={e => setCategoria(e.target.value)}>
                {DECO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>Imagen</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {imagenUrl.trim() && <img src={imagenUrl.trim()} alt="preview" style={{ height: 56, objectFit: "contain", background: "#0004", borderRadius: 4, padding: 4, flexShrink: 0 }} />}
                <input style={{ ...S.input, flex: 1 }} value={imagenUrl} onChange={e => setImagenUrl(e.target.value)} placeholder="/condecoraciones/combate/1cruzdevalor.png" />
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>Descripción de la condecoración</label>
              <p style={{ color: C.muted, fontSize: 11, margin: "0 0 6px" }}>Qué representa esta distinción en general.</p>
              <LegioEditor content={descripcion} onChange={setDescripcion} minHeight={120} stickyTop={96} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={S.label}>Motivo del otorgamiento</label>
              <p style={{ color: C.muted, fontSize: 11, margin: "0 0 6px" }}>Por qué se otorga a este militar concretamente. Se mostrará en la Sala de la Fama.</p>
              <LegioEditor content={motivo} onChange={setMotivo} minHeight={120} stickyTop={96} />
            </div>
          </div>
          <button style={S.btn("primary")} onClick={save} disabled={!nombre.trim()}>Guardar condecoración</button>
        </div>
      )}

      {/* Sin asignar */}
      {sinAsignar.length > 0 && (
        <div style={{ ...S.card, marginBottom: 16, borderLeft: `3px solid ${C.muted}` }}>
          <h3 style={{ ...S.h3, color: C.muted }}>Sin asignar ({sinAsignar.length})</h3>
          {sinAsignar.map(d => (
            <div key={d._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 8px 12px", borderBottom: `1px solid ${C.border}20` }}>
              {d.imagenUrl
                ? <img src={d.imagenUrl} alt={d.nombre} style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
                : <span style={{ fontSize: 16, flexShrink: 0 }}>🎖</span>
              }
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13 }}>{d.nombre}</span>
                  {d.categoria && (
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 2, background: `${DECO_CAT_COLOR[d.categoria] || C.accent}22`, color: DECO_CAT_COLOR[d.categoria] || C.accent, border: `1px solid ${DECO_CAT_COLOR[d.categoria] || C.accent}44`, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>{d.categoria}</span>
                  )}
                </div>
                {d.fecha && <span style={{ color: C.muted, fontSize: 11 }}>{new Date(d.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button style={{ ...S.btn("primary"), padding: "3px 10px", fontSize: 11 }} onClick={() => { setAsignarId(d._id); setAsignarSelId(""); }}>Asignar</button>
                  <button style={{ ...S.btn("danger"), padding: "3px 8px", fontSize: 11 }} onClick={() => del(d)}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal asignar militar */}
      {asignarId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div style={{ ...S.card, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={S.h3}>Asignar militar</h3>
            <div>
              <label style={S.label}>Militar</label>
              <select style={S.input} value={asignarSelId} onChange={e => setAsignarSelId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {activeMembers.map(m => <option key={m._id} value={m._id}>@{m.handle}{m.displayName && m.displayName !== m.handle ? ` — ${m.displayName}` : ""}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btn("primary")} onClick={confirmarAsignacion} disabled={!asignarSelId}>Confirmar</button>
              <button style={S.btn("secondary")} onClick={() => setAsignarId(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.h3}>Registro de condecoraciones ({condecoraciones.filter(d=>d.memberId).length})</h3>
        {!condecoraciones.some(d => d.memberId) ? (
          <p style={{ color: C.muted }}>Sin condecoraciones asignadas todavía.</p>
        ) : Object.entries(byMember).map(([memberId, { handle, decos }]) => (
          <div key={memberId} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: C.accent, fontFamily: "'Oswald', sans-serif", marginBottom: 6, textTransform: "uppercase" }}>
              @{handle}
            </div>
            {decos.map(d => (
              <div key={d._id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0 8px 12px", borderBottom: `1px solid ${C.border}20` }}>
                {d.imagenUrl
                  ? <img src={d.imagenUrl} alt={d.nombre} style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
                  : <span style={{ fontSize: 16, flexShrink: 0 }}>🎖</span>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13 }}>{d.nombre}</span>
                    {d.categoria && (
                      <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 2, background: `${DECO_CAT_COLOR[d.categoria] || C.accent}22`, color: DECO_CAT_COLOR[d.categoria] || C.accent, border: `1px solid ${DECO_CAT_COLOR[d.categoria] || C.accent}44`, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Share Tech Mono', monospace" }}>{d.categoria}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                    {d.fecha && <span style={{ color: C.muted, fontSize: 11 }}>{new Date(d.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>}
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
  const dudas       = op => Object.values(op.asistencia || {}).filter(v => v === "duda").length;
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
                  <span>Dudas: <span style={{ color: "#f59e0b" }}>{dudas(op)}</span></span>
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
            const dudasN = Object.values(selOp.asistencia || {}).filter(v => v === "duda").length;

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
                  <span style={{ fontSize: 13 }}><span style={{ color: "#f59e0b", fontWeight: 700 }}>{dudasN}</span> <span style={{ color: C.muted }}>dudas</span></span>
                  <span style={{ fontSize: 13 }}><span style={{ color: C.danger, fontWeight: 700 }}>{bajasN}</span> <span style={{ color: C.muted }}>bajas</span></span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <AsBtn valor="confirmada" label="Confirmo asistencia" color={C.green} />
                  <AsBtn valor="duda"       label="Tengo dudas"         color="#f59e0b" />
                  <AsBtn valor="baja"       label="Doy baja"            color={C.danger} />
                </div>
                {myVal && (
                  <div style={{ fontSize: 12, color: myVal === "confirmada" ? C.green : myVal === "duda" ? "#f59e0b" : C.danger, marginTop: 8 }}>
                    Tu estado: {myVal === "confirmada" ? "Confirmado" : myVal === "duda" ? "Duda" : "Baja"}
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
    const dudasN  = Object.values(sel.asistencia || {}).filter(v => v === "duda").length;

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
              <span style={{ color: "#f59e0b", fontWeight: 700, marginRight: 4 }}>{dudasN}</span>
              <span style={{ color: C.muted }}>dudas</span>
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: C.danger, fontWeight: 700, marginRight: 4 }}>{bajasN}</span>
              <span style={{ color: C.muted }}>bajas</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <AsBtn valor="confirmada" label="Confirmo asistencia" color={C.green} />
            <AsBtn valor="duda"       label="Tengo dudas"         color="#f59e0b" />
            <AsBtn valor="baja"       label="Doy baja"            color={C.danger} />
            {myVal && (
              <button style={{ ...S.btn("ghost"), padding: "8px 16px", fontSize: 13 }}
                onClick={() => setAsistencia(sel, null)}>
                Cancelar respuesta
              </button>
            )}
          </div>
          {myVal && (
            <div style={{ fontSize: 12, color: myVal === "confirmada" ? C.green : myVal === "duda" ? "#f59e0b" : C.danger, marginTop: 4 }}>
              Tu estado: {myVal === "confirmada" ? "Confirmado" : myVal === "duda" ? "Duda" : "Baja"}
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

/* ─────────────────────────────────────── */
/*  FORO (BETA)                            */
/* ─────────────────────────────────────── */
const FORO_CATS        = ["General", "Dudas", "Operaciones", "Doctrina", "Otros"];
const FORO_CAT_RESTRINGIDA = "Sugerencias de misiones";

function ForoView({ member, isJefe, canDo, hilos }) {
  const [hiloId, setHiloId]   = useState(null);
  const [crear, setCrear]     = useState(false);
  const [titulo, setTitulo]   = useState("");
  const [contenido, setContenido] = useState("");
  const [categoria, setCategoria] = useState(FORO_CATS[0]);
  const [busy, setBusy]       = useState(false);

  const canPost         = isJefe || canDo("forum_post");
  const canMod          = isJefe || canDo("forum_mod");
  const canSugerencias  = isJefe || canDo("forum_sugerencias");
  const catsDisponibles = canSugerencias ? [...FORO_CATS, FORO_CAT_RESTRINGIDA] : FORO_CATS;

  const visibles = hilos.filter(h => h.categoria !== FORO_CAT_RESTRINGIDA || canSugerencias);
  const pinned   = visibles.filter(h => h.fijado);
  const unpinned = visibles.filter(h => !h.fijado);
  const sorted   = [...pinned, ...unpinned];

  const submitHilo = async e => {
    e.preventDefault();
    if (!titulo.trim() || !contenido.trim()) return;
    setBusy(true);
    await fbAdd("foro_hilos", {
      titulo: titulo.trim(), contenido: contenido.trim(),
      categoria, autorId: member._id, autorHandle: member.handle,
      fijado: false, createdAt: serverTimestamp(),
    });
    setTitulo(""); setContenido(""); setCategoria(FORO_CATS[0]); setCrear(false);
    setBusy(false);
  };

  if (hiloId) {
    const hilo = hilos.find(h => h._id === hiloId);
    if (!hilo) { setHiloId(null); return null; }
    return <ForoHiloDetalle hilo={hilo} member={member} canMod={canMod} canPost={canPost} onBack={() => setHiloId(null)} />;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ ...S.h2, marginBottom: 0 }}>Foro <span style={{ fontSize: 13, color: C.muted, letterSpacing: 2 }}>(BETA)</span></h2>
        {canPost && !crear && (
          <button style={S.btn("primary")} onClick={() => setCrear(true)}>+ Nuevo hilo</button>
        )}
      </div>

      {crear && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={S.h3}>Nuevo hilo</div>
          <form onSubmit={submitHilo}>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Categoría</label>
              <select style={{ ...S.input, width: "auto" }} value={categoria} onChange={e => setCategoria(e.target.value)}>
                {catsDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Título</label>
              <input style={S.input} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título del hilo" required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Contenido</label>
              <textarea style={{ ...S.input, minHeight: 100, resize: "vertical" }} value={contenido} onChange={e => setContenido(e.target.value)} placeholder="Escribe aquí..." required />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("primary")} disabled={busy}>{busy ? "…" : "Publicar"}</button>
              <button type="button" style={S.btn("ghost")} onClick={() => setCrear(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {sorted.length === 0 ? (
        <p style={{ color: C.muted }}>No hay hilos todavía. ¡Sé el primero en publicar!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(h => (
            <div key={h._id} style={{ ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}
              onClick={() => setHiloId(h._id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {h.fijado && <span style={{ ...S.badge(C.accent), fontSize: 11 }}>📌 FIJADO</span>}
                  <span style={{ ...S.badge(C.accentDim), fontSize: 11 }}>{h.categoria}</span>
                </div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 17, color: C.text, letterSpacing: 1 }}>{h.titulo}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  por <span style={{ color: C.accent, fontFamily: "'Share Tech Mono', monospace" }}>@{h.autorHandle}</span>
                  {h.createdAt?.toDate && (
                    <span style={{ marginLeft: 8 }}>{h.createdAt.toDate().toLocaleDateString("es-ES")}</span>
                  )}
                </div>
              </div>
              <div style={{ color: C.muted, fontSize: 13, flexShrink: 0 }}>Ver →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ForoHiloDetalle({ hilo, member, canMod, canPost, onBack }) {
  const respuestas = useCollection("foro_respuestas", orderBy("createdAt", "asc"));
  const hiloResp   = respuestas.filter(r => r.hiloId === hilo._id);

  const [texto, setTexto]             = useState("");
  const [busy, setBusy]               = useState(false);
  const [editHilo, setEditHilo]       = useState(false);
  const [editTitulo, setEditTitulo]   = useState(hilo.titulo);
  const [editContenido, setEditContenido] = useState(hilo.contenido);
  const [editRespId, setEditRespId]   = useState(null);
  const [editRespTxt, setEditRespTxt] = useState("");

  const isAutorHilo = member._id === hilo.autorId;

  const submitRespuesta = async e => {
    e.preventDefault();
    if (!texto.trim()) return;
    setBusy(true);
    await fbAdd("foro_respuestas", {
      hiloId: hilo._id, contenido: texto.trim(),
      autorId: member._id, autorHandle: member.handle,
      createdAt: serverTimestamp(),
    });
    setTexto(""); setBusy(false);
  };

  const saveEditHilo = async () => {
    await fbUpd("foro_hilos", hilo._id, { titulo: editTitulo.trim(), contenido: editContenido.trim() });
    setEditHilo(false);
  };

  const deleteHilo = async () => {
    if (!confirm("¿Eliminar este hilo y todas sus respuestas?")) return;
    for (const r of hiloResp) await fbDel("foro_respuestas", r._id);
    await fbDel("foro_hilos", hilo._id);
    onBack();
  };

  const toggleFijar = () => fbUpd("foro_hilos", hilo._id, { fijado: !hilo.fijado });

  const saveEditResp = async id => {
    await fbUpd("foro_respuestas", id, { contenido: editRespTxt.trim() });
    setEditRespId(null);
  };

  const deleteResp = async r => {
    if (!confirm("¿Eliminar esta respuesta?")) return;
    await fbDel("foro_respuestas", r._id);
  };

  return (
    <div>
      <button style={{ ...S.btn("ghost"), marginBottom: 20 }} onClick={onBack}>← Volver al foro</button>

      <div style={{ ...S.card, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {hilo.fijado && <span style={{ ...S.badge(C.accent), fontSize: 11 }}>📌 FIJADO</span>}
              <span style={{ ...S.badge(C.accentDim), fontSize: 11 }}>{hilo.categoria}</span>
            </div>
            {editHilo ? (
              <input style={{ ...S.input, fontSize: 20, marginBottom: 8 }} value={editTitulo} onChange={e => setEditTitulo(e.target.value)} />
            ) : (
              <h2 style={{ ...S.h2, marginBottom: 4 }}>{hilo.titulo}</h2>
            )}
            <div style={{ fontSize: 12, color: C.muted }}>
              por <span style={{ color: C.accent, fontFamily: "'Share Tech Mono', monospace" }}>@{hilo.autorHandle}</span>
              {hilo.createdAt?.toDate && <span style={{ marginLeft: 8 }}>{hilo.createdAt.toDate().toLocaleDateString("es-ES")}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {canMod && <button style={S.btn("ghost")} onClick={toggleFijar}>{hilo.fijado ? "Desfijar" : "Fijar"}</button>}
            {(isAutorHilo || canMod) && !editHilo && <button style={S.btn("ghost")} onClick={() => setEditHilo(true)}>Editar</button>}
            {(isAutorHilo || canMod) && <button style={S.btn("danger")} onClick={deleteHilo}>Eliminar</button>}
          </div>
        </div>

        {editHilo ? (
          <div>
            <textarea style={{ ...S.input, minHeight: 100, resize: "vertical", marginBottom: 8 }} value={editContenido} onChange={e => setEditContenido(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("primary")} onClick={saveEditHilo}>Guardar</button>
              <button style={S.btn("ghost")} onClick={() => setEditHilo(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <p style={{ color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{hilo.contenido}</p>
        )}
      </div>

      <div style={{ ...S.h3, marginBottom: 16 }}>
        Respuestas <span style={{ color: C.muted, fontSize: 13 }}>({hiloResp.length})</span>
      </div>

      {hiloResp.length === 0 && <p style={{ color: C.muted, marginBottom: 24 }}>Sin respuestas todavía.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {hiloResp.map(r => {
          const isAutorResp = member._id === r.autorId;
          return (
            <div key={r._id} style={{ ...S.card, borderLeft: `3px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.muted }}>
                  <span style={{ color: C.accent, fontFamily: "'Share Tech Mono', monospace" }}>@{r.autorHandle}</span>
                  {r.createdAt?.toDate && <span style={{ marginLeft: 8 }}>{r.createdAt.toDate().toLocaleDateString("es-ES")}</span>}
                </div>
                {(isAutorResp || canMod) && editRespId !== r._id && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 12 }} onClick={() => { setEditRespId(r._id); setEditRespTxt(r.contenido); }}>Editar</button>
                    <button style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 12 }} onClick={() => deleteResp(r)}>Eliminar</button>
                  </div>
                )}
              </div>
              {editRespId === r._id ? (
                <div>
                  <textarea style={{ ...S.input, minHeight: 80, resize: "vertical", marginBottom: 8 }} value={editRespTxt} onChange={e => setEditRespTxt(e.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={S.btn("primary")} onClick={() => saveEditResp(r._id)}>Guardar</button>
                    <button style={S.btn("ghost")} onClick={() => setEditRespId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <p style={{ color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{r.contenido}</p>
              )}
            </div>
          );
        })}
      </div>

      {canPost && (
        <div style={S.card}>
          <div style={{ ...S.h3, marginBottom: 12 }}>Responder</div>
          <form onSubmit={submitRespuesta}>
            <textarea style={{ ...S.input, minHeight: 90, resize: "vertical", marginBottom: 12 }} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe tu respuesta..." required />
            <button style={S.btn("primary")} disabled={busy}>{busy ? "…" : "Publicar respuesta"}</button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ── Tab Admin: Foro (moderación) ── */
function TabForo({ hilos, member, isJefe, canDo }) {
  const respuestas = useCollection("foro_respuestas", orderBy("createdAt", "desc"));
  const canMod = isJefe || canDo("forum_mod");

  const deleteHilo = async h => {
    if (!confirm(`¿Eliminar hilo "${h.titulo}" y todas sus respuestas?`)) return;
    const hiloResp = respuestas.filter(r => r.hiloId === h._id);
    for (const r of hiloResp) await fbDel("foro_respuestas", r._id);
    await fbDel("foro_hilos", h._id);
  };

  const toggleFijar = h => fbUpd("foro_hilos", h._id, { fijado: !h.fijado });

  return (
    <div>
      <h3 style={S.h3}>Moderación del Foro</h3>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
        {hilos.length} hilos · {respuestas.length} respuestas totales
      </p>
      {hilos.length === 0 ? (
        <p style={{ color: C.muted }}>No hay hilos en el foro.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hilos.map(h => {
            const nResp = respuestas.filter(r => r.hiloId === h._id).length;
            return (
              <div key={h._id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, padding: "14px 20px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    {h.fijado && <span style={{ ...S.badge(C.accent), fontSize: 11 }}>📌 FIJADO</span>}
                    <span style={{ ...S.badge(C.accentDim), fontSize: 11 }}>{h.categoria}</span>
                  </div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, color: C.text }}>{h.titulo}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    <span style={{ color: C.accent, fontFamily: "'Share Tech Mono', monospace" }}>@{h.autorHandle}</span>
                    <span style={{ marginLeft: 8 }}>{nResp} respuestas</span>
                  </div>
                </div>
                {canMod && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button style={{ ...S.btn("ghost"), padding: "6px 12px", fontSize: 12 }} onClick={() => toggleFijar(h)}>
                      {h.fijado ? "Desfijar" : "Fijar"}
                    </button>
                    <button style={{ ...S.btn("danger"), padding: "6px 12px", fontSize: 12 }} onClick={() => deleteHilo(h)}>
                      Eliminar
                    </button>
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

/* ─────────────────────────────────────── */
/*  VISTA DETALLE ESPECIALIDAD             */
/* ─────────────────────────────────────── */
function EspecialidadDetalleView({ espId, member, isJefe, canDo, especialidades }) {
  const esp     = especialidades.find(e => e._id === espId);
  const guias   = useCollection("especialidad_guias", orderBy("orden"));
  const accesos = useCollection("especialidad_accesos", orderBy("createdAt", "desc"));
  const [mostrando, setMostrando] = useState("portada"); // "portada" | "guias"

  if (!esp) return <p style={{ color: C.muted }}>Especialidad no encontrada.</p>;

  const espGuias    = guias.filter(g => g.espId === espId).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const miAcceso    = accesos.find(a => a.memberId === member._id && a.espId === espId);
  const tieneAcceso = miAcceso?.estado === "aprobado" || miAcceso?.estado === "admitido";

  const solicitar = async () => {
    if (miAcceso) return;
    await fbAdd("especialidad_accesos", {
      memberId:     member._id,
      memberHandle: member.handle,
      espId,
      espNombre:    esp.nombre,
      estado:       "pendiente",
    });
  };

  /* ── Vista guías ── */
  if (mostrando === "guias") {
    return (
      <div>
        <button style={{ ...S.btn("ghost"), marginBottom: 24 }} onClick={() => setMostrando("portada")}>
          ← Volver a {esp.nombre}
        </button>
        {espGuias.length === 0
          ? <p style={{ color: C.muted }}>Esta especialidad aún no tiene guías publicadas.</p>
          : espGuias.map(g => (
            <div key={g._id} style={{ ...S.card, marginBottom: 20 }}>
              <h3 style={{ ...S.h3, marginBottom: 16 }}>{g.titulo}</h3>
              <div className="codex-render" style={{ color: C.text, lineHeight: 1.8 }}
                dangerouslySetInnerHTML={{ __html: g.contenido }} />
            </div>
          ))
        }
      </div>
    );
  }

  /* ── Vista portada (hero) ── */
  return (
    <div>
      {/* Hero */}
      <div style={{
        width: "100%", marginBottom: 32, textAlign: "center",
      }}>
        {esp.portadaUrl
          ? <img src={esp.portadaUrl} alt={esp.nombre}
              style={{ display: "block", width: "auto", maxWidth: "100%", height: "auto", maxHeight: 700, margin: "0 auto" }} />
          : <div style={{ height: 400, background: `linear-gradient(135deg, ${esp.color || C.red}33, ${C.bg})` }} />
        }
      </div>

      {/* Botón de acción centrado debajo del hero */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        {tieneAcceso && (
          <button style={{ ...S.btn("primary"), padding: "14px 48px", fontSize: 16, letterSpacing: 3 }}
            onClick={() => setMostrando("guias")}>
            Acceder a la formación
          </button>
        )}
        {!miAcceso && (
          <button style={{ ...S.btn("primary"), padding: "14px 48px", fontSize: 16, letterSpacing: 3 }}
            onClick={solicitar}>
            Solicitar formación
          </button>
        )}
        {miAcceso && !tieneAcceso && (
          <div>
            {(miAcceso.estado === "rechazado" || miAcceso.estado === "suspendido") ? (
              <div>
                <div style={{ color: C.danger, fontSize: 13, letterSpacing: 3, fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>
                  HA SIDO {miAcceso.estado === "rechazado" ? "RECHAZADO" : "SUSPENDIDO"} POR EL MOTIVO QUE SE INDICA A CONTINUACIÓN:
                </div>
                <div style={{ color: C.muted, fontSize: 13 }}>
                  {miAcceso.motivo || "Sin motivo especificado."}
                </div>
              </div>
            ) : (
              <div style={{ color: C.accent, fontSize: 13, letterSpacing: 3, fontFamily: "'Share Tech Mono', monospace" }}>
                REVISE EL ESTADO DE TRÁMITE EN SU HOJA DE SERVICIO
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

