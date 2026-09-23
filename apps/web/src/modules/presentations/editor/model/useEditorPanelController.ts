import { useCallback, useMemo, useState } from "react";

export type EditorPanelTab = "slides" | "content" | "design" | "audio";
type DirtyPanel = Exclude<EditorPanelTab, "slides">;

export type EditorConfirmDialog = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
};

type PendingAction = (() => void) | null;

type UseEditorPanelControllerOptions = {
  dirty: Record<DirtyPanel, boolean>;
  discard: Record<DirtyPanel, () => void>;
};

const CLOSED_CONFIRM: EditorConfirmDialog = {
  isOpen: false,
  title: "",
  description: "",
  confirmText: "",
  cancelText: "",
};

const panelForTab = (tab: EditorPanelTab): DirtyPanel | null =>
  tab === "slides" ? null : tab;

export function useEditorPanelController({
  dirty,
  discard,
}: UseEditorPanelControllerOptions) {
  const [activeTab, setActiveTab] = useState<EditorPanelTab | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<EditorConfirmDialog>(CLOSED_CONFIRM);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const showSlidesPanel = activeTab === "slides";
  const showSidebar = activeTab === "content";
  const showDesignPanel = activeTab === "design";
  const showAudioPanel = activeTab === "audio";

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(CLOSED_CONFIRM);
    setPendingAction(null);
  }, []);

  const requestConfirmation = useCallback((
    action: () => void,
    options?: Partial<Omit<EditorConfirmDialog, "isOpen">>,
  ) => {
    setPendingAction(() => action);
    setConfirmDialog({
      isOpen: true,
      title: options?.title ?? "تغییرات ذخیره‌نشده",
      description:
        options?.description ??
        "تغییرات ذخیره‌نشده‌ای دارید. آن‌ها را کنار بگذارید؟",
      confirmText: options?.confirmText ?? "رد تغییرات",
      cancelText: options?.cancelText ?? "ادامه ویرایش",
    });
  }, []);

  const confirmPendingAction = useCallback(() => {
    const action = pendingAction;
    closeConfirmDialog();
    action?.();
  }, [closeConfirmDialog, pendingAction]);

  const activateTab = useCallback((tab: EditorPanelTab | null) => {
    setActiveTab(tab);
  }, []);

  const closePanel = useCallback((tab: EditorPanelTab) => {
    setActiveTab((current) => current === tab ? null : current);
  }, []);

  const toggleTab = useCallback((tab: EditorPanelTab) => {
    const current = activeTab;
    const currentDirtyPanel = current ? panelForTab(current) : null;
    const leavingDirtyPanel =
      currentDirtyPanel !== null && dirty[currentDirtyPanel];

    const apply = () => {
      if (currentDirtyPanel && dirty[currentDirtyPanel]) {
        discard[currentDirtyPanel]();
      }
      setActiveTab(current === tab ? null : tab);
    };

    if (leavingDirtyPanel) {
      requestConfirmation(apply);
      return;
    }

    apply();
  }, [activeTab, dirty, discard, requestConfirmation]);

  const overlayOpen = useMemo(
    () => Boolean(activeTab),
    [activeTab],
  );

  return {
    activeTab,
    showSlidesPanel,
    showSidebar,
    showDesignPanel,
    showAudioPanel,
    overlayOpen,
    confirmDialog,
    activateTab,
    toggleTab,
    closePanel,
    requestConfirmation,
    confirmPendingAction,
    closeConfirmDialog,
  };
}
