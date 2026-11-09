import { useState } from "react";
import { Moon, Sun, LogOut, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Claim, fmtDate, Item, Profile } from "../lib/types";
import { listUserPhotos, removePhotos } from "../lib/accounts";
import { DeleteAccountModal } from "./DeleteAccountModal";

const roleBadge: Record<string, string> = {
  user: "bg-gray-100 text-gray-600",
  staff: "bg-blue-100 text-blue-700",
  admin: "bg-purple-100 text-purple-700",
};
const statusBadge: Record<string, string> = {
  lost: "bg-red-100 text-red-700",
  found: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  recovered: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

interface Props {
  profile: Profile;
  items: Item[];
  claims: Claim[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onNameSaved: (name: string) => void;
  notify: (message: string, type?: "success" | "info" | "warning") => void;
  onSignOut: () => void;
  onContactsSaved: (c: { contact_1: string; contact_2: string; contact_3: string }) => void;
  onDeleted: () => void;
}

export function ProfilePage({ profile, items, claims, theme, onToggleTheme, onNameSaved, notify, onSignOut, onContactsSaved, onDeleted }: Props) {
  const [name, setName] = useState(profile.full_name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [c1, setC1] = useState(profile.contact_1 ?? "");
  const [c2, setC2] = useState(profile.contact_2 ?? "");
  const [c3, setC3] = useState(profile.contact_3 ?? "");
  const [savingContacts, setSavingContacts] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const myItems = items.filter((i) => i.reported_by === profile.id);
  const myClaims = claims.filter((c) => c.claimant_id === profile.id);
  const initials = (profile.full_name || profile.email || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || n === profile.full_name) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ full_name: n }).eq("id", profile.id);
    setSavingName(false);
    if (error) return notify(error.message, "warning");
    onNameSaved(n);
    notify("Name updated.");
  };

  const saveContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = { contact_1: c1.trim(), contact_2: c2.trim(), contact_3: c3.trim() };
    setSavingContacts(true);
    const { error } = await supabase.from("profiles").update(v).eq("id", profile.id);
    setSavingContacts(false);
    if (error) return notify(error.message, "warning");
    setC1(v.contact_1); setC2(v.contact_2); setC3(v.contact_3);
    onContactsSaved(v);
    notify("Contact details saved.");
  };

  const deleteAccount = async () => {
    setDeleting(true);
    const photos = await listUserPhotos(profile.id); // collected first, removed after the account is gone
    const { error } = await supabase.rpc("delete_my_account");
    if (error) { setDeleting(false); return notify(error.message, "warning"); }
    await removePhotos(photos);
    onDeleted();
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return notify("Password must be at least 6 characters.", "warning");
    if (pw !== pw2) return notify("Passwords don't match.", "warning");
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSavingPw(false);
    if (error) return notify(error.message, "warning");
    setPw(""); setPw2("");
    notify("Password changed.");
  };

  const field = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";
  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-5";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className={card + " flex items-center gap-4"}>
        <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold shrink-0">{initials}</div>
        <div className="min-w-0 flex-1">
          <p className="text-gray-900 font-bold text-lg truncate">{profile.full_name || "Unnamed"}</p>
          <p className="text-sm text-gray-500 truncate">{profile.email}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-semibold ${roleBadge[profile.role]}`}>{profile.role}</span>
            {profile.created_at && <span className="text-xs text-gray-400">Member since {fmtDate(profile.created_at)}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["My reports", myItems.length],
          ["My claims", myClaims.length],
          ["Recovered", myItems.filter((i) => i.status === "recovered").length],
        ].map(([label, value]) => (
          <div key={label as string} className={card + " text-center !p-4"}>
            <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <form onSubmit={saveName} className={card + " space-y-3"}>
        <h3 className="font-bold text-gray-900">Profile details</h3>
        <div>
          <label className="block text-sm text-gray-700 mb-1.5 font-medium">Full name</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1.5 font-medium">Email</label>
          <input className={field + " opacity-60"} value={profile.email ?? ""} disabled />
        </div>
        <button disabled={savingName || !name.trim() || name.trim() === profile.full_name}
          className="px-5 py-2.5 rounded-xl text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-semibold">
          {savingName ? "Saving…" : "Save changes"}
        </button>
        <p className="text-xs text-gray-400">Reports you already submitted keep the name they were filed under.</p>
      </form>

      <form onSubmit={saveContacts} className={card + " space-y-3"}>
        <div>
          <h3 className="font-bold text-gray-900">Contact details</h3>
          <p className="text-sm text-gray-500">These are filled in automatically whenever you report an item. You can still change them on each report.</p>
        </div>
        <input className={field} value={c1} onChange={(e) => setC1(e.target.value)} placeholder={`Contact 1 — phone or email (defaults to ${profile.email})`} />
        <input className={field} value={c2} onChange={(e) => setC2(e.target.value)} placeholder="Contact 2 (optional)" />
        <input className={field} value={c3} onChange={(e) => setC3(e.target.value)} placeholder="Contact 3 (optional)" />
        <button disabled={savingContacts}
          className="px-5 py-2.5 rounded-xl text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-semibold">
          {savingContacts ? "Saving…" : "Save contact details"}
        </button>
      </form>

      <form onSubmit={savePassword} className={card + " space-y-3"}>
        <h3 className="font-bold text-gray-900">Change password</h3>
        <input className={field} type="password" placeholder="New password (min. 6 characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        <input className={field} type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        <button disabled={savingPw || !pw}
          className="px-5 py-2.5 rounded-xl text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-semibold">
          {savingPw ? "Updating…" : "Update password"}
        </button>
      </form>

      <div className={card + " flex items-center justify-between gap-3"}>
        <div>
          <h3 className="font-bold text-gray-900">Appearance</h3>
          <p className="text-sm text-gray-500">Currently using the {theme} theme.</p>
        </div>
        <button onClick={onToggleTheme} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      <div className={card}>
        <h3 className="font-bold text-gray-900 mb-3">My reports</h3>
        {myItems.length === 0 ? <p className="text-sm text-gray-400">You haven't reported anything yet.</p> : (
          <div className="divide-y divide-gray-100">
            {myItems.map((i) => (
              <div key={i.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-semibold truncate">{i.name}</p>
                  <p className="text-xs text-gray-500">{i.location} · {fmtDate(i.item_date)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-semibold shrink-0 ${statusBadge[i.status]}`}>{i.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <h3 className="font-bold text-gray-900 mb-3">My claims</h3>
        {myClaims.length === 0 ? <p className="text-sm text-gray-400">You haven't submitted any claims.</p> : (
          <div className="divide-y divide-gray-100">
            {myClaims.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-semibold truncate">{c.items?.name ?? "Item"}</p>
                  <p className="text-xs text-gray-500">Submitted {fmtDate(c.created_at)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-semibold shrink-0 ${statusBadge[c.status]}`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
        <h3 className="font-bold text-red-600 mb-1">Delete account</h3>
        <p className="text-sm text-gray-500 mb-3">Permanently deletes your account, your reports (with their photos) and your claims. This can't be undone.</p>
        <button onClick={() => setShowDelete(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white bg-red-500 hover:bg-red-600 font-semibold">
          <Trash2 size={16} /> Delete my account
        </button>
      </div>

      {showDelete && (
        <DeleteAccountModal self title="Delete your account?" who={profile.full_name || profile.email} reports={myItems.length} claims={myClaims.length}
          busy={deleting} onCancel={() => setShowDelete(false)} onConfirm={deleteAccount} />
      )}

      <button onClick={onSignOut} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-red-600 border border-red-200 hover:bg-red-50 font-semibold">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
