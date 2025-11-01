use actix::*;
use actix_web_actors::ws;
use actix::prelude::*;
use redis::AsyncCommands;
use uuid::Uuid;

const REDIS_URL: Option<&str> = Some("redis://127.0.0.1/");

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
    pub room: Addr<crate::Room>,
}

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
        self.room.do_send(PlayerOk(ctx.address()));
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for PlayerSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        if let Ok(ws::Message::Text(text)) = msg {
            // Player registration
            if let Ok(player_info) = serde_json::from_str::<crate::PlayerInfo>(&text) {
                if player_info.r#type == 6 {
                    let name = player_info.name.clone();
                    let character = player_info.character.clone();

                    // Generate a unique ID
                    let user_id = Uuid::new_v4().to_string();

                    // Store player info in Redis
                    let player_json = serde_json::json!({
                        "user_id": user_id,
                        "name": name,
                        "character": character
                    });

                    let redis_data = player_json.to_string();
                    let confirmation = serde_json::json!({
                        "type": 10,
                        "name": name,
                        "character": character,
                        "user_id": user_id
                    });


                    actix_rt::spawn(async move {
                        if let Ok(client) = redis::Client::open(REDIS_URL.unwrap()) {
                            if let Ok(mut con) = client.get_multiplexed_async_connection().await {
                                let _: () = con
                                    .set(format!("player:{}", user_id), redis_data)
                                    .await
                                    .unwrap_or_default();
                            }
                        }
                    });
                    // Notify room to send updated list to manager
                    self.room.do_send(crate::SendPlayerList);

                    // Send confirmation back to player
                    ctx.text(confirmation.to_string());
                    println!("✅ Registered player: {:?}", confirmation);
                    return;
                }


            }

            // Other message handling (answers, ok, etc.)
            if text == "ok" {
//                 self.room.do_send(crate::PlayerOk(ctx.address()));
            } else if let Ok(answer) = serde_json::from_str::<crate::PlayerAnswer>(&text) {
                if answer.r#type == 4 {
                    self.room.do_send(crate::PlayerAnswerMessage(answer));
                }
            } else {
                println!("⚠️ Unknown player message: {}", text);
            }
        }
    }
}
