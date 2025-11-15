import { Button } from "../../../components/ui/button";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <Button
        className="text-lg px-6 py-3"
        onClick={() => navigate("/editor")}
      >
        New Presentation
      </Button>
    </div>
  );
}