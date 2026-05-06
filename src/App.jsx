import { useState, useEffect, useRef } from "react";
import LegioEditor from "./LegioEditor";
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut,
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
  bg:       "#2A0A0A",
  surface:  "#1e0707",
  surface2: "#230909",
  border:   "#4a1a1a",
  accent:   "#C9A24A",
  accentDim:"#8a6e2a",
  red:      "#8B1010",
  redBright:"#c0392b",
  text:     "#e8e0d0",
  muted:    "#7a6a60",
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
    position: "sticky", top: 0, zIndex: 100, height: 76,
    background: "rgba(42,10,10,0.97)", borderBottom: `1px solid ${C.border}`,
    backdropFilter: "blur(10px)",
    display: "flex", alignItems: "center", padding: "0 32px", gap: 32,
  },
  navLogo: {
    display: "flex", alignItems: "center", gap: 14, marginRight: "auto",
  },
  navLogoText: {
    fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700,
    color: C.accent, letterSpacing: 4, lineHeight: 1,
  },
  navLogoSub: {
    fontFamily: "'Share Tech Mono', monospace", fontSize: 10,
    color: C.muted, letterSpacing: 3, display: "block",
  },
  navItem: (active) => ({
    fontFamily: "'Oswald', sans-serif", fontSize: 15, letterSpacing: 2,
    color: active ? C.accent : C.muted, cursor: "pointer",
    borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
    paddingBottom: 3, textTransform: "uppercase",
  }),
  card: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 6, padding: 28,
  },
  input: {
    width: "100%", background: "#1a0505", border: `1px solid ${C.border}`,
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
    { id: "inicio",          label: "Inicio" },
    { id: "orbat",           label: "ORBAT" },
    { id: "especialidades",  label: "Especialidades" },
    { id: "doctrina",        label: "Doctrina" },
    ...(isJefe || canDo("approve_requests") || canDo("manage_roles") || canDo("manage_members") || canDo("manage_orbat") || canDo("manage_doctrina")
      ? [{ id: "admin", label: "Mando" }]
      : []),
  ];

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={S.navLogo}>
          <img src="/logo.png" alt="Legio Invicta" style={{ height: 52, width: 52, borderRadius: "50%", border: `1px solid ${C.border}` }} />
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
        <span style={{ ...S.navItem(false), marginLeft: 8 }} onClick={() => signOut(auth)}>
          Salir
        </span>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        {view === "inicio"         && <InicioView member={member} roles={roles} />}
        {view === "orbat"          && <OrbatView unidades={orbatUnidades} miembros={orbatMiembros} roles={roles} />}
        {view === "especialidades" && <EspecialidadesView especialidades={especialidades} />}
        {view === "doctrina"       && <DoctrinaView docs={doctrina} member={member} isJefe={isJefe} canDo={canDo} />}
        {view === "admin"          && <AdminPanel roles={roles} isJefe={isJefe} isSuperAdmin={isSuperAdmin} canDo={canDo} orbatUnidades={orbatUnidades} orbatMiembros={orbatMiembros} doctrina={doctrina} member={member} especialidades={especialidades} />}
      </div>
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
  const [mode, setMode]       = useState("login"); // login | register
  const [handle, setHandle]   = useState("");
  const [pin, setPin]         = useState("");
  const [pin2, setPin2]       = useState("");
  const [error, setError]     = useState("");
  const [busy, setBusy]       = useState(false);

  const toEmail = h => `${h.trim().toLowerCase()}@legio.internal`;

  const handleLogin = async e => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, toEmail(handle), pin);
    } catch {
      setError("Handle o PIN incorrecto.");
    }
    setBusy(false);
  };

  const handleRegister = async e => {
    e.preventDefault();
    setError(""); setBusy(true);
    if (pin !== pin2) { setError("Los PINs no coinciden."); setBusy(false); return; }
    if (pin.length < 4) { setError("El PIN debe tener al menos 4 caracteres."); setBusy(false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, toEmail(handle), pin);
      await setDoc(doc(db, "members", cred.user.uid), {
        handle: handle.trim(),
        displayName: handle.trim(),
        accessStatus: "pendiente",
        isJefe: false,
        isSuperAdmin: false,
        roleIds: [],
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Ese handle ya está en uso.");
      else setError("Error al registrar. Inténtalo de nuevo.");
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
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `1px solid ${C.border}` }}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1, background: "none", border: "none",
                  borderBottom: mode === m ? `2px solid ${C.accent}` : "2px solid transparent",
                  color: mode === m ? C.accent : C.muted,
                  fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 2,
                  cursor: "pointer", padding: "0 0 10px", textTransform: "uppercase",
                }}>
                {m === "login" ? "Acceder" : "Solicitar Acceso"}
              </button>
            ))}
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Handle</label>
              <input style={S.input} value={handle} onChange={e => setHandle(e.target.value)}
                placeholder="tu_handle" autoComplete="username" required />
            </div>
            <div style={{ marginBottom: 16 }}>
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
            {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <button style={{ ...S.btn("primary"), width: "100%" }} disabled={busy}>
              {busy ? "…" : mode === "login" ? "Acceder" : "Enviar Solicitud"}
            </button>
          </form>
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
/*  VISTA INICIO                           */
/* ─────────────────────────────────────── */
function InicioView({ member, roles }) {
  const roleNames = roles
    .filter(r => getMemberRoleIds(member).includes(r._id))
    .map(r => r.name).join(" · ");

  return (
    <div>
      <h2 style={S.h2}>Panel de Mando</h2>
      <div style={{ ...S.card, maxWidth: 480, borderLeft: `4px solid ${C.accent}` }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, marginBottom: 4 }}>
          {member.displayName || member.handle}
          {member.isJefe && !member.isSuperAdmin && !getMemberRoleIds(member).length && (
            <span style={{ marginLeft: 8, color: C.accentDim }}>⚜</span>
          )}
        </div>
        {roleNames && <div style={S.badge(C.accent)}>{roleNames}</div>}
        <div style={{ color: C.muted, fontSize: 12, marginTop: 8, fontFamily: "'Share Tech Mono', monospace" }}>
          @{member.handle}
        </div>
      </div>
      <div style={{ marginTop: 32, color: C.muted, fontSize: 13 }}>
        Más secciones próximamente: SITREP, Operaciones, ORBAT…
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
function AdminPanel({ roles, isJefe, isSuperAdmin, canDo, orbatUnidades, orbatMiembros, doctrina, member, especialidades }) {
  const [tab, setTab] = useState("solicitudes");

  const tabs = [
    { id: "solicitudes",    label: "Solicitudes",    show: isJefe || canDo("approve_requests") },
    { id: "rangos",         label: "Rangos",          show: isJefe || canDo("manage_roles") },
    { id: "especialidades", label: "Especialidades",  show: isJefe || canDo("manage_roles") },
    { id: "bajas",          label: "Bajas",           show: isJefe || canDo("manage_members") },
    { id: "orbat",          label: "ORBAT",           show: isJefe || canDo("manage_orbat") },
    { id: "doctrina",       label: "Doctrina",        show: isJefe || canDo("manage_doctrina") },
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
      {tab === "orbat"          && <TabOrbat unidades={orbatUnidades} miembros={orbatMiembros} isJefe={isJefe} canDo={canDo} roles={roles} />}
      {tab === "doctrina"       && <TabDoctrina docs={doctrina} member={member} isJefe={isJefe} canDo={canDo} />}
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
  const [name, setName]   = useState("");
  const [perms, setPerms] = useState([]);
  const [editId, setEditId] = useState(null);

  const canEdit = isJefe || isSuperAdmin;

  const togglePerm = p => setPerms(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);

  const save = async () => {
    if (!name.trim()) return;
    if (editId) {
      await fbUpd("roles", editId, { name: name.trim(), permissions: perms });
      setEditId(null);
    } else {
      await fbAdd("roles", { name: name.trim(), permissions: perms });
    }
    setName(""); setPerms([]);
  };

  const startEdit = r => {
    setEditId(r._id); setName(r.name); setPerms(r.permissions || []);
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
            {/* Izquierda: nombre + botones */}
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Nombre del rango</label>
                <input style={S.input} value={name}
                  onChange={e => setName(e.target.value)} placeholder="Ej: Centurión" />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn("primary")} onClick={save}>{editId ? "Guardar" : "Crear rango"}</button>
                {editId && <button style={S.btn("ghost")} onClick={() => { setEditId(null); setName(""); setPerms([]); }}>Cancelar</button>}
              </div>
            </div>
            {/* Derecha: permisos en lista vertical */}
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

      <div style={S.card}>
        <h3 style={S.h3}>Rangos ({roles.length})</h3>
        {roles.length === 0
          ? <p style={{ color: C.muted }}>Sin rangos creados.</p>
          : roles.map(r => (
            <div key={r._id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderBottom: `1px solid ${C.border}20`,
            }}>
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
function TabOrbat({ unidades, miembros, isJefe, canDo, roles }) {
  const allMembers    = useCollection("members");
  const activeMembers = allMembers.filter(m => m.accessStatus === "activo");

  const [uNombre, setUNombre] = useState("");
  const [uColor,  setUColor]  = useState("#C9A24A");
  const [editUId, setEditUId] = useState(null);

  const [mMemberId, setMMemberId] = useState("");
  const [mCargo,    setMCargo]    = useState("");
  const [mUnidadId, setMUnidadId] = useState("");
  const [editMId,   setEditMId]   = useState(null);

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
    if (editUId) {
      await fbUpd("orbat_unidades", editUId, { nombre: uNombre.trim(), color: uColor });
      setEditUId(null);
    } else {
      const maxOrden = unidades.reduce((m, u) => Math.max(m, u.orden || 0), 0);
      await fbAdd("orbat_unidades", { nombre: uNombre.trim(), color: uColor, orden: maxOrden + 1 });
    }
    setUNombre(""); setUColor("#C9A24A");
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
      cargo:    mCargo.trim(),
      unidadId: mUnidadId,
    };
    if (editMId) {
      await fbUpd("orbat_miembros", editMId, data);
      setEditMId(null);
    } else {
      const maxOrden = miembros.filter(m => m.unidadId === mUnidadId).reduce((mx, m) => Math.max(mx, m.orden || 0), 0);
      await fbAdd("orbat_miembros", { ...data, orden: maxOrden + 1 });
    }
    setMMemberId(""); setMCargo(""); setMUnidadId("");
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
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={uColor} onChange={e => setUColor(e.target.value)}
                  style={{ width: 40, height: 32, border: "none", background: "none", cursor: "pointer" }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.muted }}>{uColor}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn("primary")} onClick={saveUnidad}>{editUId ? "Guardar" : "Crear unidad"}</button>
              {editUId && (
                <button style={S.btn("ghost")} onClick={() => { setEditUId(null); setUNombre(""); setUColor("#C9A24A"); }}>
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
                <div style={{ width: 12, height: 12, borderRadius: 2, background: u.color || C.accent, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{u.nombre}</span>
                {canEdit && (
                  <>
                    <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => moveUnidad(u._id, "up")} disabled={i === 0}>▲</button>
                    <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => moveUnidad(u._id, "down")} disabled={i === sorted.length - 1}>▼</button>
                    <button style={{ ...S.btn("ghost"), padding: "4px 8px", fontSize: 11 }} onClick={() => { setEditUId(u._id); setUNombre(u.nombre); setUColor(u.color || "#C9A24A"); }}>✎</button>
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
              <label style={S.label}>Cargo / Rol táctico</label>
              <input style={S.input} value={mCargo} onChange={e => setMCargo(e.target.value)} placeholder="Ej: Centurión, Optio, Miles…" />
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
                <button style={S.btn("ghost")} onClick={() => { setEditMId(null); setMMemberId(""); setMCargo(""); setMUnidadId(""); }}>
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
                        {m.cargo && <span style={S.badge(C.accentDim)}>{m.cargo}</span>}
                        {getMemberRoles(m.memberId).map(r => (
                          <span key={r._id} style={S.badge(C.accent)}>{r.name}</span>
                        ))}
                      </div>
                    </div>
                    {canEdit && (
                      <>
                        <button style={{ ...S.btn("ghost"), padding: "3px 7px", fontSize: 11 }}
                          onClick={() => { setEditMId(m._id); setMMemberId(m.memberId || ""); setMCargo(m.cargo || ""); setMUnidadId(m.unidadId); }}>✎</button>
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
function OrbatView({ unidades, miembros, roles }) {
  const allMembers = useCollection("members");
  const sorted = [...unidades].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const getMemberRoles = (memberId) => {
    if (!memberId) return [];
    const mem = allMembers.find(m => m._id === memberId);
    if (!mem) return [];
    return roles.filter(r => getMemberRoleIds(mem).includes(r._id));
  };

  return (
    <div>
      <h2 style={S.h2}>Orden de Batalla</h2>
      {sorted.length === 0 ? (
        <p style={{ color: C.muted }}>ORBAT no configurado. Accede al Panel de Mando para configurarlo.</p>
      ) : sorted.map(u => {
        const uM = miembros.filter(m => m.unidadId === u._id);
        const color = u.color || C.accent;
        return (
          <div key={u._id} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${color}`, paddingLeft: 16, marginBottom: 16 }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 18, color, letterSpacing: 4, textTransform: "uppercase" }}>
                {u.nombre}
              </span>
              <span style={S.badge(color)}>{uM.length} efectivos</span>
            </div>
            {uM.length === 0 ? (
              <p style={{ color: C.muted, paddingLeft: 20, fontSize: 13 }}>Sin efectivos asignados.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, paddingLeft: 20 }}>
                {uM.map(m => (
                  <div key={m._id} style={{ ...S.card, borderLeft: `2px solid ${color}55` }}>
                    <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, marginBottom: 4 }}>{m.nombre}</div>
                    {m.handle && (
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: C.accent, marginBottom: 6 }}>
                        @{m.handle}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {m.cargo && <span style={S.badge(C.accentDim)}>{m.cargo}</span>}
                      {getMemberRoles(m.memberId).map(r => (
                        <span key={r._id} style={S.badge(C.accent)}>{r.name}</span>
                      ))}
                    </div>
                  </div>
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
            <LegioEditor content={contenido} onChange={setContenido} minHeight={360} stickyTop={76} />
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
  const allMembers    = useCollection("members");
  const activeMembers = allMembers.filter(m => m.accessStatus === "activo");

  const [nombre,    setNombre]    = useState("");
  const [descripcion, setDesc]    = useState("");
  const [color,     setColor]     = useState("#C9A24A");
  const [editId,    setEditId]    = useState(null);

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

  const getMembersWithEsp = (espId) =>
    activeMembers.filter(m => (m.especialidadIds || []).includes(espId));

  const toggleMember = async (m, espId) => {
    const current = m.especialidadIds || [];
    const updated = current.includes(espId)
      ? current.filter(id => id !== espId)
      : [...current, espId];
    await fbUpd("members", m._id, { especialidadIds: updated });
  };

  const [expandedEsp, setExpandedEsp] = useState(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Izquierda — definir especialidades */}
      <div>
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
              <div key={e._id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}20` }}>
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

      {/* Derecha — asignar miembros */}
      <div style={S.card}>
        <h3 style={S.h3}>Asignar legionarios</h3>
        {especialidades.length === 0
          ? <p style={{ color: C.muted }}>Crea especialidades primero.</p>
          : especialidades.map(e => {
            const assigned = getMembersWithEsp(e._id);
            const isOpen   = expandedEsp === e._id;
            return (
              <div key={e._id} style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}
                  onClick={() => setExpandedEsp(isOpen ? null : e._id)}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: e.color || C.accent }} />
                  <span style={{ flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 1 }}>{e.nombre}</span>
                  <span style={S.badge(e.color || C.accentDim)}>{assigned.length}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${C.border}` }}>
                    {activeMembers.map(m => {
                      const has = (m.especialidadIds || []).includes(e._id);
                      return (
                        <label key={m._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", borderBottom: `1px solid ${C.border}10` }}>
                          <input type="checkbox" checked={has} onChange={() => toggleMember(m, e._id)}
                            style={{ accentColor: e.color || C.accent, width: 14, height: 14, cursor: "pointer" }} />
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: C.accent }}>@{m.handle}</span>
                          {m.displayName && m.displayName !== m.handle && (
                            <span style={{ color: C.muted, fontSize: 12 }}>{m.displayName}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  VISTA PÚBLICA ESPECIALIDADES           */
/* ─────────────────────────────────────── */
function EspecialidadesView({ especialidades }) {
  const allMembers = useCollection("members");
  const active     = allMembers.filter(m => m.accessStatus === "activo");

  const getMembersWithEsp = (espId) =>
    active.filter(m => (m.especialidadIds || []).includes(espId));

  return (
    <div>
      <h2 style={S.h2}>Especialidades</h2>
      {especialidades.length === 0 ? (
        <p style={{ color: C.muted }}>Sin especialidades definidas.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {especialidades.map(e => {
            const members = getMembersWithEsp(e._id);
            const color   = e.color || C.accent;
            return (
              <div key={e._id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${color}`, paddingLeft: 16, marginBottom: 12 }}>
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 17, color, letterSpacing: 3, textTransform: "uppercase" }}>
                    {e.nombre}
                  </span>
                  <span style={S.badge(color)}>{members.length} efectivos</span>
                </div>
                {e.descripcion && (
                  <p style={{ color: C.muted, fontSize: 13, paddingLeft: 20, marginBottom: 12 }}>{e.descripcion}</p>
                )}
                {members.length === 0 ? (
                  <p style={{ color: C.muted, paddingLeft: 20, fontSize: 13 }}>Sin efectivos asignados.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 20 }}>
                    {members.map(m => (
                      <div key={m._id} style={{ ...S.card, padding: "8px 14px", borderLeft: `2px solid ${color}55`, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color }}> @{m.handle}</span>
                        {m.displayName && m.displayName !== m.handle && (
                          <span style={{ fontSize: 13 }}>{m.displayName}</span>
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
