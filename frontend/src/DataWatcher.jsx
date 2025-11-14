import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function DataWatcher({ data }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!data?.type) return;

    switch (data.type) {
      case "game":
        navigate("/game", { replace: false });
        break;
      case "join":
        navigate("/join", { replace: false });
        break;
      case "question":
        navigate("/question", { replace: false });
        break;
      case "leaderboard":
        navigate("/leaderboard", { replace: false });
        break;
      case "PollPage":
        navigate("/PollPage", { replace: false });
        break;
      default:
        navigate("/", { replace: false });
    }
  }, [data?.type]);

  return null;
}
