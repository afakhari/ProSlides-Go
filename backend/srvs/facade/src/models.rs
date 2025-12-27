use redis::Value;
use serde::{Deserialize, Serialize};
use actix::*;
use uuid::Uuid;
use std::collections::HashSet;
use std::time::Instant;


//
// ==== Question struct ====
#[derive(Serialize, Clone)]
pub struct OptionItem {
    pub option_id: u32,
    pub option_text: String,
    pub image: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct Question {
    pub r#type: u8,
    pub question_id: u64,
    pub question_text: String,
    pub question_time: u32,
    pub max_point: f64,
    pub min_point: f64,
    pub has_multiple: bool,
    pub options: Vec<OptionItem>,
}

#[derive(serde::Serialize, Clone)]
pub struct OptionResult {
    pub option_id: u32,
    pub answer: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct QuestionResult {
    pub r#type: u8,
    pub question_id: u64,
    pub options_result: Vec<OptionResult>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct NewQuestion(pub Question);

// ===== Player Answer =====

#[derive(Deserialize, Clone, Debug, serde::Serialize)]
pub struct PlayerOptionAnswer {
    pub option_id: u32,
    pub picked: bool,
}

#[derive(Deserialize, Clone, Debug)]
pub struct PlayerAnswer {
    pub r#type: u8,
    pub question_id: u32,
    pub user_id: String,
    pub submit_time: f32,
    pub options_result: Vec<PlayerOptionAnswer>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerAnswerMessage(pub PlayerAnswer);

#[derive(Deserialize, Clone, Debug)]
pub struct ManagerAction {
    pub r#type: u8,
    pub action: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct PlayerInfo {
    pub r#type: u8,
    pub name: String,
    pub character: String,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct SendPlayerList{
    pub session_id: String,
    pub new_player: serde_json::Value,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct QuizSetupMessage(pub QuizSetup);




// ====== Room ======
pub struct Room {
    pub players: HashSet<Addr<PlayerSession>>,
    pub manager: Option<Addr<ManagerSession>>,
    pub ok_responses: usize,
    pub last_question: Option<Question>,
    pub redis_client: redis::Client,
    pub session_id: String,
}

//

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QuizSetup {
    pub quiz_id: u32,
    pub title: String,
    pub background: Background,
    #[serde(default)]
    pub music_url: Option<String>,
    pub slides: Vec<Slide>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Background {
    pub color: String,
    pub image: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Slide {
    pub slide_id: u64,
    pub slide_type: u8, // 1 = question, 2 = content, 3 = leaderboard
    pub order: u16,
    #[serde(default)]
    pub show_leaderboad_after: Option<bool>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub content_text: Option<String>,
    #[serde(default)]
    pub content_image_url: Option<String>,
    #[serde(default)]
    pub question: Option<QuizQuestion>,
    #[serde(default)]
    pub leaderboard: Vec<LeaderboardEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LeaderboardEntry {
    #[serde(default)]
    pub rust_session_id: String,
    #[serde(default)]
    pub player_name: String,
    #[serde(default)]
    pub avatar: String,
    #[serde(default)]
    pub score: u32,
    #[serde(default)]
    pub time_taken: f32,
    #[serde(default)]
    pub rank: u16,
}

#[derive(Debug, Serialize, Clone)]
pub struct LeaderboardUpdate {
    pub leaderboard: Vec<LeaderboardEntry>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QuizQuestion {
    pub question_id: u64,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    pub question_type: String,
    #[serde(default)]
    pub image_url: Option<String>,
    pub partial_scoring: bool,
    pub time_limit: u32,
    #[serde(default)]
    pub max_point: f64,
    #[serde(default)]
    pub min_point: f64,
    #[serde(default)]
    pub faster_answers_more_points: bool,
    pub options: Vec<QuizOption>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct QuizOption {
    pub option_id: u32,
    pub text: String,
    pub is_correct: bool,
    pub votes: u32,
    #[serde(default)]
    pub image_url: Option<String>,
}
//
// Messages used by Room ↔ Player
#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerText(pub String);


#[derive(Message)]
#[rtype(result = "()")]
pub struct RegisterPlayer(pub Addr<PlayerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct UnregisterPlayer(pub Addr<PlayerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct PlayerOk(pub Addr<PlayerSession>);


/// Player WebSocket actor
pub struct PlayerSession {
    pub id: Uuid,
    pub room: Addr<Room>,
    pub name: Option<String>,
    pub character: Option<String>,
    pub session_id: String,
    pub redis_client: redis::Client,
    pub quiz_setup: Option<QuizSetup>,
    pub hb: Instant,  // Add this field
}

#[derive(Deserialize)]
pub struct OptionPick {
    option_id: i64,
    picked: bool,
}

//

#[derive(Message)]
#[rtype(result = "()")]
pub struct ManagerText(pub String);

#[derive(Message)]
#[rtype(result = "()")]
pub struct RegisterManager(pub Addr<ManagerSession>);

#[derive(Message)]
#[rtype(result = "()")]
pub struct UnregisterManager;

#[derive(Message)]
#[rtype(result = "()")]
pub struct BroadcastToPlayers(pub String);


pub struct ManagerSession {
    pub room: Addr<Room>,
    pub session_id: String,
    pub redis_client: redis::Client,
    pub quiz_setup: QuizSetup,
    pub hb: Instant,  // Add this field
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct ServerMessage(pub String);
