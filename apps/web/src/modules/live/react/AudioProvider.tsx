/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type AudioContextValue = {
  isMuted: boolean;
  musicUrl: string;
  toggleMute: () => void;
  setQuizMusic: (url: string) => void;
};

const AudioContext = createContext<AudioContextValue | null>(null);

export function useAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) {
    throw new Error("useAudio must be used within AudioProvider");
  }
  return value;
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);
  const [musicUrl, setMusicUrl] = useState("");
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const setQuizMusic = useCallback((url: string) => {
    const normalized = String(url || "").trim();
    setMusicUrl(normalized);

    if (!normalized) {
      const current = audioElementRef.current;
      if (current) {
        current.pause();
        current.removeAttribute("src");
        current.load();
        audioElementRef.current = null;
      }
      return;
    }

    let audio = audioElementRef.current;
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.volume = 0.3;
      audioElementRef.current = audio;
    }

    if (audio.src !== normalized) {
      audio.src = normalized;
    }

    if (isMuted) {
      audio.pause();
      return;
    }

    void audio.play().catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.info(
          "[Audio] Playback awaits a user gesture or a playable source.",
          error,
        );
      }
    });
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      const audio = audioElementRef.current;
      if (audio) {
        if (next) {
          audio.pause();
        } else {
          void audio.play().catch((error: unknown) => {
            if (import.meta.env.DEV) {
              console.info(
                "[Audio] Playback awaits a user gesture or a playable source.",
                error,
              );
            }
          });
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      const audio = audioElementRef.current;
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioElementRef.current = null;
    };
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({
      isMuted,
      musicUrl,
      toggleMute,
      setQuizMusic,
    }),
    [isMuted, musicUrl, setQuizMusic, toggleMute],
  );

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}
