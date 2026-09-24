import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { identityApi } from "../api/identityApi.ts";
import {
  currentSessionQuery,
  identityKeys,
} from "../api/sessionQuery.ts";
import { clearIdentityCompatibilityStorage } from "../model/authStorage.ts";

type ManagerAccountMenuProps = {
  compact?: boolean;
  onBeforeOpen?: () => void;
};

export function ManagerAccountMenu({
  compact = false,
  onBeforeOpen,
}: ManagerAccountMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(currentSessionQuery());
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const displayName =
    user?.display_name?.trim() || user?.email?.trim() || "شما";
  const initial = Array.from(displayName.trim())[0] || "ش";

  useEffect(() => {
    if (!open) return;

    const closeFromPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const closeFromEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };

    document.addEventListener("pointerdown", closeFromPointer);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  const toggleMenu = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        onBeforeOpen?.();
        requestAnimationFrame(() => {
          menuRef.current
            ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
            ?.focus();
        });
      }
      return next;
    });
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : items.length - 1;
      items[index]?.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        currentIndex < 0
          ? direction > 0
            ? 0
            : items.length - 1
          : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await identityApi.logout();
    } catch (error) {
      console.warn("Logout request failed; clearing local session cache.", error);
    } finally {
      setOpen(false);
      queryClient.removeQueries({ queryKey: identityKeys.session() });
      clearIdentityCompatibilityStorage();
      navigate("/auth", { replace: true });
      setLoggingOut(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        className={`flex cursor-pointer items-center justify-center rounded-full bg-brand font-semibold text-content-inverse transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          compact ? "h-9 w-9 text-sm" : "h-10 w-10"
        }`}
        aria-label={`حساب کاربری ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={displayName}
      >
        {initial.toLocaleUpperCase("fa-IR")}
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute end-0 top-full z-[70] mt-2 w-52 overflow-hidden rounded-xl border border-border-subtle bg-surface-raised py-1 text-sm shadow-panel"
        >
          <div className="border-b border-border-subtle px-4 py-3">
            <p className="truncate font-semibold text-content" dir="auto">
              {displayName}
            </p>
            {user?.email ? (
              <bdi className="mt-1 block truncate text-xs text-content-muted" dir="ltr">
                {user.email}
              </bdi>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-start text-content-muted transition-colors hover:bg-canvas hover:text-content focus:bg-canvas focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            {loggingOut ? "در حال خروج…" : "خروج از حساب"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
