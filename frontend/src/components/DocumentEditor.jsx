
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReconnectingWebSocket from 'reconnecting-websocket';

function DocumentEditor() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState({ blocks: [] });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [docWs, setDocWs] = useState(null);
  const [commentWs, setCommentWs] = useState(null);
  const [isViewer, setIsViewer] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchDocument = async () => {
      try {
        const docResponse = await axios.get(`http://localhost:8000/api/documents/${id}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        const commentsResponse = await axios.get(`http://localhost:8000/api/documents/${id}/comments/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        const memberResponse = await axios.get(`http://localhost:8000/api/workspaces/${docResponse.data.workspace.id}/members/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        if (isMounted) {
          setDocument(docResponse.data);
          setContent(docResponse.data.content);
          setComments(commentsResponse.data);
          const userMember = memberResponse.data.find((m) => m.user.id === docResponse.data.owner.id);
          setIsViewer(userMember?.role === 'viewer');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || 'Failed to load document or comments');
        }
      }
    };
    fetchDocument();

    const docWebsocket = new ReconnectingWebSocket(`ws://localhost:8000/ws/documents/${id}/`);
    docWebsocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (isMounted) setContent(data.content || content);
    };
    setDocWs(docWebsocket);

    const commentWebsocket = new ReconnectingWebSocket(`ws://localhost:8000/ws/comments/${id}/`);
    commentWebsocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (isMounted) {
        if (data.comment) {
          setComments((prev) => [...prev, data.comment]);
        } else if (data.delete_comment_id) {
          setComments((prev) => prev.filter((c) => c.id !== data.delete_comment_id));
        }
      }
    };
    setCommentWs(commentWebsocket);

    return () => {
      isMounted = false;
      docWebsocket.close();
      commentWebsocket.close();
    };
  }, [id]);

  const handleContentChange = async (e) => {
    if (isViewer) {
      setError('Viewers cannot edit documents');
      return;
    }
    const newContent = { blocks: [{ text: e.target.value }] };
    setContent(newContent);
    if (docWs) {
      docWs.send(JSON.stringify({ content: newContent }));
    }
    try {
      await axios.put(
        `http://localhost:8000/api/documents/${id}/`,
        { title: document.title, content: newContent },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update document');
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (isViewer) {
      setError('Viewers cannot add comments');
      return;
    }
    if (!newComment.trim()) {
      setError('Comment cannot be empty');
      return;
    }
    try {
      const response = await axios.post(
        `http://localhost:8000/api/documents/${id}/comments/`,
        { content: newComment, document: id },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      if (commentWs) {
        commentWs.send(JSON.stringify({ comment: response.data }));
      }
      setNewComment('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add comment');
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (isViewer) {
      setError('Viewers cannot delete comments');
      return;
    }
    try {
      await axios.delete(`http://localhost:8000/api/comments/${commentId}/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (commentWs) {
        commentWs.send(JSON.stringify({ delete_comment_id: commentId }));
      }
      setError('');
    } catch (err) {
      setError('Failed to delete comment');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (isViewer) {
      setError('Viewers cannot upload attachments');
      return;
    }
    if (!file) {
      setError('No file selected');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post(
        `http://localhost:8000/api/documents/${id}/attachments/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setFile(null);
      setError('');
      alert(`File uploaded: ${response.data.file_url}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
    }
  };

  if (!document && error) return <div className="text-red-500">{error}</div>;

  if (!document) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">{document.title}</h2>
      {error && <p className="text-red-500">{error}</p>}
      <textarea
        value={content.blocks[0]?.text || ''}
        onChange={handleContentChange}
        className="w-full p-2 border rounded h-64 mb-4"
        placeholder="Document content..."
        readOnly={isViewer}
      />
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Comments</h3>
        {!isViewer && (
          <form onSubmit={handleCommentSubmit} className="mb-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full p-2 border rounded h-24"
              placeholder="Add a comment..."
            />
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded mt-2">
              Add Comment
            </button>
          </form>
        )}
        <ul>
          {comments.map((comment) => (
            <li key={comment.id} className="p-2 border-b">
              <p>
                <strong>{comment.user.username}</strong>: {comment.content}
              </p>
              {!isViewer && (
                <button
                  onClick={() => handleCommentDelete(comment.id)}
                  className="text-red-500 text-sm"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {!isViewer && (
        <form onSubmit={handleFileUpload}>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="mb-2"
            accept="image/*,.pdf"
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
            Upload Attachment
          </button>
        </form>
      )}
    </div>
  );
}

export default DocumentEditor;