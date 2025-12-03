use actix::*;
use actix_web_actors::ws;
use redis::{AsyncCommands};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::utils::{
    get_slide_index,
};
use crate::models::{
    PlayerText,
    PlayerSession,
    RegisterPlayer,
    UnregisterPlayer,
    PlayerOk,
    PlayerInfo,
    PlayerAnswer,
    SendPlayerList,
    QuestionResult,
    OptionResult,
};


impl Actor for PlayerSession {
    type Context = ws::WebsocketContext<Self>;
    
    fn started(&mut self, ctx: &mut Self::Context) {
        self.room.do_send(RegisterPlayer(ctx.address()));
    }
    
    fn stopped(&mut self, ctx: &mut Self::Context) {
        self.room.do_send(UnregisterPlayer(ctx.address()));
    }
}


impl Handler<PlayerText> for PlayerSession {
    type Result = ();

    fn handle(&mut self, msg: PlayerText, ctx: &mut Self::Context) {
        // Broadcasted question JSON received
        ctx.text(msg.0.clone());

        // Automatically send "ok" back to manager
        if let Ok(player_info) = serde_json::from_str::<PlayerInfo>(&msg.0) {
            if player_info.r#type == 6 { // Player registration

            }
        }
        self.room.do_send(PlayerOk(ctx.address()));
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for PlayerSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        if let Ok(ws::Message::Text(text)) = msg {
            if let Ok(player_info) = serde_json::from_str::<PlayerInfo>(&text) {
                if player_info.r#type == 6 { // Player registration
                    let name = player_info.name.clone();
                    let character = player_info.character.clone();
                    self.name = Some(name.clone());
                    self.character = Some(character.clone());
                    let redis_client = self.redis_client.clone();


                    // Generate a unique ID
                    let user_id = self.id.clone().to_string();

                    // Store player info in Redis
                    let player_json = serde_json::json!({
                        "user_id": user_id,
                        "name": name,
                        "character": character,
                        "total_points": 0,
                        "new_points": 0
                    });

                    let redis_data = player_json.to_string();
                    let confirmation = serde_json::json!({
                        "type": 10,
                        "name": name,
                        "character": character,
                        "user_id": user_id
                    });
                    let user_data = serde_json::json!({
                        "name": name,
                        "character": character,
                        "user_id": user_id
                    });
                    let session_id = self.session_id.clone();


                    actix_rt::spawn(async move {
                        if let Ok(mut con) = redis_client.get_multiplexed_async_connection().await {
                            let _: () = con
                                .set(format!("player:{}:{}", session_id, user_id), redis_data)
                                .await
                                .unwrap_or_default();
                            let session_key = format!("players:{}", session_id);
                            let player_key = format!("player:{}:{}", session_id, user_id);

                            // after saving player JSON
                            let _: () = con.sadd(session_key, player_key).await.unwrap();
                        }
                    });
                    // Notify room to send updated list to manager
                    self.room.do_send(SendPlayerList { 
                        session_id: self.session_id.clone(),
                        new_player: user_data,
                    });

                    // Send confirmation back to player
                    ctx.text(confirmation.to_string());
                    println!("✅ Registered player: {:?}", confirmation);
                    return;
                }


            }

            // Other message handling (answers, ok, etc.)
            if text == "ok" {
//                 self.room.do_send(crate::PlayerOk(ctx.address()));
            } else if let Ok(answer) = serde_json::from_str::<PlayerAnswer>(&text) {
                if answer.r#type == 4 { // Submit Question
                    // self.room.do_send(crate::PlayerAnswerMessage(answer));
                    let session_id = self.session_id.clone();
                    let user_id = self.id.to_string();
                    let answer_clone = answer.clone();
                    let redis_client = self.redis_client.clone();
                    let slides = self.quiz_setup.slides.clone();
                    
                    actix_rt::spawn(async move {
                        let slide = slides[get_slide_index(&redis_client, &session_id).await as usize].clone();
                        let question = slide.question.clone().unwrap();
                        let mut con = redis_client.get_multiplexed_async_connection().await.unwrap();

                        let qkey = format!("question:{}:{}", session_id, answer.question_id);

                        let meta_key = format!("{qkey}:meta");
                        let qmeta_str: Option<String> = con.get(&meta_key).await.unwrap();
                        if qmeta_str.is_none() {
                            println!("⚠️ Missing question meta key in Redis: {}", meta_key);
                            return;
                        }
                        let qmeta: serde_json::Value = serde_json::from_str(&qmeta_str.unwrap()).unwrap();

                        let question_time = qmeta["question_time"].as_f64().unwrap();
                        let max_point = qmeta["max_point"].as_f64().unwrap();
                        let min_point = qmeta["min_point"].as_f64().unwrap();

                        let mut options: Vec<OptionResult> = Vec::new();
                        for option in question.options {
                            options.push(
                                OptionResult { 
                                    option_id: option.option_id, 
                                    answer: option.is_correct,
                                }
                            );
                        }
                        
                        // temp result
                        let result = QuestionResult {
                            r#type: 3,
                            question_id: question.question_id,
                            options_result: options,
                        };
                        let mut correct_picked_nums: i16 = 0;
                        let mut total_corrects: u8 = 0;
                        for i in 0..answer_clone.options_result.len() {
                            if result.options_result[i].option_id == answer_clone.options_result[i].option_id {
                                if result.options_result[i].answer {
                                    total_corrects += 1;
                                    if answer_clone.options_result[i].picked {
                                        correct_picked_nums += 1;
                                    }
                                } else {
                                    if answer_clone.options_result[i].picked {
                                        correct_picked_nums -= 1;
                                    }
                                }
                            }
                        }
                        correct_picked_nums = if correct_picked_nums < 0 {0} else {correct_picked_nums};
                        let slope: f64 = correct_picked_nums as f64 / total_corrects as f64;

                        let start_key = format!("{qkey}:start");
                        let start_time: Option<f64> = con.get(&start_key).await.unwrap();

                        if start_time.is_none() {
                            println!("⚠️ Missing question start time in Redis: {}", start_key);
                            return;
                        }

                        let start_time = start_time.unwrap();
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .expect("Time went backwards")
                            .as_secs_f64();

                        let submit_time = now - start_time;

                        // Ensure question_time > 0 to avoid division by zero
                        if question_time <= 0.0 {
                            println!("❌ Invalid question_time: {}", question_time);
                            return;
                        }

                        // Cap submit_time at question_time to avoid negative scores
                        let elapsed = submit_time.min(question_time);
                        let ratio = 1.0 - (elapsed / question_time); // 1.0 (fast) → 0.0 (slow or late)

                        let score = ratio * (max_point - min_point) + min_point;
                        let new_points = slope * score;

                        // update player score
                        let pkey = format!("player:{session_id}:{user_id}");
                        let mut player: serde_json::Value = serde_json::from_str(&con.get::<_,String>(&pkey).await.unwrap()).unwrap();

                        let old_total = player["total_points"].as_f64().unwrap_or(0.0);
                        player["total_points"] = serde_json::json!(old_total + new_points);
                        player["new_points"] = serde_json::json!(new_points);

                        let _: () = con
                            .set(pkey, serde_json::to_string(&player).unwrap())
                            .await
                            .unwrap();


                        // store submits
                        let submit_key = format!("{qkey}:submits");
                        let submit_json = json!({
                            "user_id": user_id,
                            "submit_time": submit_time,
                            "picked": answer.options_result
                        });

                        let _: () = con.rpush(submit_key, submit_json.to_string()).await.unwrap();

                        for opt in answer.options_result {
                            if opt.picked {
                                let _: () = con.incr(format!("{qkey}:option:{}:count", opt.option_id), 1)
                                    .await.unwrap();
                            }
                        }
                    });


                }
            } else {
                println!("⚠️ Unknown player message: {}", text);
            }
        }
    }
}
