from .base import *  # noqa: F401,F403

# Production overrides
DEBUG = False
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

# CORS disabled (allow all origins) for temporary troubleshooting.
# Restore stricter settings after local testing is complete.
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = env.bool("CORS_ALLOW_CREDENTIALS", False)
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["https://proslides.ir", "https://www.proslides.ir"],
)
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=["https://proslides.ir", "https://www.proslides.ir"],
)
