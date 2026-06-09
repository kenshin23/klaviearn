// Thin client for the FastAPI backend (proxied through Vite at /api).
const TOKEN_KEY = "klaviearn.token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = t =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch("/api" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail;
    throw new Error(typeof detail === "string" ? detail : res.statusText);
  }
  return res.json();
}

const normalizeExercise = e => ({ ...e, posLabel: e.pos_label ?? e.posLabel });

export const api = {
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: { email, password } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/me"),
  saveSettings: settings => request("/me/settings", { method: "PUT", body: settings }),
  tree: () => request("/tree"),
  startSession: (node_id, drill) =>
    request("/sessions", { method: "POST", body: { node_id, drill } }).then(r =>
      r.exercises.map(normalizeExercise),
    ),
  completeSession: (node_id, drill, results) =>
    request("/sessions/complete", { method: "POST", body: { node_id, drill, results } }),
};
