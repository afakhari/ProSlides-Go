# 🔌 WebSocket Integration Guide

## 📋 نحوه استفاده

### 1️⃣ ساختار فایل‌ها

```
frontend/src/
├── contexts/
│   └── WebSocketContext.jsx    # Context برای مدیریت WebSocket
├── hooks/
│   └── useWebSocket.js          # Hook برای استفاده در کامپوننت‌ها
└── App.jsx                       # Wrapped با WebSocketProvider
```

### 2️⃣ استفاده در کامپوننت‌ها

```jsx
import { useWebSocket } from "../../../hooks/useWebSocket";

function YourComponent() {
  const {
    isConnected, // وضعیت اتصال
    connect, // تابع اتصال
    disconnect, // تابع قطع اتصال
    sendMessage, // ارسال پیام عمومی
    sendNavigation, // ارسال دستور ناوبری
    lastMessage, // آخرین پیام دریافت شده
    sessionId, // شناسه جلسه فعلی
  } = useWebSocket();

  // اتصال به سرور
  const handleConnect = () => {
    connect("room1"); // room1 = session ID
  };

  // ارسال دستور next
  const handleNext = () => {
    sendNavigation("next");
  };

  // دریافت پیام‌ها
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 7) {
      // Player list updated
      console.log("Players:", lastMessage.users);
    }
  }, [lastMessage]);
}
```

### 3️⃣ پروتکل پیام‌ها

#### 📤 ارسالی (Manager → Server)

```javascript
// Type 9: Navigation Command
{
  type: 9,
  action: "next" | "previous"
}
```

#### 📥 دریافتی (Server → Manager)

```javascript
// Type 7: Player List Update
{
  type: 7,
  users: [
    {
      user_id: 1,
      name: "Ali",
      character: "👑"
    },
    // ...
  ]
}

// Type 2: New Question
{
  type: 2,
  question_id: 45,
  question_text: "سوال",
  options: [...],
  question_time: 10
}

// Type 8: Question Results (ACTUAL SERVER FORMAT)
{
  type: 8,
  question_id: 45,
  options: [
    { option_id: 58, number_of_submits: 0 },
    { option_id: 59, number_of_submits: 1 },
    { option_id: 60, number_of_submits: 5 },
    { option_id: 61, number_of_submits: 3 }
  ]
}

// Type 1: Leaderboard Results (ACTUAL SERVER FORMAT)
{
  type: 1,
  results: [
    {
      user_id: "8b6e39ab-4c6d-4255-a90a-41cb7ce7171b",
      name: "Ali",
      character: "❤️",
      color: "#db2777",
      rank: 1,
      total_points: 83.97,
      new_points: 83.97
    },
    {
      user_id: "957d350e-bc07-47c2-a997-d09256e91f9a",
      name: "Sima",
      character: "❤️",
      rank: 2,
      total_points: 0,
      new_points: 0
    }
  ]
}
```

### 4️⃣ تنظیمات

#### 🌐 آدرس سرور

در فایل `WebSocketContext.jsx`:

```javascript
// Production
const wsUrl = `ws://present.proslides.ir/ws/${sessionId}/manager`;

// Development (localhost)
const wsUrl = `ws://localhost:8080/ws/${sessionId}/manager`;
```

#### 🔄 Auto-Reconnect

WebSocket به صورت خودکار بعد از 3 ثانیه دوباره اتصال برقرار می‌کند.

### 5️⃣ نمونه کد کامل

```jsx
import { useEffect } from "react";
import { useWebSocket } from "../../../hooks/useWebSocket";

export default function ManagerPage() {
  const { isConnected, connect, sendNavigation, lastMessage } = useWebSocket();

  // Connect on mount
  useEffect(() => {
    connect("room1");
  }, [connect]);

  // Listen for messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 7: // Player list
        console.log("Players:", lastMessage.users);
        break;
      case 2: // New question
        console.log("Question:", lastMessage.question_text);
        break;
      case 8: // Results
        console.log("Results:", lastMessage.submit);
        break;
      default:
        console.log("Unknown message:", lastMessage);
    }
  }, [lastMessage]);

  return (
    <div>
      <div>Status: {isConnected ? "✅ Connected" : "❌ Disconnected"}</div>
      <button onClick={() => sendNavigation("next")}>Next</button>
      <button onClick={() => sendNavigation("previous")}>Previous</button>
    </div>
  );
}
```

### 6️⃣ مدیریت خطاها

```jsx
const { connectionError } = useWebSocket();

if (connectionError) {
  console.error("Connection error:", connectionError);
}
```

### 7️⃣ Debugging

برای مشاهده log های WebSocket، کنسول مرورگر را باز کنید:

```
🔌 Connecting to: ws://present.proslides.ir/ws/room1/manager
✅ WebSocket Connected as manager
📩 Received: {"type":7,"users":[...]}
📤 Sent: {"type":9,"action":"next"}
```

## 🎯 صفحات پیاده‌سازی شده

- ✅ `JoinPage.jsx` - اتصال و دریافت لیست بازیکنان (Type 7)
- ✅ `PickAnswerQuestion.jsx` - دریافت نتایج سوال (Type 8)
- ✅ `LeaderBoard.jsx` - دریافت و نمایش لیدربورد (Type 7/11)

## 📚 مراجع

- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [React Context](https://react.dev/reference/react/useContext)
- Backend: `backend/srvs/facade/static/manager.html`
