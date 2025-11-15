import React, { useState } from "react";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { createUserAnswer } from "../../../data/mockData";

export default function PlayerWSTest() {
  const { connect, disconnect, sendMessage, isConnected, lastMessage } =
    useWebSocket();

  const [sessionId, setSessionId] = useState("1");
  const [name, setName] = useState("TestPlayer");
  const [avatar, setAvatar] = useState("🙂");
  const [custom, setCustom] = useState("");
  const [questionId, setQuestionId] = useState(45);

  const sendJoin = () => {
    const msg = { type: 13, name: name, character: avatar };
    const ok = sendMessage(msg);
    console.log("Sent join:", msg, "ok:", ok);
  };

  const sendCustom = () => {
    try {
      const parsed = JSON.parse(custom);
      const ok = sendMessage(parsed);
      console.log("Sent custom:", parsed, "ok:", ok);
    } catch (e) {
      console.warn("Invalid JSON in custom message");
    }
  };

  const sendAnswer = () => {
    const ans = createUserAnswer(questionId, [47], 5);
    const ok = sendMessage(ans);
    console.log("Sent answer:", ans, "ok:", ok);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h2 className="text-2xl font-bold mb-4">Player WebSocket Test</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <div className="p-4 bg-gray-800 rounded">
          <label className="block text-sm text-gray-300">Session ID</label>
          <input
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="session id"
          />

          <div className="mt-3 flex gap-2">
            <button
              className="px-3 py-2 bg-green-600 rounded"
              onClick={() => connect(sessionId)}
            >
              Connect
            </button>
            <button
              className="px-3 py-2 bg-red-600 rounded"
              onClick={() => disconnect()}
            >
              Disconnect
            </button>
          </div>

          <div className="mt-3 text-sm">
            Status:{" "}
            {isConnected ? (
              <span className="text-green-400">Connected</span>
            ) : (
              <span className="text-red-400">Disconnected</span>
            )}
          </div>

          <hr className="my-3 border-gray-700" />

          <label className="block text-sm text-gray-300">Name</label>
          <input
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="block text-sm text-gray-300 mt-2">Avatar</label>
          <input
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          />

          <div className="mt-3 flex gap-2">
            <button
              className="px-3 py-2 bg-blue-600 rounded"
              onClick={sendJoin}
            >
              Send Join (type:13)
            </button>
            <button
              className="px-3 py-2 bg-purple-600 rounded"
              onClick={sendAnswer}
            >
              Send Answer (type:4)
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-800 rounded">
          <label className="block text-sm text-gray-300">Custom JSON</label>
          <textarea
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white h-32"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder='e.g. { "type": 99, "hello": "world" }'
          />
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-2 bg-indigo-600 rounded"
              onClick={sendCustom}
            >
              Send Custom
            </button>
          </div>

          <hr className="my-3 border-gray-700" />

          <div className="text-sm">
            <div className="font-semibold">Last Message:</div>
            <pre className="mt-2 bg-gray-700 p-2 rounded text-xs max-h-60 overflow-auto">
              {lastMessage ? JSON.stringify(lastMessage, null, 2) : "(none)"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
