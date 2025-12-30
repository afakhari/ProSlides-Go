import pytest

from backend.srvs.office.office.models import Leaderboard, PlayerSession, Option
from backend.srvs.office.tests.factories import (
    QuizFactory,
    QuestionFactory,
    PlayerSessionFactory,
    OptionFactory,
)


@pytest.mark.django_db
def test_reset_result_clears_leaderboard_and_participants(api_client):
    quiz = QuizFactory()
    question = QuestionFactory(slide__quiz=quiz)
    option1 = OptionFactory(question=question, votes=3)
    option2 = OptionFactory(question=question, votes=7)
    player1 = PlayerSessionFactory(quiz=quiz)
    player2 = PlayerSessionFactory(quiz=quiz)

    Leaderboard.objects.create(
        question=question,
        rust_session_id=player1.rust_session_id,
        player_name=player1.player_name,
        avatar=player1.avatar,
        score=10,
        time_taken=1.0,
        rank=1,
    )
    Leaderboard.objects.create(
        question=question,
        rust_session_id=player2.rust_session_id,
        player_name=player2.player_name,
        avatar=player2.avatar,
        score=5,
        time_taken=1.2,
        rank=2,
    )
    OptionFactory(question=question, votes=3)
    OptionFactory(question=question, votes=5)

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.post(f"/api/quizzes/{quiz.id}/reset-result/")
    assert resp.status_code == 200
    assert resp.data["participants_count"] == 0
    assert resp.data["leaderboard_deleted"] == 2
    assert resp.data["participants_deleted"] == 2

    assert Leaderboard.objects.filter(question__slide__quiz=quiz).count() == 0
    assert PlayerSession.objects.filter(quiz=quiz).count() == 0
    assert Option.objects.filter(question__slide__quiz=quiz).exclude(votes=0).count() == 0
