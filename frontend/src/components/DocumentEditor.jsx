import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../axios";
import ReconnectingWebSocket from "reconnecting-websocket";
import ReactDiffViewer from "react-diff-viewer-continued";

function DocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState({ blocks: [{ text: "" }] });
  const [comments, setComments] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [docWs, setDocWs] = useState(null);
  const [commentWs, setCommentWs] = useState(null);
  const [isViewer, setIsViewer] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [localHistory, setLocalHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef(null);
  const isNavigating = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchDocument = async () => {
      try {
        const userId = localStorage.getItem("user_id");
        const token = localStorage.getItem("access_token");
        if (!userId || !token) {
          setError("Please log in to access this document.");
          return;
        }

        const docResponse = await axios.get(
          `http://localhost:8000/api/documents/${id}/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const [commentsResponse, versionsResponse, memberResponse] =
          await Promise.all([
            axios.get(`http://localhost:8000/api/documents/${id}/comments/`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`http://localhost:8000/api/documents/${id}/versions/`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(
              `http://localhost:8000/api/workspaces/${docResponse.data.workspace.id}/members/`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            ),
          ]);

        if (isMounted) {
          console.log("Document:", docResponse.data);
          console.log("Comments:", commentsResponse.data);
          console.log("Versions:", versionsResponse.data);
          console.log("Members:", memberResponse.data);
          const validContent =
            docResponse.data.content &&
            Array.isArray(docResponse.data.content.blocks) &&
            docResponse.data.content.blocks.length > 0
              ? docResponse.data.content
              : { blocks: [{ text: "" }] };
          setDocument({ ...docResponse.data, content: validContent });
          setContent(validContent);
          setLocalHistory([validContent]);
          setHistoryIndex(0);
          setComments(commentsResponse.data || []);
          setVersions(versionsResponse.data || []);
          const userMember = memberResponse.data.find(
            (m) => m.user.id === parseInt(userId)
          );
          setIsViewer(userMember?.role === "viewer");
        }
      } catch (err) {
        if (isMounted) {
          console.error("Fetch Error:", err.response?.data || err.message);
          setError(
            err.response?.data?.error ||
              err.message ||
              "Failed to load document or comments"
          );
        }
      }
    };
    fetchDocument();

    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Please log in to access real-time features");
      return;
    }

    const docWebsocket = new ReconnectingWebSocket(
      `ws://localhost:8000/ws/documents/${id}/?token=${token}`
    );
    const commentWebsocket = new ReconnectingWebSocket(
      `ws://localhost:8000/ws/comments/${id}/?token=${token}`
    );

    docWebsocket.onopen = () => console.log("Document WebSocket connected");
    docWebsocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("WebSocket document message:", data);
      if (isMounted) {
        if (data.error) {
          setError(data.error);
        } else if (
          data.content &&
          Array.isArray(data.content.blocks) &&
          data.content.blocks.length > 0
        ) {
          // Only update if not the current user's change to avoid overwriting local edits
          if (data.user_id !== parseInt(localStorage.getItem("user_id"))) {
            setContent(data.content);
            setDocument((prev) => ({ ...prev, content: data.content }));
            setLocalHistory((prev) => {
              const newHistory = [...prev.slice(0, historyIndex + 1), data.content];
              return newHistory.slice(-50); // Keep last 50 versions
            });
            setHistoryIndex((prev) => prev + 1);
          }
          if (data.version_number) {
            setVersions((prev) => [
              ...prev.filter((v) => v.version_number !== data.version_number),
              {
                id: data.version_id || data.version_number,
                version_number: data.version_number,
                user: { username: data.user || "Unknown" },
                created_at: data.created_at,
                content: data.content,
              },
            ].sort((a, b) => b.version_number - a.version_number));
          }
        } else {
          console.warn("Invalid WebSocket content:", data);
          setError("Received invalid document content");
        }
      }
    };

    commentWebsocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log("WebSocket comment message:", data);
      if (isMounted) {
        if (data.error) {
          setError(data.error);
        } else if (data.comment) {
          setComments((prev) => [...prev, data.comment]);
        } else if (data.delete_comment_id) {
          setComments((prev) =>
            prev.filter((c) => c.id !== data.delete_comment_id)
          );
        }
      }
    };

    docWebsocket.onclose = (e) => {
      console.log("Document WebSocket closed:", e.code, e.reason);
      if (e.code === 4001) setError("Authentication required");
      if (e.code === 4003)
        setError("Permission denied: You are not a workspace member");
      if (e.code === 4004) setError("Document not found");
    };
    commentWebsocket.onclose = (e) => {
      console.log("Comment WebSocket closed:", e.code, e.reason);
      if (e.code === 4001) setError("Authentication required");
      if (e.code === 4003)
        setError("Permission denied: You are not a workspace member");
      if (e.code === 4004) setError("Document not found");
    };

    setDocWs(docWebsocket);
    setCommentWs(commentWebsocket);

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSaveVersion();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const handleBeforeUnload = (e) => {
      if (unsavedChanges && !isNavigating.current) {
        e.preventDefault();
        return (e.returnValue =
          "You have unsaved changes. Do you want to save a version before leaving?");
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isMounted = false;
      docWebsocket.close();
      commentWebsocket.close();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [id]);

  // Handle navigation with confirmation
  const handleNavigation = async (path) => {
    if (unsavedChanges && !isNavigating.current) {
      isNavigating.current = true;
      const shouldSave = window.confirm(
        "You have unsaved changes. Do you want to save a version before leaving?"
      );
      if (shouldSave) {
        try {
          await handleSaveVersion();
          navigate(path);
        } catch (err) {
          console.error("Navigation Save Error:", err);
          setError("Failed to save before navigation");
          isNavigating.current = false;
        }
      } else {
        navigate(path);
      }
    } else {
      navigate(path);
    }
  };

  // Debounced content change handler
  useEffect(() => {
    const handler = setTimeout(() => {
      if (unsavedChanges) {
        setLocalHistory((prev) => {
          const newHistory = [...prev.slice(0, historyIndex + 1), content];
          return newHistory.slice(-50); // Keep last 50 versions
        });
        setHistoryIndex((prev) => prev + 1);
      }
    }, 500); // Debounce for 500ms
    return () => clearTimeout(handler);
  }, [content, unsavedChanges, historyIndex]);

  const handleContentChange = (e) => {
    if (isViewer) {
      setError("Viewers cannot edit documents");
      return;
    }
    const newContent = { blocks: [{ text: e.target.value || "" }] };
    setContent(newContent);
    setUnsavedChanges(true);
    if (docWs && docWs.readyState === WebSocket.OPEN) {
      docWs.send(
        JSON.stringify({
          content: newContent,
          user_id: parseInt(localStorage.getItem("user_id")),
        })
      );
    }
  };

  const handleSaveVersion = async () => {
    if (isViewer) {
      setError("Viewers cannot save versions");
      return;
    }
    try {
      const response = await axios.post(
        `http://localhost:8000/api/documents/${id}/save_version/`,
        { content },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      const versionsResponse = await axios.get(
        `http://localhost:8000/api/documents/${id}/versions/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      setVersions(versionsResponse.data || []);
      setUnsavedChanges(false);
      setLocalHistory([content]);
      setHistoryIndex(0);
      setError("");
      alert("Version saved successfully!");
    } catch (err) {
      console.error("Save Version Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to save version");
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setContent(localHistory[historyIndex - 1]);
      setUnsavedChanges(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < localHistory.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setContent(localHistory[historyIndex + 1]);
      setUnsavedChanges(true);
    }
  };

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
      const response = await axios.post(
        `http://localhost:8000/api/documents/${id}/comments/`,
        { content: newComment, document: id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
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
      await axios.delete(`http://localhost:8000/api/comments/${commentId}/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
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

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (isViewer) {
      setError("Viewers cannot upload attachments");
      return;
    }
    if (!file) {
      setError("No file selected");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await axios.post(
        `http://localhost:8000/api/documents/${id}/attachments/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      setFile(null);
      setError("");
      alert(`File uploaded: ${response.data.file_url}`);
    } catch (err) {
      console.error("Upload Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to upload file");
    }
  };

  const handleVersionSelect = async (versionId) => {
    try {
      const response = await axios.get(
        `http://localhost:8000/api/documents/${id}/versions/${versionId}/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      setSelectedVersion(
        response.data &&
          response.data.content &&
          Array.isArray(response.data.content.blocks)
          ? response.data
          : { ...response.data, content: { blocks: [{ text: "" }] } }
      );
      setError("");
    } catch (err) {
      console.error("Version Select Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to load version");
    }
  };

  const handleRevertVersion = async (versionId) => {
    if (isViewer) {
      setError("Viewers cannot revert versions");
      return;
    }
    try {
      const response = await axios.post(
        `http://localhost:8000/api/documents/${id}/revert/${versionId}/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );
      const validContent =
        response.data.content && Array.isArray(response.data.content.blocks)
          ? response.data.content
          : { blocks: [{ text: "" }] };
      setContent(validContent);
      setDocument({ ...response.data, content: validContent });
      setSelectedVersion(null);
      setUnsavedChanges(false);
      setLocalHistory([validContent]);
      setHistoryIndex(0);
      setError("");
      alert("Version reverted successfully");
    } catch (err) {
      console.error("Revert Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to revert version");
    }
  };

  const safeVersions = Array.isArray(versions) ? versions : [];
  const displayedVersions = showAllVersions
    ? safeVersions
    : safeVersions.slice(0, 5);

  if (!document && error)
    return <div className="error text-center">{error}</div>;

  if (!document)
    return <div className="text-center p-6 text-gray-500">Loading...</div>;

  return (
    <div className="container py-8">
      <div className="card">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">
          {document.title}
        </h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-4 flex items-center">
          <button
            onClick={() => handleNavigation("/workspaces")} // Example navigation
            className="bg-gray-500 text-white px-4 py-2 rounded mr-2 hover:bg-gray-600"
          >
            Back
          </button>
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="bg-gray-500 text-white px-4 py-2 rounded mr-2 hover:bg-gray-600 disabled:opacity-50"
          >
            Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= localHistory.length - 1}
            className="bg-gray-500 text-white px-4 py-2 rounded mr-2 hover:bg-gray-600 disabled:opacity-50"
          >
            Redo
          </button>
          {!isViewer && (
            <button
              onClick={handleSaveVersion}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Save Version (Ctrl+S)
            </button>
          )}
        </div>
        <div className="mb-6">
          <textarea
            ref={textareaRef}
            value={content.blocks[0]?.text || ""}
            onChange={handleContentChange}
            className="textarea h-96 text-lg w-full border rounded-lg p-4"
            placeholder="Document content..."
            readOnly={isViewer}
          />
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">
            Version History
          </h3>
          <ul className="space-y-2">
            {displayedVersions.map((version) => (
              <li
                key={version.id}
                className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"
              >
                <span>
                  Version {version.version_number} by{" "}
                  {version.user?.username || "Unknown"} (
                  {new Date(version.created_at).toLocaleString()})
                </span>
                <button
                  onClick={() => handleVersionSelect(version.id)}
                  className="bg-blue-500 text-white text-sm px-3 py-1 rounded hover:bg-blue-600"
                >
                  View
                </button>
              </li>
            ))}
          </ul>
          {safeVersions.length > 5 && (
            <button
              onClick={() => setShowAllVersions(!showAllVersions)}
              className="mt-3 text-blue-500 hover:underline"
            >
              {showAllVersions
                ? "Show Less"
                : `Show ${safeVersions.length - 5} More`}
            </button>
          )}
          {selectedVersion && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-semibold">
                    Version {selectedVersion.version_number} Diff
                  </h4>
                  <button
                    onClick={() => setSelectedVersion(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
                <ReactDiffViewer
                  oldValue={selectedVersion.content?.blocks?.[0]?.text || ""}
                  newValue={content.blocks?.[0]?.text || ""}
                  splitView={true}
                  leftTitle={`Version ${selectedVersion.version_number}`}
                  rightTitle="Current Version"
                  styles={{
                    variables: {
                      light: {
                        diffViewerBackground: "#fff",
                        codeFoldBackground: "#f7fafc",
                        diffViewerTitleBackground: "#edf2f7",
                      },
                      dark: {
                        diffViewerBackground: "#2d3748",
                        codeFoldBackground: "#1a202c",
                        diffViewerTitleBackground: "#4a5568",
                      },
                    },
                  }}
                />
                {!isViewer && (
                  <button
                    onClick={() => handleRevertVersion(selectedVersion.id)}
                    className="bg-green-500 text-white px-4 py-2 rounded mt-3 hover:bg-green-600"
                  >
                    Revert to this Version
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Comments</h3>
          {!isViewer && (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="textarea h-32 w-full border rounded-lg p-4"
                placeholder="Add a comment..."
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded mt-3 w-full hover:bg-blue-600"
              >
                Add Comment
              </button>
            </form>
          )}
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="border-b border-gray-200 pb-4">
                <p className="text-gray-700">
                  <strong className="text-gray-900">
                    {comment.user.username}
                  </strong>
                  : {comment.content}
                </p>
                {!isViewer && (
                  <button
                    onClick={() => handleCommentDelete(comment.id)}
                    className="text-red-500 text-sm hover:underline mt-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        {!isViewer && (
          <form onSubmit={handleFileUpload} className="mb-6">
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">
                Upload Attachment
              </label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                className="border rounded-lg p-2 w-full"
                accept="image/*,.pdf"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600"
            >
              Upload Attachment
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default DocumentEditor;