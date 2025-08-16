import React from 'react';

function Modal({ isOpen, onClose, title, children, closing = false }) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300 ${closing ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`card w-full max-w-md transform transition-all duration-300 ${closing ? 'scale-95' : 'scale-100'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-2xl">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;