import EmojiPicker, { Theme } from "emoji-picker-react";

export function ParticipantAvatarPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  return (
    <EmojiPicker
      onEmojiClick={({ emoji }) => onSelect(emoji)}
      theme={Theme.DARK}
      width="100%"
      height={320}
      searchPlaceholder="جست‌وجوی ایموجی"
      previewConfig={{ showPreview: false }}
    />
  );
}
