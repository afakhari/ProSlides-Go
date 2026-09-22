import type { CSSProperties } from "react";

export interface PresentationThemeInput {
  title?: string;
  background?: {
    color?: string;
    image?: string;
    text_color?: string;
  };
  text_color?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

const luminance = (hex: string) => {
  const channels = [1, 3, 5]
    .map(
      (start) =>
        Number.parseInt(hex.slice(start, start + 2), 16) / 255,
    )
    .map((value) =>
      value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    );

  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  );
};

const contrast = (first: string, second: string) => {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
};

export const presentationTheme = (
  input?: PresentationThemeInput,
) => {
  const background = HEX.test(input?.background?.color ?? "")
    ? input!.background!.color!
    : "#312e81";

  const requestedForeground = HEX.test(
    input?.text_color ?? input?.background?.text_color ?? "",
  )
    ? (input?.text_color ?? input?.background?.text_color)!
    : "#ffffff";

  const foreground =
    contrast(background, requestedForeground) >= 4.5
      ? requestedForeground
      : contrast(background, "#ffffff") >= contrast(background, "#0f172a")
        ? "#ffffff"
        : "#0f172a";

  const image = input?.background?.image?.trim() ?? "";

  return {
    background,
    foreground,
    image,
    style: {
      "--live-bg": background,
      "--live-fg": foreground,
      "--live-muted": `color-mix(in srgb, ${foreground} 72%, transparent)`,
      "--live-border": `color-mix(in srgb, ${foreground} 20%, transparent)`,
      "--live-surface": `color-mix(in srgb, ${background} 72%, rgba(0,0,0,.28))`,
      "--live-accent": `color-mix(in srgb, ${foreground} 18%, ${background})`,
      backgroundColor: background,
      backgroundImage: image
        ? `linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.42)), url(${JSON.stringify(image)})`
        : `radial-gradient(circle at 15% 10%, color-mix(in srgb, ${foreground} 14%, transparent), transparent 32%), linear-gradient(145deg, ${background}, color-mix(in srgb, ${background} 72%, #000))`,
    } as CSSProperties,
  };
};
