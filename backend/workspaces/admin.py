# backend/workspaces/admin.py
from django.contrib import admin
from .models import( Workspace, WorkspaceMember, Folder, Document, Comment
                    ,DocumentVersion)
@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'owner__username')

@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'user', 'role')
    list_filter = ('role',)
    search_fields = ('workspace__name', 'user__username')

@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ('name', 'workspace', 'parent', 'created_at')
    list_filter = ('workspace', 'created_at')
    search_fields = ('name', 'workspace__name')
    formfield_overrides = {
        'parent': {'widget': admin.widgets.ForeignKeyRawIdWidget},
    }
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['parent'].required = False
        return form

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'workspace', 'folder', 'created_at', 'updated_at')
    list_filter = ('workspace', 'created_at')
    search_fields = ('title', 'workspace__name')

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('document', 'user', 'content', 'block_id', 'created_at')
    list_filter = ('document', 'created_at')
    search_fields = ('content', 'user__username', 'document__title')

    
@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = ('document', 'version_number', 'created_at')
    list_filter = ('document', 'created_at')
    search_fields = ('document__title', 'version_number')
    readonly_fields = ('created_at',)

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return self.readonly_fields + ('version_number',)
        return self.readonly_fields