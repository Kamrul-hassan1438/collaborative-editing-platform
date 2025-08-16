import React from "react";
import ReactDiffViewer from "react-diff-viewer-continued";

function VersionDiffPopup({
  isOpen,
  closing,
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
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ${closing ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-5xl max-h-[85vh] flex flex-col transform transition-all duration-300 ${closing ? 'scale-95' : 'scale-100'}`}>
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Version {versionNumber} Differences
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <div className="flex justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={onPrevious}
            disabled={disablePrevious}
            className="bg-gray-500 dark:bg-gray-600 text-white px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-600 dark:hover:bg-gray-500"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={disableNext}
            className="bg-gray-500 dark:bg-gray-600 text-white px-3 py-1 rounded disabled:opacity-50 hover:bg-gray-600 dark:hover:bg-gray-500"
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
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onRevert}
              className="bg-green-500 dark:bg-green-600 text-white px-4 py-2 rounded hover:bg-green-600 dark:hover:bg-green-700 w-full"
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