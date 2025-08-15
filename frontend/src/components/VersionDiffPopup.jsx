import React from "react";
import ReactDiffViewer from "react-diff-viewer-continued";

function VersionDiffPopup({
  isOpen,
  onClose,
  oldValue,
  newValue,
  versionNumber,
  onRevert,
  isViewer = false,
  onNext,
  onPrevious,
  disableNext,
  disablePrevious,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800">
            Version {versionNumber} Differences
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <div className="flex justify-between px-4 py-2 border-b border-gray-100">
          <button
            onClick={onPrevious}
            disabled={disablePrevious}
            className="bg-gray-500 text-white px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-600"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={disableNext}
            className="bg-gray-500 text-white px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-600"
          >
            Next
          </button>
        </div>

        {/* Diff Viewer */}
        <div className="flex-1 overflow-auto p-4">
          <ReactDiffViewer
            oldValue={oldValue}
            newValue={newValue}
            splitView={true}
            leftTitle={`Version ${versionNumber}`}
            rightTitle="Current Version"
          />
        </div>

        {/* Footer */}
        {!isViewer && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onRevert}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full"
            >
              Revert to this Version
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default VersionDiffPopup;
