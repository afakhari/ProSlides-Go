use actix::*;
use actix_web::{body::MessageBody, web::Bytes};
use actix_web_actors::ws;
use serde_json::{Value, to_string};
use redis::{AsyncCommands, Client, aio::MultiplexedConnection};
use chrono::Utc;
use serde_json::json;
use std::{collections::{HashMap, HashSet}, rc::Rc, time::{SystemTime, UNIX_EPOCH}};
use crate::utils::{
    save_slide_index,
    get_slide_index,
    save_quiz_setup,
    post_question_leaderboard,
    cleanup_quiz_redis,
    add_scores_batch,
};
use crate::models::{
    ManagerSession,
    RegisterManager,
    UnregisterManager,
    ServerMessage,
    ManagerText,
    BroadcastToPlayers,
    Slide,
    OptionItem,
    Question,
    Room,
    ManagerAction,
    NewQuestion,
    OptionResult,
    QuestionResult,
    LeaderboardEntry,
};

// TODO: Check the result. i think must remove new_points:13

use std::time::{Duration, Instant};

// Heartbeat interval and timeout
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);

// ...existing code...

impl ManagerSession {
    /// Sends ping to client every HEARTBEAT_INTERVAL seconds.
    /// Also checks if client has responded within CLIENT_TIMEOUT.
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // Check if client is still responsive
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                println!("⚠️ Manager heartbeat failed, disconnecting!");
                act.room.do_send(UnregisterManager);
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for ManagerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Start heartbeat
        self.hb(ctx);

        let session_id = self.session_id.clone();
        let quiz_setup = self.quiz_setup.clone();
        let redis_client = self.redis_client.clone();
        actix_rt::spawn(async move {
            save_quiz_setup(&session_id, &quiz_setup, &redis_client).await.ok();
        });
        self.room.do_send(RegisterManager(ctx.address()));
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        self.room.do_send(UnregisterManager);
        let redis_client = self.redis_client.clone();
        let session_id = self.session_id.clone();
        actix_rt::spawn(async move {
            save_slide_index(redis_client.clone(), session_id.clone(), -1);
            cleanup_quiz_redis(&redis_client, &session_id).await;
        });
    }
}

impl Handler<ServerMessage> for ManagerSession {
    type Result = ();

    fn handle(&mut self, msg: ServerMessage, ctx: &mut Self::Context) -> Self::Result {
        ctx.text(msg.0);
    }
}


impl Handler<ManagerText> for ManagerSession {
    type Result = ();

    fn handle(&mut self, msg: ManagerText, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

async fn send_leaderbaord(
    con: &mut MultiplexedConnection,
    session_id: String,
    slide: Slide,
    manager_addr: Addr<ManagerSession>,
    room_clone: Addr<Room>,
) {
    // 1. Batch fetch player keys and values
    let pattern = format!("player:{session_id}:*");
    let player_keys: Vec<String> = match con.keys(&pattern).await {
        Ok(keys) => keys,
        Err(_) => return,
    };

    // Batch get all player JSONs
    let player_jsons: Vec<Option<String>> = if player_keys.is_empty() {
        vec![]
    } else {
        match con.get(player_keys.clone()).await {
            Ok(vals) => vals,
            Err(_) => return,
        }
    };

    let mut players = Vec::with_capacity(player_jsons.len());
    let mut dict_players: HashMap<String, serde_json::Value> = HashMap::with_capacity(player_jsons.len());

    for player_json in player_jsons.into_iter().flatten() {
        if let Ok(pdata) = serde_json::from_str::<serde_json::Value>(&player_json) {
            let user_id = pdata.get("user_id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            dict_players.insert(user_id.clone(), pdata.clone());
            players.push(pdata);
        }
    }

    // 2. Update leaderboard entries in batch
    let mut question_leaderboard = slide.leaderboard.clone();

    // 3. Add leaderboard entries to dict_players BEFORE adding to Redis
    // This ensures they're in the dict when we build the final leaderboard
    for entry in &question_leaderboard {
        // Normalize the ID - remove any quotes
        let normalized_id = entry.rust_session_id.trim_matches('"').to_string();
        dict_players.entry(normalized_id.clone()).or_insert_with(|| {
            json!({
                "user_id": normalized_id,
                "name": entry.player_name,
                "character": entry.avatar,
                "rank": 0,
                "total_points": 0,
                "new_points": entry.score,
            })
        });
    }

    // Now add scores to Redis (after dict_players is populated)
    add_scores_batch(con, &session_id, question_leaderboard.clone()).await;

    // 4. Fetch leaderboard from Redis
    let key = format!("leaderboard:{session_id}");
    let raw: Vec<(String, f64)> = match con.zrevrange_withscores(&key, 0, -1).await {
        Ok(r) => r,
        Err(_) => return,
    };

    // 5. Build leaderboard JSON - track actual rank for filtered results
    let mut rank = 0;
    let leaderboard: Vec<Value> = raw
        .into_iter()
        .filter_map(|(player_id, score)| {
            // Normalize the player_id from Redis (remove quotes if any)
            let normalized_id = player_id.trim_matches('"').to_string();

            dict_players.get(&normalized_id).map(|player| {
                rank += 1;
                json!({
                    "user_id": normalized_id,
                    "name": player["name"],
                    "character": player["character"],
                    "rank": rank,
                    "total_points": score,
                    "new_points": player["new_points"],
                })
            })
        })
        .collect();

    // 6. Slide type handling
    if slide.slide_type == 1 {
        // For question slides, update leaderboard with new points
        for p in &players {
            let new_points = p["new_points"].as_f64().unwrap_or(0.0).round() as u32;
            question_leaderboard.push(LeaderboardEntry {
                rust_session_id: p["user_id"].as_str().unwrap_or_default().to_string(),
                player_name: p["name"].as_str().unwrap_or_default().to_string(),
                avatar: p["character"].as_str().unwrap_or_default().to_string(),
                score: new_points,
                time_taken: 0.,
                rank: 0,
            });
        }
        question_leaderboard.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        for (idx, p) in question_leaderboard.iter_mut().enumerate() {
            p.rank = idx as u16 + 1;
        }
        post_question_leaderboard(&session_id, slide.slide_id, question_leaderboard.clone()).await.ok();
        let leaderboard_manager_json = json!({
            "type": 12,
            "results": leaderboard,
        });
        manager_addr.do_send(ServerMessage(leaderboard_manager_json.to_string()));
    } else if slide.slide_type == 3 {
        // For leaderboard slides, broadcast to all
        let leaderboard_manager_json = json!({
            "type": 1,
            "results": leaderboard,
        });
        let leaderboard_player_json = json!({
            "type": 11,
            "results": leaderboard,
        });
        manager_addr.do_send(ServerMessage(leaderboard_manager_json.to_string()));
        room_clone.do_send(BroadcastToPlayers(leaderboard_player_json.to_string()));
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ManagerSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        if let Ok(ws::Message::Ping(msg)) = msg {
            self.hb = Instant::now();
            ctx.pong(&msg);
        }
        else if let Ok(ws::Message::Pong(_)) = msg {
            self.hb = Instant::now();
        }
        else if let Ok(ws::Message::Text(text)) = msg {
            self.hb = Instant::now();
            println!("🧭 Manager sent: {}", text);

            // Try parsing as structured action
            if let Ok(cmd) = serde_json::from_str::<ManagerAction>(&text) {
                if cmd.r#type == 9 {
                    match cmd.action.as_str() {
                        "next" => {
                            println!("➡️ Manager requested NEXT");
                            let slides: Vec<Slide> = self.quiz_setup.slides.clone();
                            let session_id = self.session_id.clone();
                            let redis_client = self.redis_client.clone();
                            let room_clone = self.room.clone();
                            let manager_addr = ctx.address().clone();
                            actix_rt::spawn(async move {
                                let mut slide_index = get_slide_index(&redis_client, &session_id).await;
                                slide_index = if slide_index+1 < slides.len() as i32 {slide_index+1} else {slides.len() as i32};
                                if slide_index + 1 >= slides.len() as i32 { // end
                                    cleanup_quiz_redis(&redis_client, &session_id).await;
                                    save_slide_index(redis_client, session_id, -1);
                                    return;
                                }
                                save_slide_index(redis_client.clone(), session_id.clone(), slide_index);
                                let slide: Slide = slides[slide_index as usize].clone();


                                if slide.slide_type == 3 { // Leaderboard Slide
                                    if let Ok(mut con) = redis_client.get_multiplexed_async_connection().await {
                                        send_leaderbaord(&mut con, session_id.clone(), slide.clone(), manager_addr.clone(), room_clone.clone()).await;
                                    }
                                }
                                else if slide.slide_type == 2 { // content
                                    let str_json = serde_json::to_string(&slide).unwrap();
                                    room_clone.do_send(BroadcastToPlayers(str_json.clone()));
                                    manager_addr.do_send(ServerMessage(str_json));
                                }
                                else if slide.slide_type == 1 { // PickAnswerQuestion Slide
                                    let _question = slide.question.clone().unwrap();
                                    let mut options: Vec<OptionItem> = Vec::new();
                                    let mut answer_nums = 0;
                                    for option in _question.options.clone() {
                                        options.push(
                                            OptionItem {
                                                option_id: option.option_id,
                                                option_text: option.text,
                                                image: option.image_url,
                                            }
                                        );
                                        if option.is_correct {
                                            answer_nums += 1;
                                        }
                                    }
                                    let question = Question {
                                        r#type: 2,
                                        question_id: _question.question_id,
                                        question_text: _question.text.clone().unwrap(),
                                        question_time: _question.time_limit,
                                        max_point: _question.max_point,
                                        min_point: _question.min_point,
                                        has_multiple: if answer_nums > 1 {true} else {false},
                                        options: options,
                                    };
                                    let json = serde_json::to_string(&question).unwrap();


                                    room_clone.do_send(NewQuestion(question.clone()));
                                    room_clone.do_send(BroadcastToPlayers(json));
                                    let qkey = format!("question:{}:{}", session_id, question.question_id);
                                    let meta = serde_json::json!({
                                        "question_id": question.question_id,
                                        "question_time": question.question_time,
                                        "max_point": question.max_point,
                                        "min_point": question.min_point,
                                    });


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
                                        // Send result to Player
                                        let mut options: Vec<OptionResult> = Vec::new();
                                        for option in _question.options {
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
                                        room_clone.do_send(BroadcastToPlayers(result_json));
                                        // Send leaderboard to manager
                                        send_leaderbaord(&mut con, session_id.clone(), slide.clone(), manager_addr.clone(), room_clone.clone()).await;
                                    }
                                }
                            });

                        }

                        "previous" => {
                            println!("⬅️ Manager requested PREVIOUS");
                            self.room.do_send(BroadcastToPlayers(
                                "Manager pressed previous".to_string(),
                            ));
                        }

                        "end" => {
                            let redis_client = self.redis_client.clone();
                            let session_id = self.session_id.clone();
                            actix_rt::spawn(async move {
                                cleanup_quiz_redis(&redis_client, &session_id).await;
                                save_slide_index(redis_client, session_id, -1);
                            });
                        }

                        _ => println!("⚠️ Unknown manager action: {}", cmd.action),
                    }
                }
            } else {
                println!("⚠️ Manager sent invalid JSON: {}", text);
            }
        }
        else if let Ok(ws::Message::Binary(bin)) = msg {
            ctx.binary(bin);
        }
        else if let Ok(ws::Message::Close(reason)) = msg {
            ctx.close(reason);
            ctx.stop();
        }
        else {
            ctx.stop();
        }
    }
}
