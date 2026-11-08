import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Search, Bell, User, LayoutDashboard, PackageSearch, PackagePlus, ShieldCheck, TrendingUp,
  CheckCircle2, AlertCircle, Clock, Filter, X, Plus, Eye, Trash2, CheckCheck, XCircle, Users, LogOut,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { Activity, Claim, fmtDate, Item, Profile, Role, timeAgo } from "./lib/types";
import { ItemCard } from "./components/ItemCard";
import { ReportForm } from "./components/ReportForm";
import { AuthPage } from "./components/AuthPage";

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      </div>
    </div>
  );
}

type ToastT = { message: string; type: "success" | "info" | "warning" };
function Toast({ message, type }: ToastT) {
  const colors = { success: "bg-emerald-600", info: "bg-indigo-600", warning: "bg-yellow-500" };
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] ${colors[type]} text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 max-w-sm`}>
      <CheckCircle2 size={16} className="shrink-0" /> {message}
    </div>
  );
}

const roleBadge: Record<Role, string> = {
  user: "bg-gray-100 text-gray-600",
  staff: "bg-blue-100 text-blue-700",
  admin: "bg-purple-100 text-purple-700",
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [reportType, setReportType] = useState<"lost" | "found">("lost");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastT | null>(null);

  const role: Role = profile?.role ?? "user";
  const isStaff = role === "staff" || role === "admin";
  const isAdmin = role === "admin";

  // ── Auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data as Profile));
  }, [session]);

  // ── Data ──────────────────────────────────────────────────────────────
  const showToast = (message: string, type: ToastT["type"] = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadAll = useCallback(async () => {
    const [i, a, c] = await Promise.all([
      supabase.from("items").select("*").order("created_at", { ascending: false }),
      supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("claims").select("*, items(name)").order("created_at", { ascending: false }),
    ]);
    setItems((i.data as Item[]) ?? []);
    setActivity((a.data as Activity[]) ?? []);
    setClaims((c.data as Claim[]) ?? []);
    if (isAdmin) {
      const u = await supabase.from("profiles").select("*").order("created_at");
      setUsers((u.data as Profile[]) ?? []);
    }
  }, [isAdmin]);

  useEffect(() => { if (profile) loadAll(); }, [profile, loadAll]);

  // run a database action, show a toast, refresh
  const run = async (action: () => PromiseLike<{ error: any }>, ok: string, type: ToastT["type"] = "success") => {
    const { error } = await action();
    if (error) { showToast(error.message, "warning"); return false; }
    showToast(ok, type);
    await loadAll();
    return true;
  };

  // ── Actions ───────────────────────────────────────────────────────────
  const handleAddItem = async (form: any, file: File | null) => {
    let image_url: string | null = null;
    if (file) {
      const path = `${session!.user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from("item-images").upload(path, file);
      if (up.error) { showToast("Image upload failed: " + up.error.message, "warning"); return false; }
      image_url = supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl;
    }
    const ok = await run(
      () => supabase.from("items").insert({ ...form, image_url, reported_by: session!.user.id, reporter_name: profile!.full_name }),
      form.status === "lost" ? `Lost item "${form.name}" reported.` : `Found item "${form.name}" submitted.`
    );
    if (ok) setTimeout(() => setActiveTab(form.status === "lost" ? "lost" : "found"), 2600);
    return ok;
  };

  const handleClaim = async (item: Item, name: string, contact: string, notes: string) => {
    await run(() => supabase.rpc("submit_claim", { p_item_id: item.id, p_name: name, p_contact: contact, p_notes: notes }),
      `Claim for "${item.name}" submitted! Awaiting staff verification.`, "info");
  };
  const handleFoundIt = async (item: Item) => {
    await run(() => supabase.rpc("mark_found", { p_item_id: item.id }), `"${item.name}" marked as found!`);
  };
  const handleResolve = async (claim: Claim, approve: boolean) => {
    const n = claim.items?.name ?? "item";
    await run(() => supabase.rpc("resolve_claim", { p_claim_id: claim.id, p_approve: approve }),
      approve ? `Claim approved — "${n}" marked as recovered.` : `Claim for "${n}" rejected.`, approve ? "success" : "warning");
  };
  const handleDelete = async (id: number) => {
    setDeletingId(null);
    await run(() => supabase.from("items").delete().eq("id", id), "Report deleted.", "warning");
  };
  const handleRole = async (u: Profile, newRole: string) => {
    await run(() => supabase.rpc("set_user_role", { p_user: u.id, p_role: newRole }), `${u.full_name || u.email} is now ${newRole}.`);
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const pendingClaims = claims.filter((c) => c.status === "pending");
  const count = (s: string) => items.filter((i) => i.status === s).length;

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matches = !q || [item.name, item.description, item.location, item.category].some((f) => f.toLowerCase().includes(q));
    if (activeTab === "lost") return item.status === "lost" && matches;
    if (activeTab === "found") {
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      return ["found", "pending", "recovered"].includes(item.status) && matches;
    }
    return matches;
  });
  const adminItems = items.filter((i) => adminFilter === "all" || i.status === adminFilter);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "lost", label: "Lost Items", icon: AlertCircle },
    { id: "found", label: "Found Items", icon: CheckCircle2 },
    { id: "report", label: "Report Item", icon: PackagePlus },
    ...(isStaff ? [{ id: "admin", label: "Admin Panel", icon: ShieldCheck }] : []),
    ...(isAdmin ? [{ id: "users", label: "Users", icon: Users }] : []),
  ];

  const navigate = (tab: string) => { setActiveTab(tab); setSearchQuery(""); setFilterStatus("all"); };

  const card = (item: Item) => (
    <ItemCard key={item.id} item={item} userId={session!.user.id} isStaff={isStaff}
      defaultName={profile?.full_name ?? ""} defaultContact={profile?.email ?? ""}
      onClaim={handleClaim} onFoundIt={handleFoundIt} />
  );

  // ── Gates ─────────────────────────────────────────────────────────────
  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  if (!session) return <AuthPage />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading your profile…</div>;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {toast && <Toast {...toast} />}

      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><Trash2 size={24} className="text-red-500" /></div>
            <h3 className="text-gray-900 mb-1 font-bold">Delete Report?</h3>
            <p className="text-sm text-gray-500 mb-5">This permanently removes the report and its claims.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deletingId)} className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-500 hover:bg-red-600 font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 shrink-0">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center"><PackageSearch size={16} className="text-white" /></div>
            <div>
              <p className="font-bold text-[0.85rem] text-gray-900 leading-tight">STI College Gensan</p>
              <p className="text-[0.7rem] text-indigo-500">Lost &amp; Found</p>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => navigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${activeTab === id ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>
                <Icon size={17} className={activeTab === id ? "text-indigo-600" : "text-gray-400"} />
                {label}
                {id === "admin" && pendingClaims.length > 0 && (
                  <span className="ml-auto bg-yellow-400 text-yellow-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{pendingClaims.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><User size={15} className="text-indigo-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate font-semibold">{profile.full_name || "Unnamed"}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${roleBadge[role]}`}>{role}</span>
              </div>
              <button title="Sign out" onClick={() => supabase.auth.signOut()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500"><LogOut size={15} /></button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3.5 flex items-center gap-3 shrink-0">
            <h1 className="text-gray-900 font-bold text-[1.05rem]">{navItems.find((n) => n.id === activeTab)?.label}</h1>
            {(activeTab === "lost" || activeTab === "found") && (
              <div className="flex-1 max-w-sm ml-4 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, location, category…"
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={12} /></button>}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {isStaff && (
                <button onClick={() => navigate("admin")} className="relative p-2 rounded-xl hover:bg-gray-100">
                  <Bell size={18} className="text-gray-600" />
                  {pendingClaims.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />}
                </button>
              )}
              <button title="Sign out" onClick={() => supabase.auth.signOut()} className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500"><LogOut size={18} /></button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="relative bg-indigo-600 rounded-2xl overflow-hidden p-6 text-white">
                  <p className="text-indigo-200 text-sm mb-1">Welcome back, {profile.full_name || "friend"}</p>
                  <h2 className="font-bold text-xl mb-1">STI College Gensan Lost &amp; Found Portal</h2>
                  <p className="text-indigo-200 text-sm max-w-md">Helping students, faculty, and staff recover lost belongings efficiently.</p>
                  <div className="flex gap-3 mt-4 flex-wrap">
                    <button onClick={() => navigate("report")} className="flex items-center gap-1.5 bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm hover:bg-indigo-50 font-semibold"><Plus size={15} /> Report Item</button>
                    <button onClick={() => navigate("lost")} className="flex items-center gap-1.5 bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-400 font-semibold"><Search size={15} /> Browse Items</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Lost Items" value={count("lost")} icon={AlertCircle} color="text-red-500" bg="bg-red-50" />
                  <StatCard label="Found Items" value={count("found")} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-50" />
                  <StatCard label="Pending Claims" value={count("pending")} icon={Clock} color="text-yellow-500" bg="bg-yellow-50" />
                  <StatCard label="Recovered" value={count("recovered")} icon={TrendingUp} color="text-indigo-500" bg="bg-indigo-50" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-900">Recent Reports</h2>
                    <button onClick={() => navigate("lost")} className="text-sm text-indigo-600 hover:underline">View all</button>
                  </div>
                  {items.length === 0
                    ? <p className="text-sm text-gray-400">No reports yet — be the first to report an item.</p>
                    : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.slice(0, 3).map(card)}</div>}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
                  {activity.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p> : (
                    <div className="space-y-3">
                      {activity.slice(0, 6).map((a) => (
                        <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                          <div className={`w-2 h-2 rounded-full ${a.color} shrink-0`} />
                          <p className="text-sm text-gray-700 flex-1">{a.action} <span className="font-semibold">"{a.item_name}"</span></p>
                          <span className="text-xs text-gray-400 shrink-0">{timeAgo(a.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(activeTab === "lost" || activeTab === "found") && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  {activeTab === "found" && (
                    <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
                      {[["all", "All"], ["found", "Found"], ["pending", "Claim Pending"], ["recovered", "Recovered"]].map(([v, l]) => (
                        <button key={v} onClick={() => setFilterStatus(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs ${filterStatus === v ? "bg-indigo-600 text-white font-semibold" : "text-gray-500 hover:text-gray-800"}`}>{l}</button>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 ml-auto">{filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}</div>
                  <button onClick={() => { setReportType(activeTab as "lost" | "found"); navigate("report"); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold ${activeTab === "lost" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
                    <Plus size={14} /> Report {activeTab === "lost" ? "Lost" : "Found"} Item
                  </button>
                </div>
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center py-20 text-center">
                    <PackageSearch size={48} className="text-gray-300 mb-3" />
                    <p className="font-semibold text-gray-500">No items found</p>
                    <p className="text-sm text-gray-400 mt-1">{searchQuery ? "Try a different search term" : "Nothing here yet."}</p>
                  </div>
                ) : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredItems.map(card)}</div>}
              </div>
            )}

            {activeTab === "report" && (
              <div className="max-w-xl mx-auto">
                <div className="flex bg-white border border-gray-200 rounded-2xl p-1.5 gap-1 mb-6">
                  <button onClick={() => setReportType("lost")} className={`flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 font-semibold ${reportType === "lost" ? "bg-red-500 text-white shadow-sm" : "text-gray-600"}`}><AlertCircle size={15} /> Report Lost Item</button>
                  <button onClick={() => setReportType("found")} className={`flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 font-semibold ${reportType === "found" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-600"}`}><CheckCircle2 size={15} /> Report Found Item</button>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <ReportForm key={reportType} type={reportType} defaultContact={profile.email ?? ""} onSubmit={handleAddItem} />
                </div>
              </div>
            )}

            {activeTab === "admin" && isStaff && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Reports" value={items.length} icon={PackageSearch} color="text-indigo-500" bg="bg-indigo-50" />
                  <StatCard label="Active Cases" value={count("lost") + count("found")} icon={Clock} color="text-blue-500" bg="bg-blue-50" />
                  <StatCard label="Pending Claims" value={pendingClaims.length} icon={AlertCircle} color="text-yellow-500" bg="bg-yellow-50" />
                  <StatCard label="Recovered" value={count("recovered")} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-50" />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-4">Pending Claim Verifications</h3>
                  {pendingClaims.length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><CheckCheck size={36} className="mx-auto mb-2 text-gray-300" /><p className="text-sm">No pending claims — all clear!</p></div>
                  ) : (
                    <div className="space-y-3">
                      {pendingClaims.map((c) => (
                        <div key={c.id} className="p-4 bg-gray-50 rounded-xl space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><User size={16} className="text-indigo-600" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 font-semibold">{c.claimant_name}</p>
                              <p className="text-xs text-gray-500">Claiming: <span className="font-semibold">{c.items?.name}</span></p>
                              <p className="text-xs text-gray-400">{c.contact} · {fmtDate(c.created_at)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-gray-500">Text match</p>
                              <p className="font-bold" style={{ color: c.match_score >= 50 ? "#10b981" : "#f59e0b" }}>{c.match_score}%</p>
                            </div>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                            <p className="text-xs text-gray-500 mb-0.5 font-semibold">Proof of ownership:</p>
                            <p className="text-xs text-gray-600">{c.notes}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleResolve(c, true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 text-white text-xs hover:bg-emerald-600 font-semibold"><CheckCheck size={13} /> Approve</button>
                            <button onClick={() => handleResolve(c, false)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs hover:bg-red-100 hover:text-red-600 font-semibold"><XCircle size={13} /> Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-wrap gap-3">
                    <h3 className="font-bold text-gray-900">All Reports ({items.length})</h3>
                    <div className="flex items-center gap-2">
                      <Filter size={14} className="text-gray-400" />
                      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                        {["all", "lost", "found", "pending", "recovered"].map((f) => (
                          <button key={f} onClick={() => setAdminFilter(f)} className={`px-2.5 py-1 rounded-md text-xs capitalize ${adminFilter === f ? "bg-white text-gray-800 shadow-sm font-semibold" : "text-gray-500"}`}>{f}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="bg-gray-50 text-left text-xs text-gray-500">
                        {["Reported By", "Item", "Date", "Location", "Status", "Actions"].map((h) => <th key={h} className="px-6 py-3 font-semibold">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {adminItems.map((r) => (
                          <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50/50 text-sm">
                            <td className="px-6 py-3.5 text-gray-800">{r.reporter_name}</td>
                            <td className="px-6 py-3.5 text-gray-700">{r.name}</td>
                            <td className="px-6 py-3.5 text-gray-500">{fmtDate(r.item_date)}</td>
                            <td className="px-6 py-3.5 text-gray-500">{r.location}</td>
                            <td className="px-6 py-3.5"><span className="px-2 py-0.5 rounded-full text-xs capitalize bg-gray-100 text-gray-700 font-semibold">{r.status}</span></td>
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-1">
                                <button title="View" onClick={() => navigate(r.status === "lost" ? "lost" : "found")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-indigo-600"><Eye size={14} /></button>
                                {isAdmin && <button title="Delete" onClick={() => setDeletingId(r.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-500"><Trash2 size={14} /></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {adminItems.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No items match this filter.</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "users" && isAdmin && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Users ({users.length})</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 text-left text-xs text-gray-500">
                      {["Name", "Email", "Role"].map((h) => <th key={h} className="px-6 py-3 font-semibold">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-gray-50 text-sm">
                          <td className="px-6 py-3.5 text-gray-800">{u.full_name || "—"}</td>
                          <td className="px-6 py-3.5 text-gray-500">{u.email}</td>
                          <td className="px-6 py-3.5">
                            {u.id === session.user.id ? <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${roleBadge[u.role]}`}>{u.role} (you)</span> : (
                              <select value={u.role} onChange={(e) => handleRole(u, e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
                                <option value="user">user</option><option value="staff">staff</option><option value="admin">admin</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>

          <div className="md:hidden border-t border-gray-100 bg-white flex shrink-0">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => navigate(id)} className={`flex-1 flex flex-col items-center gap-0.5 py-3 relative ${activeTab === id ? "text-indigo-600 font-semibold" : "text-gray-400"}`}>
                <Icon size={18} />
                <span className="text-[0.6rem]">{label.split(" ")[0]}</span>
                {id === "admin" && pendingClaims.length > 0 && <span className="absolute top-2 right-1/4 w-2 h-2 rounded-full bg-yellow-400" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
