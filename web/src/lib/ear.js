// What an ear exercise sounds like, as data.
//
// The visual scaffolds mean nothing here — there is no notation to fade, and
// showing the note name would BE the answer. So the per-item SRS level drives
// how hard the exercise is to *listen to* instead:
//
//   pitch     L0 hears a reference C first, so the note can be measured
//             against a known anchor; L1+ gives the note alone.
//   interval  L0/L1 sound the notes one after another (easier to compare),
//             L2 sounds them together, which is the real skill.
//   chord     L0 arpeggiates and then repeats as a block, L1 arpeggiates,
//             L2 is the block chord alone.
//   phrase    the gap between notes closes as the item is mastered.
//
// A plan is a list of { midis, at }: everything in one entry sounds together,
// `at` is seconds from the start. Pure data, so the ladder is testable
// without an audio device.

export const REFERENCE_MIDI = 60; // middle C, the anchor the app teaches first

const PHRASE_GAPS = [0.75, 0.55, 0.4];

export function playbackPlan(exercise, level = 0) {
  const lvl = Math.max(0, Math.min(2, level ?? 0));
  const midis = exercise.midis ?? (exercise.midi == null ? [] : [exercise.midi]);
  if (midis.length === 0) return [];

  switch (exercise.drill) {
    case "ear-pitch":
      // No anchor when the target IS the anchor — sounding C twice and asking
      // which note it was teaches nothing.
      return lvl === 0 && midis[0] !== REFERENCE_MIDI
        ? [{ midis: [REFERENCE_MIDI], at: 0 }, { midis, at: 0.9 }]
        : [{ midis, at: 0 }];

    case "ear-interval": {
      if (lvl >= 2) return [{ midis, at: 0 }];
      const gap = lvl === 0 ? 0.65 : 0.45;
      return midis.map((m, i) => ({ midis: [m], at: i * gap }));
    }

    case "ear-chord": {
      if (lvl >= 2) return [{ midis, at: 0 }];
      const gap = lvl === 0 ? 0.45 : 0.3;
      const arpeggio = midis.map((m, i) => ({ midis: [m], at: i * gap }));
      return lvl === 0
        ? [...arpeggio, { midis, at: midis.length * gap + 0.35 }]
        : arpeggio;
    }

    case "ear-phrase": {
      const gap = PHRASE_GAPS[lvl];
      return midis.map((m, i) => ({ midis: [m], at: i * gap }));
    }

    default:
      return [];
  }
}

/** How long a plan takes, for anything that needs to wait it out. */
export const planDuration = plan =>
  plan.length === 0 ? 0 : Math.max(...plan.map(step => step.at));

/** How many separate sounds the listener will hear — drives the "•••" hint. */
export const planBeats = plan => plan.length;
