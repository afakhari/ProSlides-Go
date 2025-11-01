use actix::*;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use serde::Serialize;
use serde::Deserialize;
use uuid::Uuid;

// Local modules
mod manager;
mod player;

use manager::*;
use player::*;



// ==== Question struct ====
#[derive(Serialize, Clone)]
pub struct OptionItem {
    pub option_id: u32,
    pub option_text: String,
}

#[derive(Serialize, Clone)]
pub struct Question {
    pub r#type: u8,
    pub question_id: u32,
    pub question_text: String,
    pub question_time: u32,
    pub max_point: u32,
    pub min_point: u32,
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
    pub question_id: u32,
    pub options_result: Vec<OptionResult>,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct NewQuestion(pub Question);

// ===== Player Answer =====

#[derive(Deserialize, Clone, Debug)]
pub struct PlayerOptionAnswer {
    pub option_id: u32,
    pub picked: bool,
}

#[derive(Deserialize, Clone, Debug)]
pub struct PlayerAnswer {
    pub r#type: u8,
    pub question_id: u32,
    pub user_id: u32,
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
pub struct SendPlayerList;



// ====== Room ======
pub struct Room {
    players: HashSet<Addr<PlayerSession>>,
    manager: Option<Addr<ManagerSession>>,
    ok_responses: usize,
    last_question: Option<Question>,
}

impl Room {
    pub fn new() -> Self {
        Room {
            players: HashSet::new(),
            manager: None,
            ok_responses: 0,
            last_question: None,
        }
    }
}

impl Actor for Room {
    type Context = Context<Self>;
}

impl Handler<NewQuestion> for Room {
    type Result = ();
    fn handle(&mut self, msg: NewQuestion, _: &mut Self::Context) {
        self.last_question = Some(msg.0);
    }
}

impl Handler<PlayerAnswerMessage> for Room {
    type Result = ();

    fn handle(&mut self, msg: PlayerAnswerMessage, _: &mut Self::Context) {
        let answer = msg.0.clone();

        println!(
            "🧩 Player {} answered question {}: {:?}",
            answer.user_id, answer.question_id, answer.options_result
        );

        // You can later store this in DB or a HashMap for scoring
        // Example: self.answers.insert(answer.user_id, answer);
    }
}

use redis::AsyncCommands;

#[derive(Serialize)]
struct PlayerListMsg {
    r#type: u8,
    users: Vec<serde_json::Value>,
}

impl Handler<SendPlayerList> for Room {
    type Result = ();

    fn handle(&mut self, _: SendPlayerList, _: &mut Self::Context) {
        let manager = self.manager.clone();
        actix_rt::spawn(async move {
            if manager.is_none() { return; }

            let client = redis::Client::open("redis://127.0.0.1:6379/").unwrap();
            let mut con = client.get_multiplexed_async_connection().await.unwrap();

            // Get all player keys
            let keys: Vec<String> = con.keys("player:*").await.unwrap_or_default();

            let mut users = vec![];

            for key in keys {
                // Try to get redis string
                let json_str: Result<String, _> = con.get(&key).await;

                if let Ok(json) = json_str {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json) {
                        users.push(v);
                    }
                }
            }


            let msg = PlayerListMsg {
                r#type: 7,
                users,
            };

            let payload = serde_json::to_string(&msg).unwrap();
            manager.unwrap().do_send(crate::ManagerText(payload));
        });
    }
}

impl Handler<RegisterPlayer> for Room {
    type Result = ();
    fn handle(&mut self, msg: RegisterPlayer, _: &mut Self::Context) {
        self.players.insert(msg.0);
    }
}

impl Handler<UnregisterPlayer> for Room {
    type Result = ();
    fn handle(&mut self, msg: UnregisterPlayer, _: &mut Self::Context) {
        self.players.remove(&msg.0);
    }
}

impl Handler<RegisterManager> for Room {
    type Result = ();
    fn handle(&mut self, msg: RegisterManager, _: &mut Self::Context) {
        self.manager = Some(msg.0);
    }
}

impl Handler<UnregisterManager> for Room {
    type Result = ();
    fn handle(&mut self, _: UnregisterManager, _: &mut Self::Context) {
        self.manager = None;
    }
}

impl Handler<BroadcastToPlayers> for Room {
    type Result = ();
    fn handle(&mut self, msg: BroadcastToPlayers, _: &mut Self::Context) {
        self.ok_responses = 0;
        for player in &self.players {
            player.do_send(PlayerText(msg.0.clone()));
        }
    }
}

impl Handler<PlayerOk> for Room {
    type Result = ();

    fn handle(&mut self, _: PlayerOk, ctx: &mut Self::Context) {
        self.ok_responses += 1;

        if let Some(manager) = &self.manager {
            manager.do_send(ManagerText(format!(
                "OK count: {} / {}",
                self.ok_responses,
                self.players.len()
            )));
        }

        // When all players have responded
        if self.ok_responses == self.players.len() && self.players.len() > 0 {
            println!("✅ All players OK. Starting timer...");

            let players = self.players.clone();
            let question_time = self
                .last_question
                .as_ref()
                .map(|q| q.question_time)
                .unwrap_or(40);

            let result = crate::QuestionResult {
                r#type: 3,
                question_id: self.last_question.as_ref().map(|q| q.question_id).unwrap_or(0),
                options_result: vec![
                    crate::OptionResult { option_id: 58, answer: false },
                    crate::OptionResult { option_id: 59, answer: true },
                ],
            };

            let result_json = serde_json::to_string(&result).unwrap();

            ctx.run_later(std::time::Duration::from_secs(question_time as u64), move |_, _| {
                println!("⏰ Sending result after {}s", question_time);
                for player in &players {
                    player.do_send(PlayerText(result_json.clone()));
                }
            });
        }
    }
}


// ====== App State ======
struct AppState {
    rooms: Mutex<HashMap<String, Addr<Room>>>,
}

// ====== Route ======
async fn ws_route(
    req: HttpRequest,
    stream: web::Payload,
    data: web::Data<AppState>,
    path: web::Path<(String, String)>, // (session_id, role)
) -> Result<HttpResponse, Error> {
    let (session_id, role) = path.into_inner();
    let mut rooms = data.rooms.lock().unwrap();

    let room = rooms
        .entry(session_id.clone())
        .or_insert_with(|| Room::new().start())
        .clone();

    match role.as_str() {
        "manager" => actix_web_actors::ws::start(ManagerSession { room }, &req, stream),
        "player" => actix_web_actors::ws::start(PlayerSession { room }, &req, stream),
        _ => Ok(HttpResponse::BadRequest().body("role must be 'manager' or 'player'")),
    }
}

// ====== Main ======
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let data = web::Data::new(AppState {
        rooms: Mutex::new(HashMap::new()),
    });

    println!("🚀 Server running on http://localhost:8080");

    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/ws/{session_id}/{role}", web::get().to(ws_route))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
