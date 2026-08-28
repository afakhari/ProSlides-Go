import { useNavigate } from "react-router-dom";
import QuizManager from "../../../components/QuizManager";


// Rendering the "QuizManager" component, related to the home page of the site
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <QuizManager
      onNewPresentation={(roomId) =>
        navigate(`/manager/panel/${roomId}`, {
          state: { createdPresentation: true },
        })
      }
    />
  );
}
