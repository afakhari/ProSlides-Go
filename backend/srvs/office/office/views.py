import logging
import re
import secrets
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.db.models import Count, F, Max, Sum
from django.utils import timezone
from django.contrib.auth import get_user_model
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard, EmailVerification
from .serializers import (
    QuizSerializer, SlideSerializer, QuestionSerializer, OptionSerializer,
    ExportSerializer, PlayerSessionSerializer, LeaderboardReceiveSerializer,
    QuestionResultsReceiveSerializer, RegisterSerializer, QuizListSerializer,
    VerifyEmailSerializer, ResendVerificationSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer
)
from .permissions import IsQuizOwner, IsExportServiceOrQuizOwner, IsServiceToken
from .pagination import StandardResultsSetPagination

User = get_user_model()

logger = logging.getLogger(__name__)


PAGINATION_PARAMS = [
    openapi.Parameter(
        "page",
        openapi.IN_QUERY,
        description="Page number",
        type=openapi.TYPE_INTEGER,
    ),
    openapi.Parameter(
        "page_size",
        openapi.IN_QUERY,
        description="Page size (max 100)",
        type=openapi.TYPE_INTEGER,
    ),
]


def paginated_response_schema(items_schema):
    return openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            "count": openapi.Schema(type=openapi.TYPE_INTEGER),
            "page": openapi.Schema(type=openapi.TYPE_INTEGER),
            "page_size": openapi.Schema(type=openapi.TYPE_INTEGER),
            "total_pages": openapi.Schema(type=openapi.TYPE_INTEGER),
            "next": openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
            "previous": openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
            "results": openapi.Schema(
                type=openapi.TYPE_ARRAY,
                items=items_schema,
            ),
        },
    )


QUIZ_ITEM_SCHEMA = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "quiz_id": openapi.Schema(type=openapi.TYPE_INTEGER),
        "title": openapi.Schema(type=openapi.TYPE_STRING),
        "created_at": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
        "updated_at": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
        "author": openapi.Schema(type=openapi.TYPE_STRING),
        "access_code": openapi.Schema(type=openapi.TYPE_STRING),
        "participants_count": openapi.Schema(type=openapi.TYPE_INTEGER),
        "music_url": openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
        "background_color": openapi.Schema(type=openapi.TYPE_STRING),
        "background_image_url": openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
        "slides": openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
    },
)

SLIDE_ITEM_SCHEMA = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "slide_id": openapi.Schema(type=openapi.TYPE_INTEGER),
        "slide_type": openapi.Schema(type=openapi.TYPE_INTEGER),
        "order": openapi.Schema(type=openapi.TYPE_INTEGER),
        "show_leaderboard_after": openapi.Schema(type=openapi.TYPE_BOOLEAN),
        "title": openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
        "content_text": openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
        "content_image_url": openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
        "question": openapi.Schema(type=openapi.TYPE_OBJECT, nullable=True),
        "leaderboard": openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
    },
)

PLAYER_SESSION_ITEM_SCHEMA = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "rust_session_id": openapi.Schema(type=openapi.TYPE_STRING),
        "quiz": openapi.Schema(type=openapi.TYPE_INTEGER),
        "player_name": openapi.Schema(type=openapi.TYPE_STRING),
        "avatar": openapi.Schema(type=openapi.TYPE_STRING),
    },
)


def generate_verification_code():
    return f"{secrets.randbelow(1_000_000):06d}"


def send_verification_email(user, code):
    ttl_minutes = settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES
    send_mail(
        subject="Your ProSlides verification code",
        message=(
            "Your verification code is {code}. "
            "It expires in {ttl} minutes."
        ).format(code=code, ttl=ttl_minutes),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def touch_quiz(quiz_id):
    Quiz.objects.filter(pk=quiz_id).update(updated_at=timezone.now())


def _format_django_validation_error(exc):
    if getattr(exc, "message_dict", None):
        return exc.message_dict
    if getattr(exc, "messages", None):
        return {"detail": exc.messages}
    return {"detail": str(exc)}


def _enforce_single_choice_correct(question, exclude_option_id=None):
    if question.question_type != "single":
        return
    existing = Option.objects.filter(question=question, is_correct=True)
    if exclude_option_id is not None:
        existing = existing.exclude(pk=exclude_option_id)
    if existing.exists():
        raise ValidationError({"detail": "Single choice questions can only have one correct option."})


def _enforce_slide_type(slide, expected_type, expected_label):
    if slide.slide_type != expected_type:
        raise ValidationError(
            {"detail": f"Slide type must be '{expected_label}' for this endpoint."}
        )


class QuizViewSet(viewsets.ModelViewSet):
    """
    مدیریت کوئیزها

    ایجاد، مشاهده، ویرایش و حذف کوئیزهای تعاملی
    """
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]
    swagger_tags = ["Quizzes"]
    pagination_class = StandardResultsSetPagination

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
        operation_description="Resolve quiz_id by access_code.",
        manual_parameters=[
            openapi.Parameter(
                "access_code",
                openapi.IN_QUERY,
                description="Quiz access code",
                type=openapi.TYPE_STRING,
                required=True,
            )
        ],
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    "quiz_id": openapi.Schema(type=openapi.TYPE_INTEGER),
                },
            ),
            400: openapi.Response("Missing access_code"),
            404: openapi.Response("Quiz not found"),
        },
        tags=["Quizzes"],
    )
    @action(
        detail=False,
        methods=['get'],
        url_path='resolve-access-code',
        permission_classes=[AllowAny],
    )
    def resolve_access_code(self, request):
        access_code = request.query_params.get("access_code", "").strip()
        if not access_code:
            return Response(
                {"detail": "access_code query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quiz = Quiz.objects.filter(access_code=access_code).values("id").first()
        if not quiz:
            return Response(
                {"detail": "Quiz not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"quiz_id": quiz["id"]})

    @swagger_auto_schema(
        operation_description="List quizzes.",
        manual_parameters=PAGINATION_PARAMS,
        responses={
            200: openapi.Response(
                "Paginated quiz list",
                schema=paginated_response_schema(QUIZ_ITEM_SCHEMA),
            )
        },
        tags=["Quizzes"],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="Return quiz list for user panel.",
        manual_parameters=PAGINATION_PARAMS,
        responses={
            200: openapi.Response(
                "Paginated quiz list",
                schema=paginated_response_schema(
                    openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            "quiz_id": openapi.Schema(type=openapi.TYPE_INTEGER),
                            "quiz_name": openapi.Schema(type=openapi.TYPE_STRING),
                            "last_update": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
                            "created_at": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
                            "access_code": openapi.Schema(type=openapi.TYPE_STRING),
                            "participants_count": openapi.Schema(type=openapi.TYPE_INTEGER),
                            "slides_count": openapi.Schema(type=openapi.TYPE_INTEGER),
                        },
                    )
                ),
            )
        },
        tags=["Quizzes"],
    )
    @action(detail=False, methods=['get'], url_path='list')
    def list_quizzes(self, request):
        queryset = self.get_queryset()
        queryset = queryset.annotate(slides_count=Count('slides', distinct=True))
        queryset = queryset.order_by('-created_at')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = QuizListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = QuizListSerializer(queryset, many=True)
        return Response(serializer.data)

    def _filter_quizzes_for_request(self, request, queryset):
        if request.user and request.user.is_authenticated:
            return queryset.filter(author=request.user.username)
        author = request.query_params.get('author')
        if author:
            return queryset.filter(author=author)
        return queryset

    def _next_copy_title(self, title):
        match = re.match(r'^(.*)\s\(copy\d+\)$', title)
        base_title = match.group(1) if match else title

        pattern = re.compile(rf'^{re.escape(base_title)} \(copy(\d+)\)$')
        existing = Quiz.objects.filter(
            title__startswith=f"{base_title} (copy"
        ).values_list('title', flat=True)
        max_copy = 0
        for existing_title in existing:
            matched = pattern.match(existing_title)
            if matched:
                max_copy = max(max_copy, int(matched.group(1)))
        return f"{base_title} (copy{max_copy + 1})"

    @swagger_auto_schema(
        operation_description="Resolve quiz_id by access_code.",
        manual_parameters=[
            openapi.Parameter(
                "access_code",
                openapi.IN_QUERY,
                description="Quiz access code",
                type=openapi.TYPE_STRING,
                required=True,
            )
        ],
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    "quiz_id": openapi.Schema(type=openapi.TYPE_INTEGER),
                },
            ),
            400: openapi.Response("Missing access_code"),
            404: openapi.Response("Quiz not found"),
        },
        tags=["Quizzes"],
    )
    @action(
        detail=False,
        methods=['get'],
        url_path='resolve-access-code',
        permission_classes=[AllowAny],
    )
    def resolve_access_code(self, request):
        access_code = request.query_params.get("access_code", "").strip()
        if not access_code:
            return Response(
                {"detail": "access_code query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quiz = Quiz.objects.filter(access_code=access_code).values("id").first()
        if not quiz:
            return Response(
                {"detail": "Quiz not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"quiz_id": quiz["id"]})

    @swagger_auto_schema(
        operation_description="List quizzes.",
        manual_parameters=PAGINATION_PARAMS,
        responses={
            200: openapi.Response(
                "Paginated quiz list",
                schema=paginated_response_schema(QUIZ_ITEM_SCHEMA),
            )
        },
        tags=["Quizzes"],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="Return quiz list for user panel.",
        manual_parameters=PAGINATION_PARAMS,
        responses={
            200: openapi.Response(
                "Paginated quiz list",
                schema=paginated_response_schema(
                    openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            "quiz_id": openapi.Schema(type=openapi.TYPE_INTEGER),
                            "quiz_name": openapi.Schema(type=openapi.TYPE_STRING),
                            "last_update": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
                            "created_at": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME),
                            "access_code": openapi.Schema(type=openapi.TYPE_STRING),
                            "participants_count": openapi.Schema(type=openapi.TYPE_INTEGER),
                            "slides_count": openapi.Schema(type=openapi.TYPE_INTEGER),
                        },
                    )
                ),
            )
        },
        tags=["Quizzes"],
    )
    @action(detail=False, methods=['get'], url_path='list')
    def list_quizzes(self, request):
        queryset = self._filter_quizzes_for_request(request, self.get_queryset())
        queryset = queryset.annotate(slides_count=Count('slides', distinct=True))
        queryset = queryset.order_by('-created_at')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = QuizListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = QuizListSerializer(queryset, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_description="صادرات کامل اطلاعات کوئیز برای Rust",
        manual_parameters=[
            openapi.Parameter(
                "X-Export-Token",
                openapi.IN_HEADER,
                description="Service token for Rust export access (optional if authenticated).",
                type=openapi.TYPE_STRING,
                required=False,
            )
        ],
        responses={200: ExportSerializer},
        tags=["Quizzes"]
    )
    @action(
        detail=True,
        methods=['get'],
        permission_classes=[IsExportServiceOrQuizOwner],
    )
    def export(self, request, pk=None):
        """
        صادرات کامل کوئیز برای اجرا در Rust

        این endpoint تمام اطلاعات کوئیز شامل اسلایدها، سوالات و گزینه‌ها را 
        به فرمت مورد نیاز Rust برمی‌گرداند.
        """
        if getattr(request, "_export_service_token_valid", False):
            quiz = get_object_or_404(Quiz, pk=pk)
        else:
            quiz = self.get_object()
        serializer = ExportSerializer(quiz)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_description="Calculate final leaderboard for a quiz.",
        responses={
            200: openapi.Response(
                "Final leaderboard",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "leaderboard": openapi.Schema(
                            type=openapi.TYPE_ARRAY,
                            items=openapi.Schema(
                                type=openapi.TYPE_OBJECT,
                                properties={
                                    "rust_session_id": openapi.Schema(type=openapi.TYPE_STRING),
                                    "player_name": openapi.Schema(type=openapi.TYPE_STRING),
                                    "avatar": openapi.Schema(type=openapi.TYPE_STRING),
                                    "score": openapi.Schema(type=openapi.TYPE_INTEGER),
                                    "rank": openapi.Schema(type=openapi.TYPE_INTEGER),
                                },
                            ),
                        )
                    },
                ),
            )
        },
        tags=["Leaderboard"]
    )
    @action(detail=True, methods=['get'], url_path='final-leaderboard')
    def final_leaderboard(self, request, pk=None):
        quiz = self.get_object()
        totals = (
            Leaderboard.objects
            .filter(question__slide__quiz=quiz)
            .values('rust_session_id')
            .annotate(score=Sum('score'))
            .order_by('-score', 'rust_session_id')
        )
        session_map = PlayerSession.objects.filter(
            quiz=quiz
        ).in_bulk(field_name='rust_session_id')

        fallback_rows = (
            Leaderboard.objects
            .filter(question__slide__quiz=quiz)
            .values('rust_session_id')
            .annotate(player_name=Max('player_name'), avatar=Max('avatar'))
        )
        fallback_map = {row['rust_session_id']: row for row in fallback_rows}

        entries = []
        for row in totals:
            rust_id = row['rust_session_id']
            session = session_map.get(rust_id)
            fallback = fallback_map.get(rust_id, {})
            entries.append({
                'rust_session_id': rust_id,
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
        responses={200: openapi.Response("Results reset")},
        tags=["Quizzes"]
    )
    @action(detail=True, methods=['post'], url_path='reset-result')
    def reset_result(self, request, pk=None):
        quiz = self.get_object()
        with transaction.atomic():
            Option.objects.filter(
                question__slide__quiz=quiz
            ).update(votes=0)
            leaderboard_deleted = Leaderboard.objects.filter(
                question__slide__quiz=quiz
            ).delete()[0]
            Option.objects.filter(question__slide__quiz=quiz).update(votes=0)
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
        responses={201: QuizSerializer},
        tags=["Quizzes"]
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
                    options = []
                    for idx, option in enumerate(
                        question.options.all().order_by('order', 'id'),
                        start=1,
                    ):
                        options.append(
                            Option(
                                question=new_question,
                                order=option.order or idx,
                                text=option.text,
                                is_correct=option.is_correct,
                                votes=0,
                                image_url=option.image_url,
                            )
                        )
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
    swagger_tags = ["Slides"]
    pagination_class = StandardResultsSetPagination

    @swagger_auto_schema(
        operation_description="List slides for a quiz.",
        manual_parameters=PAGINATION_PARAMS,
        responses={
            200: openapi.Response(
                "Paginated slide list",
                schema=paginated_response_schema(SLIDE_ITEM_SCHEMA),
            )
        },
        tags=["Slides"],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

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

        try:
            with transaction.atomic():
                if order is not None:
                    Slide.objects.filter(quiz=quiz, order__gte=order).update(order=F('order') + 1)
                serializer.save(quiz=quiz, order=order)
                touch_quiz(quiz.pk)
        except DjangoValidationError as exc:
            raise ValidationError(_format_django_validation_error(exc))
        except IntegrityError:
            logger.exception(
                "Slide constraint violation during create for quiz_id=%s",
                quiz.id,
            )
            raise ValidationError(
                {"detail": "Slide order conflicts with an existing slide."}
            )

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
        except DjangoValidationError as exc:
            return Response(_format_django_validation_error(exc), status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            logger.exception(
                "Slide order constraint violation for slide_id=%s quiz_id=%s",
                instance.id,
                quiz.id,
            )
            return Response(
                {
                    "error": "Failed to update slide",
                    "detail": "Slide order conflicts with an existing slide.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception(
                "Failed to update slide_id=%s quiz_id=%s", instance.id, quiz.id
            )
            return Response(
                {
                    "error": "Failed to update slide",
                    "detail": "Unexpected server error while updating the slide.",
                },
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
        },
        tags=["Questions"]
    )
    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        """
        دریافت سوال مربوط به یک اسلاید
        """
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            _enforce_slide_type(question.slide, 1, "question")
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
        },
        tags=["Questions"]
    )
    def create(self, request, quiz_pk=None, slide_pk=None):
        """
        ایجاد سوال جدید برای یک اسلاید

        هر اسلاید فقط می‌تواند یک سوال داشته باشد.
        """
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        _enforce_slide_type(slide, 1, "question")

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
            except DjangoValidationError as exc:
                return Response(
                    _format_django_validation_error(exc),
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except IntegrityError:
                logger.exception(
                    "Question constraint violation for slide_id=%s quiz_pk=%s",
                    slide_pk,
                    quiz_pk,
                )
                return Response(
                    {
                        "error": "Failed to create question",
                        "detail": "Question data violates database constraints.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception:
                logger.exception(
                    "Failed to create question for slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {
                        "error": "Failed to create question",
                        "detail": "Unexpected server error while creating the question.",
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        operation_description="آپدیت کامل سوال",
        request_body=QuestionSerializer,
        responses={
            200: QuestionSerializer,
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        },
        tags=["Questions"]
    )
    def update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت کامل سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            _enforce_slide_type(question.slide, 1, "question")
            serializer = QuestionSerializer(
                question, data=request.data, partial=False)
            serializer.is_valid(raise_exception=True)
            new_type = serializer.validated_data.get("question_type", question.question_type)
            if new_type == "single":
                correct_count = Option.objects.filter(question=question, is_correct=True).count()
                if correct_count > 1:
                    return Response(
                        {"detail": "Single choice questions can only have one correct option."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            try:
                serializer.save()
                touch_quiz(question.slide.quiz_id)
            except DjangoValidationError as exc:
                return Response(
                    _format_django_validation_error(exc),
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except IntegrityError:
                logger.exception(
                    "Question constraint violation for slide_id=%s quiz_pk=%s",
                    slide_pk,
                    quiz_pk,
                )
                return Response(
                    {
                        "error": "Failed to update question",
                        "detail": "Question data violates database constraints.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception:
                logger.exception(
                    "Failed to update question slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {
                        "error": "Failed to update question",
                        "detail": "Unexpected server error while updating the question.",
                    },
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
        },
        tags=["Questions"]
    )
    def partial_update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت جزئی سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            _enforce_slide_type(question.slide, 1, "question")
            serializer = QuestionSerializer(
                question, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            new_type = serializer.validated_data.get("question_type", question.question_type)
            if new_type == "single":
                correct_count = Option.objects.filter(question=question, is_correct=True).count()
                if correct_count > 1:
                    return Response(
                        {"detail": "Single choice questions can only have one correct option."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            try:
                serializer.save()
                touch_quiz(question.slide.quiz_id)
            except DjangoValidationError as exc:
                return Response(
                    _format_django_validation_error(exc),
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except IntegrityError:
                logger.exception(
                    "Question constraint violation for slide_id=%s quiz_pk=%s",
                    slide_pk,
                    quiz_pk,
                )
                return Response(
                    {
                        "error": "Failed to update question",
                        "detail": "Question data violates database constraints.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception:
                logger.exception(
                    "Failed to partially update question slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {
                        "error": "Failed to update question",
                        "detail": "Unexpected server error while updating the question.",
                    },
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
        },
        tags=["Questions"]
    )
    def destroy(self, request, quiz_pk=None, slide_pk=None):
        """حذف سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk,
                slide__quiz_id=quiz_pk,
                slide__quiz__owner=request.user
            )
            _enforce_slide_type(question.slide, 1, "question")
            quiz_id = question.slide.quiz_id
            question.delete()
            touch_quiz(quiz_id)
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
    swagger_tags = ["Options"]

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

    def _shift_option_orders(self, question, order, direction, old_order=None):
        max_order = (
            Option.objects.filter(question=question)
            .aggregate(max_order=Max('order'))
            .get('max_order') or 0
        )
        offset = max_order + 1000

        if direction == "insert":
            Option.objects.filter(
                question=question,
                order__gte=order,
            ).update(order=F('order') + offset)
            Option.objects.filter(
                question=question,
                order__gte=order + offset,
            ).update(order=F('order') - offset + 1)
            return

        if old_order is None:
            return

        if direction == "up":
            Option.objects.filter(
                question=question,
                order__gte=order,
                order__lt=old_order,
            ).update(order=F('order') + offset)
            Option.objects.filter(
                question=question,
                order__gte=order + offset,
                order__lt=old_order + offset,
            ).update(order=F('order') - offset + 1)
            return

        if direction == "down":
            Option.objects.filter(
                question=question,
                order__gt=old_order,
                order__lte=order,
            ).update(order=F('order') + offset)
            Option.objects.filter(
                question=question,
                order__gt=old_order + offset,
                order__lte=order + offset,
            ).update(order=F('order') - offset - 1)

    def _reorder_options(self, question, instance, new_order):
        options = list(Option.objects.filter(question=question).order_by('order'))
        options = [opt for opt in options if opt.pk != instance.pk]
        insert_pos = max(0, min(len(options), new_order - 1))
        options.insert(insert_pos, instance)

        max_order = (
            Option.objects.filter(question=question)
            .aggregate(max_order=Max('order'))
            .get('max_order') or 0
        )
        offset = max_order + 1000
        Option.objects.filter(question=question).update(order=F('order') + offset)

        for idx, option in enumerate(options, start=1):
            Option.objects.filter(pk=option.pk).update(order=idx)

    def perform_create(self, serializer):
        question = get_object_or_404(
            Question,
            slide_id=self.kwargs['slide_pk'],
            slide__quiz_id=self.kwargs['quiz_pk'],
            slide__quiz__owner=self.request.user
        )
        order = serializer.validated_data.get("order")
        if order is not None and order < 1:
            raise ValidationError({'order': 'must be a positive integer'})
        if serializer.validated_data.get("is_correct"):
            _enforce_single_choice_correct(question)
        try:
            with transaction.atomic():
                if order is not None:
                    self._shift_option_orders(question, order, "insert")
                serializer.save(question=question, order=order)
            touch_quiz(question.slide.quiz_id)
        except DjangoValidationError as exc:
            raise ValidationError(_format_django_validation_error(exc))
        except IntegrityError:
            logger.exception(
                "Option constraint violation for question slide_id=%s quiz_pk=%s",
                self.kwargs['slide_pk'],
                self.kwargs['quiz_pk'],
            )
            raise ValidationError(
                {"detail": "Option data violates database constraints."}
            )
        except Exception:
            logger.exception(
                "Failed to create option for question slide_id=%s quiz_pk=%s",
                self.kwargs['slide_pk'], self.kwargs['quiz_pk']
            )
            raise

    def perform_update(self, serializer):
        instance = serializer.instance
        new_order = serializer.validated_data.get("order", instance.order)
        if new_order is not None and new_order < 1:
            raise ValidationError({'order': 'must be a positive integer'})
        if serializer.validated_data.get("is_correct"):
            _enforce_single_choice_correct(instance.question, exclude_option_id=instance.pk)
        try:
            with transaction.atomic():
                if new_order != instance.order:
                    self._reorder_options(instance.question, instance, new_order)
                instance = serializer.save(order=new_order)
            touch_quiz(instance.question.slide.quiz_id)
        except DjangoValidationError as exc:
            raise ValidationError(_format_django_validation_error(exc))
        except IntegrityError:
            logger.exception(
                "Option constraint violation for question slide_id=%s quiz_pk=%s",
                self.kwargs['slide_pk'],
                self.kwargs['quiz_pk'],
            )
            raise ValidationError(
                {"detail": "Option data violates database constraints."}
            )

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
        responses={200: openapi.Response("محتوا دریافت شد")},
        tags=["Content"]
    )
    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        """دریافت محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        _enforce_slide_type(slide, 2, "content")
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
        responses={200: "محتوا با موفقیت آپدیت شد"},
        tags=["Content"]
    )
    def update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        _enforce_slide_type(slide, 2, "content")
        try:
            slide.title = request.data.get('title', slide.title)
            slide.content_text = request.data.get(
                'content_text', slide.content_text)
            slide.content_image_url = request.data.get(
                'content_image_url', slide.content_image_url)
            slide.save()
            touch_quiz(slide.quiz_id)
        except DjangoValidationError as exc:
            return Response(
                _format_django_validation_error(exc),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IntegrityError:
            logger.exception(
                "Content constraint violation for slide_id=%s quiz_pk=%s",
                slide_pk,
                quiz_pk,
            )
            return Response(
                {
                    "error": "Failed to update content",
                    "detail": "Content data violates database constraints.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception(
                "Failed to update content slide_id=%s quiz_pk=%s", slide_pk, quiz_pk
            )
            return Response(
                {
                    "error": "Failed to update content",
                    "detail": "Unexpected server error while updating content.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'title': slide.title,
            'content_text': slide.content_text,
            'content_image_url': slide.content_image_url
        })

    @swagger_auto_schema(
        operation_description="حذف محتوای اسلاید",
        responses={200: "محتوا با موفقیت حذف شد"},
        tags=["Content"]
    )
    def destroy(self, request, quiz_pk=None, slide_pk=None):
        """حذف محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        _enforce_slide_type(slide, 2, "content")
        try:
            slide.title = None
            slide.content_text = None
            slide.content_image_url = None
            slide.save()
            touch_quiz(slide.quiz_id)
        except DjangoValidationError as exc:
            return Response(
                _format_django_validation_error(exc),
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IntegrityError:
            logger.exception(
                "Content constraint violation for slide_id=%s quiz_pk=%s",
                slide_pk,
                quiz_pk,
            )
            return Response(
                {
                    "error": "Failed to delete content",
                    "detail": "Content data violates database constraints.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception(
                "Failed to delete content slide_id=%s quiz_pk=%s", slide_pk, quiz_pk
            )
            return Response(
                {
                    "error": "Failed to delete content",
                    "detail": "Unexpected server error while deleting content.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response({'status': 'content deleted'})


class PlayerSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    """
    مدیریت سشن‌های بازیکنان

    ارتباط بین Rust WebSocket و Django برای شناسایی بازیکنان
    """
    queryset = PlayerSession.objects.all()
    serializer_class = PlayerSessionSerializer
    swagger_tags = ["Players"]
    pagination_class = StandardResultsSetPagination

    @swagger_auto_schema(
        operation_description="List player sessions.",
        manual_parameters=PAGINATION_PARAMS,
        responses={
            200: openapi.Response(
                "Paginated player session list",
                schema=paginated_response_schema(PLAYER_SESSION_ITEM_SCHEMA),
            )
        },
        tags=["Players"],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return PlayerSession.objects.none()
        return PlayerSession.objects.filter(quiz__owner=self.request.user)

    def perform_create(self, serializer):
        quiz = get_object_or_404(
            Quiz,
            pk=serializer.validated_data["quiz"].id,
            owner=self.request.user,
        )
        serializer.save(quiz=quiz)



class LeaderboardReceiveView(viewsets.ViewSet):
    permission_classes = [IsServiceToken]
    """
    دریافت لیدربرد از Rust
    """

    @swagger_auto_schema(
        operation_description=(
            "Receive leaderboard entries for a question. "
            "Either rust_session_id or user_id is required per entry (rust_session_id preferred)."
        ),
        manual_parameters=[
            openapi.Parameter(
                "X-Export-Token",
                openapi.IN_HEADER,
                description="Service token required to submit leaderboard updates.",
                type=openapi.TYPE_STRING,
                required=True,
            )
        ],
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['leaderboard'],
            properties={
                'leaderboard': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        required=[
                            'player_name',
                            'avatar',
                            'score',
                            'time_taken',
                            'rank',
                        ],
                        properties={
                            'rust_session_id': openapi.Schema(type=openapi.TYPE_STRING),
                            'user_id': openapi.Schema(
                                type=openapi.TYPE_STRING,
                                description='Legacy alias for rust_session_id.',
                            ),
                            'player_name': openapi.Schema(type=openapi.TYPE_STRING),
                            'avatar': openapi.Schema(type=openapi.TYPE_STRING),
                            'score': openapi.Schema(type=openapi.TYPE_INTEGER),
                            'time_taken': openapi.Schema(type=openapi.TYPE_NUMBER),
                            'rank': openapi.Schema(type=openapi.TYPE_INTEGER),
                        },
                    ),
                )
            },
        ),
        responses={
            200: openapi.Response(
                "Leaderboard stored",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                        'saved_entries': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'total_entries': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'errors': openapi.Schema(
                            type=openapi.TYPE_ARRAY,
                            items=openapi.Schema(type=openapi.TYPE_OBJECT),
                        ),
                    },
                ),
            ),
            207: openapi.Response(
                "Leaderboard partially stored",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                        'saved_entries': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'total_entries': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'errors': openapi.Schema(
                            type=openapi.TYPE_ARRAY,
                            items=openapi.Schema(type=openapi.TYPE_OBJECT),
                        ),
                    },
                ),
            ),
            400: openapi.Response("Invalid payload"),
            404: openapi.Response("No question found for this slide"),
        },
        tags=["Leaderboard"]
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
                {'error': 'leaderboard list is empty; provide at least one entry'},
                status=status.HTTP_400_BAD_REQUEST
            )

        saved_count = 0
        errors = []
        for idx, entry in enumerate(leaderboard_data, start=1):
            try:
                rust_id = entry.get('rust_session_id')
                if not rust_id:
                    errors.append(
                        {'index': idx, 'detail': 'rust_session_id missing in entry'}
                    )
                    continue
                player_name = entry.get('player_name')
                avatar = entry.get('avatar')
                if not player_name:
                    errors.append(
                        {
                            'index': idx,
                            'rust_session_id': rust_id,
                            'detail': 'player_name missing in entry',
                        }
                    )
                    continue
                if not avatar:
                    errors.append(
                        {
                            'index': idx,
                            'rust_session_id': rust_id,
                            'detail': 'avatar missing in entry',
                        }
                    )
                    continue

                player_session = PlayerSession.objects.filter(
                    rust_session_id=rust_id
                ).first()

                if player_session:
                    if player_session.quiz_id != question.slide.quiz_id:
                        errors.append(
                            {
                                'index': idx,
                                'rust_session_id': rust_id,
                                'detail': 'player_session belongs to another quiz'
                            }
                        )
                        continue
                    updates = {}
                    if player_session.player_name != player_name:
                        updates['player_name'] = player_name
                    if player_session.avatar != avatar:
                        updates['avatar'] = avatar
                    if updates:
                        PlayerSession.objects.filter(pk=player_session.pk).update(**updates)
                        for key, value in updates.items():
                            setattr(player_session, key, value)
                else:
                    player_session = PlayerSession.objects.create(
                        rust_session_id=rust_id,
                        quiz=question.slide.quiz,
                        player_name=player_name,
                        avatar=avatar,
                    )

                Leaderboard.objects.update_or_create(
                    question=question,
                    rust_session_id=rust_id,
                    defaults={
                        'player_name': player_name,
                        'avatar': avatar,
                        'score': entry['score'],
                        'time_taken': entry['time_taken'],
                        'rank': entry['rank']
                    }
                )
                saved_count += 1
            except Exception:
                logger.exception(
                    "Failed to save leaderboard entry for question_id=%s", question.pk
                )
                errors.append(
                    {
                        'index': idx,
                        'rust_session_id': entry.get('rust_session_id'),
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


class QuestionResultsReceiveView(viewsets.ViewSet):
    """
    Receive final question results and persist option votes.
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Store final question results (option votes).",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['options'],
            properties={
                'options': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        required=['option_id', 'number_of_submits'],
                        properties={
                            'option_id': openapi.Schema(type=openapi.TYPE_INTEGER),
                            'number_of_submits': openapi.Schema(type=openapi.TYPE_INTEGER),
                        },
                    ),
                ),
            },
        ),
        responses={
            200: openapi.Response(
                "Results stored",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                        'updated_options': openapi.Schema(type=openapi.TYPE_INTEGER),
                    },
                ),
            ),
            400: openapi.Response("Invalid payload"),
            404: openapi.Response("No question found for this slide"),
        },
        tags=["Questions"],
    )
    def create(self, request, quiz_pk=None, slide_pk=None):
        serializer = QuestionResultsReceiveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            question = Question.objects.get(
                slide_id=slide_pk,
                slide__quiz_id=quiz_pk,
                slide__quiz__owner=request.user,
            )
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND,
            )

        options_data = serializer.validated_data.get('options', [])
        if not options_data:
            return Response(
                {'detail': 'options list is empty; provide at least one entry'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        option_ids = [item['option_id'] for item in options_data]
        if len(option_ids) != len(set(option_ids)):
            return Response(
                {'detail': 'Duplicate option_id values are not allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question_option_ids = list(
            Option.objects.filter(question=question).values_list('id', flat=True)
        )
        provided_ids = set(option_ids)
        expected_ids = set(question_option_ids)
        if provided_ids != expected_ids:
            missing = sorted(expected_ids - provided_ids)
            extra = sorted(provided_ids - expected_ids)
            return Response(
                {
                    'detail': 'options list must include every option for the question.',
                    'missing_option_ids': missing,
                    'unexpected_option_ids': extra,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        votes_map = {item['option_id']: item['number_of_submits'] for item in options_data}
        with transaction.atomic():
            options = list(
                Option.objects
                .select_for_update()
                .filter(question=question, id__in=option_ids)
            )
            for option in options:
                option.votes = votes_map.get(option.id, 0)
            Option.objects.bulk_update(options, ['votes'])
            touch_quiz(question.slide.quiz_id)

        return Response(
            {'status': 'results saved', 'updated_options': len(option_ids)},
            status=status.HTTP_200_OK,
        )


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @swagger_auto_schema(
        operation_description="Register a new user and send a verification code.",
        request_body=RegisterSerializer,
        responses={
            201: openapi.Response(
                "Verification code sent",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "username": openapi.Schema(type=openapi.TYPE_STRING),
                        "email": openapi.Schema(type=openapi.TYPE_STRING),
                        "is_active": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        "verification_sent": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    },
                ),
                examples={
                    "application/json": {
                        "username": "newuser",
                        "email": "new@example.com",
                        "is_active": False,
                        "verification_sent": True,
                    }
                },
            )
        },
        tags=["Auth"]
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        if settings.AUTH_REQUIRE_EMAIL_VERIFICATION:
            verification = EmailVerification.objects.create(
                user=user,
                code=generate_verification_code(),
                expires_at=timezone.now() + timezone.timedelta(
                    minutes=settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES
                ),
            )
            send_verification_email(user, verification.code)
        else:
            user.is_active = True
            user.save(update_fields=["is_active"])

        return Response(
            {
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active,
                "verification_sent": settings.AUTH_REQUIRE_EMAIL_VERIFICATION,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_verify"

    @swagger_auto_schema(
        operation_description="Verify a user's email with a code.",
        request_body=VerifyEmailSerializer,
        responses={
            200: openapi.Response(
                "Email verified",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Email verified"}},
            ),
            400: openapi.Response(
                "Invalid or expired code",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Invalid email or code"}},
            ),
            429: openapi.Response(
                "Too many failed attempts",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Too many failed attempts"}},
            ),
        },
        tags=["Auth"]
    )
    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response(
                {"detail": "Invalid email or code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_active:
            return Response({"detail": "Email already verified"})

        verification = EmailVerification.objects.filter(user=user, is_verified=False).first()
        if not verification or verification.code is None:
            return Response(
                {"detail": "Verification code not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if verification.is_expired():
            return Response(
                {"detail": "Verification code expired"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if verification.attempts >= settings.EMAIL_VERIFICATION_MAX_ATTEMPTS:
            return Response(
                {"detail": "Too many failed attempts"},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if code != verification.code:
            verification.attempts += 1
            verification.save(update_fields=["attempts"])
            return Response(
                {"detail": "Invalid email or code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = True
        user.save(update_fields=["is_active"])
        verification.is_verified = True
        verification.verified_at = timezone.now()
        verification.code = None
        verification.save(update_fields=["is_verified", "verified_at", "code"])

        return Response({"detail": "Email verified"})


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_verify"

    @swagger_auto_schema(
        operation_description="Resend email verification code.",
        request_body=ResendVerificationSerializer,
        responses={
            200: openapi.Response(
                "Verification code sent",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Verification code sent"}},
            ),
            429: openapi.Response(
                "Please wait before requesting a new code",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Please wait before requesting a new code."}},
            ),
        },
        tags=["Auth"]
    )
    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response(
                {"detail": "If the account exists, a code was sent."},
                status=status.HTTP_200_OK,
            )

        if user.is_active:
            return Response({"detail": "Email already verified"})

        verification, _ = EmailVerification.objects.get_or_create(
            user=user,
            defaults={
                "code": generate_verification_code(),
                "expires_at": timezone.now() + timezone.timedelta(
                    minutes=settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES
                ),
            },
        )

        resend_wait = settings.EMAIL_VERIFICATION_RESEND_SECONDS
        if verification.sent_at and (timezone.now() - verification.sent_at).total_seconds() < resend_wait:
            return Response(
                {"detail": "Please wait before requesting a new code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        verification.code = generate_verification_code()
        verification.attempts = 0
        verification.is_verified = False
        verification.expires_at = timezone.now() + timezone.timedelta(
            minutes=settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES
        )
        verification.save()
        send_verification_email(user, verification.code)

        return Response({"detail": "Verification code sent"})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @swagger_auto_schema(
        operation_description="Request a password reset link.",
        request_body=PasswordResetRequestSerializer,
        responses={
            200: openapi.Response(
                "If the account exists, a reset link was sent",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "If the account exists, a reset link was sent"}},
            )
        },
        tags=["Auth"]
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email).first()
        if user and user.is_active:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = settings.PASSWORD_RESET_URL_TEMPLATE.format(uid=uid, token=token)
            send_mail(
                subject="ProSlides password reset",
                message=(
                    "Use the link below to reset your password:\n{link}"
                ).format(link=reset_link),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

        return Response({"detail": "If the account exists, a reset link was sent"})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @swagger_auto_schema(
        operation_description="Confirm password reset using uid and token.",
        request_body=PasswordResetConfirmSerializer,
        responses={
            200: openapi.Response(
                "Password updated",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Password updated"}},
            ),
            400: openapi.Response(
                "Invalid token",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Invalid token"}},
            ),
        },
        tags=["Auth"]
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        try:
            user_id = urlsafe_base64_decode(uid).decode()
        except Exception:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(pk=user_id).first()
        if not user:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated"})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Blacklist a refresh token.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["refresh"],
            properties={
                "refresh": openapi.Schema(type=openapi.TYPE_STRING),
            },
        ),
        responses={
            200: openapi.Response(
                "Logged out",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Logged out"}},
            ),
            400: openapi.Response(
                "Invalid token",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={"detail": openapi.Schema(type=openapi.TYPE_STRING)},
                ),
                examples={"application/json": {"detail": "Invalid token"}},
            ),
        },
        tags=["Auth"]
    )
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response(
                {"detail": "refresh token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except Exception:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Logged out"})


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @swagger_auto_schema(
        operation_description="Obtain access and refresh tokens.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["username", "password"],
            properties={
                "username": openapi.Schema(type=openapi.TYPE_STRING),
                "password": openapi.Schema(type=openapi.TYPE_STRING),
            },
        ),
        responses={
            200: openapi.Response(
                "Tokens",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "access": openapi.Schema(type=openapi.TYPE_STRING),
                        "refresh": openapi.Schema(type=openapi.TYPE_STRING),
                    },
                ),
                examples={
                    "application/json": {
                        "access": "jwt-access-token",
                        "refresh": "jwt-refresh-token",
                    }
                },
            ),
            401: openapi.Response("Invalid credentials"),
        },
        tags=["Auth"]
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @swagger_auto_schema(
        operation_description="Refresh access token using a refresh token.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=["refresh"],
            properties={
                "refresh": openapi.Schema(type=openapi.TYPE_STRING),
            },
        ),
        responses={
            200: openapi.Response(
                "Access token",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "access": openapi.Schema(type=openapi.TYPE_STRING),
                    },
                ),
                examples={"application/json": {"access": "new-jwt-access-token"}},
            ),
            401: openapi.Response("Invalid token"),
        },
        tags=["Auth"]
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

