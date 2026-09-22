import { useContext } from "react";

import { DesignDraftContext } from "./designDraftContext.ts";

export const useOptionalDesignDraft = () =>
  useContext(DesignDraftContext);

export const useRequiredDesignDraft = () => {
  const controller = useContext(DesignDraftContext);
  if (!controller) {
    throw new Error(
      "Design draft context is required while editing presentation design.",
    );
  }
  return controller;
};
