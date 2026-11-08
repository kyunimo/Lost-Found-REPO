import { useEffect, useState } from "react";
import { MapPin, Calendar, Tag, CheckCircle, Clock, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { fmtDate, Item, Match } from "../lib/types";

const NO_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' fill='#9ca3af' font-family='sans-serif' font-size='16' text-anchor='middle' dominant-baseline='middle'>No photo</text></svg>`
  );

const statusConfig = {
  lost: { label: "Lost", color: "bg-red-100 text-red-700", icon: AlertCircle },
  found: { label: "Found", color: "bg-green-100 text-green-700", icon: CheckCircle },
  pending: { label: "Claim Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  recovered: { label: "Recovered", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
};

interface Props {
  item: Item;
  userId: string;
  isStaff: boolean;
  defaultName: string;
  defaultContact: string;
  onClaim: (item: Item, name: string, contact: string, notes: string) => Promise<void>;
  onFoundIt: (item: Item) => Promise<void>;
}

export function ItemCard({ item, userId, isStaff, defaultName, defaultContact, onClaim, onFoundIt }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimantName, setClaimantName] = useState(defaultName);
  const [claimantContact, setClaimantContact] = useState(defaultContact);
  const [claimNotes, setClaimNotes] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);

  const status = statusConfig[item.status] || statusConfig.lost;
  const StatusIcon = status.icon;
  const isOwner = item.reported_by === userId;
  const canSeeContact = isOwner || isStaff;
  const img = item.image_url || NO_IMAGE;

  // "Intelligent matching": ask the database for the best opposite-type reports
  useEffect(() => {
    if (!showModal || (item.status !== "lost" && item.status !== "found")) return;
    supabase.rpc("suggest_matches", { p_item_id: item.id }).then(({ data }) => setMatches(data ?? []));
  }, [showModal, item.id, item.status]);

  const close = () => { setShowModal(false); setShowClaimForm(false); };

  const submitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    await onClaim(item, claimantName, claimantContact, claimNotes);
    setClaimNotes("");
    close();
  };

  const field = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
        <div className="relative h-44 overflow-hidden bg-gray-50">
          <img src={img} alt={item.name} className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).src = NO_IMAGE)} />
          <div className={`absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.color}`}>
            <StatusIcon size={12} /> {status.label}
          </div>
          <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full text-xs text-gray-600">{item.category}</div>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <h3 className="text-gray-900 mb-1 font-semibold">{item.name}</h3>
          <p className="text-sm text-gray-500 mb-3 flex-1 line-clamp-2">{item.description}</p>
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-xs text-gray-500"><MapPin size={12} className="text-indigo-400" />{item.location}</div>
            <div className="flex items-center gap-2 text-xs text-gray-500"><Calendar size={12} className="text-indigo-400" />{fmtDate(item.item_date)}</div>
            <div className="flex items-center gap-2 text-xs text-gray-500"><Tag size={12} className="text-indigo-400" />Reported by: {item.reporter_name}</div>
          </div>
          <button onClick={() => setShowModal(true)} className="w-full py-2 rounded-xl text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 font-medium">
            View Details
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={close}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-56 bg-gray-100">
              <img src={img} alt={item.name} className="w-full h-full object-cover" />
              <button onClick={close} className="absolute top-3 right-3 bg-white rounded-full px-2 py-1 shadow text-gray-500 hover:text-gray-800">✕</button>
              <div className={`absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.color}`}>
                <StatusIcon size={12} /> {status.label}
              </div>
            </div>
            <div className="p-6">
              <h2 className="text-gray-900 mb-2 text-xl font-bold">{item.name}</h2>
              <p className="text-sm text-gray-600 mb-4">{item.description}</p>
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2 text-sm text-gray-600"><MapPin size={14} className="text-indigo-500" />{item.location}</div>
                <div className="flex items-center gap-2 text-sm text-gray-600"><Calendar size={14} className="text-indigo-500" />{fmtDate(item.item_date)}</div>
                <div className="flex items-center gap-2 text-sm text-gray-600"><Tag size={14} className="text-indigo-500" />Reported by: {item.reporter_name}</div>
                {canSeeContact && <div className="text-sm text-gray-600">📞 Contact: {item.contact}</div>}
              </div>

              {matches.length > 0 && (
                <div className="mb-5 border border-indigo-100 bg-indigo-50/50 rounded-xl p-3">
                  <p className="text-xs text-indigo-700 font-semibold flex items-center gap-1 mb-2">
                    <Sparkles size={13} /> Possible matches
                  </p>
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs text-gray-700 py-1">
                      <span>{m.name} <span className="text-gray-400">· {m.status} · {m.location}</span></span>
                      <span className="font-semibold text-indigo-600">{m.score}%</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 mt-1">Suggestions only — ownership is verified by staff.</p>
                </div>
              )}

              {item.status === "found" && !isOwner && !showClaimForm && (
                <button onClick={() => setShowClaimForm(true)} className="w-full py-2.5 rounded-xl text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-semibold">
                  Submit Claim Request
                </button>
              )}

              {item.status === "found" && !isOwner && showClaimForm && (
                <form onSubmit={submitClaim} className="space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-700 font-semibold">Claim Ownership</p>
                  <input required value={claimantName} onChange={(e) => setClaimantName(e.target.value)} placeholder="Your full name" className={field} />
                  <input required value={claimantContact} onChange={(e) => setClaimantContact(e.target.value)} placeholder="Email / phone" className={field} />
                  <textarea required rows={2} value={claimNotes} onChange={(e) => setClaimNotes(e.target.value)}
                    placeholder="Proof of ownership (serial number, contents, marks…)" className={field + " resize-none"} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowClaimForm(false)} className="flex-1 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="flex-1 py-2 rounded-xl text-sm text-white bg-indigo-600 hover:bg-indigo-700 font-semibold">Submit Claim</button>
                  </div>
                </form>
              )}

              {item.status === "lost" && !isOwner && (
                <button onClick={async () => { await onFoundIt(item); close(); }} className="w-full py-2.5 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 font-semibold">
                  I Found This Item
                </button>
              )}

              {item.status === "pending" && (
                <div className="text-center py-2 text-sm text-yellow-600 bg-yellow-50 rounded-xl font-medium">⏳ Claim pending staff verification</div>
              )}
              {item.status === "recovered" && (
                <div className="text-center py-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl font-medium">✅ This item has been recovered</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
