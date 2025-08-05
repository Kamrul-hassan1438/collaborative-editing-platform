from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),  # Ensure admin URL is correctly mapped
    path('api/', include('users.urls')),
    path('api/', include('workspaces.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)