from itsdangerous import URLSafeTimedSerializer
from django.conf import settings

def get_serializer():
    return URLSafeTimedSerializer(settings.SECRET_KEY, salt="workspace-invite")

def generate_invite_token(workspace_id, role, expires_in=3600):
    s = URLSafeTimedSerializer(settings.SECRET_KEY)
    return s.dumps({'workspace_id': workspace_id, 'role': role})

def verify_invite_token(token, max_age=3600):
    s = URLSafeTimedSerializer(settings.SECRET_KEY)
    try:
        data = s.loads(token, max_age=max_age)
        return data  
    except Exception:
        return None
