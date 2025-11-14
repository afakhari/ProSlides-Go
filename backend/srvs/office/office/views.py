from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import F, Max
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import Quiz, PickAnswerQuestion, Option
from .serializers import (
    QuizSerializer, QuizDetailSerializer,
    PickAnswerQuestionSerializer, PickAnswerQuestionCreateSerializer,
    OptionSerializer, QuizUpdateSerializer
)


class QuizViewSet(viewsets.ModelViewSet):
    """
    مدیریت کوئیزها

    ایجاد، مشاهده، ویرایش و حذف کوئیزهای آزمون
    """
    serializer_class = QuizSerializer
    queryset = Quiz.objects.all().order_by('id')

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return QuizUpdateSerializer
        return QuizSerializer

    def get_default_user(self):
        """دریافت یا ایجاد کاربر پیش‌فرض"""
        from django.contrib.auth.models import User
        user, created = User.objects.get_or_create(
            username='default_user',
            defaults={
                'email': 'default@quiz.com',
                'is_active': True,
                'is_staff': True,
                'is_superuser': True,
                'password': 'default_password'
            }
        )
        return user

    @swagger_auto_schema(
        operation_description="ایجاد یک کوئیز جدید",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['title'],
            properties={
                'title': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='عنوان کوئیز',
                    max_length=200
                )
            }
        ),
        responses={
            201: QuizSerializer,
            400: "داده‌های نامعتبر"
        }
    )
    def create(self, request, *args, **kwargs):
        """ایجاد کوئیز - مدیریت خودکار created_by"""
        user = self.get_default_user()

        data = request.data.copy()
        if isinstance(data, dict):
            data['created_by'] = user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = self.get_default_user()
        serializer.save(created_by=user)

    @swagger_auto_schema(
        method='get',
        operation_description="دریافت کامل کوئیز با سوالات و گزینه‌ها (برای Rust WebSocket)",
        responses={
            200: QuizDetailSerializer,
            404: "کوئیز پیدا نشد"
        }
    )
    @action(detail=True, methods=['get'])
    def full_quiz(self, request, pk=None):
        """API برای دریافت کامل کوئیز (مخصوص Rust)"""
        quiz = self.get_object()
        serializer = QuizDetailSerializer(quiz)
        return Response(serializer.data)


class PickAnswerQuestionViewSet(viewsets.ModelViewSet):
    """
    مدیریت سوالات چندگزینه‌ای

    ایجاد، مشاهده، ویرایش و حذف سوالات کوئیز
    """

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PickAnswerQuestionCreateSerializer
        return PickAnswerQuestionSerializer

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        return PickAnswerQuestion.objects.filter(quiz_id=quiz_id).order_by('order')

    def get_serializer_context(self):
        """اضافه کردن quiz به context - با بررسی وجود fake view برای Swagger"""
        context = super().get_serializer_context()

        # اگر Swagger در حال تولید schema است، از بررسی وجود کوئیز صرف نظر کن
        if getattr(self, 'swagger_fake_view', False):
            return context

        quiz_id = self.kwargs.get('quiz_pk')
        if quiz_id:
            try:
                context['quiz'] = get_object_or_404(Quiz, id=quiz_id)
            except:
                # اگر کوئیز وجود ندارد، برای Swagger مشکلی ایجاد نکن
                pass

        return context

    @swagger_auto_schema(
        operation_description="ایجاد سوال جدید در کوئیز",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['title', 'question_text', 'order'],
            properties={
                'title': openapi.Schema(type=openapi.TYPE_STRING, description='عنوان سوال'),
                'question_text': openapi.Schema(type=openapi.TYPE_STRING, description='متن سوال'),
                'order': openapi.Schema(type=openapi.TYPE_INTEGER, description='ترتیب سوال (بزرگتر از صفر)')
            }
        ),
        responses={
            201: PickAnswerQuestionSerializer,
            400: "داده‌های نامعتبر",
            404: "کوئیز پیدا نشد"
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        quiz_id = self.kwargs.get('quiz_pk')
        quiz = get_object_or_404(Quiz, id=quiz_id)
        serializer.save(quiz=quiz)


class OptionViewSet(viewsets.ModelViewSet):
    """
    مدیریت گزینه‌های سوالات

    ایجاد، مشاهده، ویرایش، حذف و مدیریت ترتیب گزینه‌ها
    """
    serializer_class = OptionSerializer
    queryset = Option.objects.all().order_by('order', 'id')

    def get_queryset(self):
        question_id = self.kwargs.get('question_pk')
        return Option.objects.filter(question_id=question_id).order_by('order', 'id')

    @swagger_auto_schema(
        operation_description="ایجاد گزینه جدید برای سوال",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['text'],
            properties={
                'text': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='متن گزینه',
                    max_length=200
                ),
                'is_correct': openapi.Schema(
                    type=openapi.TYPE_BOOLEAN,
                    description='آیا گزینه صحیح است؟',
                    default=False
                ),
                'order': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='ترتیب گزینه (بزرگتر از صفر). اگر خالی باشد، به صورت خودکار در انتها قرار می‌گیرد'
                )
            }
        ),
        responses={
            201: OptionSerializer,
            400: "داده‌های نامعتبر",
            404: "سوال پیدا نشد"
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="ویرایش گزینه",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'text': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='متن گزینه',
                    max_length=200
                ),
                'is_correct': openapi.Schema(
                    type=openapi.TYPE_BOOLEAN,
                    description='آیا گزینه صحیح است؟'
                ),
                'order': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='ترتیب جدید گزینه. در صورت تغییر، ترتیب گزینه‌های دیگر به طور خودکار تنظیم می‌شود'
                )
            }
        ),
        responses={
            200: OptionSerializer,
            400: "داده‌های نامعتبر",
            404: "گزینه پیدا نشد"
        }
    )
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="آپدیت جزئی گزینه",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'text': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='متن گزینه',
                    max_length=200
                ),
                'is_correct': openapi.Schema(
                    type=openapi.TYPE_BOOLEAN,
                    description='آیا گزینه صحیح است؟'
                ),
                'order': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='ترتیب جدید گزینه'
                )
            }
        ),
        responses={
            200: OptionSerializer,
            400: "داده‌های نامعتبر",
            404: "گزینه پیدا نشد"
        }
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="دریافت لیست گزینه‌های یک سوال",
        responses={
            200: OptionSerializer(many=True),
            404: "سوال پیدا نشد"
        }
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="دریافت جزئیات یک گزینه",
        responses={
            200: OptionSerializer,
            404: "گزینه پیدا نشد"
        }
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @swagger_auto_schema(
        operation_description="حذف گزینه",
        responses={
            204: "حذف موفق. گزینه‌های بعدی به طور خودکار به بالا منتقل می‌شوند.",
            404: "گزینه پیدا نشد"
        }
    )
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    @swagger_auto_schema(
        method='post',
        operation_description="جابجایی گزینه به بالا در ترتیب نمایش",
        responses={
            200: OptionSerializer,
            404: "گزینه پیدا نشد"
        }
    )
    @action(detail=True, methods=['post'])
    def move_up(self, request, quiz_pk=None, question_pk=None, pk=None):
        """جابجایی گزینه به بالا"""
        option = self.get_object()

        if option.order > 1:
            previous_option = Option.objects.filter(
                question=option.question,
                order=option.order - 1
            ).first()

            if previous_option:
                option.order, previous_option.order = previous_option.order, option.order
                option.save()
                previous_option.save()

        return Response(OptionSerializer(option).data)

    @swagger_auto_schema(
        method='post',
        operation_description="جابجایی گزینه به پایین در ترتیب نمایش",
        responses={
            200: OptionSerializer,
            404: "گزینه پیدا نشد"
        }
    )
    @action(detail=True, methods=['post'])
    def move_down(self, request, quiz_pk=None, question_pk=None, pk=None):
        """جابجایی گزینه به پایین"""
        option = self.get_object()
        max_order = Option.objects.filter(question=option.question).aggregate(
            Max('order')
        )['order__max']

        if option.order < max_order:
            next_option = Option.objects.filter(
                question=option.question,
                order=option.order + 1
            ).first()

            if next_option:
                option.order, next_option.order = next_option.order, option.order
                option.save()
                next_option.save()

        return Response(OptionSerializer(option).data)

    @swagger_auto_schema(
        method='post',
        operation_description="سفارشی‌سازی ترتیب گزینه‌ها با لیست IDها",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['order'],
            properties={
                'order': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Items(type=openapi.TYPE_INTEGER),
                    description='لیست ID گزینه‌ها به ترتیب دلخواه. تمام IDهای گزینه‌های سوال باید موجود باشد.'
                )
            }
        ),
        responses={
            200: OptionSerializer(many=True),
            400: "داده‌های نامعتبر - لیست باید شامل تمام IDهای گزینه‌ها باشد",
            404: "سوال پیدا نشد"
        }
    )
    @action(detail=False, methods=['post'])
    def reorder(self, request, quiz_pk=None, question_pk=None):
        """سفارشی‌سازی ترتیب گزینه‌ها"""
        question = get_object_or_404(PickAnswerQuestion, id=question_pk)
        new_order = request.data.get('order', [])

        if not isinstance(new_order, list):
            return Response(
                {"error": "Order must be a list of option IDs"},
                status=status.HTTP_400_BAD_REQUEST
            )

        existing_options = set(Option.objects.filter(
            question=question).values_list('id', flat=True))
        if set(new_order) != existing_options:
            return Response(
                {"error": "Order list must contain all option IDs for this question"},
                status=status.HTTP_400_BAD_REQUEST
            )

        for order, option_id in enumerate(new_order, 1):
            Option.objects.filter(id=option_id).update(order=order)

        options = Option.objects.filter(question=question).order_by('order')
        return Response(OptionSerializer(options, many=True).data)

    def perform_create(self, serializer):
        question_id = self.kwargs.get('question_pk')
        question = get_object_or_404(PickAnswerQuestion, id=question_id)

        data = serializer.validated_data

        if 'order' not in data or not data['order']:
            # اگر order مشخص نشده، آخرین order + 1 قرار بده
            last_order = Option.objects.filter(question=question).aggregate(
                Max('order')
            )['order__max'] or 0
            serializer.save(question=question, order=last_order + 1)
        else:
            target_order = data['order']

            # بررسی اینکه آیا order مورد نظر از قبل وجود دارد
            existing_option = Option.objects.filter(
                question=question,
                order=target_order
            ).first()

            if existing_option:
                # ✅ فقط orderهای بعد از target_order را جابجا کن
                self._shift_options_from_order(question, target_order)

            serializer.save(question=question)

    def perform_update(self, serializer):
        """هنگام آپدیت، اگر order تغییر کرد، گزینه‌ها را جابجا کن"""
        instance = self.get_object()
        new_order = serializer.validated_data.get('order')

        if new_order and new_order != instance.order:
            # ذخیره order قدیمی
            old_order = instance.order

            # ابتدا گزینه را به order موقت منتقل کن
            instance.order = 9999  # یک order موقت بسیار بزرگ
            instance.save()

            # orderهای بین old_order و new_order را جابجا کن
            if new_order > old_order:
                # اگر به سمت راست حرکت می‌کند
                self._shift_options_between_orders(question=instance.question,
                                                   start_order=old_order + 1,
                                                   end_order=new_order,
                                                   direction=-1)
            else:
                # اگر به سمت چپ حرکت می‌کند
                self._shift_options_between_orders(question=instance.question,
                                                   start_order=new_order,
                                                   end_order=old_order - 1,
                                                   direction=1)

            # حالا گزینه را به order جدید منتقل کن
            instance.order = new_order
            instance.save()

        else:
            serializer.save()

    def _shift_options_from_order(self, question, target_order):
        """جابجایی گزینه‌ها از یک order مشخص به بعد"""
        # پیدا کردن گزینه‌هایی که order >= target_order دارند
        queryset = Option.objects.filter(
            question=question,
            order__gte=target_order
        ).order_by('-order')  # مهم: از انتها به ابتدا بروزرسانی کن

        # افزایش order گزینه‌های موجود (از بزرگترین به کوچکترین)
        for option in queryset:
            option.order += 1
            option.save()

    def _shift_options_between_orders(self, question, start_order, end_order, direction):
        """جابجایی گزینه‌ها در یک بازه order مشخص"""
        if direction > 0:
            # به راست جابجا کن (افزایش)
            queryset = Option.objects.filter(
                question=question,
                order__gte=start_order,
                order__lte=end_order
            ).order_by('order')
            for option in queryset:
                option.order += 1
                option.save()
        else:
            # به چپ جابجا کن (کاهش)
            queryset = Option.objects.filter(
                question=question,
                order__gte=start_order,
                order__lte=end_order
            ).order_by('-order')
            for option in queryset:
                option.order -= 1
                option.save()

    def perform_destroy(self, instance):
        """هنگام حذف، گزینه‌های بعدی را یک پله به بالا ببر"""
        question = instance.question
        deleted_order = instance.order

        # حذف گزینه
        instance.delete()

        # کاهش order گزینه‌های بعدی
        Option.objects.filter(
            question=question,
            order__gt=deleted_order
        ).update(order=F('order') - 1)
