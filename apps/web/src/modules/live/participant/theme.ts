export interface ParticipantQuizTheme {
  title?: string;
  background?: { color?: string; image?: string; text_color?: string };
  text_color?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (first: string, second: string) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

export const participantTheme = (quiz?: ParticipantQuizTheme) => {
  const background = HEX.test(quiz?.background?.color ?? "")
    ? quiz!.background!.color!
    : "#312e81";
  const preferredForeground = HEX.test(quiz?.text_color ?? quiz?.background?.text_color ?? "")
    ? (quiz?.text_color ?? quiz?.background?.text_color)!
    : "#ffffff";
  const foreground = contrast(background, preferredForeground) >= 4.5
    ? preferredForeground
    : contrast(background, "#ffffff") >= contrast(background, "#0f172a") ? "#ffffff" : "#0f172a";

  return {
    background,
    foreground,
    image: quiz?.background?.image?.trim() ?? "",
    style: {
      "--live-bg": background,
      "--live-fg": foreground,
      "--live-muted": `color-mix(in srgb, ${foreground} 72%, transparent)`,
      "--live-border": `color-mix(in srgb, ${foreground} 20%, transparent)`,
      "--live-surface": `color-mix(in srgb, ${background} 72%, rgba(0,0,0,.28))`,
      "--live-accent": `color-mix(in srgb, ${foreground} 18%, ${background})`,
      backgroundColor: background,
      backgroundImage: quiz?.background?.image
        ? `linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.42)), url(${JSON.stringify(quiz.background.image)})`
        : `radial-gradient(circle at 15% 10%, color-mix(in srgb, ${foreground} 14%, transparent), transparent 32%), linear-gradient(145deg, ${background}, color-mix(in srgb, ${background} 72%, #000))`,
    } as CSSProperties,
  };
};
import type { CSSProperties } from "react";
