import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("pota_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

client.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !e.config.url.includes("/auth/login")) {
      localStorage.removeItem("pota_token");
      if (!window.location.pathname.startsWith("/portal/") && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(e);
  }
);

export default client;

export const formatIDR = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export const formatMonth = (ym) => {
  if (!ym) return "-";
  const [y, m] = ym.split("-");
  const names = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
};

export const formatDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export const errText = (e) => {
  const d = e?.response?.data?.detail;
  if (!d) return e.message || "Terjadi kesalahan";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join(", ");
  return JSON.stringify(d);
};
