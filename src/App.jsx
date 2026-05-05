import { useState, useEffect, useRef } from "react";
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
    fontFamily: "'Inter', sans-serif", fontSize: 14,
  },
  nav: {
    position: "sticky", top: 0, zIndex: 100, height: 64,
    background: "rgba(42,10,10,0.97)", borderBottom: `1px solid ${C.border}`,
    backdropFilter: "blur(10px)",
    display: "flex", alignItems: "center", padding: "0 24px", gap: 24,
  },
  navLogo: {
    display: "flex", alignItems: "center", gap: 12, marginRight: "auto",
  },
  navLogoText: {
    fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700,
    color: C.accent, letterSpacing: 3, lineHeight: 1,
  },
  navLogoSub: {
    fontFamily: "'Share Tech Mono', monospace", fontSize: 9,
    color: C.muted, letterSpacing: 2, display: "block",
  },
  navItem: (active) => ({
    fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 2,
    color: active ? C.accent : C.muted, cursor: "pointer",
    borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
    paddingBottom: 2, textTransform: "uppercase",
  }),
  card: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 4, padding: 24,
  },
  input: {
    width: "100%", background: "#1a0505", border: `1px solid ${C.border}`,
    borderRadius: 4, color: C.text, padding: "8px 12px", fontSize: 14,
    fontFamily: "'Share Tech Mono', monospace", outline: "none", boxSizing: "border-box",
  },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? C.accent : variant === "danger" ? C.danger : C.border,
    color: variant === "primary" ? "#0a0c08" : C.text,
    border: "none", borderRadius: 4, padding: "8px 20px",
    fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 2,
    cursor: "pointer", textTransform: "uppercase", fontWeight: 600,
  }),
  label: { display: "block", color: C.muted, fontSize: 12, marginBottom: 4, letterSpacing: 1 },
  divider: {
    borderTop: `1px solid ${C.border}`, margin: "20px 0",
  },
  h2: {
    fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 600,
    color: C.accent, letterSpacing: 2, marginBottom: 16, textTransform: "uppercase",
  },
  h3: {
    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600,
    color: C.text, letterSpacing: 1, marginBottom: 12,
  },
  badge: (color = C.accentDim) => ({
    display: "inline-block", background: color + "33",
    color: color, border: `1px solid ${color}55`,
    borderRadius: 4, fontSize: 11, padding: "2px 8px",
    fontFamily: "'Share Tech Mono', monospace", letterSpacing: 1,
  }),
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", padding: "8px 12px",
    borderBottom: `1px solid ${C.border}`,
    fontFamily: "'Oswald', sans-serif", fontSize: 12,
    color: C.muted, letterSpacing: 2, textTransform: "uppercase",
  },
  td: {
    padding: "10px 12px", borderBottom: `1px solid ${C.border}20`,
    fontSize: 13, verticalAlign: "middle",
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
/*  COMING SOON — retirar cuando el sistema
/*  de login esté listo para abrir         */
/* ─────────────────────────────────────── */
export default function App() {
  return (
    <div style={{
      ...S.page, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 32,
    }}>
      <img src="/logo.png" alt="Legio Invicta"
        style={{ width: 280, height: 280, borderRadius: "50%", border: `2px solid ${C.border}` }} />
      <div style={{
        fontFamily: "'Oswald', sans-serif", fontSize: 15, letterSpacing: 8,
        color: C.muted, textTransform: "uppercase",
      }}>
        Próximamente
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  APP REAL (en espera)                   */
/* ─────────────────────────────────────── */
function AppReal() {
  const [user, setUser]     = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]     = useState("inicio");

  const roles = useCollection("roles");

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
    { id: "inicio",   label: "Inicio" },
    { id: "miembros", label: "Legionarios" },
    ...(isJefe || canDo("approve_requests") || canDo("manage_roles") || canDo("manage_members")
      ? [{ id: "admin", label: "Mando" }]
      : []),
  ];

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={S.navLogo}>
          <img src="/logo.png" alt="Legio Invicta" style={{ height: 44, width: 44, borderRadius: "50%", border: `1px solid ${C.border}` }} />
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

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
        {view === "inicio"   && <InicioView member={member} roles={roles} />}
        {view === "miembros" && <MiembrosView roles={roles} canDo={canDo} isJefe={isJefe} />}
        {view === "admin"    && <AdminPanel roles={roles} isJefe={isJefe} isSuperAdmin={isSuperAdmin} canDo={canDo} />}
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
function AdminPanel({ roles, isJefe, isSuperAdmin, canDo }) {
  const [tab, setTab] = useState("solicitudes");

  const tabs = [
    { id: "solicitudes", label: "Solicitudes",  show: isJefe || canDo("approve_requests") },
    { id: "rangos",      label: "Rangos",        show: isJefe || canDo("manage_roles") },
    { id: "legionarios", label: "Legionarios",   show: isJefe || canDo("manage_members") },
    { id: "bajas",       label: "Bajas",         show: isJefe || canDo("manage_members") },
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
      {tab === "solicitudes" && <TabSolicitudes roles={roles} />}
      {tab === "rangos"      && <TabRangos roles={roles} isJefe={isJefe} isSuperAdmin={isSuperAdmin} />}
      {tab === "legionarios" && <TabLegionarios roles={roles} />}
      {tab === "bajas"       && <TabBajas />}
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
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Nombre del rango</label>
            <input style={{ ...S.input, maxWidth: 300 }} value={name}
              onChange={e => setName(e.target.value)} placeholder="Ej: Centurión" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Permisos</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {ALL_PERMS.map(p => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={perms.includes(p.id)} onChange={() => togglePerm(p.id)} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn("primary")} onClick={save}>{editId ? "Guardar" : "Crear rango"}</button>
            {editId && <button style={S.btn("ghost")} onClick={() => { setEditId(null); setName(""); setPerms([]); }}>Cancelar</button>}
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
