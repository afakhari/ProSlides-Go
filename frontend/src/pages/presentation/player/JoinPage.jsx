import { useState, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useServerData } from "../../../hooks/useServerData";

export default function PlayerJoinPage({ roomId, quiz }) {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🧙");
  const [showPicker, setShowPicker] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinSent, setJoinSent] = useState(false);
  const { connect, sendMessage, isConnected, lastMessage } = useWebSocket();
  const { processMessage } = useServerData();

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
    // Connect to WebSocket for players and attempt to send join message
    try {
      if (!roomId) {
        console.error("Missing roomId for WebSocket connection");
        return;
      }
      connect(roomId);
    } catch (err) {
      console.error("Failed to connect WebSocket:", err);
    }
    // navigate("/game", { state: newPlayer });
    //navigate("/", { state: newPlayer });
  };
  // console.log(inp);

  // When joined and connection is ready, send join message once
  useEffect(() => {
    if (!joined) return;
    if (!isConnected) return;
    if (joinSent) return;

    const msg = {
      type: 6,
      name: name,
      character: avatar,
    };

    const ok = sendMessage(msg);
    if (ok) setJoinSent(true);
    else console.warn("Join message could not be sent - socket not open yet");
  }, [joined, isConnected, joinSent, name, avatar, sendMessage]);

  // Listen for registration response (type 10) and save user_id to localStorage
  useEffect(() => {
    if (!lastMessage) return;

    // Process message through ServerDataContext
    processMessage(lastMessage);

    // Type 10: Registration confirmation from server
    if (lastMessage.type === 10) {
      console.log("[PlayerJoinPage] Registration successful:", lastMessage);
      localStorage.setItem("user_id", lastMessage.user_id);
      localStorage.setItem("player_name", lastMessage.name);
      localStorage.setItem("character", lastMessage.character);
      console.log(
        "[PlayerJoinPage] Saved user_id to localStorage:",
        lastMessage.user_id
      );
    }
  }, [lastMessage, processMessage]);

  // Calculate dynamic background style from quiz data
  const backgroundStyle = {
    backgroundImage: quiz?.background?.image
      ? `url('${quiz.background.image}')`
      : "none",
    backgroundColor: quiz?.background?.color || "#1e1e2e",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  // Stay on "Get ready to play!" until server sends next command (no auto-exit)
  return !joined ? (
    <div className="min-h-screen w-full" style={backgroundStyle}>
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
    <div className="min-h-screen w-full" style={backgroundStyle}>
      <header>
        <div className="flex items-center justify-center text-white px-6 py-7 rounded-t-xl">
          <div className="shrink-0">
            <p className="text-3xl">Proslides</p>
          </div>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center h-full">
        <div className="flex items-center space-x-4 px-6 py-3 rounded-2xl m-4">
          <span className="text-5xl">{players[players.length - 1].avatar}</span>
          <span className="text-2xl font-semibold">
            {players[players.length - 1].name}
          </span>
        </div>
        <br />
        <br />

        <h4 className="text-3xl text-center text-white mb-6 m-8">
          Get ready to play!
        </h4>

        <h3 className="text-white mb-6">the quiz will start soon.</h3>

        {/* <button
          className="mt-6 bg-purple-700 text-white px-8 py-3 rounded-lg hover:bg-purple-800 transition"
          onClick={() => console.log(players)}
        >
          start Game
        </button> */}
      </div>
    </div>
  );
}
