import {
  FileText,
  LayoutList,
  Paintbrush,
  Volume2,
  type LucideIcon,
} from "lucide-react";

import type { EditorPanelTab } from "../model/useEditorPanelController.ts";

type ToolbarItem = {
  id: EditorPanelTab;
  label: string;
  icon: LucideIcon;
  mobileOnly?: boolean;
};

type EditorToolbarProps = {
  activeTab: EditorPanelTab | null;
  setActiveTab: (tab: EditorPanelTab) => void;
  isCompact?: boolean;
};

const items: ToolbarItem[] = [
  {
    id: "slides",
    label: "اسلایدها",
    icon: LayoutList,
    mobileOnly: true,
  },
  { id: "content", label: "محتوا", icon: FileText },
  { id: "design", label: "طراحی", icon: Paintbrush },
  { id: "audio", label: "صدا", icon: Volume2 },
];

export default function RightToolbar({
  activeTab,
  setActiveTab,
  isCompact = false,
}: EditorToolbarProps) {
  const containerClass = isCompact
    ? "fixed inset-x-0 bottom-0 z-40 flex h-16 w-full flex-row items-center justify-around gap-2 border-t border-brand-border bg-surface px-2 py-2 shadow-panel"
    : "flex h-full w-20 flex-col items-center gap-2 border-e border-brand-border bg-surface py-4 shadow-sm";

  return (
    <div
      className={containerClass}
      style={
        isCompact
          ? {
              paddingBottom:
                "calc(0.5rem + env(safe-area-inset-bottom))",
            }
          : undefined
      }
      aria-label="ابزارهای ویرایشگر"
      dir="rtl"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const visibilityClass =
          item.mobileOnly && !isCompact ? "hidden" : "";

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-control px-2 transition-all ${
              isActive
                ? "bg-brand-muted text-brand-strong"
                : "text-content-muted hover:bg-brand-soft hover:text-brand"
            } ${visibilityClass}`}
            aria-pressed={isActive}
            aria-label={item.label}
          >
            <Icon size={22} strokeWidth={2} aria-hidden="true" />
            <span className="text-[10px] font-medium">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
