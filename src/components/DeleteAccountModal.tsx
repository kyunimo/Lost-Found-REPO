import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  title: string;
  who: string;
  self: boolean;
  reports: number;
  claims: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({ title, who, self, reports, claims, busy, onCancel, onConfirm }: Props) {
  const [text, setText] = useState("");
  const ready = text.trim() === "DELETE" && !busy;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4" onClick={busy ? undefined : onCancel}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle size={26} className="text-red-500" />
        </div>
        <h3 className="text-gray-900 font-bold text-center text-lg mb-1">{title}</h3>
        <p className="text-sm text-gray-600 text-center mb-4">
          {self ? "You are about to permanently delete your account." : <>You are about to permanently delete the account of <span className="font-semibold">{who}</span>.</>}
        </p>

        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 mb-4">
          <p className="font-semibold mb-1">Warning: this cannot be undone. All of this will be deleted:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>The login and profile (including saved contact details)</li>
            <li>{reports} report{reports === 1 ? "" : "s"} filed, with their photos, and any claims made on them</li>
            <li>{claims} claim{claims === 1 ? "" : "s"} submitted</li>
          </ul>
        </div>

        <label className="block text-sm text-gray-700 mb-1.5 font-medium">
          Type <span className="font-bold">DELETE</span> to confirm
        </label>
        <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="DELETE"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white mb-4" />

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={busy} className="flex-1 py-3 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 font-medium">Cancel</button>
          <button onClick={onConfirm} disabled={!ready} className="flex-1 py-3 rounded-xl text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 font-semibold">
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
