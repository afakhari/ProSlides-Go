import json
from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import Quiz, PickAnswerQuestion, Option


class QuizAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # ❌ حذف ساخت کاربر - حالا در views ساخته می‌شود
        # فقط کوئیز و سوالات تستی ایجاد کنید
        self.quiz = Quiz.objects.create(
            title="آزمون ریاضی پایه",
            created_by=User.objects.get(
                username='default_user')  # استفاده از کاربر موجود
        )

        self.question = PickAnswerQuestion.objects.create(
            quiz=self.quiz,
            title="سوال جمع ساده",
            question_text="حاصل ۲ + ۲ چیست؟",
            order=1
        )

        self.option1 = Option.objects.create(
            question=self.question,
            text="۴",
            is_correct=True
        )
        self.option2 = Option.objects.create(
            question=self.question,
            text="۵",
            is_correct=False
        )

    def _get_response_data(self, response):
        """کمک برای مدیریت pagination"""
        if hasattr(response, 'data') and 'results' in response.data:
            return response.data['results']
        return response.data

    def test_create_quiz(self):
        url = reverse('quiz-list')
        data = {"title": "آزمون علوم تجربی"}

        response = self.client.post(url, data, format='json')
        print("Create Quiz Response:",
              response.status_code, response.data)  # دیباگ
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Quiz.objects.count(), 2)
        self.assertEqual(response.data['title'], "آزمون علوم تجربی")

    def test_get_quiz_list(self):
        url = reverse('quiz-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self._get_response_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['title'], "آزمون ریاضی پایه")

    def test_get_quiz_detail(self):
        url = reverse('quiz-detail', kwargs={'pk': self.quiz.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "آزمون ریاضی پایه")

    def test_update_quiz(self):
        url = reverse('quiz-detail', kwargs={'pk': self.quiz.pk})
        data = {"title": "آزمون ریاضی پیشرفته"}

        response = self.client.put(url, data, format='json')
        print("Update Quiz Response:",
              response.status_code, response.data)  # دیباگ
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.title, "آزمون ریاضی پیشرفته")

    def test_delete_quiz(self):
        url = reverse('quiz-detail', kwargs={'pk': self.quiz.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Quiz.objects.count(), 0)

    def test_get_full_quiz(self):
        url = reverse('quiz-full-quiz', kwargs={'pk': self.quiz.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "آزمون ریاضی پایه")
        self.assertEqual(len(response.data['slides']), 1)

    def test_create_question(self):
        url = reverse('quiz-questions', kwargs={'quiz_pk': self.quiz.pk})
        data = {
            "title": "سوال تفریق",
            "question_text": "حاصل ۵ - ۳ چیست؟",
            "order": 2
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PickAnswerQuestion.objects.count(), 2)
        self.assertEqual(response.data['title'], "سوال تفریق")

    def test_create_question_with_invalid_order_zero(self):
        url = reverse('quiz-questions', kwargs={'quiz_pk': self.quiz.pk})
        data = {
            "title": "سوال نامعتبر",
            "question_text": "متن سوال",
            "order": 0
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_question_with_invalid_order_negative(self):
        url = reverse('quiz-questions', kwargs={'quiz_pk': self.quiz.pk})
        data = {
            "title": "سوال نامعتبر",
            "question_text": "متن سوال",
            "order": -1
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_question_with_duplicate_order(self):
        url = reverse('quiz-questions', kwargs={'quiz_pk': self.quiz.pk})
        data = {
            "title": "سوال تکراری",
            "question_text": "متن سوال تکراری",
            "order": 1  # همان order سوال موجود
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_question_list(self):
        url = reverse('quiz-questions', kwargs={'quiz_pk': self.quiz.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self._get_response_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['title'], "سوال جمع ساده")

    def test_get_question_detail(self):
        url = reverse('quiz-question-detail', kwargs={
            'quiz_pk': self.quiz.pk,
            'pk': self.question.pk
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "سوال جمع ساده")

    def test_update_question(self):
        url = reverse('quiz-question-detail', kwargs={
            'quiz_pk': self.quiz.pk,
            'pk': self.question.pk
        })
        data = {
            "title": "سوال جمع ویرایش شده",
            "question_text": "حاصل ۳ + ۴ چیست؟",
            "order": 1
        }

        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.question.refresh_from_db()
        self.assertEqual(self.question.title, "سوال جمع ویرایش شده")

    def test_partial_update_question(self):
        url = reverse('quiz-question-detail', kwargs={
            'quiz_pk': self.quiz.pk,
            'pk': self.question.pk
        })
        data = {"title": "فقط عنوان تغییر کرد"}

        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.question.refresh_from_db()
        self.assertEqual(self.question.title, "فقط عنوان تغییر کرد")

    def test_delete_question(self):
        url = reverse('quiz-question-detail', kwargs={
            'quiz_pk': self.quiz.pk,
            'pk': self.question.pk
        })
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(PickAnswerQuestion.objects.count(), 0)

    def test_create_option(self):
        url = reverse('question-options', kwargs={
            'quiz_pk': self.quiz.pk,
            'question_pk': self.question.pk
        })
        data = {
            "text": "گزینه تستی",
            "is_correct": True
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Option.objects.count(), 3)

    def test_get_option_list(self):
        url = reverse('question-options', kwargs={
            'quiz_pk': self.quiz.pk,
            'question_pk': self.question.pk
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self._get_response_data(response)
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['text'], "۴")

    def test_get_option_detail(self):
        url = reverse('question-option-detail', kwargs={
            'quiz_pk': self.quiz.pk,
            'question_pk': self.question.pk,
            'pk': self.option1.pk
        })
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['text'], "۴")

    def test_update_option(self):
        url = reverse('question-option-detail', kwargs={
            'quiz_pk': self.quiz.pk,
            'question_pk': self.question.pk,
            'pk': self.option1.pk
        })
        data = {
            "text": "گزینه ویرایش شده",
            "is_correct": False
        }

        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.option1.refresh_from_db()
        self.assertEqual(self.option1.text, "گزینه ویرایش شده")

    def test_delete_option(self):
        url = reverse('question-option-detail', kwargs={
            'quiz_pk': self.quiz.pk,
            'question_pk': self.question.pk,
            'pk': self.option1.pk
        })
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Option.objects.count(), 1)

    def test_complete_quiz_workflow(self):
        # ۱. ایجاد کوئیز جدید
        quiz_data = {"title": "آزمون جامع"}
        quiz_response = self.client.post(
            reverse('quiz-list'), quiz_data, format='json')

        # دیباگ برای بررسی ساختار پاسخ
        print("Quiz Response:", quiz_response.status_code, quiz_response.data)

        # بررسی که کوئیز ایجاد شده است
        self.assertEqual(quiz_response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', quiz_response.data)
        quiz_id = quiz_response.data['id']

        # ۲. ایجاد سوال اول
        question1_data = {
            "title": "سوال اول",
            "question_text": "متن سوال اول",
            "order": 1
        }
        question1_response = self.client.post(
            reverse('quiz-questions', kwargs={'quiz_pk': quiz_id}),
            question1_data,
            format='json'
        )

        # ۳. ایجاد سوال دوم
        question2_data = {
            "title": "سوال دوم",
            "question_text": "متن سوال دوم",
            "order": 2
        }
        question2_response = self.client.post(
            reverse('quiz-questions', kwargs={'quiz_pk': quiz_id}),
            question2_data,
            format='json'
        )

        # ۴. دریافت کامل کوئیز
        full_quiz_response = self.client.get(
            reverse('quiz-full-quiz', kwargs={'pk': quiz_id})
        )

        # بررسی نتایج
        self.assertEqual(question1_response.status_code,
                         status.HTTP_201_CREATED)
        self.assertEqual(question2_response.status_code,
                         status.HTTP_201_CREATED)
        self.assertEqual(full_quiz_response.status_code, status.HTTP_200_OK)

        # بررسی ساختار داده‌های برگشتی
        full_quiz_data = full_quiz_response.data
        self.assertEqual(full_quiz_data['title'], "آزمون جامع")
        self.assertEqual(len(full_quiz_data['slides']), 2)
