import { Bot, Brain, Grid2X2, Home, Settings } from "lucide-react";
import type { AppSection } from "@/organism/store";
import { cn } from "@/lib/utils";

const items: Array<{ id: AppSection; label: string; icon: typeof Home }> = [
  { id: "home", label: "Главная", icon: Home },
  { id: "avatar", label: "Аватар", icon: Bot },
  { id: "memory", label: "Память", icon: Brain },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "more", label: "Ещё", icon: Grid2X2 },
];

export function AppNavigation({ active, onSelect }: { active: AppSection; onSelect: (section: AppSection) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(0,0,0,0.24)] backdrop-blur-xl" aria-label="Основная навигация">
      <div className="mx-auto grid max-w-4xl grid-cols-5">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={active === id ? "page" : undefined}
            aria-pressed={active === id}
            onClick={() => onSelect(id)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
              active === id ? "text-accent" : "text-muted hover:text-fg",
            )}
          >
            <span className={cn("flex size-8 items-center justify-center rounded-xl", active === id && "bg-accent/15 shadow-[0_0_18px_color-mix(in_srgb,var(--color-accent)_28%,transparent)]")}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
