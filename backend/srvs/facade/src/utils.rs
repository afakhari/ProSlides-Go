use crate::models::{
    QuizSetup,
};
use redis::{AsyncCommands, aio::MultiplexedConnection};
use reqwest::Client;
use serde_json::json;
use actix_rt;

pub async fn save_quiz_setup(
    session_id: &str,
    setup: &QuizSetup,
    redis: &redis::Client,
) -> redis::RedisResult<()> {
    let quiz_key = format!("quiz:{session_id}");
    let json = serde_json::to_string(setup).unwrap();

    let mut con = redis.get_multiplexed_async_connection().await?;
    con.set(quiz_key, json).await
}

pub async fn load_quiz_setup(
    session_id: &str,
    redis: &redis::Client,
) -> Option<QuizSetup> {
    let key = format!("quiz:{session_id}");
    let mut con = redis.get_multiplexed_async_connection().await.ok()?;
    let data: Option<String> = con.get(key).await.ok()?;
    data.and_then(|json| serde_json::from_str(&json).ok())
}


pub fn save_slide_index(
    redis: redis::Client,
    session_id: String,
    index: i32,
) {
    actix_rt::spawn(async move {
        let mut con = match redis.get_multiplexed_async_connection().await {
            Ok(c) => c,
            Err(_) => return,
        };

        let key = format!("quiz:{}:slide_index", session_id);
        let _ : () = con.set(key, index).await.unwrap_or(());
    });
}

pub async fn get_slide_index(
    redis: &redis::Client,
    session_id: &str
) -> i32 {
    let mut con = redis.get_multiplexed_async_connection().await.unwrap();
    let key = format!("quiz:{}:slide_index", session_id);

    con.get::<_, i32>(key).await.unwrap_or(-1)
}
/*
pub fn get_quiz_setup() -> Option<QuizSetup> {
    let quiz_setup = json!(
        {
            "quiz_id": 1001,
            "title": "General Knowledge Challenge",
            "background": "https://example.com/bg.jpg",
            "music_url": "https://example.com/music.mp3",
            "slides": [
                {
                "slide_id": 1,
                "slide_type": 1,
                "order": 1,
                "show_leaderboad_after": true,
                "title": "Question 1",
                "content_text": null,
                "content_image_url": null,
                "question": {
                    "question_id": 501,
                    "title": "Geography",
                    "text": "What is the capital of France?",
                    "question_type": "single_choice",
                    "image_url": null,
                    "partial_scoring": 0,
                    "time_limit": 10,
                    "max_point": 100,
                    "min_point": 0,
                    "faster_answers_more_points": true,
                    "options": [
                    {
                        "option_id": 201,
                        "text": "Berlin",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 202,
                        "text": "Madrid",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 203,
                        "text": "Paris",
                        "is_correct": true,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 204,
                        "text": "Rome",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    }
                    ]
                },
                "leaderboard": null
                },
                {
                "slide_id": 2,
                "slide_type": 2,
                "order": 2,
                "show_leaderboad_after": false,
                "title": "Leaderboard 1",
                "content_text": null,
                "content_image_url": null,
                "question": null,
                "leaderboard": "top_10"
                },
                {
                "slide_id": 3,
                "slide_type": 1,
                "order": 3,
                "show_leaderboad_after": true,
                "title": "Question 2",
                "content_text": null,
                "content_image_url": null,
                "question": {
                    "question_id": 502,
                    "title": "Math",
                    "text": "What is 2 + 2?",
                    "question_type": "single_choice",
                    "image_url": null,
                    "partial_scoring": 0,
                    "time_limit": 8,
                    "max_point": 80,
                    "min_point": 0,
                    "faster_answers_more_points": true,
                    "options": [
                    {
                        "option_id": 205,
                        "text": "3",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 206,
                        "text": "4",
                        "is_correct": true,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 207,
                        "text": "5",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 208,
                        "text": "6",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    }
                    ]
                },
                "leaderboard": null
                },
                {
                "slide_id": 4,
                "slide_type": 2,
                "order": 4,
                "show_leaderboad_after": false,
                "title": "Leaderboard 2",
                "content_text": null,
                "content_image_url": null,
                "question": null,
                "leaderboard": "global"
                },
                {
                "slide_id": 5,
                "slide_type": 1,
                "order": 5,
                "show_leaderboad_after": true,
                "title": "Question 3",
                "content_text": null,
                "content_image_url": null,
                "question": {
                    "question_id": 503,
                    "title": "Science",
                    "text": "Which planet is known as the Red Planet?",
                    "question_type": "multiple_choice",
                    "image_url": null,
                    "partial_scoring": 0,
                    "time_limit": 15,
                    "max_point": 70,
                    "min_point": 0,
                    "faster_answers_more_points": true,
                    "options": [
                    {
                        "option_id": 209,
                        "text": "Venus",
                        "is_correct": true,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 210,
                        "text": "Mars",
                        "is_correct": true,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 211,
                        "text": "Jupiter",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    },
                    {
                        "option_id": 212,
                        "text": "Saturn",
                        "is_correct": false,
                        "votes": 0,
                        "image": null
                    }
                    ]
                },
                "leaderboard": null
                }
            ]
            }
    );
    serde_json::from_value(quiz_setup).ok()
}
*/
pub async fn get_quiz_setup(session_id: &str) -> Result<QuizSetup, Box<dyn std::error::Error>> {
    let url = format!("https://api.proslides.ir/api/quizzes/{}/export/", session_id);

    let client = Client::new();

    let response = client
        .get(&url)
        .send()
        .await?
        .error_for_status()?; // fail on 4xx/5xx automatically

    let quiz_setup: QuizSetup = response.json().await?;

    Ok(quiz_setup)
}