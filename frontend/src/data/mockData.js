// Mock data for development and testing

// ============================================
// User and Players Data
// ============================================

export const User_adding = {
  type: 13,
  Users: [
    // { user_id: 1, name: "ali", character: "@" },
    // { user_id: 2, name: "ahmad", character: "😊" },
    // { user_id: 4, name: "mike", character: "⭐" },
    // { user_id: 5, name: "mike", character: "⭐" },
    // { user_id: 6, name: "mike", character: "⭐" },s
    // { user_id: 7, name: "mike", character: "⭐" },
    // { user_id: 8, name: "mike", character: "⭐" },
    // { user_id: 9, name: "mike", character: "😁" },
    // { user_id: 10, name: "mike", character: "⭐" },
    // { user_id: 11, name: "mike", character: "⭐" },
    // { user_id: 12, name: "mike", character: "⭐" },
    // { user_id: 13, name: "mike", character: "💕" },
    // { user_id: 14, name: "mike", character: "⭐" },
    // { user_id: 15, name: "mike", character: "⭐" },
    // { user_id: 16, name: "mike", character: "⭐" },
    // { user_id: 17, name: "mike", character: "⭐" },
  ],
};

// Leaderboard players data
export const LeaderboardPlayers = [
  {
    user_id: 1,
    name: "Chloe",
    character: "👑",
    color: "#db2777",
    rank: 110,
    total_points: 153,
    new_points: 61,
  },
  {
    user_id: 2,
    name: "Trang",
    character: "🌸",
    color: "#059669",
    rank: 2,
    total_points: 149,
    new_points: 49,
  },
  {
    user_id: 3,
    name: "Alex",
    character: "🐱",
    color: "#65a30d",
    rank: 3,
    total_points: 34,
    new_points: 34,
  },
  {
    user_id: 4,
    name: "Jenny",
    character: "🧁",
    color: "#2563eb",
    rank: 5,
    total_points: 0,
    new_points: 0,
  },
  {
    user_id: 5,
    name: "Kian",
    character: "😂",
    color: "#4563bb",
    rank: 4,
    total_points: 20,
    new_points: 20,
  },
  {
    user_id: 6,
    name: "ali",
    character: "@",
    color: "#db9869",
    rank: 1,
    total_points: 100,
    new_points: 61,
  },
];

// Default players for LeaderboardModal
// export const DefaultModalPlayers = [
//   { id: 1, name: "Chloe", character: "👑", points: 213, color: "#ec4899" },
//   { id: 2, name: "Trang", character: "🌸", points: 123, color: "#10b981" },
//   { id: 3, name: "Alex", character: "🐱", points: 109, color: "#f97316" },
//   { id: 4, name: "Hesam3", character: "👯", points: 44, color: "#6366f1" },
//   { id: 5, name: "hesam2", character: "🧑", points: 0, color: "#8b5cf6" },
// ];

// ============================================
// Questions Data
// ============================================

// ============================================
// Questions Data
// ============================================

// Pick Answer Question - English
export const PickAnswerQuestion_EN = {
  type: 2,
  question_id: 45,
  question_text: "Which country has the highest population?",
  options: [
    { option_id: 47, option_text: "Denmark 🇩🇰" },
    { option_id: 48, option_text: "Sweden 🇸🇪" },
    { option_id: 49, option_text: "United Kingdom 🇬🇧" },
    { option_id: 50, option_text: "France 🇫🇷" },
  ],
  question_time: 10,
  min_point: 0,
  max_point: 50,
};

// Pick Answer Question Result - English
export const PickAnswerResult_EN = {
  type: 3,
  question_id: 45,
  optionsResult: [
    { option_id: 47, answer: false },
    { option_id: 48, answer: false },
    { option_id: 49, answer: true },
    { option_id: 50, answer: false },
  ],
};

// Pick Answer Question - Persian
export const PickAnswerQuestion_FA = {
  type: 2,
  question_id: 46,
  question_text: "نزدیک‌ترین سیاره به خورشید کدام است؟",
  options: [
    { option_id: 51, option_text: "مریخ" },
    { option_id: 52, option_text: "زمین" },
    { option_id: 53, option_text: "زهره" },
    { option_id: 54, option_text: "عطارد" },
    { option_id: 55, option_text: "مشتری" },
    { option_id: 56, option_text: "اورانوس" },
  ],
  question_time: 20,
  min_point: 10,
  max_point: 50,
};

// Pick Answer Question Result - Persian
export const PickAnswerResult_FA = {
  type: 3,
  question_id: 46,
  optionsResult: [
    { option_id: 51, answer: false },
    { option_id: 52, answer: false },
    { option_id: 53, answer: false },
    { option_id: 54, answer: true },
    { option_id: 55, answer: false },
    { option_id: 56, answer: false },
  ],
};

// Quiz Setup with multiple slides
// slide_type: 1 = Question, 2 = Leaderboard
export const QuizSetup = {
  type: 5,
  slides: [
    {
      slide_type: 1,
      question_id: 145,
      question_text: "What is the capital of France?",
      question_time: 4,
      max_point: 100,
      min_point: 0,
      options: [
        { option_id: 72, option_text: "Berlin", answer: false },
        { option_id: 73, option_text: "Madrid", answer: false },
        { option_id: 74, option_text: "Paris", answer: true },
        { option_id: 75, option_text: "Rome", answer: false },
      ],
    },
    {
      slide_type: 2, // Final leaderboard
    },
    {
      slide_type: 1,
      question_id: 146,
      question_text: "What is 2 + 2?",
      question_time: 4,
      max_point: 80,
      min_point: 0,
      options: [
        { option_id: 76, option_text: "3", answer: false },
        { option_id: 77, option_text: "4", answer: true },
        { option_id: 78, option_text: "5", answer: false },
        { option_id: 79, option_text: "6", answer: false },
      ],
    },
    {
      slide_type: 2, // Leaderboard after second question
    },
    {
      slide_type: 1,
      question_id: 147,
      question_text: "Which planet is known as the Red Planet?",
      question_time: 25,
      max_point: 70,
      min_point: 0,
      options: [
        { option_id: 80, option_text: "Venus", answer: false },
        { option_id: 81, option_text: "Mars", answer: true },
        { option_id: 82, option_text: "Jupiter", answer: false },
        { option_id: 83, option_text: "Saturn", answer: false },
      ],
    },
    {
      slide_type: 2, // Final leaderboard
    },
  ],
};

// ============================================
// Footer/UI Data
// ============================================

// Footer stats configuration
export const DefaultFooterStats = {
  hearts: 1,
  happy: 3,
  star: 3,
  thumbsUp: 7,
  players: { current: User_adding.Users.length, max: 50 },
};

// Chat messages for Footer
export const DefaultChatMessages = [
  { user: "hesam Azmoun", message: "s", avatar: "👤" },
];

// Footer menu items
export const FooterMenuItems = [
  { icon: "✖️", label: "Stop presenting", action: "stop" },
  { icon: "📱", label: "Open Remote Control", action: "remote" },
  { icon: "⛶", label: "Switch to full screen", action: "fullscreen" },
  { icon: "❄️", label: "Allow profanity", action: "profanity" },
  { icon: "▦", label: "Show QR code", action: "qr" },
  { icon: "ℹ️", label: "Hide instruction bar", action: "instruction" },
  { icon: "🌐", label: "Public\nSwitch to Private", action: "privacy" },
  { icon: "↻", label: "Reset this slide", action: "reset" },
];

// Keyboard shortcuts
export const KeyboardShortcuts = [
  { label: "Back to Editor", key: "ESC" },
  { label: "Show / Hide QR Code", key: "Q" },
];

// Reactions
export const Reactions = [
  { icon: "🎊", label: "Confetti", key: "C" },
  { icon: "👏", label: "Applause", key: "A" },
  { icon: "🥁", label: "Drumroll", key: "D" },
];

// ============================================
// Game Configuration
// ============================================

// Default game code
export const DefaultGameCode = "room1";

// Color list for user names
export const UserColorList = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#BB8FCE", // Purple
  "#85C1E2", // Sky Blue
  "#F8B739", // Orange
  "#EC7063", // Coral
];

// ============================================
// Output/Response Types
// ============================================

// User answer submission format (no longer used - see PlayerPickAnswerQuestion for the correct format)
export const createUserAnswer = (questionId, selectedOptions, timeLeft) => ({
  type: 4,
  question_id: questionId,
  optins_selected: selectedOptions,
  time_left: timeLeft,
});

// Initial state for navigation
export const createNextPrevious = (
  type = 5,
  action = null,
  slideIndex = null
) => ({
  type,
  action, // "next" or "previous"
  slide_index: slideIndex, // Current slide index
});

// Question Result - Updated to match server format
export const QuestionResult = {
  type: 8,
  question_id: 45,
  options: [
    { option_id: 62, number_of_submits: 10 },
    { option_id: 63, number_of_submits: 5 },
    { option_id: 64, number_of_submits: 3 },
    { option_id: 65, number_of_submits: 2 },
  ],
};

// Leaderboard Result - Type 1 from server
export const LeaderboardResult = {
  type: 1,
  results: [
    {
      user_id: "8b6e39ab-4c6d-4255-a90a-41cb7ce7171b",
      name: "Ali",
      character: "❤️",
      color: "#db2777",
      rank: 1,
      total_points: 83.97,
      new_points: 83.97,
    },
    {
      user_id: "957d350e-bc07-47c2-a997-d09256e91f9a",
      name: "Sima",
      character: "❤️",
      color: "#059669",
      rank: 2,
      total_points: 0,
      new_points: 0,
    },
  ],
};
