import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Auth from "./screens/Auth.jsx";
import Home from "./screens/Home.jsx";
import Stats from "./screens/Stats.jsx";

// Session pulls in VexFlow (~1MB) — load it only when practice starts.
const Session = lazy(() => import("./screens/Session.jsx"));
import { api, getToken, setToken } from "./lib/api.js";
import { SKILL_NODES } from "./lib/notes.js";
import { buildSession } from "./lib/session.js";
import {
  loadState, saveState, recordAnswer, recordSession, nodeAccuracy, DEFAULT_SETTINGS,
} from "./lib/storage.js";

const GUEST_KEY = "klaviearn.guest";

export default function App() {
  // auth.status: loading | choose | guest | online
  const [auth, setAuth] = useState({ status: "loading" });
  const [me, setMe] = useState(null);
  const [tree, setTree] = useState(null);
  const [screen, setScreen] = useState({ name: "home" });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const localRef = useRef(null); // guest-mode persistent state

  useEffect(() => {
    if (getToken()) {
      Promise.all([api.me(), api.tree()])
        .then(([m, t]) => {
          setMe(m);
          setTree(t.nodes);
          setSettings(m.settings);
          setAuth({ status: "online" });
        })
        .catch(() => {
          setToken(null);
          setAuth({ status: "choose" });
        });
    } else if (localStorage.getItem(GUEST_KEY)) {
      enterGuest();
    } else {
      setAuth({ status: "choose" });
    }
  }, []);

  function enterGuest() {
    localStorage.setItem(GUEST_KEY, "1");
    localRef.current = loadState();
    setSettings(localRef.current.settings);
    setAuth({ status: "guest" });
  }

  async function refreshOnline() {
    const [m, t] = await Promise.all([api.me(), api.tree()]);
    setMe(m);
    setTree(t.nodes);
    setSettings(m.settings);
    setAuth({ status: "online" });
  }

  function updateSettings(next) {
    setSettings(next);
    if (auth.status === "online") {
      api.saveSettings(next).catch(() => {});
    } else {
      localRef.current.settings = next;
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
  const nodes = online
    ? tree
    : SKILL_NODES.map(n => ({ ...n, accuracy: nodeAccuracy(localRef.current, n) }));

  return (
    <Home
      nodes={nodes}
      me={online ? me : null}
      settings={settings}
      onSettings={updateSettings}
      onStart={startSession}
      onStats={online ? () => setScreen({ name: "stats" }) : null}
      onLogout={online ? () => { setToken(null); setMe(null); setTree(null); setAuth({ status: "choose" }); } : null}
      onSignup={!online ? () => setAuth({ status: "choose" }) : null}
    />
  );
}
