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

// ("D", "maj") → "D major" / "Re mayor"
const QUALITY = {
  en: { maj: "major", min: "minor" },
  es: { maj: "mayor", min: "menor" },
};
export function chordLabel(rootName, quality) {
  const base = rootName.replace("#", "");
  const sharp = rootName.includes("#") ? "#" : "";
  const root = (solfege ? SOLFEGE[base] ?? base : base) + sharp;
  return `${root} ${QUALITY[lang][quality] ?? quality}`;
}

const STRINGS = {
  // Keys are the English display text, except a few "key#variant" entries
  // that need an explicit English value (e.g. plural forms).
  en: {
    "due#one": "due",
    "sharp#n": "sharps",
    "flat#n": "flats",
  },
  es: {
    "due#one": "pendiente",
    "Sight reading, one giant note at a time.": "Lectura a primera vista, una nota gigante a la vez.",
    "session practiced": "sesión practicada",
    "sessions practiced": "sesiones practicadas",
    "-day streak": " días de racha",
    "due": "pendientes",
    "due for review": "pendientes de repaso",
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
    "Signup code": "Código de registro",
    "Whoever invited you has it.": "Quien te invitó lo tiene.",
    "New here? Create an account": "¿Primera vez? Crea una cuenta",
    "Have an account? Log in": "¿Ya tienes cuenta? Inicia sesión",
    "Practice without an account (progress stays on this device)": "Practica sin cuenta (el progreso se queda en este dispositivo)",
    "Settings": "Ajustes",
    "▶ Play the chord": "▶ Toca el acorde",
    "▶ Match the pitch": "▶ Encuentra la nota",
    "▶ Play the pattern": "▶ Toca el patrón",
    "▶ Name the key": "▶ Nombra la tonalidad",
    "🎯 Grades": "🎯 Niveles",
    "Grades": "Niveles",
    "Not started": "Sin empezar",
    "Working on it": "En ello",
    "Secure": "Seguro",
    "Technique": "Técnica",
    "Reading": "Lectura",
    "Rhythm": "Ritmo",
    "Ear": "Oído",
    "Scales and arpeggios": "Escalas y arpegios",
    "Pieces": "Piezas",
    "Sight-reading": "Lectura a primera vista",
    "Aural": "Audición",
    "Generic levels, not any exam board's syllabus — correct them against whichever one you are working to.": "Niveles genéricos, no el temario de ningún conservatorio — ajústalos al que estés siguiendo.",
    "Which key is this?": "¿Qué tonalidad es esta?",
    "Nothing at the front — count again.": "No hay nada al principio — cuenta otra vez.",
    "Count again:": "Cuenta otra vez:",
    "sharp#n": "sostenidos",
    "flat#n": "bemoles",
    "▶ Right hand": "▶ Mano derecha",
    "Left hand": "Mano izquierda",
    "Hands together": "Manos juntas",
    "bar": "compás",
    "Play this bar with your right hand.": "Toca este compás con la mano derecha.",
    "Play this bar with your left hand.": "Toca este compás con la mano izquierda.",
    "Play this bar with both hands.": "Toca este compás con las dos manos.",
    "In time": "A tiempo",
    "In time!": "¡A tiempo!",
    "Play the phrase in time with the metronome.": "Toca la frase a tiempo con el metrónomo.",
    "Play it evenly, with the fingering shown.": "Tócalo parejo, con la digitación indicada.",
    "▶ Count-in & play": "▶ Cuenta y toca",
    "▶ Name what you hear": "▶ Nombra lo que oyes",
    "▶ Major or minor?": "▶ ¿Mayor o menor?",
    "▶ Play it back": "▶ Tócala de vuelta",
    "🔊 Play it again": "🔊 Suena otra vez",
    "Play the note you just heard.": "Toca la nota que acabas de oír.",
    "How far apart were those two notes?": "¿A qué distancia estaban esas dos notas?",
    "Was that major or minor?": "¿Eso era mayor o menor?",
    "Play those four notes back.": "Toca esas cuatro notas de vuelta.",
    "☀ Major": "☀ Mayor",
    "☾ Minor": "☾ Menor",
    "Listen to the middle note — is it bright or dark?": "Escucha la nota del medio — ¿suena brillante u oscura?",
    "Play all three notes together.": "Toca las tres notas a la vez.",
    "Playing:": "Tocando:",
    "Clear": "Borrar",
    "🔊 Hear the chord": "🔊 Escucha el acorde",
    "Change password": "Cambiar contraseña",
    "Current password": "Contraseña actual",
    "New password (at least 8 characters)": "Nueva contraseña (mínimo 8 caracteres)",
    "Password updated.": "Contraseña actualizada.",
    "Current password is wrong": "La contraseña actual es incorrecta",
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

export const t = key => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;

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
  "piece-ode-to-joy": {
    title: "Himno a la Alegría",
    blurb: "Beethoven — 8 compases. Practica compás a compás; los que fallas vuelven.",
  },
  "piece-mary-lamb": {
    title: "María tenía un corderito",
    blurb: "Tradicional — 8 compases. Practica compás a compás; los que fallas vuelven.",
  },
  "key-signatures": {
    title: "Armaduras",
    blurb: "Cuenta los sostenidos o bemoles del principio y nombra la tonalidad — antes de tocar una nota.",
  },
  "technique-5finger": { title: "Posiciones de cinco dedos", blurb: "Cinco notas bajo cinco dedos, arriba y abajo, parejo. Donde empieza toda mano." },
  "technique-scales": { title: "Escalas, pulgar por debajo", blurb: "Do mayor, una octava. El pulgar que se mete por debajo es todo el truco." },
  "technique-arpeggios": { title: "Arpegios", blurb: "La tríada extendida bajo la mano — un acorde que tocas nota a nota." },
  chords: { title: "Tríadas", blurb: "Tres notas, una forma, un solo sonido — toca el acorde entero de golpe." },
  "ear-pitch": { title: "Encuentra la nota", blurb: "Oye una nota y búscala en tu piano. Nada en pantalla — esto es puro oído." },
  "ear-intervals": { title: "Intervalos de oído", blurb: "Dos notas, sin partitura. Nombra la distancia solo por el sonido." },
  "ear-chords": { title: "¿Mayor o menor?", blurb: "Un semitono es toda la diferencia. Oye una tríada y nombra su carácter." },
  "ear-phrases": { title: "Tócala de vuelta", blurb: "Cuatro notas, y luego te toca — así se aprende una melodía de oído." },
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

const TECHNIQUE_ES = {
  "C position, right hand": "Posición de Do, mano derecha",
  "C position, left hand": "Posición de Do, mano izquierda",
  "C major scale, right hand": "Escala de Do mayor, mano derecha",
  "C major scale, left hand": "Escala de Do mayor, mano izquierda",
  "C major arpeggio, right hand": "Arpegio de Do mayor, mano derecha",
  "C major arpeggio, left hand": "Arpegio de Do mayor, mano izquierda",
};
// Grade titles, blurbs and requirement labels. The server speaks English
// identifiers; a half-translated screen is worse than an untranslated one,
// so test_parity checks every shipped label appears here.
export const GRADE_ES = {
  foundation: {
    title: "Iniciación",
    blurb: "Antes del primer grado: cinco dedos, una tonalidad y notas que reconoces al verlas.",
  },
  "grade-1": {
    title: "Grado 1",
    blurb: "Cinco tonalidades, ambas claves, una pieza a dos manos y oído para la diferencia.",
  },
};
export const gradeText = grade =>
  (lang === "es" && GRADE_ES[grade.id] ? GRADE_ES[grade.id] : grade);

export const REQUIREMENT_ES = {
  "C position, both hands": "Posición de Do, ambas manos",
  "C major scale, hands separately": "Escala de Do mayor, manos separadas",
  "Treble guide notes": "Notas guía en clave de Sol",
  "Bass guide notes": "Notas guía en clave de Fa",
  "Line or space": "Línea o espacio",
  "Quarters, halves and wholes": "Negras, blancas y redondas",
  "Match a pitch you hear": "Encuentra la nota que oyes",
  "Scales: C, G, D, F major, hands separately":
    "Escalas: Do, Sol, Re, Fa mayor, manos separadas",
  "Scale: A harmonic minor, hands separately":
    "Escala: La menor armónica, manos separadas",
  "Arpeggios: C, G, D, F major, hands separately":
    "Arpegios: Do, Sol, Re, Fa mayor, manos separadas",
  "Arpeggio: A minor, hands separately": "Arpegio: La menor, manos separadas",
  "Ode to Joy, hands together": "Himno a la Alegría, manos juntas",
  "Mary Had a Little Lamb, hands together": "María tenía un corderito, manos juntas",
  "The treble octave": "La octava en clave de Sol",
  "The bass octave": "La octava en clave de Fa",
  "Intervals by sight": "Intervalos a la vista",
  "Key signatures to one sharp or flat": "Armaduras hasta un sostenido o bemol",
  "Intervals by ear": "Intervalos de oído",
  "Major or minor": "Mayor o menor",
  "Play back a phrase": "Toca una frase de vuelta",
};
export const requirementLabel = en =>
  (lang === "es" ? REQUIREMENT_ES[en] ?? en : en);

const TRACK_ES = {
  Reading: "Lectura", Rhythm: "Ritmo", Technique: "Técnica",
  Ear: "Oído", Repertoire: "Repertorio",
};
export const trackName = en => (lang === "es" ? TRACK_ES[en] ?? en : en);

export const techniqueName = en => (lang === "es" ? TECHNIQUE_ES[en] ?? en : en);

// Key names follow the note-name setting: C major is Do mayor in solfège.
const MODE_ES = { major: "mayor", minor: "menor" };
export function keyName(englishName) {
  const [letterPart, ...rest] = englishName.split(" ");
  const mode = englishName.includes("minor") ? "minor" : "major";
  const flat = rest.includes("flat");
  const root = (solfege ? SOLFEGE[letterPart] ?? letterPart : letterPart)
    + (flat ? (lang === "es" ? " bemol" : " flat") : "");
  return lang === "es" ? `${root} ${MODE_ES[mode]}` : `${root} ${mode}`;
}

// The short label on an answer button: "B♭" rather than "B flat major".
export function keyLabel(keyId) {
  const root = keyId.replace("b", "♭").replace("m", "");
  const letter = root[0];
  return (solfege ? SOLFEGE[letter] ?? letter : letter) + root.slice(1);
}
