import logging
import time
import uuid

from django.conf import settings

from .logging_utils import set_request_id

logger = logging.getLogger("backend.request")


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.META.get("HTTP_X_REQUEST_ID") or uuid.uuid4().hex
        request.request_id = request_id
        set_request_id(request_id)

        start_time = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        threshold_ms = getattr(settings, "LOG_REQUEST_THRESHOLD_MS", 500)

        if duration_ms >= threshold_ms:
            logger.info(
                "slow_request method=%s path=%s status=%s duration_ms=%.2f",
                request.method,
                request.path,
                response.status_code,
                duration_ms,
            )

        response["X-Request-ID"] = request_id
        set_request_id("-")
        return response
