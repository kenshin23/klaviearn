import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Auth from "./screens/Auth.jsx";
import Home from "./screens/Home.jsx";
import Stats from "./screens/Stats.jsx";
import Grades from "./screens/Grades.jsx";

// Session pulls in VexFlow (~1MB) — load it only when practice starts.
const Session = lazy(() => import("./screens/Session.jsx"));
import { api, getToken, setToken } from "./lib/api.js";
import { SKILL_NODES } from "./lib/notes.js";
import { buildSession } from "./lib/session.js";
import {
  loadState, saveState, recordAnswer, recordSession, nodeAccuracy, DEFAULT_SETTINGS,
} from "./lib/storage.js";
import { setLocale } from "./lib/i18n.js";

const GUEST_KEY = "klaviearn.guest";

// Guest progress lives in a mutable local store, so the accuracies the home
// screen shows are derived and published deliberately. This is the same shape
// the online branch gets back from api.tree().
const nodesFor = local =>
  SKILL_NODES.map(n => ({ ...n, accuracy: nodeAccuracy(local, n) }));

// Which of the three ways in applies is settled before the first render: the
// token and the guest flag are both synchronous reads, so there is nothing
// here to wait for and nothing to resolve in an effect.
function bootstrap() {
  if (getToken()) return { status: "loading", local: null };
  if (localStorage.getItem(GUEST_KEY)) return { status: "guest", local: loadState() };
  return { status: "choose", local: null };
}

export default function App() {
  const [boot] = useState(bootstrap);
  // auth.status: loading | choose | guest | online
  const [auth, setAuth] = useState({ status: boot.status });
  const [me, setMe] = useState(null);
  const [tree, setTree] = useState(null);
  const [screen, setScreen] = useState({ name: "home" });
  const [settings, setSettings] = useState(boot.local?.settings ?? DEFAULT_SETTINGS);
  const localRef = useRef(boot.local); // guest-mode persistent state
  const [guestNodes, setGuestNodes] = useState(() => boot.local && nodesFor(boot.local));
  const settingsRef = useRef(settings);
  // Mirrors `settings` for updateSettings' updater form. Written in a layout
  // effect rather than during render: React is free to throw a render away,
  // but a ref written during one keeps the value anyway. A layout effect
  // still lands before anything can handle an event.
  useLayoutEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Locale is module state read by t()/noteLabel(); set it before children render.
  setLocale(settings.language, settings.noteNames);

  // Declared above the effect that calls it, not hoisted into it from below:
  // reaching backwards for a function means the call cannot see later
  // changes to what that function closes over.
  function enterGuest() {
    localStorage.setItem(GUEST_KEY, "1");
    localRef.current = loadState();
    setSettings(localRef.current.settings);
    setGuestNodes(nodesFor(localRef.current));
    setAuth({ status: "guest" });
  }

  // Only the token path has anything to wait for; bootstrap() settled the
  // other two above.
  useEffect(() => {
    if (!getToken()) return;
    Promise.all([api.me(), api.tree()])
      .then(([m, t]) => {
        setMe(m);
        setTree(t.nodes);
        // Server settings win where saved, but presentation defaults
        // (language, note names) come from the browser until then.
        setSettings({ ...DEFAULT_SETTINGS, ...m.settings });
        setAuth({ status: "online" });
      })
      .catch(() => {
        setToken(null);
        setAuth({ status: "choose" });
      });
  }, []);

  async function refreshOnline() {
    const [m, t] = await Promise.all([api.me(), api.tree()]);
    setMe(m);
    setTree(t.nodes);
    setSettings({ ...DEFAULT_SETTINGS, ...m.settings });
    setAuth({ status: "online" });
  }

  // Accepts a value or an updater. Two settings changes in the same tick
  // both read the `settings` prop, so the second would overwrite the first
  // with a value computed from stale state; the ref is what the updater form
  // reads instead.
  function updateSettings(next) {
    const value = typeof next === "function" ? next(settingsRef.current) : next;
    settingsRef.current = value;
    setSettings(value);
    if (auth.status === "online") {
      api.saveSettings(value).catch(() => {});
    } else {
      localRef.current.settings = value;
      saveState(localRef.current);
    }
  }

  async function startSession(node, drill) {
    if (auth.status === "online") {
      setScreen({ name: "starting" });
      try {
        const exercises = await api.startSession(node.id, drill);
        setScreen({ name: "session", node, drill, exercises, startedAt: Date.now() });
      } catch {
        setScreen({ name: "home" }); // server hiccup: stay home rather than crash
      }
    } else {
      const exercises = buildSession(node, drill, localRef.current.noteStats);
      setScreen({ name: "session", node, drill, exercises, startedAt: Date.now() });
    }
  }

  // Returns reward info (online) so the summary can show XP; null for guest.
  async function finishSession(results) {
    const { node, drill } = screen;
    if (auth.status === "online") {
      const reward = await api.completeSession(node.id, drill, results);
      api.tree().then(t => setTree(t.nodes)).catch(() => {});
      setMe(m => m && { ...m, xp: reward.xp, streakDays: reward.streakDays });
      return reward;
    }
    const ok = results.filter(r => r.hit).length;
    for (const r of results) recordAnswer(localRef.current, r.item, r.hit);
    recordSession(localRef.current, { nodeId: node.id, drill, ok, total: results.length });
    saveState(localRef.current);
    setGuestNodes(nodesFor(localRef.current)); // the badges move because this changed
    return null;
  }

  if (auth.status === "loading" || screen.name === "starting") {
    return <main className="screen"><p className="status">…</p></main>;
  }

  if (auth.status === "choose") {
    return <Auth onAuthed={refreshOnline} onGuest={enterGuest} />;
  }

  if (screen.name === "stats") {
    return <Stats onHome={() => setScreen({ name: "home" })} />;
  }

  if (screen.name === "grades") {
    return <Grades onHome={() => setScreen({ name: "home" })} />;
  }

  if (screen.name === "session") {
    return (
      <Suspense fallback={<main className="screen"><p className="status">…</p></main>}>
        <Session
          key={screen.startedAt}
          exercises={screen.exercises}
          settings={settings}
          onFinish={finishSession}
          onHome={() => setScreen({ name: "home" })}
        />
      </Suspense>
    );
  }

  const online = auth.status === "online";
  const nodes = online ? tree : guestNodes;

  return (
    <Home
      nodes={nodes}
      me={online ? me : null}
      settings={settings}
      onSettings={updateSettings}
      onStart={startSession}
      onStats={online ? () => setScreen({ name: "stats" }) : null}
      onGrades={online ? () => setScreen({ name: "grades" }) : null}
      onLogout={online ? () => { setToken(null); setMe(null); setTree(null); setAuth({ status: "choose" }); } : null}
      onSignup={!online ? () => setAuth({ status: "choose" }) : null}
    />
  );
}
