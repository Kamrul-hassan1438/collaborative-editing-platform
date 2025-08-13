# backend/workspaces/urls.py
from django.urls import path
from .views import (
    WorkspaceView,
    WorkspaceDetailView,
    WorkspaceMemberView,
    FolderView,
    DocumentView,
    DocumentDetailView,
    AttachmentView,
    CommentView,
    CommentDetailView,
    JoinWorkspaceView,
    DocumentVersionView,
    DocumentVersionDetailView,
    DocumentRevertView,
    FolderDetailView,
    SaveDocumentVersionView
)

urlpatterns = [
    path('workspaces/', WorkspaceView.as_view(), name='workspaces'),
    path('workspaces/<int:pk>/', WorkspaceDetailView.as_view(), name='workspace-detail'),
    path('workspaces/<int:workspace_id>/members/', WorkspaceMemberView.as_view(), name='workspace-members'),
    path('workspaces/<int:workspace_id>/documents/', DocumentView.as_view(), name='documents'),
    path('documents/<int:pk>/', DocumentDetailView.as_view(), name='document-detail'),
    path('documents/<int:document_id>/attachments/', AttachmentView.as_view(), name='attachments'),
    path('documents/<int:document_id>/comments/', CommentView.as_view(), name='comments'),
    path('comments/<int:pk>/', CommentDetailView.as_view(), name='comment-detail'),
    path('workspaces/<int:workspace_id>/join/', JoinWorkspaceView.as_view(), name='join-workspace'),

    path('documents/<int:document_id>/versions/', DocumentVersionView.as_view(), name='document-versions'),
    path('documents/<int:document_id>/versions/<int:version_id>/', DocumentVersionDetailView.as_view(), name='document-version-detail'),
    path('documents/<int:document_id>/revert/<int:version_id>/', DocumentRevertView.as_view(), name='document-revert'),


    path('workspaces/<int:workspace_id>/folders/', FolderView.as_view(), name='folder-list-create'),
    path('workspaces/<int:workspace_id>/folders/<int:folder_id>/', FolderDetailView.as_view(), name='folder-detail'),
    path('documents/<int:pk>/save_version/', SaveDocumentVersionView.as_view(), name='document-save-version'),

]