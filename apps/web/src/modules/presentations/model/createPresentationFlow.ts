export interface CreationGate {
  current: boolean;
}

interface CreatedPresentation {
  id?: string;
}

interface CreationFlowOptions {
  gate: CreationGate;
  create: (title: string) => Promise<CreatedPresentation>;
  navigate: (presentationId: string) => void;
  title?: string;
}

export async function createPresentationOnce({
  gate,
  create,
  navigate,
  title = "ارائه بدون عنوان",
}: CreationFlowOptions): Promise<string | null> {
  if (gate.current) return null;

  gate.current = true;
  try {
    const presentation = await create(title);
    const presentationId = presentation.id?.trim();
    if (!presentationId) {
      throw new Error("presentation_id_missing");
    }
    navigate(presentationId);
    return presentationId;
  } finally {
    gate.current = false;
  }
}
