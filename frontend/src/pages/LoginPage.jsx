import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Sparkles, Mail, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errText } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("bmarrahmah@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Selamat datang kembali");
      nav("/admin");
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex pota-hero-portal p-12 relative overflow-hidden flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#7CB342]/15 border border-[#7CB342]/40 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-[#9CCC65]" />
          </div>
          <div>
            <div className="font-display text-xl">Portal OTA</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CCC65]">Orang Tua Asuh</div>
          </div>
        </div>
        <div className="max-w-md">
          <div className="gold-divider mb-6" />
          <h1 className="font-display text-4xl xl:text-5xl leading-tight text-white">
            Membina generasi Qur'ani,<br/>membangun masa depan umat.
          </h1>
          <p className="mt-6 text-[#D8E5DE] leading-relaxed">
            Kelola data orang tua asuh, anak asuh, donasi, dan laporan bulanan secara terpadu dalam satu portal yang elegan dan aman.
          </p>
        </div>
        <div className="text-xs text-[#B7C7BE] tracking-wide">
          "Perumpamaan orang yang menafkahkan hartanya di jalan Allah adalah seperti sebutir benih..." (QS. Al-Baqarah: 261)
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-[var(--pota-canvas)]">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-[var(--pota-green)] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#9CCC65]" />
            </div>
            <div>
              <div className="font-display text-xl text-[var(--pota-green)]">Portal OTA</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--pota-gold)]">Orang Tua Asuh</div>
            </div>
          </div>

          <div className="gold-divider mb-4" />
          <h2 className="font-display text-3xl text-[var(--pota-green)]">Masuk Admin</h2>
          <p className="text-sm text-[var(--pota-text-muted)] mt-2">
            Bismillah, masuk dengan akun administrator lembaga untuk mengelola program.
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wide text-[var(--pota-text)] uppercase">Email</label>
              <div className="pota-input mt-1.5 flex items-center gap-2 bg-white border border-[var(--pota-border)] rounded-xl px-3.5 py-2.5">
                <Mail className="w-4 h-4 text-[var(--pota-text-muted)]" />
                <input
                  data-testid="input-email"
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  placeholder="nama@lembaga.id"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wide text-[var(--pota-text)] uppercase">Kata Sandi</label>
              <div className="pota-input mt-1.5 flex items-center gap-2 bg-white border border-[var(--pota-border)] rounded-xl px-3.5 py-2.5">
                <Lock className="w-4 h-4 text-[var(--pota-text-muted)]" />
                <input
                  data-testid="input-password"
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              data-testid="btn-login"
              type="submit" disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-[var(--pota-green)] hover:bg-[var(--pota-green-2)] text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
            >
              {loading ? "Memproses..." : (<>Masuk Portal <ArrowRight className="w-4 h-4" /></>)}
            </button>

            <div className="text-center text-xs text-[var(--pota-text-muted)] mt-4">
              Sistem terenkripsi & terverifikasi pengelola.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
