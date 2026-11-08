import { useState } from "react";
import { Upload, CheckCircle } from "lucide-react";

const categories = ["Electronics", "Documents/ID", "Clothing", "Accessories", "Bags", "Keys", "Books", "Others"];
const locations = ["Main Building", "Library", "Gymnasium", "Cafeteria", "Parking Area", "Dormitory", "Science Lab", "Engineering Hall", "Admin Office", "Chapel"];

interface Props {
  type: "lost" | "found";
  defaultContact: string;
  onSubmit: (data: any, file: File | null) => Promise<boolean>;
}

export function ReportForm({ type, defaultContact, onSubmit }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "", location: "", item_date: "", description: "", contact: defaultContact });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { alert("Image must be 5MB or smaller."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit({ ...form, status: type }, file);
    setBusy(false);
    if (ok) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false); setFile(null); setPreview(null);
        setForm({ name: "", category: "", location: "", item_date: "", description: "", contact: defaultContact });
      }, 2500);
    }
  };

  const isLost = type === "lost";
  const field = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";
  const label = "block text-sm text-gray-700 mb-1.5 font-medium";

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h3 className="text-gray-900 mb-2 text-xl font-bold">{isLost ? "Lost Item Reported!" : "Found Item Submitted!"}</h3>
        <p className="text-gray-500 text-sm max-w-sm">
          {isLost ? "Your report is saved. Check the item's details to see possible matches." : "Thank you! The owner can now find and claim it."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={label}>Item Photo</label>
        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-indigo-200 rounded-xl cursor-pointer bg-indigo-50/50 hover:bg-indigo-50 overflow-hidden">
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-indigo-400">
              <Upload size={28} />
              <span className="text-sm">Click to upload image</span>
              <span className="text-xs text-gray-400">PNG, JPG up to 5MB</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
        </label>
      </div>

      <div>
        <label className={label}>Item Name <span className="text-red-500">*</span></label>
        <input name="name" value={form.name} onChange={handleChange} required className={field}
          placeholder={isLost ? "e.g. Black Leather Wallet" : "e.g. Blue Umbrella"} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Category <span className="text-red-500">*</span></label>
          <select name="category" value={form.category} onChange={handleChange} required className={field}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Date {isLost ? "Lost" : "Found"} <span className="text-red-500">*</span></label>
          <input type="date" name="item_date" value={form.item_date} onChange={handleChange} required className={field}
            max={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>

      <div>
        <label className={label}>Location {isLost ? "Last Seen" : "Found"} <span className="text-red-500">*</span></label>
        <select name="location" value={form.location} onChange={handleChange} required className={field}>
          <option value="">Select location</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div>
        <label className={label}>Description <span className="text-red-500">*</span></label>
        <textarea name="description" value={form.description} onChange={handleChange} required rows={3}
          placeholder="Color, brand, distinguishing features…" className={field + " resize-none"} />
        {!isLost && <p className="text-xs text-gray-400 mt-1">Tip: leave out one identifying detail so the real owner can prove ownership.</p>}
      </div>

      <div>
        <label className={label}>Contact Information <span className="text-red-500">*</span></label>
        <input name="contact" value={form.contact} onChange={handleChange} required placeholder="Email or phone number" className={field} />
      </div>

      <button type="submit" disabled={busy}
        className={`w-full py-3 rounded-xl text-sm text-white font-semibold disabled:opacity-60 ${isLost ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
        {busy ? "Submitting…" : isLost ? "Submit Lost Item Report" : "Submit Found Item Report"}
      </button>
    </form>
  );
}
