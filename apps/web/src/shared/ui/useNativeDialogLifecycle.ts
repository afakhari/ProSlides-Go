import {
  useCallback,
  useEffect,
  useRef,
  type SyntheticEvent,
} from "react";

type NativeDialogLifecycleOptions = {
  open: boolean;
  onRequestClose: () => void;
};

export function useNativeDialogLifecycle({
  open,
  onRequestClose,
}: NativeDialogLifecycleOptions) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        const activeElement = document.activeElement;
        returnFocusRef.current =
          activeElement instanceof HTMLElement ? activeElement : null;
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onRequestClose();
    },
    [onRequestClose],
  );

  const handleClose = useCallback(() => {
    if (open) {
      onRequestClose();
    }

    const returnTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnTarget?.isConnected) {
      window.requestAnimationFrame(() => returnTarget.focus());
    }
  }, [onRequestClose, open]);

  return {
    dialogRef,
    handleCancel,
    handleClose,
  };
}
