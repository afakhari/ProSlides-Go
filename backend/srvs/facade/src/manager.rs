use actix::*;
use actix_web::body::MessageBody;
use actix_web_actors::ws;
use serde_json::to_string;
use redis::{AsyncCommands};
use crate::{player::PlayerSession, Question, OptionItem};
use chrono::Utc;
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

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
    pub room: Addr<crate::Room>,
    pub session_id: String,
    pub redis_client: redis::Client,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct ServerMessage(pub String);

impl Handler<ServerMessage> for ManagerSession {
    type Result = ();

    fn handle(&mut self, msg: ServerMessage, ctx: &mut Self::Context) -> Self::Result {
        ctx.text(msg.0);
    }
}


impl Actor for ManagerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.room.do_send(RegisterManager(ctx.address()));
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        self.room.do_send(UnregisterManager);
    }
}

impl Handler<ManagerText> for ManagerSession {
    type Result = ();

    fn handle(&mut self, msg: ManagerText, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ManagerSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        if let Ok(ws::Message::Text(text)) = msg {
            println!("🧭 Manager sent: {}", text);

            // Try parsing as structured action
            if let Ok(cmd) = serde_json::from_str::<crate::ManagerAction>(&text) {
                if cmd.r#type == 9 {
                    match cmd.action.as_str() {
                        "next" => {
                            println!("➡️ Manager requested NEXT");
                            let question = crate::Question {
                                r#type: 2,
                                question_id: 45,
                                question_text: "How are you?".to_string(),
                                question_time: 10,
                                max_point: 100.0,
                                min_point: 0.0,
                                options: vec![
                                    crate::OptionItem { option_id: 58, option_text: "Not bad".to_string() },
                                    crate::OptionItem { option_id: 59, option_text: "Very good!".to_string() },
                                ],
                            };
                            let json = serde_json::to_string(&question).unwrap();

                            self.room.do_send(crate::NewQuestion(question.clone()));
                            self.room.do_send(crate::BroadcastToPlayers(json));
                            let qkey = format!("question:{}:{}", self.session_id, question.question_id);
                            let meta = serde_json::json!({
                                "question_id": question.question_id,
                                "question_time": question.question_time,
                                "max_point": question.max_point,
                                "min_point": question.min_point
                            });
                            let redis_client = self.redis_client.clone();
                            let manager_addr = ctx.address();
                            let session_id = self.session_id.clone();


                            actix_rt::spawn(async move {
                                if let Ok(mut con) = redis_client.get_multiplexed_async_connection().await {
                                    // Store question meta & start timestamp
                                    let now = SystemTime::now()
                                        .duration_since(UNIX_EPOCH)
                                        .expect("Time error")
                                        .as_secs_f64();


                                    let _: () = con
                                        .set(format!("{qkey}:meta"), meta.to_string())
                                        .await
                                        .unwrap(); 
                                    let _: () = con
                                        .set(format!("{qkey}:start"), now)
                                        .await
                                        .unwrap();

                                    // Wait question_time seconds
                                    tokio::time::sleep(std::time::Duration::from_secs(question.question_time as u64)).await;

                                    // Collect results
                                    let mut options_result = Vec::new();
                                    for opt in question.options {
                                        let oid = opt.option_id;
                                        let key = format!("question:{}:{}:option:{}:count", session_id, question.question_id, oid);
                                        let count: i64 = con.get(key).await.unwrap_or(0);

                                        options_result.push(json!({
                                            "option_id": oid,
                                            "number_of_submits": count
                                        }));
                                    }

                                    let results_json = json!({
                                        "type": 8,
                                        "question_id": question.question_id,
                                        "options": options_result
                                    });

                                    // Send to manager WebSocket
                                    manager_addr.do_send(ServerMessage(results_json.to_string()));

                                    // ==== AFTER sending type 8 to manager ====
                                    let session_key = format!("players:{}", session_id);

                                    // Get all player keys for this session
                                    let player_keys: Vec<String> = con.smembers(&session_key).await.unwrap_or_default();

                                    let mut players = Vec::new();

                                    for pkey in player_keys {
                                        if let Ok(pjson) = con.get::<_, String>(&pkey).await {
                                            if let Ok(pdata) = serde_json::from_str::<serde_json::Value>(&pjson) {
                                                players.push(pdata);
                                            }
                                        }
                                    }

                                    // Sort descending by total_points
                                    players.sort_by(|a, b| {
                                        b["total_points"].as_f64().partial_cmp(&a["total_points"].as_f64()).unwrap()
                                    });

                                    // Assign ranking
                                    let mut ranked = Vec::new();
                                    for (i, p) in players.iter().enumerate() {
                                        ranked.push(json!({
                                            "user_id": p["user_id"],
                                            "name": p["name"],
                                            "character": p["character"],
                                            "rank": i + 1,
                                            "total_points": p["total_points"],
                                            "new_points": p["new_points"]
                                        }));
                                    }

                                    let leaderboard_json = json!({
                                        "type": 1,
                                        "results": ranked
                                    });

                                    // Send leaderboard to manager
                                    manager_addr.do_send(ServerMessage(leaderboard_json.to_string()));

                                }
                            });

                            
                            
                        }

                        "previous" => {
                            println!("⬅️ Manager requested PREVIOUS");
                            self.room.do_send(crate::BroadcastToPlayers(
                                "Manager pressed previous".to_string(),
                            ));
                        }

                        _ => println!("⚠️ Unknown manager action: {}", cmd.action),
                    }
                }
            } else {
                println!("⚠️ Manager sent invalid JSON: {}", text);
            }
        }
    }
}
