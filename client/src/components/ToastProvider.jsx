import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext({
  success: () => {},
  error: () => {},
  info: () => {},
});

const TOAST_LIMIT = 4;
const DEFAULT_DURATION = 4000;

function buildToastId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((type, message, options = {}) => {
    if (!message) return;
    const id = buildToastId();
    const duration = Number.isFinite(options.duration) ? options.duration : DEFAULT_DURATION;
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      if (next.length > TOAST_LIMIT) {
        return next.slice(next.length - TOAST_LIMIT);
      }
      return next;
    });
    if (duration > 0) {
      window.setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const api = useMemo(() => ({
    success: (message, options) => pushToast("success", message, options),
    error: (message, options) => pushToast("error", message, options),
    info: (message, options) => pushToast("info", message, options),
    remove: removeToast,
  }), [pushToast, removeToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <div className="toast-message">{toast.message}</div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => removeToast(toast.id)}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
