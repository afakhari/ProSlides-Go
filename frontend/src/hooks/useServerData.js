import { useContext } from "react";
import { ServerDataContext } from "../contexts/ServerDataContext";

export const useServerData = () => {
  const context = useContext(ServerDataContext);
  if (!context) {
    throw new Error("useServerData must be used within ServerDataProvider");
  }
  return context;
};
