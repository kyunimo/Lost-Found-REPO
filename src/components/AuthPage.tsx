import { useState } from "react";
<<<<<<< HEAD
import { PackageSearch } from "lucide-react";
import { supabase } from "../lib/supabase";

export function AuthPage() {
=======
import { Moon, PackageSearch, Sun } from "lucide-react";
import { supabase } from "../lib/supabase";

export function AuthPage({ theme, onToggleTheme, notice }: { theme: "light" | "dark"; onToggleTheme: () => void; notice?: string }) {
>>>>>>> 4d6617f (v5)
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ text: error.message, ok: false });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) setMsg({ text: error.message, ok: false });
      else if (!data.session) setMsg({ text: "Account created! Check your email to confirm, then sign in.", ok: true });
    }
    setBusy(false);
  };

  const input = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
=======
    <div className="relative min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <button onClick={onToggleTheme} aria-label="Toggle dark mode" className="absolute top-4 right-4 p-2.5 rounded-xl bg-white border border-gray-200 text-gray-600">
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
>>>>>>> 4d6617f (v5)
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <PackageSearch size={20} className="text-white" />
          </div>
          <div>
            <p className="text-gray-900 font-bold leading-tight">STI College Gensan</p>
            <p className="text-xs text-indigo-500">Campus Lost &amp; Found</p>
          </div>
        </div>
<<<<<<< HEAD
=======
        {notice && <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-4">{notice}</p>}
>>>>>>> 4d6617f (v5)
        <h1 className="text-gray-900 font-bold mb-4">{mode === "in" ? "Sign in" : "Create an account"}</h1>
        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <input className={input} required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" required minLength={6} placeholder="Password (min. 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
          {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</p>}
          <button disabled={busy} className="w-full py-2.5 rounded-xl text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 font-semibold">
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-4 text-xs text-indigo-600 hover:underline w-full text-center">
          {mode === "in" ? "No account yet? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
