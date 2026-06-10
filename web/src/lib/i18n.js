// All presentation text lives client-side; the server speaks canonical
// identifiers (letters C–B, English pos labels, node ids). setLocale() is
// called by App whenever settings change, before anything re-renders.

export const SOLFEGE = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };

let lang = "en";
let solfege = false;

export function setLocale(language, noteNames) {
  lang = language === "es" ? "es" : "en";
  solfege = noteNames === "solfege";
}
export const browserDefaults = () => {
  const es = (navigator.language || "").toLowerCase().startsWith("es");
  return { language: es ? "es" : "en", noteNames: es ? "solfege" : "letters" };
};

// "G" → "G" or "Sol"
export const noteLabel = letter => (solfege ? SOLFEGE[letter] ?? letter : letter);

// 67 → "G4" or "Sol4"; 61 → "C#4" or "Do#4"
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function noteName(midi) {
  const raw = SHARPS[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  const base = raw.replace("#", "");
  return (solfege ? SOLFEGE[base] + (raw.includes("#") ? "#" : "") : raw) + octave;
}

const STRINGS = {
  en: {}, // English is the key itself — see t() below.
  es: {
    "Sight reading, one giant note at a time.": "Lectura a primera vista, una nota gigante a la vez.",
    "session practiced": "sesión practicada",
    "sessions practiced": "sesiones practicadas",
    "-day streak": " días de racha",
    "▶ Read notes": "▶ Leer notas",
    "Read phrases": "Leer frases",
    "Line or space?": "¿Línea o espacio?",
    "▶ Tap the rhythm": "▶ Marca el ritmo",
    "▶ Name the interval": "▶ Nombra el intervalo",
    "⚙ Settings": "⚙ Ajustes",
    "📊 My stats": "📊 Mis estadísticas",
    "Log out": "Cerrar sesión",
    "Create account to sync progress": "Crea una cuenta para sincronizar tu progreso",
    "✕ End": "✕ Terminar",
    "Play the note you see.": "Toca la nota que ves.",
    "Play the phrase, left to right.": "Toca la frase, de izquierda a derecha.",
    "Is this note on a line, or in a space?": "¿Está esta nota en una línea o en un espacio?",
    "Tap this rhythm with the metronome.": "Marca este ritmo con el metrónomo.",
    "How far apart are these notes?": "¿A qué distancia están estas notas?",
    "— correct!": "— ¡correcto!",
    "You played": "Tocaste",
    "Phrase complete!": "¡Frase completa!",
    "Locked in!": "¡Clavado!",
    "Not quite — check the timing marks and go again.": "Casi — revisa las marcas de tiempo e inténtalo de nuevo.",
    "Look again — is the notehead on a line, or between lines?": "Mira otra vez: ¿la cabeza de la nota está sobre una línea o entre líneas?",
    "Look at the gap between the noteheads and try again.": "Mira la distancia entre las notas e inténtalo de nuevo.",
    "Yes —": "Sí —",
    "🎤 Start microphone": "🎤 Activar micrófono",
    "🎤 Listening…": "🎤 Escuchando…",
    "Listening…": "Escuchando…",
    "Hearing:": "Oyendo:",
    "🔊 Hear it": "🔊 Escúchala",
    "Microphone unavailable:": "Micrófono no disponible:",
    "MIDI not supported in this browser — mic and buttons work.": "Este navegador no soporta MIDI — el micrófono y los botones funcionan.",
    "MIDI: plug in a keyboard and it connects automatically.": "MIDI: conecta un teclado y se conectará automáticamente.",
    "MIDI:": "MIDI:",
    "── Line ──": "── Línea ──",
    "‿ Space ‿": "‿ Espacio ‿",
    "2nd": "2.ª", "3rd": "3.ª", "4th": "4.ª", "5th": "5.ª",
    "a 2nd": "una segunda", "a 3rd": "una tercera", "a 4th": "una cuarta", "a 5th": "una quinta",
    "▶ Count-in & tap": "▶ Conteo y toca",
    "▶ Counting…": "▶ Contando…",
    "GO": "¡YA!",
    "TAP — or spacebar, or any piano key": "TOCA — o barra espaciadora, o cualquier tecla del piano",
    "early": "pronto", "late": "tarde", "extra": "de más",
    "bpm": "ppm",
    "Session complete": "Sesión completada",
    "Back to lessons": "Volver a las lecciones",
    "Welcome back": "Bienvenido de nuevo",
    "Create your account": "Crea tu cuenta",
    "Email": "Correo",
    "Password": "Contraseña",
    "Log in": "Iniciar sesión",
    "Sign up": "Registrarse",
    "New here? Create an account": "¿Primera vez? Crea una cuenta",
    "Have an account? Log in": "¿Ya tienes cuenta? Inicia sesión",
    "Practice without an account (progress stays on this device)": "Practica sin cuenta (el progreso se queda en este dispositivo)",
    "Settings": "Ajustes",
    "Training wheels": "Ayudas visuales",
    "Auto — fade as I master each note": "Auto — desaparecen al dominar cada nota",
    "Always: note names + colors": "Siempre: nombres + colores",
    "Colors only": "Solo colores",
    "Plain notation": "Notación simple",
    "Strict octave (piano input must match the exact octave)": "Octava estricta (la entrada del piano debe coincidir con la octava exacta)",
    "Staff size": "Tamaño del pentagrama",
    "Microphone sensitivity": "Sensibilidad del micrófono",
    "High — quiet or distant piano": "Alta — piano suave o lejano",
    "Normal": "Normal",
    "Low — noisy room": "Baja — habitación ruidosa",
    "Hearing something — too quiet. Play louder or move closer.": "Oigo algo — muy bajito. Toca más fuerte o acércate.",
    "Medium": "Mediano", "Large": "Grande", "Huge": "Enorme",
    "Language": "Idioma",
    "Note names": "Nombres de las notas",
    "Letters (C D E)": "Letras (C D E)",
    "Solfège (Do Re Mi)": "Solfeo (Do Re Mi)",
    "← Back": "← Volver",
    "My stats": "Mis estadísticas",
    "sessions": "sesiones",
    "Trouble spots": "Puntos débiles",
    "No wrong notes recorded yet. Either you're perfect, or it's early days.": "Aún no hay notas falladas. O eres perfecto, o es muy pronto.",
    "Seeing": "Viendo",
    "you played": "tocaste",
    "Every note you've met": "Cada nota que has visto",
    "Run a session first.": "Primero completa una sesión.",
    "letters + colors": "nombres + colores",
    "colors only": "solo colores",
    "plain notation": "notación simple",
    "Interval:": "Intervalo:",
    "grand staff,": "doble pentagrama,",
    "treble": "clave de Sol", "bass": "clave de Fa",
  },
};

export const t = key => (lang === "es" ? STRINGS.es[key] ?? key : key);

// --- Curriculum presentation, keyed by stable server ids ---

export const NODE_TEXT_ES = {
  guide: { title: "Notas guía", blurb: "Do y Sol — tus dos anclas. Todo lo demás está a pasos de ellas." },
  steps: { title: "De Do a Sol", blurb: "Completa los pasos entre las notas guía." },
  octave: { title: "La octava completa", blurb: "De Do4 a Do5 — incluida la línea adicional." },
  "bass-guide": { title: "Notas guía en clave de Fa", blurb: "Fa3 — la línea que abraza la clave de Fa — y el Do central." },
  "bass-steps": { title: "De Fa al Do central", blurb: "Pasos desde la línea de Fa hasta el Do central." },
  "bass-octave": { title: "La octava grave", blurb: "De Do3 al Do central — el territorio de la mano izquierda." },
  "rhythm-steady": { title: "Ritmos estables", blurb: "Negras, blancas y redondas — márcalas con el metrónomo." },
  "rhythm-eighths": { title: "Corcheas", blurb: "Dos toques por pulso." },
  "rhythm-rests": { title: "Silencios", blurb: "Las notas que no tocas también cuentan." },
  intervals: { title: "Intervalos como formas", blurb: "Deja de contar líneas — ve la distancia. Los lectores fluidos leen saltos, no nombres." },
  grand: { title: "El doble pentagrama", blurb: "Ambos pentagramas juntos — el Do central es el puente entre tus manos." },
};

export const nodeText = node =>
  lang === "es" && NODE_TEXT_ES[node.id] ? NODE_TEXT_ES[node.id] : node;

const POS_ES = {
  "ledger line": "línea adicional",
  "space below the staff": "espacio bajo el pentagrama",
  "bottom line": "primera línea",
  "first space": "primer espacio",
  "second line": "segunda línea",
  "second space": "segundo espacio",
  "middle line": "tercera línea",
  "third space": "tercer espacio",
  "fourth line": "cuarta línea",
  "top space": "espacio superior",
  "top line": "línea superior",
  "space above the staff": "espacio sobre el pentagrama",
  "ledger line above": "línea adicional superior",
};
export const posLabel = en => (lang === "es" ? POS_ES[en] ?? en : en);

const RHYTHM_ES = {
  "Four steady quarters": "Cuatro negras estables",
  "A half, then two quarters": "Una blanca y dos negras",
  "Two quarters, then a half": "Dos negras y una blanca",
  "Two halves": "Dos blancas",
  "One whole note": "Una redonda",
  "Eighth pairs, then quarters": "Pares de corcheas y negras",
  "Eighths in the middle": "Corcheas en medio",
  "Eighths on two and four": "Corcheas en el dos y el cuatro",
  "Rest on beat two": "Silencio en el segundo pulso",
  "Rest on beat three": "Silencio en el tercer pulso",
  "A half, a rest, a quarter": "Blanca, silencio, negra",
};
export const rhythmName = en => (lang === "es" ? RHYTHM_ES[en] ?? en : en);
