import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { LoaderCircle } from "lucide-react";

import { Button } from "./Button.tsx";

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "default" | "destructive";
  isLoading?: boolean;
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description = "",
  confirmText = "تأیید",
  cancelText = "انصراف",
  confirmVariant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onClose();
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-content/35 backdrop-blur-[2px]" />
        <AlertDialogPrimitive.Content
          dir="rtl"
          className="fixed left-1/2 top-1/2 z-50 w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-border-subtle bg-surface-raised p-6 text-content shadow-panel outline-none"
          onEscapeKeyDown={(event) => {
            if (isLoading) event.preventDefault();
          }}
        >
          <AlertDialogPrimitive.Title className="text-lg font-semibold leading-7">
            {title}
          </AlertDialogPrimitive.Title>
          {description ? (
            <AlertDialogPrimitive.Description className="mt-2 text-sm leading-6 text-content-muted">
              {description}
            </AlertDialogPrimitive.Description>
          ) : (
            <AlertDialogPrimitive.Description className="sr-only">
              این عملیات نیاز به تأیید دارد.
            </AlertDialogPrimitive.Description>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button
                variant="outline"
                disabled={isLoading}
                className="sm:min-w-24"
              >
                {cancelText}
              </Button>
            </AlertDialogPrimitive.Cancel>

            <Button
              variant={confirmVariant}
              disabled={isLoading}
              className="sm:min-w-24"
              aria-busy={isLoading || undefined}
              onClick={() => void onConfirm()}
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  <span>در حال انجام…</span>
                </>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
