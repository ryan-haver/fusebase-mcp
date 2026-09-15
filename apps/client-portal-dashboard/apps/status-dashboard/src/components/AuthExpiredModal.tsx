import { useMemo } from 'react'
import { authUiForAppTokenReason, type AuthTokenExpiredError } from '../lib/api'

interface AuthExpiredModalProps {
  onClose: () => void
  authError: AuthTokenExpiredError
}

/**
 * Auth failure modal — shown when AppTokenValidationError is mapped to AuthTokenExpiredError.
 * Copy depends on server `reason` (e.g. missing_gate_service_token is not a session timeout).
 */
export function AuthExpiredModal({ onClose, authError }: AuthExpiredModalProps) {
  const { title, body } = useMemo(
    () => authUiForAppTokenReason(authError.appTokenReason, authError.serverHint),
    [authError.appTokenReason, authError.serverHint],
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-gray-600 mb-3 text-sm leading-relaxed">{body}</p>
        {authError.appTokenReason ? (
          <p className="mb-6 font-mono text-xs text-slate-500">reason: {authError.appTokenReason}</p>
        ) : (
          <div className="mb-6" />
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  )
}
