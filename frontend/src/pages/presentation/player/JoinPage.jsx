import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";

export default function PlayerJoinPage(inp) {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🧙");
  const [showPicker, setShowPicker] = useState(false);
  const [joined, setJoined] = useState(false);

  // const navigate = useNavigate();

  // Loading from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("players");
      if (stored) setPlayers(JSON.parse(stored));
      else setPlayers([]);
    } catch (err) {
      console.error("Error reading players:", err);
      setPlayers([]);
    }
  }, []);

  // Adding new player
  const savePlayer = () => {
    if (!name.trim()) return alert("Please enter your name!");

    const newPlayer = {
      id: players.length + 1,
      name,
      avatar,
    };

    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    localStorage.setItem("players", JSON.stringify(updatedPlayers));
    setJoined(true);
    // navigate("/game", { state: newPlayer });
    //navigate("/", { state: newPlayer });
  };
  console.log(inp);
  return !joined ? (

    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/src/assets/bg.jpg')" }}
    >
      <div className="flex flex-col items-center justify-center">
        <header>
          <div className="flex items-center justify-center text-white px-6 py-7 rounded-t-xl placeholder-gray-500">
            <div className="shrink-0">
              <p className="text-3xl">Proslides</p>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center mt-7 justify-around w-4/5 max-w-2xl">
          {/* Set name */}
          <div className="w-full">
            <h1 className="text-white text-left text-2xl font-extrabold">
              Enter your name
            </h1>
          </div>
          <input
            className="bg-white px-4 py-2 w-full rounded text-center text-lg font-bold placeholder-gray-400"
            // placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Choosing Avatar */}
          <div className="mt-12 w-full">
            <h1 className="text-white text-left text-2xl font-extrabold">
              Choose an avatar
            </h1>
          </div>
          <div className="flex flex-col items-center relative">
            <div className="text-9xl mb-2">{avatar}</div>
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="text-white font-medium underline hover:text-purple-900 text-2xl"
            >
              Change Avatar
            </button>

            {/* Emoji Picker */}
            {showPicker && (
              <div className="absolute mt-4 z-10">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setAvatar(emojiData.emoji);
                    setShowPicker(false);
                  }}
                  theme="light"
                  searchDisabled={false}
                  width={300}
                  height={400}
                />
              </div>
            )}
          </div>

          {/*Join Button */}
          <button
            onClick={savePlayer}
            className="mt-12 bg-purple-700 w-full text-white px-10 py-3 rounded-lg hover:bg-purple-800 transition"
          >
            Join the game!
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/src/assets/bg.jpg')" }}
    >
      <header>
        <div className="flex items-center justify-center text-white px-6 py-7 rounded-t-xl">
          <div className="shrink-0">
            <p className="text-3xl">Proslides</p>
          </div>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center h-full">
        <div className="flex items-center space-x-4 px-6 py-3 rounded-2xl m-4">
          <span className="text-5xl">{players[0].avatar}</span>
          <span className="text-2xl font-semibold">{players[0].name}</span>
        </div>
        <br />
        <br />

        <h4 className="text-5xl text-white mb-6 m-8">Get ready to play!</h4>

        <h3 className="text-white mb-6">the question will start soon.</h3>

        <button
          className="mt-6 bg-purple-700 text-white px-8 py-3 rounded-lg hover:bg-purple-800 transition"
          onClick={console.log(players)}
        >
          start Game
        </button>
      </div>
    </div>
  );
}
