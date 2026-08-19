import React, { useEffect, useState } from "react";
import api, { formatMonth, errText } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Check, Edit3, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

const monthOptions = () => {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(d.toISOString().slice(0, 7));
  }
  return opts;
};

export default function LaporanPage() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0]);
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [summary, setSummary] = useState("");
  const [reportStatus, setReportStatus] = useState("Terlapor");

  const load = async () => {
    const r = await api.get("/reports", { params: { month, status } });
    setRows(r.data);
  };
  useEffect(() => { load(); }, [month, status]);

  const openEdit = (row) => {
    setEditing(row);
    setSummary(row.summary || "");
    setReportStatus(row.status === "Terlapor" ? "Terlapor" : "Terlapor");
  };

  const save = async () => {
    try {
      await api.post("/reports", { guardian_id: editing.guardian_id, month, summary, status: reportStatus });
      toast.success("Laporan diperbarui");
      setEditing(null); load();
    } catch (e) { toast.error(errText(e)); }
  };

  const quickMark = async (row) => {
    try {
      await api.post("/reports", { guardian_id: row.guardian_id, month, summary: row.summary || `Laporan ${formatMonth(month)} telah disampaikan.`, status: "Terlapor" });
      toast.success("Ditandai Terlapor"); load();
    } catch (e) { toast.error(errText(e)); }
  };

  const terlapor = rows.filter(r => r.status === "Terlapor").length;
  const belum = rows.length - terlapor;

  return (
    <div className="space-y-6" data-testid="page-laporan">
      <div>
        <div className="gold-divider mb-3" />
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Laporan Bulanan</h1>
        <p className="text-sm text-[var(--pota-text-muted)] mt-1">Pantau status laporan setiap Orang Tua Asuh untuk periode berjalan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="pota-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Periode</div>
          <div className="mt-2 font-display text-xl text-[var(--pota-green)]">{formatMonth(month)}</div>
        </div>
        <div className="pota-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Terlapor</div>
          <div className="mt-2 font-display text-2xl text-[var(--pota-green)]">{terlapor}</div>
        </div>
        <div className="pota-card p-5">
          <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Belum Terlapor</div>
          <div className="mt-2 font-display text-2xl text-[#9F1239]">{belum}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger data-testid="select-laporan-month" className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="Terlapor">Terlapor</SelectItem>
            <SelectItem value="Belum Terlapor">Belum Terlapor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="pota-card p-10 text-center">
          <ClipboardCheck className="w-10 h-10 mx-auto text-[var(--pota-gold)]" />
          <div className="mt-3 font-display text-lg text-[var(--pota-green)]">Belum ada data</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.guardian_id} data-testid={`row-laporan-${r.guardian_id}`} className="pota-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg text-[var(--pota-green)]">{r.guardian_name}</div>
                  <div className="mt-1"><StatusBadge status={r.guardian_status} /></div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.summary && <div className="text-xs text-[var(--pota-text-muted)] mt-2 line-clamp-2">{r.summary}</div>}
              <div className="flex items-center gap-2 mt-3">
                {r.status !== "Terlapor" && (
                  <button data-testid={`btn-mark-${r.guardian_id}`} onClick={()=>quickMark(r)} className="flex-1 inline-flex items-center justify-center gap-1 bg-[var(--pota-green)] text-white text-xs font-semibold py-2 rounded-lg">
                    <Check className="w-3.5 h-3.5" /> Tandai Terlapor
                  </button>
                )}
                <button data-testid={`btn-edit-${r.guardian_id}`} onClick={()=>openEdit(r)} className="flex-1 inline-flex items-center justify-center gap-1 border text-xs font-semibold py-2 rounded-lg">
                  <Edit3 className="w-3.5 h-3.5" /> Isi Ringkasan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Laporan {editing?.guardian_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Periode: <span className="font-semibold">{formatMonth(month)}</span></div>
            <div>
              <label className="text-xs font-semibold uppercase">Ringkasan Laporan</label>
              <textarea data-testid="input-report-summary" rows={5} value={summary} onChange={(e)=>setSummary(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase">Status</label>
              <Select value={reportStatus} onValueChange={setReportStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Terlapor">Terlapor</SelectItem>
                  <SelectItem value="Belum Terlapor">Belum Terlapor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <button data-testid="btn-save-report" onClick={save} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">Simpan Laporan</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
