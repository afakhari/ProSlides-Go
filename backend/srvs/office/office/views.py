import logging
import re
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, F, Max, Sum
from django.utils import timezone
from django.contrib.auth import get_user_model
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard
from .serializers import (
    QuizSerializer, SlideSerializer, QuestionSerializer, OptionSerializer,
    ExportSerializer, PlayerSessionSerializer, LeaderboardReceiveSerializer,
    RegisterSerializer, QuizListSerializer
)
from .permissions import IsQuizOwner

User = get_user_model()

logger = logging.getLogger(__name__)


def touch_quiz(quiz_id):
    Quiz.objects.filter(pk=quiz_id).update(updated_at=timezone.now())


class QuizViewSet(viewsets.ModelViewSet):
    """
    مدیریت کوئیزها

    ایجاد، مشاهده، ویرایش و حذف کوئیزهای تعاملی
    """
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return Quiz.objects.none()
        return Quiz.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _next_copy_title(self, title):
        match = re.match(r'^(.*)\s\(copy\d+\)$', title)
        base_title = match.group(1) if match else title

        pattern = re.compile(rf'^{re.escape(base_title)} \(copy(\d+)\)$')
        existing = Quiz.objects.filter(
            owner=self.request.user,
            title__startswith=f"{base_title} (copy"
        ).values_list('title', flat=True)
        max_copy = 0
        for existing_title in existing:
            matched = pattern.match(existing_title)
            if matched:
                max_copy = max(max_copy, int(matched.group(1)))
        return f"{base_title} (copy{max_copy + 1})"

    @swagger_auto_schema(
        operation_description="Return quiz list for user panel.",
        responses={200: QuizListSerializer(many=True)}
    )
    @action(detail=False, methods=['get'], url_path='list')
    def list_quizzes(self, request):
        queryset = self.get_queryset().annotate(slides_count=Count('slides', distinct=True))
        serializer = QuizListSerializer(queryset, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_description="صادرات کامل اطلاعات کوئیز برای Rust",
        responses={200: ExportSerializer}
    )
    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """
        صادرات کامل کوئیز برای اجرا در Rust

        این endpoint تمام اطلاعات کوئیز شامل اسلایدها، سوالات و گزینه‌ها را 
        به فرمت مورد نیاز Rust برمی‌گرداند.
        """
        quiz = self.get_object()
        serializer = ExportSerializer(quiz)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_description="Calculate final leaderboard for a quiz.",
        responses={200: openapi.Response("Final leaderboard")}
    )
    @action(detail=True, methods=['get'], url_path='final-leaderboard')
    def final_leaderboard(self, request, pk=None):
        quiz = self.get_object()
        totals = (
            Leaderboard.objects
            .filter(question__slide__quiz=quiz)
            .values('user_id')
            .annotate(score=Sum('score'))
            .order_by('-score', 'user_id')
        )
        session_map = PlayerSession.objects.filter(
            quiz=quiz
        ).in_bulk(field_name='user_id')

        fallback_rows = (
            Leaderboard.objects
            .filter(question__slide__quiz=quiz)
            .values('user_id')
            .annotate(player_name=Max('player_name'), avatar=Max('avatar'))
        )
        fallback_map = {row['user_id']: row for row in fallback_rows}

        entries = []
        for row in totals:
            user_id = row['user_id']
            session = session_map.get(user_id)
            fallback = fallback_map.get(user_id, {})
            entries.append({
                'user_id': user_id,
                'player_name': session.player_name if session else fallback.get('player_name'),
                'avatar': session.avatar if session else fallback.get('avatar'),
                'score': row['score'] or 0,
            })

        ranked = []
        prev_score = None
        current_rank = 0
        for idx, entry in enumerate(entries):
            if prev_score is None or entry['score'] < prev_score:
                current_rank = idx + 1
            prev_score = entry['score']
            entry['rank'] = current_rank
            ranked.append(entry)

        return Response({'leaderboard': ranked})

    @swagger_auto_schema(
        operation_description="Reset quiz results and participants.",
        responses={200: openapi.Response("Results reset")}
    )
    @action(detail=True, methods=['post'], url_path='reset-result')
    def reset_result(self, request, pk=None):
        quiz = self.get_object()
        with transaction.atomic():
            leaderboard_deleted = Leaderboard.objects.filter(
                question__slide__quiz=quiz
            ).delete()[0]
            participants_deleted = PlayerSession.objects.filter(
                quiz=quiz
            ).delete()[0]
            Quiz.objects.filter(pk=quiz.pk).update(
                participants_count=0,
                updated_at=timezone.now(),
            )
        return Response({
            'status': 'reset',
            'leaderboard_deleted': leaderboard_deleted,
            'participants_deleted': participants_deleted,
            'participants_count': 0,
        })

    @swagger_auto_schema(
        operation_description="Duplicate a quiz with all slides/questions/options.",
        responses={201: QuizSerializer}
    )
    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        quiz = self.get_object()
        with transaction.atomic():
            new_quiz = Quiz.objects.create(
                title=self._next_copy_title(quiz.title),
                author=quiz.author,
                owner=quiz.owner,
                music_url=quiz.music_url,
                background_color=quiz.background_color,
                background_image_url=quiz.background_image_url,
                participants_count=0,
            )

            for slide in quiz.slides.all().order_by('order'):
                new_slide = Slide.objects.create(
                    quiz=new_quiz,
                    slide_type=slide.slide_type,
                    order=slide.order,
                    show_leaderboard_after=slide.show_leaderboard_after,
                    title=slide.title,
                    content_text=slide.content_text,
                    content_image_url=slide.content_image_url,
                )

                if slide.slide_type == 1 and hasattr(slide, 'question'):
                    question = slide.question
                    new_question = Question.objects.create(
                        slide=new_slide,
                        title=question.title,
                        text=question.text,
                        question_type=question.question_type,
                        min_point=question.min_point,
                        max_point=question.max_point,
                        time_limit=question.time_limit,
                        image_url=question.image_url,
                        faster_answers_more_points=question.faster_answers_more_points,
                        partial_scoring=question.partial_scoring,
                    )
                    options = [
                        Option(
                            question=new_question,
                            text=option.text,
                            is_correct=option.is_correct,
                            votes=0,
                            image_url=option.image_url,
                        )
                        for option in question.options.all()
                    ]
                    if options:
                        Option.objects.bulk_create(options)

        serializer = QuizSerializer(new_quiz)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SlideViewSet(viewsets.ModelViewSet):
    """
    مدیریت اسلایدهای کوئیز

    هر کوئیز می‌تواند چندین اسلاید از نوع سوال یا محتوا داشته باشد.
    """
    serializer_class = SlideSerializer

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return Slide.objects.none()
        return Slide.objects.filter(quiz_id=self.kwargs['quiz_pk'], quiz__owner=self.request.user)

    def perform_create(self, serializer):
        quiz = get_object_or_404(Quiz, pk=self.kwargs['quiz_pk'], owner=self.request.user)
        order = serializer.validated_data.get('order')
        if order is not None and order < 1:
            raise ValidationError({'order': 'must be a positive integer'})

        with transaction.atomic():
            if order is not None:
                Slide.objects.filter(quiz=quiz, order__gte=order).update(order=F('order') + 1)
            serializer.save(quiz=quiz, order=order)
            touch_quiz(quiz.pk)

    def _reorder_existing(self, quiz, instance, new_order):
        """Shift other slides to keep order unique when one slide moves."""
        old_order = instance.order

        if new_order is None or new_order == old_order:
            return
        if new_order < 1:
            raise ValidationError({'order': 'must be a positive integer'})

        # Build new ordering in memory
        slides = list(Slide.objects.filter(quiz=quiz).order_by('order'))
        slides = [s for s in slides if s.pk != instance.pk]
        insert_pos = max(0, min(len(slides), new_order - 1))
        slides.insert(insert_pos, instance)

        # Temporarily shift all orders to avoid unique constraint clashes
        offset = (Slide.objects.filter(quiz=quiz).aggregate(max_order=Max('order'))['max_order'] or 0) + 1000
        Slide.objects.filter(quiz=quiz).update(order=F('order') + offset)

        # Apply final ordering
        for idx, slide in enumerate(slides, start=1):
            Slide.objects.filter(pk=slide.pk).update(order=idx)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        quiz = instance.quiz
        new_order = serializer.validated_data.get('order', instance.order)

        try:
            with transaction.atomic():
                self._reorder_existing(quiz, instance, new_order)
                serializer.save(quiz=quiz, order=new_order)
                touch_quiz(quiz.pk)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception(
                "Failed to update slide_id=%s quiz_id=%s", instance.id, quiz.id
            )
            return Response(
                {'error': 'Failed to update slide'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(serializer.data)

    def perform_destroy(self, instance):
        quiz_id = instance.quiz_id
        super().perform_destroy(instance)
        touch_quiz(quiz_id)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class QuestionViewSet(viewsets.ViewSet):
    """
    مدیریت سوالات اسلایدها

    هر اسلاید از نوع سوال می‌تواند یک سوال داشته باشد.
    """

    @swagger_auto_schema(
        operation_description="دریافت سوال یک اسلاید",
        responses={
            200: QuestionSerializer,
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        """
        دریافت سوال مربوط به یک اسلاید
        """
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            serializer = QuestionSerializer(question)
            return Response(serializer.data)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        operation_description="ایجاد سوال جدید برای اسلاید",
        request_body=QuestionSerializer,
        responses={
            201: QuestionSerializer,
            400: openapi.Response("اسلاید از قبل سوال دارد")
        }
    )
    def create(self, request, quiz_pk=None, slide_pk=None):
        """
        ایجاد سوال جدید برای یک اسلاید

        هر اسلاید فقط می‌تواند یک سوال داشته باشد.
        """
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)

        with transaction.atomic():
            if Question.objects.filter(slide_id=slide_pk).exists():
                return Response(
                    {'error': 'This slide already has a question'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = QuestionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save(slide=slide)
                touch_quiz(slide.quiz_id)
            except Exception:
                logger.exception(
                    "Failed to create question for slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {'error': 'Failed to create question'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        operation_description="آپدیت کامل سوال",
        request_body=QuestionSerializer,
        responses={
            200: QuestionSerializer,
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت کامل سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            serializer = QuestionSerializer(
                question, data=request.data, partial=False)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
                touch_quiz(question.slide.quiz_id)
            except Exception:
                logger.exception(
                    "Failed to update question slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {'error': 'Failed to update question'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(serializer.data)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        operation_description="آپدیت جزئی سوال",
        request_body=QuestionSerializer,
        responses={
            200: QuestionSerializer,
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def partial_update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت جزئی سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            serializer = QuestionSerializer(
                question, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
                touch_quiz(question.slide.quiz_id)
            except Exception:
                logger.exception(
                    "Failed to partially update question slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {'error': 'Failed to update question'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(serializer.data)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        operation_description="حذف سوال یک اسلاید",
        responses={
            204: "سوال با موفقیت حذف شد",
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def destroy(self, request, quiz_pk=None, slide_pk=None):
        """حذف سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            question.delete()
            touch_quiz(question.slide.quiz_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )


class OptionViewSet(viewsets.ModelViewSet):
    """
    مدیریت گزینه‌های سوالات

    هر سوال می‌تواند چندین گزینه داشته باشد.
    """
    serializer_class = OptionSerializer

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return Option.objects.none()

        question = get_object_or_404(
            Question,
            slide_id=self.kwargs['slide_pk'],
            slide__quiz_id=self.kwargs['quiz_pk'],
            slide__quiz__owner=self.request.user
        )
        return Option.objects.filter(question=question)

    def perform_create(self, serializer):
        question = get_object_or_404(
            Question,
            slide_id=self.kwargs['slide_pk'],
            slide__quiz_id=self.kwargs['quiz_pk'],
            slide__quiz__owner=self.request.user
        )
        try:
            serializer.save(question=question)
            touch_quiz(question.slide.quiz_id)
        except Exception:
            logger.exception(
                "Failed to create option for question slide_id=%s quiz_pk=%s",
                self.kwargs['slide_pk'], self.kwargs['quiz_pk']
            )
            raise

    def perform_update(self, serializer):
        instance = serializer.save()
        touch_quiz(instance.question.slide.quiz_id)

    def perform_destroy(self, instance):
        quiz_id = instance.question.slide.quiz_id
        instance.delete()
        touch_quiz(quiz_id)


class ContentViewSet(viewsets.ViewSet):
    """
    مدیریت محتوای اسلایدها

    برای اسلایدهای نوع محتوا (slide_type=2)
    """

    @swagger_auto_schema(
        operation_description="دریافت محتوای اسلاید",
        responses={200: openapi.Response("محتوا دریافت شد")}
    )
    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        """دریافت محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        return Response({
            'title': slide.title,
            'content_text': slide.content_text,
            'content_image_url': slide.content_image_url
        })

    @swagger_auto_schema(
        operation_description="آپدیت محتوای اسلاید",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'title': openapi.Schema(type=openapi.TYPE_STRING),
                'content_text': openapi.Schema(type=openapi.TYPE_STRING),
                'content_image_url': openapi.Schema(type=openapi.TYPE_STRING),
            }
        ),
        responses={200: "محتوا با موفقیت آپدیت شد"}
    )
    def update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        try:
            slide.title = request.data.get('title', slide.title)
            slide.content_text = request.data.get(
                'content_text', slide.content_text)
            slide.content_image_url = request.data.get(
                'content_image_url', slide.content_image_url)
            slide.save()
            touch_quiz(slide.quiz_id)
        except Exception:
            logger.exception(
                "Failed to update content slide_id=%s quiz_pk=%s", slide_pk, quiz_pk
            )
            return Response(
                {'error': 'Failed to update content'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'title': slide.title,
            'content_text': slide.content_text,
            'content_image_url': slide.content_image_url
        })

    @swagger_auto_schema(
        operation_description="حذف محتوای اسلاید",
        responses={200: "محتوا با موفقیت حذف شد"}
    )
    def destroy(self, request, quiz_pk=None, slide_pk=None):
        """حذف محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        try:
            slide.title = None
            slide.content_text = None
            slide.content_image_url = None
            slide.save()
            touch_quiz(slide.quiz_id)
        except Exception:
            logger.exception(
                "Failed to delete content slide_id=%s quiz_pk=%s", slide_pk, quiz_pk
            )
            return Response(
                {'error': 'Failed to delete content'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response({'status': 'content deleted'})


class PlayerSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    """
    مدیریت سشن‌های بازیکنان

    ارتباط بین Rust WebSocket و Django برای شناسایی بازیکنان
    """
    queryset = PlayerSession.objects.all()
    serializer_class = PlayerSessionSerializer

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return PlayerSession.objects.none()
        return Quiz.objects.filter(owner=self.request.user)


class LeaderboardReceiveView(viewsets.ViewSet):
    permission_classes = [AllowAny]
    """
    دریافت لیدربرد از Rust
    """

    @swagger_auto_schema(
        operation_description="دریافت لیدربرد از Rust",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['leaderboard'],
            properties={
                'leaderboard': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            'user_id': openapi.Schema(type=openapi.TYPE_STRING),
                            'score': openapi.Schema(type=openapi.TYPE_INTEGER),
                            'time_taken': openapi.Schema(type=openapi.TYPE_NUMBER),
                            'rank': openapi.Schema(type=openapi.TYPE_INTEGER),
                        }
                    )
                )
            }
        ),
        responses={200: "لیدربرد با موفقیت ذخیره شد"}
    )
    def create(self, request, quiz_pk=None, slide_pk=None):
        """دریافت لیدربرد از Rust"""
        serializer = LeaderboardReceiveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # از روی slide_pk سوال مربوطه را پیدا می‌کنیم
        try:
            question = Question.objects.get(
                slide_id=slide_pk,
                slide__quiz_id=quiz_pk
            )
        except Question.DoesNotExist:
            return Response(
                {'error': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

        leaderboard_data = serializer.validated_data.get('leaderboard', [])
        if not leaderboard_data:
            return Response(
                {'error': 'leaderboard list is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        saved_count = 0
        errors = []
        for entry in leaderboard_data:
            try:
                rust_id = entry.get('user_id')
                if not rust_id:
                    errors.append({'detail': 'user_id missing in entry'})
                    continue

                player_session = PlayerSession.objects.filter(
                    user_id=rust_id
                ).first()

                if player_session:
                    Leaderboard.objects.update_or_create(
                        question=question,
                        user_id=rust_id,
                        defaults={
                            'player_name': player_session.player_name,
                            'avatar': player_session.avatar,
                            'score': entry['score'],
                            'time_taken': entry['time_taken'],
                            'rank': entry['rank']
                        }
                    )
                    saved_count += 1
                else:
                    errors.append(
                        {
                            'user_id': rust_id,
                            'detail': 'player_session not found'
                        }
                    )
            except Exception:
                logger.exception(
                    "Failed to save leaderboard entry for question_id=%s", question.pk
                )
                errors.append(
                    {
                        'user_id': entry.get('user_id'),
                        'detail': 'internal error while saving entry'
                    }
                )

        response_data = {
            'status': 'leaderboard saved',
            'saved_entries': saved_count,
            'total_entries': len(leaderboard_data)
        }
        if errors:
            response_data['errors'] = errors
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
        return Response(response_data)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

