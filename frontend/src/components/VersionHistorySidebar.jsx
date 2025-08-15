import { useEffect, useState, useCallback } from "react";
import axios from "../axios";
import VersionDiffPopup from "./VersionDiffPopup";

function VersionHistorySidebar({
  isOpen,
  versions,
  isViewer,
  documentId,
  currentContent,
  setError,
  setContent,
  setDocument,
  setUnsavedChanges,
  setUndoStack,
  setRedoStack,
  setVersions,
  onClose,
}) {
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffData, setDiffData] = useState({
    oldValue: "",
    versionNumber: null,
    versionId: null,
  });
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
  });

  const fetchPage = useCallback(
    async (targetPage) => {
      try {
        const res = await axios.get(
          `http://localhost:8000/api/documents/${documentId}/versions/?page=${targetPage}`,
          authHeaders()
        );
        const data = res.data;
        const list = Array.isArray(data) ? data : data.results || [];
        setVersions(list);
        setPage(targetPage);
        setHasNext(Boolean(data.next));
        setHasPrev(Boolean(data.previous));
        setSelectedVersionIndex(null);
        setIsDiffOpen(false);
        setError("");
        return list;
      } catch (err) {
        console.error("Fetch versions page error:", err.response?.data || err.message);
        setError(err.response?.data?.error || "Failed to load versions page");
        return null;
      }
    },
    [documentId, setVersions, setError]
  );

  useEffect(() => {
    if (!isOpen) return;
    fetchPage(1);
  }, [isOpen, fetchPage]);

  const handleVersionSelect = async (versionId, index) => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/documents/${documentId}/versions/${versionId}/`,
        authHeaders()
      );
      const versionContent =
        typeof res.data.content === "string"
          ? res.data.content
          : res.data.content?.blocks?.[0]?.text || "";
      setSelectedVersionIndex(index);
      setDiffData({
        oldValue: versionContent,
        versionNumber: res.data.version_number,
        versionId,
      });
      setIsDiffOpen(true);
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
      const res = await axios.post(
        `http://localhost:8000/api/documents/${documentId}/revert/${versionId}/`,
        {},
        authHeaders()
      );
      const validContent =
        typeof res.data.content === "string"
          ? res.data.content
          : res.data.content?.blocks?.[0]?.text || "";
      setContent(validContent);
      setDocument({ ...res.data, content: validContent });
      setUnsavedChanges(false);
      setUndoStack([validContent]);
      setRedoStack([]);
      localStorage.removeItem(`unsaved_document_${documentId}`);
      setError("");
      setIsDiffOpen(false);
      alert("Version reverted successfully");
    } catch (err) {
      console.error("Revert Error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to revert version");
    }
  };

  const handlePopupRevert = () => {
    if (!diffData.versionId) return;
    handleRevertVersion(diffData.versionId);
  };

  const handleNextVersion = async () => {
    if (selectedVersionIndex === null) return;
    if (selectedVersionIndex > 0) {
      const nextIndex = selectedVersionIndex - 1;
      return handleVersionSelect(versions[nextIndex].id, nextIndex);
    }
    if (hasPrev) {
      const list = await fetchPage(page - 1);
      if (list && list.length) {
        const idx = list.length - 1;
        return handleVersionSelect(list[idx].id, idx);
      }
    }
  };

  const handlePreviousVersion = async () => {
    if (selectedVersionIndex === null) return;
    if (selectedVersionIndex < versions.length - 1) {
      const prevIndex = selectedVersionIndex + 1;
      return handleVersionSelect(versions[prevIndex].id, prevIndex);
    }
    if (hasNext) {
      const list = await fetchPage(page + 1);
      if (list && list.length) {
        const idx = 0;
        return handleVersionSelect(list[idx].id, idx);
      }
    }
  };

  const goToPreviousPage = async () => {
    if (!hasPrev) return;
    await fetchPage(page - 1);
  };

  const goToNextPage = async () => {
    if (!hasNext) return;
    await fetchPage(page + 1);
  };

  if (!isOpen) return null;

  const safeVersions = Array.isArray(versions) ? versions : [];

  return (
    <>
      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'open animate-slide-in' : 'animate-slide-out'}`}>
        <div className="sidebar-header">
          <span>Version History</span>
          <span className="close-icon" onClick={onClose}>×</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {safeVersions.length === 0 ? (
            <p className="text-gray-500">No versions available</p>
          ) : (
            <ul className="space-y-2">
              {safeVersions.map((version, index) => (
                <li
                  key={version.id}
                  className={`p-3 rounded-lg cursor-pointer ${
                    selectedVersionIndex === index
                      ? "bg-blue-100"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => handleVersionSelect(version.id, index)}
                >
                  <p className="font-medium">
                    Version {version.version_number} by {version.user?.username || "Unknown"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(version.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pt-3 border-t mt-3 flex items-center justify-between">
          <button
            onClick={goToPreviousPage}
            disabled={!hasPrev}
            className="bg-gray-500 text-white px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-600"
          >
            Previous 5
          </button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <button
            onClick={goToNextPage}
            disabled={!hasNext}
            className="bg-gray-500 text-white px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-600"
          >
            Next 5
          </button>
        </div>
      </div>

      {/* Diff Popup (Moved outside sidebar container) */}
      <VersionDiffPopup
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        oldValue={diffData.oldValue}
        newValue={currentContent}
        versionNumber={diffData.versionNumber}
        onRevert={handlePopupRevert}
        isViewer={isViewer}
        onNext={handleNextVersion}
        onPrevious={handlePreviousVersion}
        disableNext={selectedVersionIndex === 0 && !hasPrev}
        disablePrevious={selectedVersionIndex === safeVersions.length - 1 && !hasNext}
      />
    </>
  );
}

export default VersionHistorySidebar;