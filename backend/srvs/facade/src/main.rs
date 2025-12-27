use actix::*;
use actix_web::{web, App, Error, HttpRequest, HttpResponse, HttpServer};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, MutexGuard};
use serde::Serialize;
use uuid::Uuid;
use redis::{AsyncCommands};

// Local modules
mod manager;
mod player;
mod models;
mod utils;
use utils::{
    get_quiz_setup,
};
use models::{
    PlayerSession,
    Room,
    NewQuestion,
    PlayerAnswerMessage,
    SendPlayerList,
    ManagerText,
    RegisterPlayer,
    UnregisterPlayer,
    BroadcastToPlayers,
    OptionResult,
    RegisterManager,
    UnregisterManager,
    PlayerText,
    PlayerOk,
    QuestionResult,
    Slide,
    QuizOption,
    ManagerSession,
};
use std::time::Instant;


pub const REDIS_URL: Option<&str> = Some("redis://127.0.0.1/");


impl Room {
    pub fn new(session_id: String) -> Self {
        Room {
            players: HashSet::new(),
            manager: None,
            ok_responses: 0,
            last_question: None,
            redis_client: redis::Client::open(REDIS_URL.unwrap()).unwrap(),
            session_id: session_id,
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

#[derive(Serialize)]
struct PlayerListMsg {
    r#type: u8,
    users: Vec<serde_json::Value>,
}

impl Handler<SendPlayerList> for Room {
    type Result = ();

    fn handle(&mut self, data: SendPlayerList, _: &mut Self::Context) {
        let manager = self.manager.clone();
        let session_id = data.session_id.clone();
        let client = self.redis_client.clone();
        let new_player = data.new_player.clone();

        // let redis_client = self.
        actix_rt::spawn(async move {
            if manager.is_none() { return; }
            if let Ok(mut con) = client.get_multiplexed_async_connection().await {

                // Get all player keys
                let pattern = format!("players:{session_id}");
                let keys: Vec<String> = con.smembers(&pattern).await.unwrap();

                let mut users = vec![];

                for key in keys {
                    // Try to get redis string
                    let json_str: Result<String, _> = con.get(&key).await;

                    if let Ok(json) = json_str {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json) {
                            if v.get("user_id").unwrap() != new_player.get("user_id").unwrap() {
                                users.push(v);
                            }
                        }
                    }
                }
                // Add new player manually
                users.push(new_player);


                let msg = PlayerListMsg {
                    r#type: 7,
                    users,
                };

                let payload = serde_json::to_string(&msg).unwrap();
                manager.unwrap().do_send(ManagerText(payload));
            }
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
            /*
            let players = self.players.clone();
            let quiz_setup = self.quiz_setup.clone().unwrap();
            let redis_client = self.redis_client.clone();
            let session_id = self.session_id.clone();
            actix_rt::spawn(async move {
                let slide = quiz_setup.slides[get_slide_index(&redis_client, &session_id).await as usize].clone();
                if slide.slide_type == 3 { // leaderboard
                // pass
            }
            else if slide.slide_type == 2 { // content
            // pass
        }
        else if slide.slide_type == 1 { // question
        let question = slide.question.clone().unwrap();
                    let question_time = question.time_limit.clone();

                    let mut options: Vec<OptionResult> = Vec::new();
                    for option in question.options {
                        options.push(
                            OptionResult {
                                option_id: option.option_id,
                                answer: option.is_correct,
                            }
                        );
                    }

                    let result = QuestionResult {
                        r#type: 3,
                        question_id: question.question_id,
                        options_result: options,
                    };

                    let result_json = serde_json::to_string(&result).unwrap();
                    tokio::time::sleep(std::time::Duration::from_secs(question_time as u64)).await;
                    println!("⏰ Sending result after {}s", question_time);
                    for player in &players {
                        player.do_send(PlayerText(result_json.clone()));
                    }
                }
            });
            */
        }
    }
}


// ====== App State ======
struct AppState {
    rooms: Mutex<HashMap<String, Addr<Room>>>,
}

fn lock_rooms<T>(mutex: &Mutex<T>) -> MutexGuard<T> {
    match mutex.lock() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("⚠️ Recovering poisoned mutex");
            e.into_inner()
        }
    }
}


// ====== Route ======
async fn ws_route(
    req: HttpRequest,
    stream: web::Payload,
    data: web::Data<AppState>,
    path: web::Path<(String, String)>, // (session_id, role)
) -> Result<HttpResponse, Error> {
    let (session_id, role) = path.into_inner();
    // let mut rooms = data.rooms.lock().unwrap();
    let mut rooms = lock_rooms(&data.rooms);



    let room = rooms
        .entry(session_id.clone())
        .or_insert_with(|| Room::new(session_id.clone()).start())
        .clone();
    let redis_client = redis::Client::open(REDIS_URL.unwrap()).unwrap();
    match role.as_str() {
        "manager" => actix_web_actors::ws::start(
            ManagerSession {
                room: room,
                session_id: session_id.clone(),
                redis_client: redis_client,
                quiz_setup: get_quiz_setup(&session_id).await.unwrap(),
                hb: Instant::now(),  // Initialize heartbeat
            }, &req, stream),
        "player" => actix_web_actors::ws::start(
                PlayerSession {
                            id: Uuid::new_v4(),
                            room: room,
                            name: None,
                            character: None,
                            session_id: session_id,
                            redis_client: redis_client,
                            quiz_setup: None,
                            hb: Instant::now(),  // Initialize heartbeat
                        },
                        &req,
                        stream,
                    ),
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
