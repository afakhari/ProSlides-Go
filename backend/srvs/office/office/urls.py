from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import routers, permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from . import views
from .swagger_info import swagger_info

# Schema View برای Swagger
schema_view = get_schema_view(
    swagger_info,
    public=True,
    permission_classes=(permissions.AllowAny,),
)

router = routers.DefaultRouter(trailing_slash='/?')

# Quiz routes
router.register(r'quizzes', views.QuizViewSet, basename='quiz')

# Slide routes (nested under quizzes)
router.register(r'quizzes/(?P<quiz_pk>\d+)/slides',
                views.SlideViewSet, basename='slide')

# Option routes (nested under questions)
router.register(r'quizzes/(?P<quiz_pk>\d+)/slides/(?P<slide_pk>\d+)/question/options',
                views.OptionViewSet, basename='option')

# Player session routes
router.register(r'player-sessions', views.PlayerSessionViewSet,
                basename='playersession')

# Content management view
content_view = views.ContentViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'delete': 'destroy'
})

# Leaderboard view
leaderboard_view = views.LeaderboardReceiveView.as_view({'post': 'create'})

# Question results (votes) view
question_results_view = views.QuestionResultsReceiveView.as_view({'post': 'create'})

# Question endpoints
question_view = views.QuestionViewSet.as_view({
    'get': 'retrieve',
    'post': 'create',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    re_path(r'^admin$', RedirectView.as_view(url='/admin/', permanent=False)),

    # API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    re_path(r'^swagger$', RedirectView.as_view(url='/swagger/', permanent=False)),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    re_path(r'^redoc$', RedirectView.as_view(url='/redoc/', permanent=False)),
    path('swagger.json/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    re_path(r'^swagger\\.json$', RedirectView.as_view(url='/swagger.json/', permanent=False)),

    # Question endpoint (nested)
    re_path(
        r'^api/quizzes/(?P<quiz_pk>\d+)/slides/(?P<slide_pk>\d+)/question/?$',
        question_view,
        name='question-detail'
    ),

    # Content endpoint (nested)
    re_path(
        r'^api/quizzes/(?P<quiz_pk>\d+)/slides/(?P<slide_pk>\d+)/content/?$',
        content_view,
        name='slide-content'
    ),

    # Leaderboard endpoint (nested under question)
    re_path(
        r'^api/quizzes/(?P<quiz_pk>\d+)/slides/(?P<slide_pk>\d+)/question/leaderboard/?$',
        leaderboard_view,
        name='question-leaderboard'
    ),
    re_path(
        r'^api/quizzes/(?P<quiz_pk>\d+)/slides/(?P<slide_pk>\d+)/question/results/?$',
        question_results_view,
        name='question-results'
    ),

    # Auth
    re_path(r'^api/auth/register/?$', views.RegisterView.as_view(), name='auth-register'),
    re_path(r'^api/auth/google/?$', views.GoogleAuthView.as_view(), name='auth-google'),
    re_path(r'^api/auth/verify/?$', views.VerifyEmailView.as_view(), name='auth-verify'),
    re_path(r'^api/auth/verify/resend/?$', views.ResendVerificationView.as_view(), name='auth-verify-resend'),
    re_path(r'^api/auth/password/reset/?$', views.PasswordResetRequestView.as_view(), name='auth-password-reset'),
    re_path(r'^api/auth/password/reset/confirm/?$', views.PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    re_path(r'^api/auth/logout/?$', views.LogoutView.as_view(), name='auth-logout'),
    re_path(r'^api/auth/token/?$', views.ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    re_path(r'^api/auth/token/refresh/?$', views.ThrottledTokenRefreshView.as_view(), name='token_refresh'),

    # API routes
    path('api/', include(router.urls)),
    re_path(r'^api$', RedirectView.as_view(url='/api/', permanent=False)),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
