/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";

const AudioContext = createContext();

export function useAudio() {
  return useContext(AudioContext);
}

export function AudioProvider({ children }) {
  const [isMuted, setIsMuted] = useState(false);
  const [musicUrl, setMusicUrl] = useState(null);
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioElementRef = useRef(null);
  const oscillatorsRef = useRef([]);
  const presentationOscillatorsRef = useRef([]);

  // Initialize Audio Context with presentation music
  const initAudio = () => {
    if (audioContextRef.current) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0 : 0.2; // Volume for presentation music
    masterGain.connect(ctx.destination);
    gainNodeRef.current = masterGain;

    // Create exciting presentation music
    // Using energetic chord progression: Em - C - G - D (vi - IV - I - V)
    const chordProgression = [
      [164.81, 196.0, 246.94], // E minor (E, G, B) - dramatic start
      [261.63, 329.63, 392.0], // C major (C, E, G) - bright
      [196.0, 246.94, 293.66], // G major (G, B, D) - powerful
      [293.66, 369.99, 440.0], // D major (D, F#, A) - triumphant
    ];

    const CHORD_DURATION = 2; // Faster tempo - 2 seconds per chord
    let currentChord = 0;

    const playChord = (time) => {
      const chord = chordProgression[currentChord];

      // Add bass notes (octave lower) with rhythmic pattern
      const bass = chord[0] / 2;
      const bassOsc = ctx.createOscillator();
      bassOsc.type = "sawtooth";
      bassOsc.frequency.value = bass;

      const bassGain = ctx.createGain();
      // Create punchy bass with envelope
      bassGain.gain.setValueAtTime(0, time);
      bassGain.gain.linearRampToValueAtTime(0.12, time + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

      bassOsc.connect(bassGain);
      bassGain.connect(masterGain);
      bassOsc.start(time);
      bassOsc.stop(time + 0.4);

      presentationOscillatorsRef.current.push(bassOsc);

      // Add rhythmic bass hits (4 hits per chord)
      for (let i = 1; i < 4; i++) {
        const hitTime = time + (i * CHORD_DURATION) / 4;
        const hitOsc = ctx.createOscillator();
        hitOsc.type = "sawtooth";
        hitOsc.frequency.value = bass;

        const hitGain = ctx.createGain();
        hitGain.gain.setValueAtTime(0, hitTime);
        hitGain.gain.linearRampToValueAtTime(0.08, hitTime + 0.02);
        hitGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.25);

        hitOsc.connect(hitGain);
        hitGain.connect(masterGain);
        hitOsc.start(hitTime);
        hitOsc.stop(hitTime + 0.25);

        presentationOscillatorsRef.current.push(hitOsc);
      }

      // Main chord with brighter sound
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle"; // Brighter than sine
        osc.frequency.value = freq;

        // Faster vibrato for energy
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 1.5; // Faster vibrato
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 2;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(time);

        const noteGain = ctx.createGain();
        noteGain.gain.value = 0.12 / chord.length;

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(time);
        osc.stop(time + CHORD_DURATION - 0.05);

        presentationOscillatorsRef.current.push(osc);
        presentationOscillatorsRef.current.push(lfo);
      });

      // Energetic melody with fast arpeggios (16th notes)
      const melodies = [
        [329.63, 392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 392.0], // Em fast arp
        [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25, 392.0], // C fast arp
        [587.33, 739.99, 880.0, 1174.66, 880.0, 739.99, 587.33, 440.0], // G fast arp
        [739.99, 880.0, 1108.73, 1479.98, 1108.73, 880.0, 739.99, 554.37], // D fast arp
      ];

      const currentMelody = melodies[currentChord];
      currentMelody.forEach((freq, idx) => {
        const noteTime = time + (idx * CHORD_DURATION) / currentMelody.length;
        const melodyOsc = ctx.createOscillator();
        melodyOsc.type = "sawtooth"; // More aggressive than square
        melodyOsc.frequency.value = freq;

        const melodyGain = ctx.createGain();
        melodyGain.gain.setValueAtTime(0, noteTime);
        melodyGain.gain.linearRampToValueAtTime(0.08, noteTime + 0.02);
        melodyGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);

        melodyOsc.connect(melodyGain);
        melodyGain.connect(masterGain);
        melodyOsc.start(noteTime);
        melodyOsc.stop(noteTime + 0.2);

        presentationOscillatorsRef.current.push(melodyOsc);
      });

      // Add driving rhythm (Kick, Hi-hats and Snare)
      for (let i = 0; i < 8; i++) {
        const noteTime = time + (i * CHORD_DURATION) / 8;

        // Kick Drum (Four-on-the-floor: beats 1, 3, 5, 7 -> indices 0, 2, 4, 6)
        if (i % 2 === 0) {
          const kickOsc = ctx.createOscillator();
          kickOsc.type = "sine";
          kickOsc.frequency.setValueAtTime(150, noteTime);
          kickOsc.frequency.exponentialRampToValueAtTime(0.01, noteTime + 0.5);

          const kickGain = ctx.createGain();
          kickGain.gain.setValueAtTime(1, noteTime);
          kickGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.5);

          kickOsc.connect(kickGain);
          kickGain.connect(masterGain);
          kickOsc.start(noteTime);
          kickOsc.stop(noteTime + 0.5);

          presentationOscillatorsRef.current.push(kickOsc);
        }

        // Hi-hat (every 8th note)
        const hatOsc = ctx.createOscillator();
        hatOsc.type = "square";
        hatOsc.frequency.value = i % 2 === 0 ? 8000 : 12000; // Vary pitch

        const hatGain = ctx.createGain();
        hatGain.gain.setValueAtTime(0, noteTime);
        hatGain.gain.linearRampToValueAtTime(0.02, noteTime + 0.005);
        hatGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.05);

        hatOsc.connect(hatGain);
        hatGain.connect(masterGain);
        hatOsc.start(noteTime);
        hatOsc.stop(noteTime + 0.05);

        presentationOscillatorsRef.current.push(hatOsc);

        // Snare (on beats 2 and 4 -> indices 2 and 6)
        if (i === 2 || i === 6) {
          const snareOsc = ctx.createOscillator();
          snareOsc.type = "triangle";
          snareOsc.frequency.value = 150; // Low punch

          const snareNoise = ctx.createOscillator(); // Use high freq for noise-like
          snareNoise.type = "sawtooth";
          snareNoise.frequency.value = 2000;

          const snareGain = ctx.createGain();
          snareGain.gain.setValueAtTime(0, noteTime);
          snareGain.gain.linearRampToValueAtTime(0.1, noteTime + 0.005);
          snareGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.1);

          snareOsc.connect(snareGain);
          snareNoise.connect(snareGain);
          snareGain.connect(masterGain);

          snareOsc.start(noteTime);
          snareOsc.stop(noteTime + 0.1);
          snareNoise.start(noteTime);
          snareNoise.stop(noteTime + 0.1);

          presentationOscillatorsRef.current.push(snareOsc);
          presentationOscillatorsRef.current.push(snareNoise);
        }
      }

      currentChord = (currentChord + 1) % chordProgression.length;
    };

    // Schedule chord progression
    const scheduleChords = () => {
      const scheduleAhead = 2; // Schedule 2 chords ahead
      for (let i = 0; i < scheduleAhead; i++) {
        playChord(ctx.currentTime + i * CHORD_DURATION);
      }
    };

    scheduleChords();

    // Keep scheduling new chords
    const scheduleInterval = setInterval(() => {
      if (ctx.state === "running") {
        playChord(ctx.currentTime + CHORD_DURATION);
      }
    }, CHORD_DURATION * 1000);

    oscillatorsRef.current.push({ type: "interval", id: scheduleInterval });
  };

  // Handle Mute Toggle
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    // If we have a music URL, use the audio element
    if (audioElementRef.current) {
      if (newMuted) {
        audioElementRef.current.pause();
      } else {
        audioElementRef.current.play().catch((err) => {
          console.warn("[Audio] Could not play music:", err);
        });
      }
      return;
    }

    // Fallback to generated music
    if (!audioContextRef.current) {
      initAudio();
    }

    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      audioContextRef.current.resume();
    }

    if (gainNodeRef.current) {
      // Smooth transition
      const now = audioContextRef.current.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(now);
      gainNodeRef.current.gain.setTargetAtTime(newMuted ? 0 : 0.2, now, 0.5);
    }
  };

  // Set music URL from quiz data
  const setQuizMusic = (url) => {
    if (!url) return;

    setMusicUrl(url);

    // Create or update audio element
    if (!audioElementRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0.3;
      audioElementRef.current = audio;
    }

    // Only update src if it's different to avoid reloading
    if (audioElementRef.current.src !== url) {
      audioElementRef.current.src = url;
    }

    // Always try to play if not muted
    if (!isMuted) {
      const playPromise = audioElementRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[Audio] Could not auto-play music:", err);
          // Auto-play policy might block this.
          // We can try to resume AudioContext if we were using it, but here we use HTML5 Audio.
        });
      }
    }

    console.log("[Audio] Music URL set:", url);
  };

  // Cleanup on unmount
  useEffect(() => {
    const oscillators = oscillatorsRef.current;
    const audioContext = audioContextRef.current;
    const audioElement = audioElementRef.current;

    return () => {
      // Clear any intervals
      oscillators.forEach((item) => {
        if (item && item.type === "interval") {
          clearInterval(item.id);
        }
      });

      if (audioContext) {
        audioContext.close();
      }

      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
      }
    };
  }, []);

  const value = {
    isMuted,
    toggleMute,
    setQuizMusic,
    musicUrl,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}
