import { useRef, useState } from "react";
import Home from "./screens/Home.jsx";
import Session from "./screens/Session.jsx";
import { loadState, saveState, recordAnswer, recordSession } from "./lib/storage.js";

export default function App() {
  // One persistent state object, mutated through the storage helpers and
  // saved on every change. (Phase 2 moves this to a real backend.)
  const stateRef = useRef(loadState());
  const [screen, setScreen] = useState({ name: "home" });
  const [settings, setSettings] = useState(stateRef.current.settings);

  function updateSettings(next) {
    setSettings(next);
    stateRef.current.settings = next;
    saveState(stateRef.current);
  }

  function finishSession(results) {
    const ok = results.filter(r => r.hit).length;
    for (const r of results) recordAnswer(stateRef.current, r.midi, r.hit);
    recordSession(stateRef.current, {
      nodeId: screen.node.id,
      drill: screen.drill,
      ok,
      total: results.length,
    });
    saveState(stateRef.current);
  }

  if (screen.name === "session") {
    return (
      <Session
        key={screen.startedAt}
        node={screen.node}
        drill={screen.drill}
        settings={settings}
        noteStats={stateRef.current.noteStats}
        onFinish={finishSession}
        onHome={() => setScreen({ name: "home" })}
      />
    );
  }

  return (
    <Home
      state={stateRef.current}
      settings={settings}
      onSettings={updateSettings}
      onStart={(node, drill) =>
        setScreen({ name: "session", node, drill, startedAt: Date.now() })
      }
    />
  );
}
