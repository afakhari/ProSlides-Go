use actix::*;
use actix_web_actors::ws;
use serde_json::to_string;

use crate::{player::PlayerSession, Question, OptionItem};

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
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, _: &mut Self::Context) {
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
                                max_point: 100,
                                min_point: 0,
                                options: vec![
                                    crate::OptionItem { option_id: 58, option_text: "Not bad".to_string() },
                                    crate::OptionItem { option_id: 59, option_text: "Very good!".to_string() },
                                ],
                            };
                            let json = serde_json::to_string(&question).unwrap();

                            self.room.do_send(crate::NewQuestion(question.clone()));
                            self.room.do_send(crate::BroadcastToPlayers(json));
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
