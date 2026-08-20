import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, User, FileText, Users, GraduationCap, HandCoins, Link2, Sparkles, ClipboardCheck, Settings2, KeyRound } from "lucide-react";

const entityIcons = {
  guardian: Users,
  child: GraduationCap,
  relation: Link2,
  donation: HandCoins,
  development: Sparkles,
  report: ClipboardCheck,
  user: User,
  settings: Settings2,
  auth: KeyRound,
};
const entityLabels = {
  guardian: "Orang Tua Asuh",
  child: "Anak Asuh",
  relation: "Relasi",
  donation: "Donasi",
  development: "Perkembangan",
  report: "Laporan",
  user: "Akun Admin",
  settings: "Pengaturan Lembaga",
};
const actionLabels = {
  create: "Ditambahkan",
  update: "Diperbarui",
  delete: "Dihapus",
  regenerate: "Token Regenerate",
  reset: "Kata Sandi Direset",
  change_password: "Ubah Kata Sandi",
};
const actionColor = {
  create: "status-rutin",
  update: "status-insidentil",
  delete: "status-belum",
  regenerate: "status-tidak-rutin",
  reset: "status-tidak-rutin",
  change_password: "status-tidak-rutin",
};

const fmtWhen = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function AktivitasPage() {
  const [rows, setRows] = useState([]);
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [userId, setUserId] = useState("all");
  const [users, setUsers] = useState([]);

  useEffect(() => { api.get("/users").then((r) => setUsers(r.data)); }, []);
  useEffect(() => {
    api.get("/activities", { params: { entity, action, user_id: userId } }).then((r) => setRows(r.data));
  }, [entity, action, userId]);

  return (
    <div className="space-y-6" data-testid="page-aktivitas">
      <div>
        <div className="gold-divider mb-3" />
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Log Aktivitas Admin</h1>
        <p className="text-sm text-[var(--pota-text-muted)] mt-1">Catatan siapa mengubah data dan kapan, untuk audit multi-admin.</p>
      </div>

      <div className="pota-card p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger data-testid="filter-log-entity" className="bg-white"><SelectValue placeholder="Semua Jenis Data" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jenis Data</SelectItem>
            {Object.entries(entityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger data-testid="filter-log-action" className="bg-white"><SelectValue placeholder="Semua Aksi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Aksi</SelectItem>
            <SelectItem value="create">Ditambahkan</SelectItem>
            <SelectItem value="update">Diperbarui</SelectItem>
            <SelectItem value="delete">Dihapus</SelectItem>
            <SelectItem value="reset">Reset Kata Sandi</SelectItem>
            <SelectItem value="change_password">Ubah Kata Sandi</SelectItem>
            <SelectItem value="regenerate">Regenerate Token</SelectItem>
          </SelectContent>
        </Select>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger data-testid="filter-log-user" className="bg-white"><SelectValue placeholder="Semua Admin" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Admin</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-[var(--pota-text-muted)]">
        Menampilkan <span className="font-semibold text-[var(--pota-green)]">{rows.length}</span> aktivitas terakhir
      </div>

      {rows.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <Activity className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">Belum ada aktivitas</div>
          <div className="text-sm text-[var(--pota-text-muted)]">Aktivitas admin akan tercatat otomatis setelah ada perubahan data.</div>
        </div>
      ) : (
        <div className="pota-card divide-y">
          {rows.map((r) => {
            const Icon = entityIcons[r.entity] || FileText;
            return (
              <div key={r.id} data-testid={`row-activity-${r.id}`} className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F1F8E9] border border-[#C5E1A5] text-[#33691E] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--pota-green)]">{r.user_name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${actionColor[r.action] || "status-tidak-aktif"}`}>
                      {actionLabels[r.action] || r.action}
                    </span>
                    <span className="text-sm text-[var(--pota-text-muted)]">
                      {entityLabels[r.entity] || r.entity}{r.label ? ` — ${r.label}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--pota-text-muted)] mt-1">
                    {r.user_email} · {fmtWhen(r.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
