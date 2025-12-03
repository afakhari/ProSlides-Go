# cmd
.venv\Scripts\activate
set PYTHONPATH=.
# set SECRET_KEY="django secret key"
set ALLOWED_HOSTS=127.0.0.1,localhost
set CORS_ALLOWED_ORIGINS=http://127.0.0.1:8000
set DJANGO_SETTINGS_MODULE=backend.srvs.office.office.settings
set DEBUG=True
python backend/srvs/office/manage.py makemigrations
python backend/srvs/office/manage.py migrate
python backend/srvs/office/manage.py runserver 127.0.0.1:8000
# TODO: password for redis