import { useState } from "react";
import axios from "../axios";

function CommentsSidebar({ isOpen, comments, isViewer, documentId, commentWs, setComments, setError, onClose }) {
  const [newComment, setNewComment] = useState("");

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (isViewer) {
      setError("Viewers cannot add comments");
      return;
    }
    if (!newComment.trim()) {
      setError("Comment cannot be empty");
      return;
    }
    try {
      const token = localStorage.getItem("access_token");
      const response = await axios.post(
        `http://localhost:8000/api/documents/${documentId}/comments/`,
        { content: newComment, document: documentId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (commentWs && commentWs.readyState === WebSocket.OPEN) {
        commentWs.send(JSON.stringify({ comment: response.data }));
      }
      setNewComment("");
      setError("");
    } catch (err) {
      console.error("Comment Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to add comment");
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (isViewer) {
      setError("Viewers cannot delete comments");
      return;
    }
    try {
      const token = localStorage.getItem("access_token");
      await axios.delete(`http://localhost:8000/api/comments/${commentId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (commentWs && commentWs.readyState === WebSocket.OPEN) {
        commentWs.send(JSON.stringify({ delete_comment_id: commentId }));
      }
      setError("");
    } catch (err) {
      console.error("Delete Comment Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to delete comment");
    }
  };

  const handleClose = () => {
    onClose(); // Use the onClose prop instead of setShowCommentsSidebar
  };

  if (!isOpen) return null;

  return (
    <div className={`sidebar ${isOpen ? 'open animate-slide-in' : 'animate-slide-out'}`}>
      <div className="sidebar-header">
        <span>Comments</span>
        <span className="close-icon" onClick={handleClose}>×</span>
      </div>
      {!isViewer && (
        <form onSubmit={handleCommentSubmit} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="textarea h-24"
            placeholder="Add a comment..."
          />
          <button type="submit" className="btn-primary mt-2 w-full">
            Add Comment
          </button>
        </form>
      )}
      <div className="comment-list">
        {comments.length === 0 ? (
          <p className="text-gray-500">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <p className="text-gray-700">
                <strong className="text-gray-900">{comment.user.username}</strong>: {comment.content}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(comment.created_at).toLocaleString()}
              </p>
              {!isViewer && (
                <button
                  onClick={() => handleCommentDelete(comment.id)}
                  className="btn-dang
er text-sm mt-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default CommentsSidebar;