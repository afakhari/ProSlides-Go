import { useContext } from "react";
import { ServerDataContext } from "./ServerDataContext";

export const useServerData = () => {
  const context = useContext(ServerDataContext);
  if (!context) {
    throw new Error("useServerData must be used within ServerDataProvider");
  }
  return context;
};
