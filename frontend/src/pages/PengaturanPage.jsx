import React, { useEffect, useRef, useState } from "react";
import api, { errText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, User, Users, Upload, Plus, Trash2, KeyRound, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

const backendHost = process.env.REACT_APP_BACKEND_URL;
const toImgSrc = (u) => (u ? (u.startsWith("/api") ? `${backendHost}${u}` : u) : "");

/* -------------------- Profil Lembaga -------------------- */
function InstitutionTab() {
  const [f, setF] = useState({ institution_name: "", tagline: "", contact: "", address: "", logo_url: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => { api.get("/settings").then((r) => setF({ logo_url: "", ...r.data })); }, []);

  const uploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/upload/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setF((p) => ({ ...p, logo_url: r.data.url }));
      toast.success("Logo diunggah");
    } catch (e) { toast.error(errText(e)); }
    finally { setUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api.put("/settings", f); toast.success("Profil lembaga tersimpan"); }
    catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="pota-card p-6 space-y-5 max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="w-28 h-28 rounded-2xl overflow-hidden bg-[var(--pota-surface)] border border-[var(--pota-border)] flex items-center justify-center flex-shrink-0">
          {f.logo_url ? <img src={toImgSrc(f.logo_url)} alt="Logo" className="w-full h-full object-cover" /> : <Sparkles className="w-8 h-8 text-[var(--pota-gold)]" />}
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Logo Lembaga</div>
          <div className="text-sm text-[var(--pota-text-muted)] mt-1">Ditampilkan di header portal Orang Tua Asuh.</div>
          <div className="mt-3 flex gap-2">
            <button data-testid="btn-upload-logo" type="button" onClick={() => fileRef.current.click()} className="inline-flex items-center gap-2 border border-[var(--pota-border)] px-3 py-2 rounded-lg text-sm hover:border-[var(--pota-gold)]">
              <Upload className="w-4 h-4" /> {uploading ? "Mengunggah..." : (f.logo_url ? "Ganti Logo" : "Unggah Logo")}
            </button>
            {f.logo_url && (
              <button type="button" onClick={() => setF({ ...f, logo_url: "" })} className="inline-flex items-center gap-2 text-sm text-red-600 px-3 py-2">
                <Trash2 className="w-4 h-4" /> Hapus
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase">Nama Lembaga *</label>
        <input data-testid="input-institution-name" required value={f.institution_name} onChange={(e) => setF({ ...f, institution_name: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase">Tagline</label>
        <input value={f.tagline || ""} onChange={(e) => setF({ ...f, tagline: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase">Kontak</label>
          <input value={f.contact || ""} onChange={(e) => setF({ ...f, contact: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Alamat</label>
          <input value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
      </div>
      <button disabled={saving} data-testid="btn-save-settings" className="bg-[var(--pota-green)] text-white px-6 py-2.5 rounded-lg font-semibold">{saving ? "Menyimpan..." : "Simpan Profil"}</button>
    </form>
  );
}

/* -------------------- Akun Saya -------------------- */
function MyAccountTab() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user?.name || "", avatar_url: user?.avatar_url || "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/upload/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const newAvatar = r.data.url;
      setF((p) => ({ ...p, avatar_url: newAvatar }));
      await api.put(`/users/${user.id}`, { avatar_url: newAvatar });
      setUser({ ...user, avatar_url: newAvatar });
      toast.success("Foto profil diperbarui");
    } catch (e) { toast.error(errText(e)); }
    finally { setUploading(false); }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, { name: f.name, avatar_url: f.avatar_url });
      setUser({ ...user, name: f.name, avatar_url: f.avatar_url });
      toast.success("Profil diperbarui");
    } catch (e) { toast.error(errText(e)); }
    finally { setSaving(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password.length < 6) return toast.error("Kata sandi baru minimal 6 karakter");
    if (pw.new_password !== pw.confirm) return toast.error("Konfirmasi kata sandi tidak cocok");
    setPwSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password });
      toast.success("Kata sandi diperbarui");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (e) { toast.error(errText(e)); }
    finally { setPwSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
      <form onSubmit={saveProfile} className="pota-card p-6 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Profil</div>
        <div className="font-display text-xl text-[var(--pota-green)]">Data Akun Saya</div>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--pota-green)] text-[#DCEDC8] flex items-center justify-center text-2xl font-display border border-[var(--pota-border)]">
            {f.avatar_url ? <img src={toImgSrc(f.avatar_url)} alt="" className="w-full h-full object-cover" /> : (user?.name || "A").charAt(0)}
          </div>
          <button data-testid="btn-upload-avatar" type="button" onClick={() => fileRef.current.click()} className="inline-flex items-center gap-2 border border-[var(--pota-border)] px-3 py-2 rounded-lg text-sm hover:border-[var(--pota-gold)]">
            <Upload className="w-4 h-4" /> {uploading ? "Mengunggah..." : (f.avatar_url ? "Ganti Foto" : "Unggah Foto")}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Nama</label>
          <input data-testid="input-my-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Email</label>
          <input value={user?.email || ""} disabled className="w-full mt-1 px-3 py-2 border rounded-lg bg-[var(--pota-surface)] text-[var(--pota-text-muted)]" />
        </div>
        <button data-testid="btn-save-me" disabled={saving} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">{saving ? "Menyimpan..." : "Simpan Profil"}</button>
      </form>

      <form onSubmit={changePassword} className="pota-card p-6 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-[var(--pota-text-muted)] font-semibold">Keamanan</div>
        <div className="font-display text-xl text-[var(--pota-green)]">Ubah Kata Sandi</div>
        <div>
          <label className="text-xs font-semibold uppercase">Kata Sandi Saat Ini</label>
          <input data-testid="input-current-pw" type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Kata Sandi Baru</label>
          <input data-testid="input-new-pw" type="password" required value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase">Konfirmasi Kata Sandi Baru</label>
          <input data-testid="input-confirm-pw" type="password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
        </div>
        <button data-testid="btn-change-pw" disabled={pwSaving} className="w-full inline-flex items-center justify-center gap-2 bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">
          <Lock className="w-4 h-4" /> {pwSaving ? "Memperbarui..." : "Perbarui Kata Sandi"}
        </button>
      </form>
    </div>
  );
}

/* -------------------- Kelola Akun -------------------- */
function UsersTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [nu, setNu] = useState({ name: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [np, setNp] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = () => api.get("/users").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/users", nu);
      toast.success("Akun admin baru ditambahkan");
      setNu({ name: "", email: "", password: "" });
      setAddOpen(false); load();
    } catch (e) { toast.error(errText(e)); }
    finally { setCreating(false); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Hapus akun ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Akun dihapus"); load(); }
    catch (e) { toast.error(errText(e)); }
  };

  const doReset = async (e) => {
    e.preventDefault();
    if (np.length < 6) return toast.error("Kata sandi minimal 6 karakter");
    setResetting(true);
    try {
      await api.post(`/users/${resetUser.id}/reset-password`, { new_password: np });
      toast.success(`Kata sandi ${resetUser.name} direset`);
      setResetUser(null); setNp("");
    } catch (e) { toast.error(errText(e)); }
    finally { setResetting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-xl text-[var(--pota-green)]">Kelola Akun Admin</div>
          <div className="text-sm text-[var(--pota-text-muted)]">Semua akun memiliki akses penuh sebagai administrator lembaga.</div>
        </div>
        <button data-testid="btn-add-user" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 bg-[var(--pota-green)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Tambah Akun
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((u) => (
          <div key={u.id} className="pota-card p-4 flex items-start gap-3" data-testid={`card-user-${u.id}`}>
            <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--pota-green)] text-[#DCEDC8] flex items-center justify-center font-display flex-shrink-0">
              {u.avatar_url ? <img src={toImgSrc(u.avatar_url)} alt="" className="w-full h-full object-cover" /> : (u.name || "A").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[var(--pota-green)] truncate flex items-center gap-2">
                {u.name}
                {u.id === user?.id && <span className="pota-pill-gold">Anda</span>}
              </div>
              <div className="text-xs text-[var(--pota-text-muted)] truncate">{u.email}</div>
              <div className="mt-3 flex items-center gap-2">
                <button data-testid={`btn-reset-${u.id}`} onClick={() => setResetUser(u)} className="text-xs font-semibold text-[var(--pota-green)] inline-flex items-center gap-1 hover:text-[var(--pota-gold)]">
                  <KeyRound className="w-3.5 h-3.5" /> Reset Kata Sandi
                </button>
                {u.id !== user?.id && (
                  <button onClick={() => remove(u)} className="text-xs font-semibold text-red-600 inline-flex items-center gap-1 hover:text-red-700">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Tambah Akun Admin</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase">Nama *</label>
              <input data-testid="input-new-user-name" required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase">Email *</label>
              <input data-testid="input-new-user-email" type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase">Kata Sandi Awal *</label>
              <input data-testid="input-new-user-pw" type="password" required minLength={6} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="Minimal 6 karakter" />
            </div>
            <button data-testid="btn-save-user" disabled={creating} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">{creating ? "Menyimpan..." : "Buat Akun"}</button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-[var(--pota-green)]">Reset Kata Sandi</DialogTitle></DialogHeader>
          <form onSubmit={doReset} className="space-y-3">
            <div className="text-sm text-[var(--pota-text-muted)]">
              Menetapkan kata sandi baru untuk <span className="font-semibold text-[var(--pota-green)]">{resetUser?.name}</span>.
            </div>
            <div>
              <label className="text-xs font-semibold uppercase">Kata Sandi Baru</label>
              <input data-testid="input-reset-pw" type="password" required minLength={6} value={np} onChange={(e) => setNp(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="Minimal 6 karakter" />
            </div>
            <button data-testid="btn-do-reset" disabled={resetting} className="w-full bg-[var(--pota-green)] text-white py-2.5 rounded-lg font-semibold">{resetting ? "Memperbarui..." : "Simpan Kata Sandi"}</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function PengaturanPage() {
  return (
    <div className="space-y-6" data-testid="page-pengaturan">
      <div>
        <div className="gold-divider mb-3" />
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--pota-green)]">Pengaturan</h1>
        <p className="text-sm text-[var(--pota-text-muted)] mt-1">Kelola profil lembaga, akun admin, dan preferensi personal.</p>
      </div>

      <Tabs defaultValue="lembaga">
        <TabsList className="bg-white border border-[var(--pota-border)]">
          <TabsTrigger data-testid="tab-lembaga" value="lembaga"><Building2 className="w-4 h-4 mr-1.5" /> Profil Lembaga</TabsTrigger>
          <TabsTrigger data-testid="tab-akun-saya" value="me"><User className="w-4 h-4 mr-1.5" /> Akun Saya</TabsTrigger>
          <TabsTrigger data-testid="tab-akun-admin" value="users"><Users className="w-4 h-4 mr-1.5" /> Kelola Akun</TabsTrigger>
        </TabsList>
        <TabsContent value="lembaga"><InstitutionTab /></TabsContent>
        <TabsContent value="me"><MyAccountTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
