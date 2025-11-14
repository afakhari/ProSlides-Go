/*
import { useLocation } from "react-router-dom";

export default function GamePage() {
  const { state } = useLocation();

  return (
    <div className="flex items-center justify-center h-screen bg-green-200">
      <h1 className="text-2xl font-bold">
        Welcome {state?.name}! You are player #{state?.id}
      </h1>
    </div>
  );
}
*/

export default function PlayerGamePage() {
  // const location = useLocation();
  // const navigate = useNavigate();
  const player = location.state; // Data from the Join page

  if (!player) {
    // If there were no players
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-pink-200">
        <p className="text-lg mb-4">
          No player found. Please join the game first.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-purple-700 text-white px-6 py-2 rounded-lg"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-pink-300">
      <h1 className="text-5xl font-bold text-white mb-6">ProSlides</h1>

      <div className="flex items-center space-x-4 bg-white px-6 py-3 rounded-2xl shadow-lg m-4">
        <span className="text-5xl">{player.avatar}</span>
        <span className="text-2xl font-semibold">{player.name}</span>
      </div>
      <br />
      <br />

      <h4 className="text-5xl text-white mb-6 m-8">Get ready to play!</h4>

      <h3 className="text-white mb-6">the question will start soon.</h3>

      <button className="mt-6 bg-purple-700 text-white px-8 py-3 rounded-lg hover:bg-purple-800 transition">

        start Game
      </button>
    </div>
  );
}
