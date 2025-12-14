use actix::*;
use actix_web::body::MessageBody;
use actix_web_actors::ws;
use serde_json::{Value, to_string};
use redis::{AsyncCommands, Client, aio::MultiplexedConnection};
use chrono::Utc;
use serde_json::json;
use std::{rc::Rc, time::{SystemTime, UNIX_EPOCH}};
use crate::utils::{
    save_slide_index,
    get_slide_index,
    save_quiz_setup,
    post_question_leaderboard,
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

impl Actor for ManagerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
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
            save_slide_index(redis_client, session_id, -1);
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

async fn send_leaderbaord(con: &mut MultiplexedConnection, session_id: String, slide: Slide, manager_addr: Addr<ManagerSession>, room_clone: Addr<Room>){
                
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

    /*
    let leaderboard_after_key = format!("quiz:{}:leaderboard_after", session_id);
    let leaderboard_after = serde_json::to_string(&ranked).ok().unwrap();
    let _: () = con.set(leaderboard_after_key, leaderboard_after).await.expect("Error in sending leaderboard");
    */
    if slide.slide_type == 1 { // quesion slide
        /*
        let leaderboard_befor_key = format!("quiz:{}:leaderboard_befor", session_id);
        let leaderboard_befor: Option<String> = con.get(&leaderboard_befor_key).await.ok();
        if leaderboard_befor.is_none() {
                
        } else {
            let mut result = Vec::new();

            for a in leaderboard_after {
                if let Some(b) = before.iter().find(|x| x.user_id == a.user_id) {
                    result.push(LeaderboardEntry {
                        rust_session_id: a.user_id,
                        player_name: a.name.clone(),
                        character: a.character.clone(),
                        new_points: a.total_points - b.total_points,
                        total_points: a.total_points,
                        rank: a.rank,
                    });
                }
            }
        }
        */
        let mut question_leaderboard = slide.leaderboard.clone();
        let mut new_points = 0;
        for p in players.iter() {
            new_points = p["new_points"].to_string().parse::<f32>().expect("Error in numeric").round() as u32;
            question_leaderboard.push(LeaderboardEntry {
                rust_session_id: p["user_id"].to_string(),
                player_name: p["name"].to_string(),
                avatar: p["character"].to_string(),
                score: new_points.clone(),
                time_taken: 0.,
                rank: 0,
            });
        }
        question_leaderboard.sort_by(|a, b| {
            b.score.partial_cmp(&a.score).unwrap()
        });
        let mut index = 1;
        for p in &mut question_leaderboard {
            p.rank = index;
            index += 1;
        }
        post_question_leaderboard(&session_id, slide.slide_id, question_leaderboard.clone()).await.ok();
        let leaderboard_manager_json = json!({
            "type": 12,
            "results": ranked,
        });
        manager_addr.do_send(ServerMessage(leaderboard_manager_json.to_string()));
    }
    else if slide.slide_type == 3 { // leaderboard slide
        let leaderboard_manager_json = json!({
            "type": 1,
            "results": ranked,
        });
        let leaderboard_player_json = json!({
            "type": 11,
            "results": ranked,
        });
        
        manager_addr.do_send(ServerMessage(leaderboard_manager_json.to_string()));
        room_clone.do_send(BroadcastToPlayers(leaderboard_player_json.to_string()));
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ManagerSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        if let Ok(ws::Message::Text(text)) = msg {
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

                        _ => println!("⚠️ Unknown manager action: {}", cmd.action),
                    }
                }
            } else {
                println!("⚠️ Manager sent invalid JSON: {}", text);
            }
        }
    }
}
