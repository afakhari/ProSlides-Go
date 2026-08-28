//This component belongs to the toolbar on the right side of the Edit Quiz section(Panel)

import { FileText, Paintbrush, Volume2, LayoutList } from "lucide-react";


const items = [
    { id: "slides", label: "اسلایدها", icon: LayoutList, mobileOnly: true },
    { id: "content", label: "محتوا", icon: FileText },
    { id: "design", label: "طراحی", icon: Paintbrush },
    { id: "audio", label: "صدا", icon: Volume2 },
];


export default function RightToolbar({ activeTab, setActiveTab, isCompact = false }) {
    const containerClass = isCompact
        ? "fixed inset-x-0 bottom-0 z-40 flex h-16 w-full flex-row items-center justify-around gap-2 border-t border-violet-100 bg-white px-2 py-2 shadow-lg"
        : "flex h-full w-20 flex-col items-center gap-2 border-r border-violet-100 bg-white py-4 shadow-sm";
    return (
        <div
            className={containerClass}
            style={isCompact ? { paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" } : undefined}
            aria-label="ابزارهای ویرایشگر"
            dir="rtl"
        >

            {items.map((item, index) => {
                if (item === "divider") {
                    return (
                        <div
                            key={index}
                            className={isCompact ? "w-px h-8 bg-gray-300" : "w-8 h-px bg-gray-300 my-2"}
                        ></div>
                    );
                }

                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const visibilityClass = item.mobileOnly && !isCompact ? "hidden" : "";

                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-2 transition-all 
                            ${isActive ? "bg-violet-100 text-violet-800" : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"}
                            ${visibilityClass}`}
                        aria-pressed={isActive}
                    >
                        <Icon size={22} strokeWidth={2} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
