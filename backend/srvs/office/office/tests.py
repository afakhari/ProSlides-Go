from contextlib import contextmanager
import logging

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import Quiz, Slide, Question, Option, Leaderboard, PlayerSession


@contextmanager
def suppress_request_warnings():
    logger = logging.getLogger("django.request")
    previous_level = logger.level
    logger.setLevel(logging.ERROR)
    try:
        yield
    finally:
        logger.setLevel(previous_level)


class OfficeAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="owner",
            password="pass1234",
            email="owner@example.com",
        )
        self.client.force_authenticate(user=self.user)

        quiz_fields = {field.name for field in Quiz._meta.get_fields()}
        quiz_kwargs = {"title": "Test Quiz"}
        if "owner" in quiz_fields:
            quiz_kwargs["owner"] = self.user
        self.quiz = Quiz.objects.create(**quiz_kwargs)
        self.slide = Slide.objects.create(quiz=self.quiz, slide_type=1, order=1)
        self.question = Question.objects.create(
            slide=self.slide,
            question_type="single",
            text="What is 2 + 2?",
            min_point=0,
            max_point=100,
            time_limit=30,
            faster_answers_more_points=False,
            partial_scoring=False,
        )
        self.option1 = Option.objects.create(
            question=self.question,
            order=1,
            text="4",
            is_correct=True,
        )
        self.option2 = Option.objects.create(
            question=self.question,
            order=2,
            text="5",
            is_correct=False,
        )

    @staticmethod
    def _get_results(response):
        if isinstance(response.data, dict) and "results" in response.data:
            return response.data["results"]
        return response.data

    def test_quiz_crud(self):
        create_url = reverse("quiz-list")
        response = self.client.post(
            create_url,
            {"title": "New Quiz"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        quiz_id = response.data.get("quiz_id") or response.data.get("id")
        self.assertIsNotNone(quiz_id)

        list_response = self.client.get(create_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        quizzes = self._get_results(list_response)
        self.assertTrue(any(q["quiz_id"] == quiz_id for q in quizzes))

        detail_url = reverse("quiz-detail", kwargs={"pk": quiz_id})
        patch_response = self.client.patch(
            detail_url, {"title": "Updated Quiz"}, format="json"
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_resolve_access_code(self):
        client = APIClient()
        url = reverse("quiz-resolve-access-code")
        response = client.get(url, {"access_code": self.quiz.access_code})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["quiz_id"], self.quiz.id)

    def test_slide_crud(self):
        list_url = reverse("slide-list", kwargs={"quiz_pk": self.quiz.pk})
        response = self.client.post(
            list_url,
            {"slide_type": 2, "order": 2, "title": "Intro"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        slide_id = response.data["slide_id"]

        detail_url = reverse(
            "slide-detail", kwargs={"quiz_pk": self.quiz.pk, "pk": slide_id}
        )
        patch_response = self.client.patch(
            detail_url, {"title": "Intro Updated"}, format="json"
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_question_crud(self):
        slide = Slide.objects.create(quiz=self.quiz, slide_type=1, order=2)
        url = reverse("question-detail", kwargs={"quiz_pk": self.quiz.pk, "slide_pk": slide.pk})

        payload = {
            "title": "Question 2",
            "text": "Another question?",
            "question_type": "single",
            "min_point": 0,
            "max_point": 100,
            "time_limit": 20,
            "faster_answers_more_points": False,
            "partial_scoring": False,
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        get_response = self.client.get(url)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)

        patch_response = self.client.patch(url, {"text": "Updated text"}, format="json")
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete(url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_option_crud(self):
        list_url = reverse(
            "option-list", kwargs={"quiz_pk": self.quiz.pk, "slide_pk": self.slide.pk}
        )
        response = self.client.post(
            list_url,
            {"text": "Option C", "is_correct": False, "order": 3},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        option_id = response.data["option_id"]

        detail_url = reverse(
            "option-detail",
            kwargs={"quiz_pk": self.quiz.pk, "slide_pk": self.slide.pk, "pk": option_id},
        )
        patch_response = self.client.patch(
            detail_url, {"text": "Option C Updated"}, format="json"
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_export_includes_question_options(self):
        url = reverse("quiz-export", kwargs={"pk": self.quiz.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("slides", response.data)
        self.assertEqual(response.data["access_code"], self.quiz.access_code)

        question_slide = next(
            (slide for slide in response.data["slides"] if slide["slide_type"] == 1),
            None,
        )
        self.assertIsNotNone(question_slide)
        self.assertIn("question", question_slide)
        self.assertEqual(len(question_slide["question"]["options"]), 2)

    def test_question_results_persists_votes(self):
        url = reverse(
            "question-results",
            kwargs={"quiz_pk": self.quiz.pk, "slide_pk": self.slide.pk},
        )
        payload = {
            "options": [
                {"option_id": self.option1.id, "number_of_submits": 5},
                {"option_id": self.option2.id, "number_of_submits": 2},
            ]
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.option1.refresh_from_db()
        self.option2.refresh_from_db()
        self.assertEqual(self.option1.votes, 5)
        self.assertEqual(self.option2.votes, 2)

    def test_question_results_requires_all_options(self):
        url = reverse(
            "question-results",
            kwargs={"quiz_pk": self.quiz.pk, "slide_pk": self.slide.pk},
        )
        payload = {
            "options": [{"option_id": self.option1.id, "number_of_submits": 1}]
        }
        with suppress_request_warnings():
            response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
    def test_leaderboard_receive_creates_entries(self):
        url = reverse(
            "question-leaderboard",
            kwargs={"quiz_pk": self.quiz.pk, "slide_pk": self.slide.pk},
        )
        payload = {
            "leaderboard": [
                {
                    "rust_session_id": "player-1",
                    "player_name": "Alice",
                    "avatar": "A",
                    "score": 120,
                    "time_taken": 2.5,
                    "rank": 1,
                }
            ]
        }
        response = self.client.post(
            url,
            payload,
            format="json",
            HTTP_X_EXPORT_TOKEN="test-export-token",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(PlayerSession.objects.filter(rust_session_id="player-1").exists())
        self.assertEqual(Leaderboard.objects.filter(question=self.question).count(), 1)
