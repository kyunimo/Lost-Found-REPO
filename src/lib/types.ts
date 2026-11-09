export type Role = "user" | "staff" | "admin";
export type Status = "lost" | "found" | "pending" | "recovered";

export interface Profile { id: string; full_name: string; email: string; role: Role; created_at?: string;
  contact_1?: string; contact_2?: string; contact_3?: string; }

export interface Item {
  id: number; name: string; category: string; status: Status; location: string;
  item_date: string; description: string; contact: string; contact_2?: string; contact_3?: string; image_url: string | null;
  reported_by: string; reporter_name: string; created_at: string;
}

export interface Claim {
  id: number; item_id: number; claimant_id: string; claimant_name: string; contact: string;
  notes: string; status: "pending" | "approved" | "rejected"; match_score: number;
  created_at: string; items?: { name: string } | null;
}

export interface Activity { id: number; action: string; item_name: string; color: string; created_at: string; }

export interface Match { id: number; name: string; status: Status; location: string; score: number; }

export const fmtDate = (d: string) =>
  new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} day(s) ago`;
};
