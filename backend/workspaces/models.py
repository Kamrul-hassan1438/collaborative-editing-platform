from django.db import models
from users.models import User
from pymongo import MongoClient
from django.conf import settings

class Workspace(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_workspaces')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspaces_workspace'

    def __str__(self):
        return self.name

class WorkspaceMember(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(
        max_length=20,
        choices=[('owner', 'Owner'), ('editor', 'Editor'), ('viewer', 'Viewer')],
        default='viewer'
    )

    class Meta:
        db_table = 'workspaces_member'
        unique_together = ['workspace', 'user']

    def __str__(self):
        return f"{self.user.username} - {self.workspace.name} ({self.role})"

class Folder(models.Model):
    name = models.CharField(max_length=255)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='folders')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspaces_folder'
        unique_together = ['workspace', 'name', 'parent']

    def __str__(self):
        return self.name

class Document(models.Model):
    title = models.CharField(max_length=255)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='documents')
    folder = models.ForeignKey(Folder, null=True, blank=True, on_delete=models.SET_NULL, related_name='documents')
    content = models.JSONField(default=dict(blocks=[dict(text="")]))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workspaces_document'

    def __str__(self):
        return self.title

    def save(self, *args, create_version=False, user=None, **kwargs):
        is_new = self._state.adding
        if is_new and not self.content:
            self.content = {"blocks": [{"text": ""}]}
        super().save(*args, **kwargs)
        if not is_new and create_version:
            latest_version = DocumentVersion.objects.filter(document=self).order_by('-version_number').first()
            version_number = (latest_version.version_number + 1) if latest_version else 1
            version = DocumentVersion.objects.create(
                document=self,
                user=user or (self._user if hasattr(self, '_user') else None),
                version_number=version_number
            )
            version.save_version_to_mongo(self.content)

class Comment(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    block_id = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'workspaces_comment'

    def __str__(self):
        return f"Comment by {self.user.username} on {self.document.title}"

class DocumentVersion(models.Model):
    document = models.ForeignKey('Document', on_delete=models.CASCADE, related_name='versions')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='document_versions')
    version_number = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    mongo_version_id = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'workspaces_document_version'
        unique_together = ['document', 'version_number']
        ordering = ['-version_number']

    def __str__(self):
        return f"Version {self.version_number} of {self.document.title}"

    def save_version_to_mongo(self, content):
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        versions_collection = db['document_versions']
        result = versions_collection.insert_one({
            'document_id': self.document.id,
            'version_number': self.version_number,
            'content': content,
            'created_at': self.created_at.isoformat(),
            'user_id': self.user.id if self.user else None
        })
        self.mongo_version_id = str(result.inserted_id)
        self.save()
        client.close()

        