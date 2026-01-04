import WebSocket from "ws";
import https from "https";

const ACCESS_CODE = "IUSTCS";
const BOT_COUNT = 100;
const API_BASE = "https://api.proslides.ir/api";
const WS_BASE = "wss://present.proslides.ir/ws";

// Helper to fetch API
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  console.log(`Resolving access code: ${ACCESS_CODE}...`);
  try {
    const data = await fetchJson(
      `${API_BASE}/quizzes/resolve-access-code/?access_code=${ACCESS_CODE}`
    );

    if (!data.quiz_id) {
      console.error("Invalid access code or no quiz_id returned.");
      return;
    }

    const quizId = data.quiz_id;
    console.log(`Quiz ID: ${quizId}`);
    console.log(`Starting ${BOT_COUNT} bots...`);

    for (let i = 0; i < BOT_COUNT; i++) {
      startBot(i + 1, quizId);
      // Stagger starts slightly
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (err) {
    console.error("Error resolving access code:", err);
  }
}

function startBot(id, quizId) {
  const wsUrl = `${WS_BASE}/${quizId}/player`;
  const ws = new WebSocket(wsUrl);

  const botName = `Bot_${id}_${Math.floor(Math.random() * 1000)}`;
  const botChar = ["🤖", "👾", "👽", "👻", "🤡"][Math.floor(Math.random() * 5)];

  let userId = null;
  let currentQuestion = null;

  ws.on("open", () => {
    console.log(`[${botName}] Connected.`);

    // Send Join Message
    const joinMsg = {
      type: 6,
      name: botName,
      character: botChar,
    };
    ws.send(JSON.stringify(joinMsg));

    // Start Heartbeat
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 5000); // Send ping every 5 seconds
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(
        ws,
        msg,
        botName,
        (uid) => (userId = uid),
        () => userId
      );
    } catch (e) {
      console.error(`[${botName}] Error parsing message:`, e);
    }
  });

  ws.on("close", () => {
    console.log(`[${botName}] Disconnected.`);
  });

  ws.on("error", (err) => {
    console.error(`[${botName}] Error:`, err.message);
  });
}

function handleMessage(ws, msg, botName, setUserId, getUserId) {
  // Type 10: Registration Success
  if (msg.type === 10) {
    console.log(`[${botName}] Registered with User ID: ${msg.user_id}`);
    setUserId(msg.user_id);
  }

  // Type 2: New Question
  if (msg.type === 2) {
    console.log(
      `[${botName}] Received Question: "${msg.question_text}" (ID: ${msg.question_id})`
    );

    const questionTime = msg.question_time || 10;
    const options = msg.options || [];

    if (options.length === 0) {
      console.log(`[${botName}] No options found for question.`);
      return;
    }

    // Simulate thinking time (random between 1s and questionTime - 1s)
    const thinkTime = Math.max(
      1000,
      Math.random() * (questionTime * 1000 * 0.8)
    );

    setTimeout(() => {
      submitAnswer(ws, msg, options, getUserId(), botName, thinkTime / 1000);
    }, thinkTime);
  }
}

function submitAnswer(ws, question, options, userId, botName, elapsedSeconds) {
  if (!userId) {
    console.warn(`[${botName}] Cannot submit: No User ID.`);
    return;
  }

  // Pick a random option
  const randomOptionIndex = Math.floor(Math.random() * options.length);
  const selectedOption = options[randomOptionIndex];

  // Construct options_result
  const optionsResult = options.map((opt) => ({
    option_id: opt.option_id,
    picked: opt.option_id === selectedOption.option_id,
  }));

  const submitMsg = {
    type: 4,
    question_id: question.question_id,
    user_id: userId,
    submit_time: Math.round(elapsedSeconds * 1000) / 1000,
    options_result: optionsResult,
  };

  console.log(
    `[${botName}] Submitting answer: Option ${selectedOption.option_text} (ID: ${selectedOption.option_id})`
  );
  ws.send(JSON.stringify(submitMsg));
}

main();
