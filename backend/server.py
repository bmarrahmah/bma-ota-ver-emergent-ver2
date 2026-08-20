from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import secrets
import logging
import random
import io
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

import bcrypt
import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Header, Query
from fastapi.responses import Response as FastResponse, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

# -----------------------------
# Setup
# -----------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

APP_NAME = os.environ.get("APP_NAME", "portal-ota")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

app = FastAPI(title="Portal Orang Tua Asuh API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("portal-ota")

# -----------------------------
# Object storage
# -----------------------------
_storage_key: Optional[str] = None


def init_storage(force: bool = False) -> Optional[str]:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage tidak tersedia")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# -----------------------------
# Auth helpers
# -----------------------------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(uid: str, email: str, minutes: int = 60 * 24 * 7) -> str:
    payload = {
        "sub": uid,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesi telah kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "Pengguna tidak ditemukan")
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


async def log_activity(user: dict, action: str, entity: str, entity_id: str = "", label: str = "", details: Optional[dict] = None):
    try:
        await db.activities.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "user_name": user.get("name", ""),
            "user_email": user.get("email", ""),
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "label": label or "",
            "details": details or {},
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.warning(f"activity log failed: {e}")


# -----------------------------
# Models
# -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GuardianIn(BaseModel):
    name: str
    contact: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    status: Literal["Rutin", "Tidak Rutin", "Insidentil", "Tidak Aktif"] = "Rutin"
    notes: Optional[str] = ""


class ChildIn(BaseModel):
    name: str
    nim: str
    generation: str
    birth_date: Optional[str] = ""
    address: Optional[str] = ""
    father_name: Optional[str] = ""
    father_job: Optional[str] = ""
    mother_name: Optional[str] = ""
    mother_job: Optional[str] = ""
    photo_url: Optional[str] = ""
    school: Optional[str] = ""
    aspiration: Optional[str] = ""
    status: Literal["Aktif", "Alumni", "Non-Aktif"] = "Aktif"


class RelationIn(BaseModel):
    guardian_id: str
    child_id: str
    notes: Optional[str] = ""


class DonationIn(BaseModel):
    guardian_id: str
    donation_date: str  # ISO date
    donation_month: str  # e.g. "2026-01"
    amount: float
    method: Optional[str] = "Transfer Bank"
    notes: Optional[str] = ""


class DevelopmentIn(BaseModel):
    child_id: str
    academic_year: str  # e.g. "2025/2026"
    semester: Literal["Semester 1", "Semester 2"]
    period_month: Optional[str] = ""  # "2026-01"
    category: str  # Akademik, Keagamaan, Hafalan, Karakter, Kedisiplinan, Kehadiran, Prestasi, Lainnya
    title: str
    content: str
    note: Optional[str] = ""


class ReportIn(BaseModel):
    guardian_id: str
    month: str  # "2026-01"
    summary: str
    status: Literal["Terlapor", "Belum Terlapor"] = "Terlapor"


class TargetIn(BaseModel):
    month: str
    amount: float


class SettingsIn(BaseModel):
    institution_name: str
    tagline: Optional[str] = ""
    contact: Optional[str] = ""
    address: Optional[str] = ""
    logo_url: Optional[str] = ""


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordIn(BaseModel):
    new_password: str


# -----------------------------
# Utility
# -----------------------------
def strip_mongo(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def build_guardian_summary(g: dict) -> dict:
    gid = g["id"]
    child_ids = [r["child_id"] async for r in db.relations.find({"guardian_id": gid})]
    children_count = len(child_ids)
    donations = await db.donations.find({"guardian_id": gid}).to_list(1000)
    total = sum(d.get("amount", 0) for d in donations)
    last = None
    if donations:
        last = max(donations, key=lambda d: d.get("donation_date", ""))
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    report = await db.reports.find_one({"guardian_id": gid, "month": current_month})
    return {
        **strip_mongo(g),
        "children_count": children_count,
        "total_donation": total,
        "last_donation": strip_mongo(last) if last else None,
        "current_month_reported": bool(report and report.get("status") == "Terlapor"),
    }


# -----------------------------
# Auth endpoints
# -----------------------------
@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Email atau kata sandi salah")
    token = create_token(user["id"], email)
    response.set_cookie(
        "access_token", token, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/"
    )
    return {
        "id": user["id"],
        "email": email,
        "name": user.get("name", "Admin"),
        "avatar_url": user.get("avatar_url", ""),
        "token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not full or not verify_password(body.current_password, full.get("password_hash", "")):
        raise HTTPException(400, "Kata sandi saat ini salah")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Kata sandi baru minimal 6 karakter")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await log_activity(user, "change_password", "user", user["id"], user.get("name", ""))
    return {"ok": True}


@api.get("/activities")
async def list_activities(
    entity: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 200,
    user=Depends(get_current_user),
):
    q = {}
    if entity and entity != "all":
        q["entity"] = entity
    if action and action != "all":
        q["action"] = action
    if user_id and user_id != "all":
        q["user_id"] = user_id
    docs = await db.activities.find(q).sort("created_at", -1).limit(min(limit, 500)).to_list(500)
    for d in docs:
        strip_mongo(d)
    return docs


@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    docs = await db.users.find().sort("created_at", 1).to_list(200)
    for d in docs:
        strip_mongo(d)
        d.pop("password_hash", None)
    return docs


@api.post("/users")
async def create_user_endpoint(body: UserCreateIn, user=Depends(get_current_user)):
    email = body.email.lower()
    if len(body.password) < 6:
        raise HTTPException(400, "Kata sandi minimal 6 karakter")
    exists = await db.users.find_one({"email": email})
    if exists:
        raise HTTPException(400, "Email sudah terdaftar")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "admin",
        "avatar_url": "",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    strip_mongo(doc)
    doc.pop("password_hash", None)
    await log_activity(user, "create", "user", doc["id"], doc["name"])
    return doc


@api.put("/users/{uid}")
async def update_user(uid: str, body: UserUpdateIn, user=Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if upd:
        await db.users.update_one({"id": uid}, {"$set": upd})
    u = await db.users.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    strip_mongo(u)
    u.pop("password_hash", None)
    return u


@api.delete("/users/{uid}")
async def delete_user(uid: str, user=Depends(get_current_user)):
    if uid == user["id"]:
        raise HTTPException(400, "Tidak dapat menghapus akun sendiri")
    count = await db.users.count_documents({})
    if count <= 1:
        raise HTTPException(400, "Minimal harus ada satu akun admin")
    target = await db.users.find_one({"id": uid})
    await db.users.delete_one({"id": uid})
    if target:
        await log_activity(user, "delete", "user", uid, target.get("name", ""))
    return {"ok": True}


@api.post("/users/{uid}/reset-password")
async def reset_user_password(uid: str, body: ResetPasswordIn, user=Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(400, "Kata sandi minimal 6 karakter")
    r = await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_password(body.new_password)}})
    if r.matched_count == 0:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    target = await db.users.find_one({"id": uid})
    await log_activity(user, "reset", "user", uid, (target or {}).get("name", ""))
    return {"ok": True}


# -----------------------------
# Dashboard
# -----------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    guardians = await db.guardians.find().to_list(2000)
    children = await db.children.find().to_list(2000)
    donations = await db.donations.find().to_list(5000)
    reports = await db.reports.find().to_list(5000)

    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    reports_this_month = [r for r in reports if r.get("month") == current_month]
    reported_ids = {r["guardian_id"] for r in reports_this_month if r.get("status") == "Terlapor"}
    active_guardians = [g for g in guardians if g.get("status") != "Tidak Aktif"]

    status_dist = {"Rutin": 0, "Tidak Rutin": 0, "Insidentil": 0, "Tidak Aktif": 0}
    for g in guardians:
        s = g.get("status", "Tidak Aktif")
        status_dist[s] = status_dist.get(s, 0) + 1

    # Recent activity
    activities = []
    for d in sorted(donations, key=lambda x: x.get("created_at", ""), reverse=True)[:5]:
        g = next((x for x in guardians if x["id"] == d["guardian_id"]), None)
        activities.append({
            "type": "donation",
            "title": f"Donasi diterima dari {g['name'] if g else '-'}",
            "amount": d.get("amount"),
            "date": d.get("created_at"),
        })
    devs = await db.developments.find().sort("created_at", -1).limit(5).to_list(5)
    for dev in devs:
        c = next((x for x in children if x["id"] == dev["child_id"]), None)
        activities.append({
            "type": "development",
            "title": f"Perkembangan {c['name'] if c else '-'} — {dev.get('category')}",
            "date": dev.get("created_at"),
        })
    activities = sorted(activities, key=lambda x: x.get("date", ""), reverse=True)[:8]

    return {
        "total_guardians": len(guardians),
        "active_guardians": len(active_guardians),
        "total_children": len(children),
        "total_donation": sum(d.get("amount", 0) for d in donations),
        "donation_this_month": sum(d.get("amount", 0) for d in donations if d.get("donation_month") == current_month),
        "reports_this_month": len(reported_ids),
        "reports_pending": len(active_guardians) - len(reported_ids),
        "status_distribution": status_dist,
        "recent_activity": activities,
        "current_month": current_month,
    }


@api.get("/dashboard/donation-trend")
async def donation_trend(months: int = 12, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    buckets = []
    for i in range(months - 1, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        key = f"{year:04d}-{month:02d}"
        buckets.append(key)
    docs = await db.donations.find({"donation_month": {"$in": buckets}}).to_list(5000)
    totals = {k: 0 for k in buckets}
    counts = {k: 0 for k in buckets}
    for d in docs:
        m = d.get("donation_month")
        if m in totals:
            totals[m] += d.get("amount", 0)
            counts[m] += 1
    names_id = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
    return [
        {
            "month": k,
            "label": f"{names_id[int(k.split('-')[1])-1]} {k.split('-')[0][2:]}",
            "amount": totals[k],
            "count": counts[k],
        }
        for k in buckets
    ]


@api.get("/reports/pdf-summary")
async def report_pdf_summary(month: str, user=Depends(get_current_user)):
    guardians = await db.guardians.find().sort("name", 1).to_list(2000)
    reports = await db.reports.find({"month": month}).to_list(2000)
    donations = await db.donations.find({"donation_month": month}).to_list(2000)
    rels = await db.relations.find().to_list(5000)
    settings = await db.settings.find_one({"id": "main"}) or {}

    by_gid_report = {r["guardian_id"]: r for r in reports}
    by_gid_donation = {}
    for d in donations:
        by_gid_donation.setdefault(d["guardian_id"], 0)
        by_gid_donation[d["guardian_id"]] += d.get("amount", 0)
    children_count = {}
    for r in rels:
        children_count[r["guardian_id"]] = children_count.get(r["guardian_id"], 0) + 1

    names_id = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
    y, m = month.split("-")
    period_label = f"{names_id[int(m)-1]} {y}"

    total_terlapor = sum(1 for r in reports if r.get("status") == "Terlapor")
    total_donation = sum(d.get("amount", 0) for d in donations)
    active_guardians = [g for g in guardians if g.get("status") != "Tidak Aktif"]
    total_belum = len(active_guardians) - total_terlapor

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.6*cm, rightMargin=1.6*cm, topMargin=2*cm, bottomMargin=1.8*cm,
        title=f"Rekap Laporan {period_label}",
    )
    styles = getSampleStyleSheet()
    GREEN = colors.HexColor("#0F4A2A")
    GOLD = colors.HexColor("#7CB342")
    MUTED = colors.HexColor("#5C6F67")
    BG_SOFT = colors.HexColor("#F8FAF8")
    ROW_ALT = colors.HexColor("#FBFDFB")

    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=GREEN, fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=4, alignment=0)
    over = ParagraphStyle("over", parent=styles["Normal"], textColor=GOLD, fontName="Helvetica-Bold", fontSize=9, leading=12, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=GREEN, fontName="Helvetica-Bold", fontSize=13, leading=16, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["Normal"], textColor=colors.HexColor("#111E1A"), fontName="Helvetica", fontSize=10, leading=14)
    muted = ParagraphStyle("muted", parent=styles["Normal"], textColor=MUTED, fontName="Helvetica", fontSize=9, leading=12)

    def fmt_idr(n):
        try: return f"Rp {int(n):,}".replace(",", ".")
        except Exception: return "Rp 0"

    story = []
    story.append(Paragraph("REKAP LAPORAN BULANAN", over))
    story.append(Paragraph(settings.get("institution_name", "Yayasan Insan Peduli Umat"), h1))
    if settings.get("tagline"):
        story.append(Paragraph(settings["tagline"], muted))
    story.append(Spacer(1, 12))

    info = Table([
        [Paragraph("<b>Periode</b>", body), Paragraph(period_label, body),
         Paragraph("<b>Tanggal Cetak</b>", body), Paragraph(datetime.now(timezone.utc).strftime("%d %B %Y"), body)],
    ], colWidths=[2.6*cm, 5*cm, 3.4*cm, 6.4*cm])
    info.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8E4")),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#E2E8E4")),
        ("BACKGROUND", (0,0), (0,-1), BG_SOFT),
        ("BACKGROUND", (2,0), (2,-1), BG_SOFT),
        ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(info)

    # Summary stats
    story.append(Spacer(1, 10))
    stats = Table([
        [Paragraph("<b>Total OTA</b>", muted), Paragraph("<b>Terlapor</b>", muted),
         Paragraph("<b>Belum Terlapor</b>", muted), Paragraph("<b>Donasi Bulan Ini</b>", muted)],
        [Paragraph(f"<font size=16 color='#0B3D2E'><b>{len(guardians)}</b></font>", body),
         Paragraph(f"<font size=16 color='#065F46'><b>{total_terlapor}</b></font>", body),
         Paragraph(f"<font size=16 color='#9F1239'><b>{max(0,total_belum)}</b></font>", body),
         Paragraph(f"<font size=14 color='#0B3D2E'><b>{fmt_idr(total_donation)}</b></font>", body)],
    ], colWidths=[4.2*cm]*4)
    stats.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8E4")),
        ("LINEAFTER", (0,0), (-2,-1), 0.25, colors.HexColor("#E2E8E4")),
        ("BACKGROUND", (0,0), (-1,0), BG_SOFT),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(stats)

    # Table of guardians
    story.append(Paragraph("Daftar Orang Tua Asuh", h2))
    header = ["No", "Nama Orang Tua Asuh", "Kontak", "Status OTA", "Anak", "Donasi", "Status Laporan"]
    table_data = [[Paragraph(f"<b>{h}</b>", body) for h in header]]
    for i, g in enumerate(guardians, 1):
        gid = g["id"]
        rep = by_gid_report.get(gid)
        rep_status = rep.get("status") if rep else "Belum Terlapor"
        rep_color = "#065F46" if rep_status == "Terlapor" else "#9F1239"
        table_data.append([
            Paragraph(str(i), body),
            Paragraph(g["name"], body),
            Paragraph(g.get("contact") or "-", muted),
            Paragraph(g.get("status", "-"), muted),
            Paragraph(str(children_count.get(gid, 0)), body),
            Paragraph(fmt_idr(by_gid_donation.get(gid, 0)), body),
            Paragraph(f"<font color='{rep_color}'><b>{rep_status}</b></font>", body),
        ])
    tbl = Table(table_data, colWidths=[0.9*cm, 4.2*cm, 3.1*cm, 2.2*cm, 1.6*cm, 2.6*cm, 3.2*cm], repeatRows=1)
    tbl_style = [
        ("BACKGROUND", (0,0), (-1,0), GREEN),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("LINEBELOW", (0,0), (-1,0), 1.5, GOLD),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8E4")),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#EEF3EF")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]
    for r_idx in range(1, len(table_data)):
        if r_idx % 2 == 0:
            tbl_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), ROW_ALT))
    # Override header row text color for the header <b> paragraphs (they use body color); rebuild header cells as white paragraphs
    white_header = ParagraphStyle("wh", parent=body, textColor=colors.white, fontName="Helvetica-Bold")
    table_data[0] = [Paragraph(h, white_header) for h in header]
    tbl = Table(table_data, colWidths=[0.9*cm, 4.2*cm, 3.1*cm, 2.2*cm, 1.6*cm, 2.6*cm, 3.2*cm], repeatRows=1)
    tbl.setStyle(TableStyle(tbl_style))
    story.append(tbl)

    story.append(Spacer(1, 18))
    story.append(Paragraph("Dokumen ini dihasilkan otomatis oleh Portal Orang Tua Asuh — Barakallahu fiikum.", muted))

    doc.build(story)
    buf.seek(0)
    filename = f"Rekap_Laporan_{month}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/reports/pdf")
async def report_pdf(guardian_id: str, month: str, user=Depends(get_current_user)):
    g = await db.guardians.find_one({"id": guardian_id})
    if not g:
        raise HTTPException(404, "Orang Tua Asuh tidak ditemukan")
    report = await db.reports.find_one({"guardian_id": guardian_id, "month": month})
    settings = await db.settings.find_one({"id": "main"}) or {}
    rels = await db.relations.find({"guardian_id": guardian_id}).to_list(200)
    child_ids = [r["child_id"] for r in rels]
    children = await db.children.find({"id": {"$in": child_ids}}).to_list(200)
    devs_by_child = {}
    for c in children:
        devs = await db.developments.find({"child_id": c["id"]}).sort("created_at", -1).to_list(200)
        devs_by_child[c["id"]] = devs

    names_id = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
    y, m = month.split("-")
    period_label = f"{names_id[int(m)-1]} {y}"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2.2*cm, bottomMargin=2*cm,
        title=f"Laporan {g['name']} - {period_label}",
    )
    styles = getSampleStyleSheet()
    GREEN = colors.HexColor("#0F4A2A")
    GOLD = colors.HexColor("#7CB342")
    MUTED = colors.HexColor("#5C6F67")

    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=GREEN, fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=6)
    over = ParagraphStyle("over", parent=styles["Normal"], textColor=GOLD, fontName="Helvetica-Bold", fontSize=9, leading=12, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=GREEN, fontName="Helvetica-Bold", fontSize=14, leading=18, spaceBefore=14, spaceAfter=6)
    h3 = ParagraphStyle("h3", parent=styles["Heading3"], textColor=GREEN, fontName="Helvetica-Bold", fontSize=12, leading=15, spaceBefore=8, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["Normal"], textColor=colors.HexColor("#111E1A"), fontName="Helvetica", fontSize=10.5, leading=15)
    muted = ParagraphStyle("muted", parent=styles["Normal"], textColor=MUTED, fontName="Helvetica", fontSize=9, leading=12)
    pill = ParagraphStyle("pill", parent=styles["Normal"], textColor=colors.HexColor("#7A5B14"), fontName="Helvetica-Bold", fontSize=9)

    story = []
    story.append(Paragraph("PORTAL ORANG TUA ASUH", over))
    story.append(Paragraph(settings.get("institution_name", "Yayasan Insan Peduli Umat"), h1))
    if settings.get("tagline"):
        story.append(Paragraph(settings["tagline"], muted))
    story.append(Spacer(1, 12))

    info_table = Table([
        [Paragraph("<b>Orang Tua Asuh</b>", body), Paragraph(g["name"], body)],
        [Paragraph("<b>Status</b>", body), Paragraph(g.get("status", "-"), body)],
        [Paragraph("<b>Periode</b>", body), Paragraph(period_label, body)],
        [Paragraph("<b>Tanggal Cetak</b>", body), Paragraph(datetime.now(timezone.utc).strftime("%d %B %Y"), body)],
    ], colWidths=[4.2*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8E4")),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#E2E8E4")),
        ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#F8FAF8")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(info_table)

    if report and report.get("summary"):
        story.append(Paragraph("Ringkasan Laporan", h2))
        story.append(Paragraph(report["summary"].replace("\n", "<br/>"), body))
    else:
        story.append(Paragraph("Ringkasan Laporan", h2))
        story.append(Paragraph("<i>Laporan untuk periode ini belum tersedia.</i>", muted))

    story.append(Paragraph("Anak Asuh dan Capaian", h2))
    if not children:
        story.append(Paragraph("Belum ada anak asuh yang terhubung.", muted))
    for c in children:
        story.append(Paragraph(f"{c['name']} — NIM {c.get('nim', '-')}", h3))
        story.append(Paragraph(f"Angkatan {c.get('generation', '-')} · {c.get('school', '-')}", muted))
        devs = devs_by_child.get(c["id"], [])
        if not devs:
            story.append(Paragraph("<i>Belum ada capaian tercatat.</i>", muted))
        else:
            for d in devs[:6]:
                story.append(Spacer(1, 4))
                story.append(Paragraph(f"<font color='#7CB342'>■</font> <b>{d.get('category', '-')}</b> — {d.get('semester','-')} · {d.get('academic_year','-')}", pill))
                if d.get("title"):
                    story.append(Paragraph(f"<b>{d['title']}</b>", body))
                if d.get("content"):
                    story.append(Paragraph(d["content"], body))

    story.append(Spacer(1, 20))
    story.append(Paragraph("Jazakumullah khairan katsira atas dukungan Bapak/Ibu.", muted))

    doc.build(story)
    buf.seek(0)
    filename = f"Laporan_{g['name'].replace(' ', '_')}_{month}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# -----------------------------
# Guardians (Orang Tua Asuh)
# -----------------------------
@api.get("/guardians")
async def list_guardians(q: Optional[str] = None, status: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if status and status != "all":
        query["status"] = status
    docs = await db.guardians.find(query).sort("created_at", -1).to_list(2000)
    if q:
        ql = q.lower()
        docs = [d for d in docs if ql in d.get("name", "").lower() or ql in d.get("contact", "").lower()]
    result = []
    for g in docs:
        result.append(await build_guardian_summary(g))
    return result


@api.post("/guardians")
async def create_guardian(body: GuardianIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["portal_token"] = secrets.token_urlsafe(24)
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.guardians.insert_one(doc)
    await log_activity(user, "create", "guardian", doc["id"], doc["name"])
    return strip_mongo(doc)


@api.get("/guardians/{gid}")
async def get_guardian(gid: str, user=Depends(get_current_user)):
    g = await db.guardians.find_one({"id": gid})
    if not g:
        raise HTTPException(404, "Orang Tua Asuh tidak ditemukan")
    return await build_guardian_summary(g)


@api.put("/guardians/{gid}")
async def update_guardian(gid: str, body: GuardianIn, user=Depends(get_current_user)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    r = await db.guardians.update_one({"id": gid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    g = await db.guardians.find_one({"id": gid})
    await log_activity(user, "update", "guardian", gid, g.get("name", ""))
    return strip_mongo(g)


@api.delete("/guardians/{gid}")
async def delete_guardian(gid: str, user=Depends(get_current_user)):
    g = await db.guardians.find_one({"id": gid})
    await db.guardians.delete_one({"id": gid})
    await db.relations.delete_many({"guardian_id": gid})
    await db.donations.delete_many({"guardian_id": gid})
    await db.reports.delete_many({"guardian_id": gid})
    if g:
        await log_activity(user, "delete", "guardian", gid, g.get("name", ""))
    return {"ok": True}


@api.post("/guardians/{gid}/regenerate-token")
async def regenerate_token(gid: str, user=Depends(get_current_user)):
    token = secrets.token_urlsafe(24)
    await db.guardians.update_one({"id": gid}, {"$set": {"portal_token": token, "updated_at": now_iso()}})
    g = await db.guardians.find_one({"id": gid})
    await log_activity(user, "regenerate", "guardian", gid, (g or {}).get("name", ""))
    return {"portal_token": token}


# -----------------------------
# Children (Anak Asuh)
# -----------------------------
@api.get("/children")
async def list_children(q: Optional[str] = None, generation: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if generation:
        query["generation"] = generation
    docs = await db.children.find(query).sort("created_at", -1).to_list(2000)
    if q:
        ql = q.lower()
        docs = [d for d in docs if ql in d.get("name", "").lower() or ql in d.get("nim", "").lower() or ql in d.get("generation", "").lower()]
    for c in docs:
        rels = await db.relations.count_documents({"child_id": c["id"]})
        c["guardians_count"] = rels
        strip_mongo(c)
    return docs


@api.post("/children")
async def create_child(body: ChildIn, user=Depends(get_current_user)):
    exists = await db.children.find_one({"nim": body.nim})
    if exists:
        raise HTTPException(400, "NIM sudah terdaftar")
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.children.insert_one(doc)
    await log_activity(user, "create", "child", doc["id"], doc["name"])
    return strip_mongo(doc)


@api.get("/children/{cid}")
async def get_child(cid: str, user=Depends(get_current_user)):
    c = await db.children.find_one({"id": cid})
    if not c:
        raise HTTPException(404, "Anak Asuh tidak ditemukan")
    rels = await db.relations.find({"child_id": cid}).to_list(100)
    guardian_ids = [r["guardian_id"] for r in rels]
    guardians = await db.guardians.find({"id": {"$in": guardian_ids}}).to_list(100)
    devs = await db.developments.find({"child_id": cid}).sort("created_at", -1).to_list(200)
    return {
        **strip_mongo(c),
        "guardians": [strip_mongo(g) for g in guardians],
        "developments": [strip_mongo(d) for d in devs],
    }


@api.put("/children/{cid}")
async def update_child(cid: str, body: ChildIn, user=Depends(get_current_user)):
    upd = body.model_dump()
    upd["updated_at"] = now_iso()
    r = await db.children.update_one({"id": cid}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    c = await db.children.find_one({"id": cid})
    await log_activity(user, "update", "child", cid, c.get("name", ""))
    return strip_mongo(c)


@api.delete("/children/{cid}")
async def delete_child(cid: str, user=Depends(get_current_user)):
    c = await db.children.find_one({"id": cid})
    await db.children.delete_one({"id": cid})
    await db.relations.delete_many({"child_id": cid})
    await db.developments.delete_many({"child_id": cid})
    if c:
        await log_activity(user, "delete", "child", cid, c.get("name", ""))
    return {"ok": True}


# -----------------------------
# Photo upload
# -----------------------------
@api.post("/upload/photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg").lower()
    path = f"{APP_NAME}/photos/{uuid.uuid4()}.{ext}"
    data = await file.read()
    ct = file.content_type or f"image/{ext}"
    result = put_object(path, data, ct)
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def download_file(path: str):
    data, ct = get_object(path)
    return FastResponse(content=data, media_type=ct)


# -----------------------------
# Relations
# -----------------------------
@api.get("/relations")
async def list_relations(user=Depends(get_current_user)):
    rels = await db.relations.find().to_list(2000)
    guardians = {g["id"]: g for g in await db.guardians.find().to_list(2000)}
    children = {c["id"]: c for c in await db.children.find().to_list(2000)}
    out = []
    for r in rels:
        g = guardians.get(r["guardian_id"])
        c = children.get(r["child_id"])
        if not g or not c:
            continue
        out.append({
            "id": r["id"],
            "guardian_id": r["guardian_id"],
            "child_id": r["child_id"],
            "guardian_name": g["name"],
            "child_name": c["name"],
            "child_nim": c.get("nim"),
            "created_at": r.get("created_at"),
            "notes": r.get("notes", ""),
        })
    return out


@api.post("/relations")
async def create_relation(body: RelationIn, user=Depends(get_current_user)):
    exists = await db.relations.find_one({"guardian_id": body.guardian_id, "child_id": body.child_id})
    if exists:
        raise HTTPException(400, "Relasi ini sudah ada")
    g = await db.guardians.find_one({"id": body.guardian_id})
    c = await db.children.find_one({"id": body.child_id})
    if not g or not c:
        raise HTTPException(404, "Orang Tua Asuh atau Anak Asuh tidak ditemukan")
    doc = {
        "id": str(uuid.uuid4()),
        "guardian_id": body.guardian_id,
        "child_id": body.child_id,
        "notes": body.notes,
        "created_at": now_iso(),
    }
    await db.relations.insert_one(doc)
    await log_activity(user, "create", "relation", doc["id"], f"{g['name']} ↔ {c['name']}")
    return strip_mongo(doc)


@api.delete("/relations/{rid}")
async def delete_relation(rid: str, user=Depends(get_current_user)):
    r = await db.relations.find_one({"id": rid})
    label = ""
    if r:
        g = await db.guardians.find_one({"id": r["guardian_id"]})
        c = await db.children.find_one({"id": r["child_id"]})
        label = f"{(g or {}).get('name','?')} ↔ {(c or {}).get('name','?')}"
    await db.relations.delete_one({"id": rid})
    await log_activity(user, "delete", "relation", rid, label)
    return {"ok": True}


# -----------------------------
# Donations
# -----------------------------
@api.get("/donations/pdf")
async def donations_pdf(
    month: Optional[str] = None,
    guardian_id: Optional[str] = None,
    method: Optional[str] = None,
    user=Depends(get_current_user),
):
    q = {}
    if month:
        q["donation_month"] = month
    if guardian_id:
        q["guardian_id"] = guardian_id
    if method:
        q["method"] = method
    docs = await db.donations.find(q).sort("donation_date", -1).to_list(5000)
    guardians = {g["id"]: g for g in await db.guardians.find().to_list(2000)}
    settings = await db.settings.find_one({"id": "main"}) or {}
    target_doc = None
    if month:
        target_doc = await db.donation_targets.find_one({"month": month})

    names_id = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]

    def fmt_month(ym):
        if not ym: return "-"
        y, m = ym.split("-")
        return f"{names_id[int(m)-1]} {y}"

    def fmt_idr(n):
        try: return f"Rp {int(n):,}".replace(",", ".")
        except Exception: return "Rp 0"

    period_label = fmt_month(month) if month else "Semua Periode"
    guardian_label = guardians.get(guardian_id, {}).get("name") if guardian_id else "Semua Orang Tua Asuh"
    method_label = method if method else "Semua Metode"

    total = sum(d.get("amount", 0) for d in docs)
    per_ota = {}
    for d in docs:
        gid = d["guardian_id"]
        if gid not in per_ota:
            per_ota[gid] = {"name": guardians.get(gid, {}).get("name", "-"), "amount": 0, "count": 0}
        per_ota[gid]["amount"] += d.get("amount", 0)
        per_ota[gid]["count"] += 1
    top5 = sorted(per_ota.values(), key=lambda x: x["amount"], reverse=True)[:5]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.6*cm, rightMargin=1.6*cm, topMargin=2*cm, bottomMargin=1.8*cm,
        title=f"Rekap Donasi {period_label}",
    )
    styles = getSampleStyleSheet()
    GREEN = colors.HexColor("#0F4A2A")
    GOLD = colors.HexColor("#7CB342")
    MUTED = colors.HexColor("#4E6656")
    BG_SOFT = colors.HexColor("#F7FAF6")
    ROW_ALT = colors.HexColor("#F1F8E9")

    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=GREEN, fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=4, alignment=0)
    over = ParagraphStyle("over", parent=styles["Normal"], textColor=GOLD, fontName="Helvetica-Bold", fontSize=9, leading=12, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=GREEN, fontName="Helvetica-Bold", fontSize=13, leading=16, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["Normal"], textColor=colors.HexColor("#0B2416"), fontName="Helvetica", fontSize=10, leading=14)
    muted = ParagraphStyle("muted", parent=styles["Normal"], textColor=MUTED, fontName="Helvetica", fontSize=9, leading=12)

    story = []
    story.append(Paragraph("REKAP DONASI", over))
    story.append(Paragraph(settings.get("institution_name", "Yayasan Insan Peduli Umat"), h1))
    if settings.get("tagline"):
        story.append(Paragraph(settings["tagline"], muted))
    story.append(Spacer(1, 12))

    info = Table([
        [Paragraph("<b>Periode</b>", body), Paragraph(period_label, body),
         Paragraph("<b>Orang Tua Asuh</b>", body), Paragraph(guardian_label or "-", body)],
        [Paragraph("<b>Metode</b>", body), Paragraph(method_label, body),
         Paragraph("<b>Tanggal Cetak</b>", body), Paragraph(datetime.now(timezone.utc).strftime("%d %B %Y"), body)],
    ], colWidths=[2.6*cm, 5*cm, 3.4*cm, 6.4*cm])
    info.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#DDE6DA")),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#DDE6DA")),
        ("BACKGROUND", (0,0), (0,-1), BG_SOFT),
        ("BACKGROUND", (2,0), (2,-1), BG_SOFT),
        ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(info)

    # Summary
    story.append(Spacer(1, 10))
    target_amount = float((target_doc or {}).get("amount", 0)) if target_doc else 0
    pct = round((total/target_amount)*100, 1) if target_amount > 0 else 0
    stats_row_1 = [
        Paragraph("<b>Total Terkumpul</b>", muted),
        Paragraph("<b>Jumlah Transaksi</b>", muted),
        Paragraph("<b>Target Bulan Ini</b>" if month else "<b>Rata-rata Transaksi</b>", muted),
        Paragraph("<b>Pencapaian</b>" if month else "<b>Orang Tua Asuh</b>", muted),
    ]
    if month:
        stats_row_2 = [
            Paragraph(f"<font size=14 color='#0F4A2A'><b>{fmt_idr(total)}</b></font>", body),
            Paragraph(f"<font size=16 color='#0F4A2A'><b>{len(docs)}</b></font>", body),
            Paragraph(f"<font size=13 color='#0F4A2A'><b>{fmt_idr(target_amount) if target_amount else '-'}</b></font>", body),
            Paragraph(f"<font size=16 color='#{'2E7D32' if pct >= 100 else '0F4A2A'}'><b>{pct}%</b></font>" if target_amount else "-", body),
        ]
    else:
        avg = total / len(docs) if docs else 0
        stats_row_2 = [
            Paragraph(f"<font size=14 color='#0F4A2A'><b>{fmt_idr(total)}</b></font>", body),
            Paragraph(f"<font size=16 color='#0F4A2A'><b>{len(docs)}</b></font>", body),
            Paragraph(f"<font size=13 color='#0F4A2A'><b>{fmt_idr(avg)}</b></font>", body),
            Paragraph(f"<font size=16 color='#0F4A2A'><b>{len(per_ota)}</b></font>", body),
        ]
    stats_tbl = Table([stats_row_1, stats_row_2], colWidths=[4.2*cm]*4)
    stats_tbl.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#DDE6DA")),
        ("LINEAFTER", (0,0), (-2,-1), 0.25, colors.HexColor("#DDE6DA")),
        ("BACKGROUND", (0,0), (-1,0), BG_SOFT),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(stats_tbl)

    # Top 5 kontribusi
    if top5:
        story.append(Paragraph("Top 5 Kontribusi Orang Tua Asuh", h2))
        max_amt = top5[0]["amount"] or 1
        top_data = [[Paragraph("<b>Peringkat</b>", body), Paragraph("<b>Orang Tua Asuh</b>", body),
                     Paragraph("<b>Kontribusi</b>", body), Paragraph("<b>Transaksi</b>", body)]]
        white_header = ParagraphStyle("wh", parent=body, textColor=colors.white, fontName="Helvetica-Bold")
        top_data[0] = [Paragraph(x.text, white_header) for x in top_data[0]]
        for i, r in enumerate(top5, 1):
            share = round((r["amount"]/max_amt)*100)
            bar = "█" * max(1, share // 8)
            top_data.append([
                Paragraph(f"#{i}", body),
                Paragraph(r["name"], body),
                Paragraph(f"<b>{fmt_idr(r['amount'])}</b> <font color='#7CB342'>{bar}</font>", body),
                Paragraph(str(r["count"]), body),
            ])
        top_tbl = Table(top_data, colWidths=[1.5*cm, 5.5*cm, 8*cm, 2.4*cm], repeatRows=1)
        top_style = [
            ("BACKGROUND", (0,0), (-1,0), GREEN),
            ("LINEBELOW", (0,0), (-1,0), 1.5, GOLD),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#DDE6DA")),
            ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#EEF5EA")),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ]
        for r_idx in range(1, len(top_data)):
            if r_idx % 2 == 0:
                top_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), ROW_ALT))
        top_tbl.setStyle(TableStyle(top_style))
        story.append(top_tbl)

    # Detail transaksi
    story.append(Paragraph("Detail Transaksi Donasi", h2))
    if not docs:
        story.append(Paragraph("<i>Tidak ada donasi pada periode yang dipilih.</i>", muted))
    else:
        header = ["No", "Tanggal", "Periode", "Orang Tua Asuh", "Metode", "Nominal"]
        white_header = ParagraphStyle("wh", parent=body, textColor=colors.white, fontName="Helvetica-Bold")
        rows = [[Paragraph(h, white_header) for h in header]]
        for i, d in enumerate(docs, 1):
            rows.append([
                Paragraph(str(i), body),
                Paragraph(d.get("donation_date", "-"), body),
                Paragraph(fmt_month(d.get("donation_month")), body),
                Paragraph(guardians.get(d["guardian_id"], {}).get("name", "-"), body),
                Paragraph(d.get("method") or "-", muted),
                Paragraph(f"<b>{fmt_idr(d.get('amount', 0))}</b>", body),
            ])
        rows.append([
            Paragraph("", body), Paragraph("", body), Paragraph("", body),
            Paragraph("<b>TOTAL</b>", body), Paragraph("", body),
            Paragraph(f"<b><font color='#0F4A2A'>{fmt_idr(total)}</font></b>", body),
        ])
        tbl = Table(rows, colWidths=[0.9*cm, 2.4*cm, 2.5*cm, 5.5*cm, 2.4*cm, 3.7*cm], repeatRows=1)
        tstyle = [
            ("BACKGROUND", (0,0), (-1,0), GREEN),
            ("LINEBELOW", (0,0), (-1,0), 1.5, GOLD),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#DDE6DA")),
            ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#EEF5EA")),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("BACKGROUND", (0,-1), (-1,-1), BG_SOFT),
            ("LINEABOVE", (0,-1), (-1,-1), 0.8, GOLD),
        ]
        for r_idx in range(1, len(rows)-1):
            if r_idx % 2 == 0:
                tstyle.append(("BACKGROUND", (0, r_idx), (-1, r_idx), ROW_ALT))
        tbl.setStyle(TableStyle(tstyle))
        story.append(tbl)

    story.append(Spacer(1, 18))
    story.append(Paragraph("Jazakumullah khairan atas kebaikan seluruh Orang Tua Asuh. Barakallahu fiikum.", muted))

    doc.build(story)
    buf.seek(0)
    suffix = month if month else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"Rekap_Donasi_{suffix}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/donations")
async def list_donations(guardian_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if guardian_id:
        q["guardian_id"] = guardian_id
    docs = await db.donations.find(q).sort("donation_date", -1).to_list(2000)
    guardians = {g["id"]: g for g in await db.guardians.find().to_list(2000)}
    out = []
    for d in docs:
        strip_mongo(d)
        d["guardian_name"] = guardians.get(d["guardian_id"], {}).get("name", "-")
        out.append(d)
    return out


@api.post("/donations")
async def create_donation(body: DonationIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.donations.insert_one(doc)
    g = await db.guardians.find_one({"id": body.guardian_id})
    await log_activity(user, "create", "donation", doc["id"], f"{(g or {}).get('name','-')} · Rp {int(body.amount):,}".replace(",", "."))
    return strip_mongo(doc)


@api.delete("/donations/{did}")
async def delete_donation(did: str, user=Depends(get_current_user)):
    d = await db.donations.find_one({"id": did})
    await db.donations.delete_one({"id": did})
    if d:
        g = await db.guardians.find_one({"id": d.get("guardian_id")})
        await log_activity(user, "delete", "donation", did, f"{(g or {}).get('name','-')} · Rp {int(d.get('amount',0)):,}".replace(",", "."))
    return {"ok": True}


# -----------------------------
# Developments
# -----------------------------
@api.get("/developments")
async def list_developments(
    child_id: Optional[str] = None,
    semester: Optional[str] = None,
    category: Optional[str] = None,
    user=Depends(get_current_user),
):
    q = {}
    if child_id:
        q["child_id"] = child_id
    if semester:
        q["semester"] = semester
    if category:
        q["category"] = category
    docs = await db.developments.find(q).sort("created_at", -1).to_list(2000)
    children = {c["id"]: c for c in await db.children.find().to_list(2000)}
    for d in docs:
        strip_mongo(d)
        d["child_name"] = children.get(d["child_id"], {}).get("name", "-")
    return docs


@api.post("/developments")
async def create_development(body: DevelopmentIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    await db.developments.insert_one(doc)
    c = await db.children.find_one({"id": body.child_id})
    await log_activity(user, "create", "development", doc["id"], f"{(c or {}).get('name','-')} · {body.category}")
    return strip_mongo(doc)


@api.delete("/developments/{did}")
async def delete_development(did: str, user=Depends(get_current_user)):
    d = await db.developments.find_one({"id": did})
    await db.developments.delete_one({"id": did})
    if d:
        c = await db.children.find_one({"id": d.get("child_id")})
        await log_activity(user, "delete", "development", did, f"{(c or {}).get('name','-')} · {d.get('category','')}")
    return {"ok": True}


# -----------------------------
# Reports
# -----------------------------
@api.get("/reports")
async def list_reports(month: Optional[str] = None, status: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if month:
        q["month"] = month
    docs = await db.reports.find(q).to_list(2000)
    for d in docs:
        strip_mongo(d)

    # Merge with all active guardians for the month view
    guardians = await db.guardians.find().to_list(2000)
    result = []
    if month:
        by_g = {d["guardian_id"]: d for d in docs}
        for g in guardians:
            r = by_g.get(g["id"])
            result.append({
                "guardian_id": g["id"],
                "guardian_name": g["name"],
                "guardian_status": g.get("status"),
                "month": month,
                "status": r.get("status") if r else "Belum Terlapor",
                "summary": r.get("summary") if r else "",
                "report_id": r.get("id") if r else None,
                "created_at": r.get("created_at") if r else None,
            })
        if status and status != "all":
            result = [x for x in result if x["status"] == status]
        return result

    return docs


@api.post("/reports")
async def upsert_report(body: ReportIn, user=Depends(get_current_user)):
    g = await db.guardians.find_one({"id": body.guardian_id})
    existing = await db.reports.find_one({"guardian_id": body.guardian_id, "month": body.month})
    if existing:
        await db.reports.update_one(
            {"id": existing["id"]},
            {"$set": {"summary": body.summary, "status": body.status, "updated_at": now_iso()}},
        )
        await log_activity(user, "update", "report", existing["id"], f"{(g or {}).get('name','-')} · {body.month} · {body.status}")
        return strip_mongo(await db.reports.find_one({"id": existing["id"]}))
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.reports.insert_one(doc)
    await log_activity(user, "create", "report", doc["id"], f"{(g or {}).get('name','-')} · {body.month} · {body.status}")
    return strip_mongo(doc)


@api.delete("/reports/{rid}")
async def delete_report(rid: str, user=Depends(get_current_user)):
    r = await db.reports.find_one({"id": rid})
    await db.reports.delete_one({"id": rid})
    if r:
        g = await db.guardians.find_one({"id": r.get("guardian_id")})
        await log_activity(user, "delete", "report", rid, f"{(g or {}).get('name','-')} · {r.get('month','')}")
    return {"ok": True}


# -----------------------------
# Settings
# -----------------------------
@api.get("/donation-target")
async def get_donation_target(month: str, user=Depends(get_current_user)):
    doc = await db.donation_targets.find_one({"month": month})
    donations = await db.donations.find({"donation_month": month}).to_list(2000)
    collected = sum(d.get("amount", 0) for d in donations)
    target = doc.get("amount", 0) if doc else 0
    return {
        "month": month,
        "target": target,
        "collected": collected,
        "count": len(donations),
        "percentage": round((collected / target) * 100, 1) if target > 0 else 0,
        "remaining": max(0, target - collected),
    }


@api.put("/donation-target")
async def put_donation_target(body: TargetIn, user=Depends(get_current_user)):
    await db.donation_targets.update_one(
        {"month": body.month},
        {"$set": {"amount": body.amount, "updated_at": now_iso()}},
        upsert=True,
    )
    await log_activity(user, "update", "settings", f"target-{body.month}", f"Target {body.month} · Rp {int(body.amount):,}".replace(",", "."))
    return {"month": body.month, "amount": body.amount}


@api.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.settings.find_one({"id": "main"})
    if not s:
        s = {
            "id": "main",
            "institution_name": "Yayasan Insan Peduli Umat",
            "tagline": "Membina generasi Qur'ani, membangun masa depan umat",
            "contact": "+62 812-3456-7890",
            "address": "Jl. Kebajikan No. 12, Bandung",
        }
        await db.settings.insert_one(s)
    return strip_mongo(s)


@api.put("/settings")
async def update_settings(body: SettingsIn, user=Depends(get_current_user)):
    await db.settings.update_one({"id": "main"}, {"$set": body.model_dump()}, upsert=True)
    s = await db.settings.find_one({"id": "main"})
    await log_activity(user, "update", "settings", "main", body.institution_name)
    return strip_mongo(s)


# -----------------------------
# Public Portal (no auth)
# -----------------------------
@api.get("/portal/{token}")
async def portal_view(token: str):
    g = await db.guardians.find_one({"portal_token": token})
    if not g:
        raise HTTPException(404, "Tautan portal tidak valid")

    rels = await db.relations.find({"guardian_id": g["id"]}).to_list(200)
    child_ids = [r["child_id"] for r in rels]
    children = await db.children.find({"id": {"$in": child_ids}}).to_list(200)

    # Developments per child
    child_devs = {}
    for cid in child_ids:
        devs = await db.developments.find({"child_id": cid}).sort("created_at", -1).to_list(200)
        child_devs[cid] = [strip_mongo(d) for d in devs]

    donations = await db.donations.find({"guardian_id": g["id"]}).sort("donation_date", -1).to_list(500)
    total_donation = sum(d.get("amount", 0) for d in donations)
    last_donation = donations[0] if donations else None

    reports = await db.reports.find({"guardian_id": g["id"]}).sort("month", -1).to_list(100)
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    current_report = next((r for r in reports if r.get("month") == current_month), None)

    settings = await db.settings.find_one({"id": "main"}) or {}

    return {
        "guardian": {
            "name": g["name"],
            "status": g.get("status"),
            "since": g.get("created_at"),
        },
        "institution": {
            "name": settings.get("institution_name", "Yayasan Insan Peduli Umat"),
            "tagline": settings.get("tagline", ""),
            "contact": settings.get("contact", ""),
            "logo_url": settings.get("logo_url", ""),
        },
        "summary": {
            "children_count": len(children),
            "total_donation": total_donation,
            "last_donation": {
                "amount": last_donation.get("amount") if last_donation else 0,
                "donation_month": last_donation.get("donation_month") if last_donation else None,
                "donation_date": last_donation.get("donation_date") if last_donation else None,
            } if last_donation else None,
            "current_month": current_month,
            "current_month_reported": bool(current_report and current_report.get("status") == "Terlapor"),
        },
        "children": [
            {
                **strip_mongo(c),
                "developments": child_devs.get(c["id"], []),
            }
            for c in children
        ],
        "donations": [
            {
                "donation_date": d.get("donation_date"),
                "donation_month": d.get("donation_month"),
                "amount": d.get("amount"),
                "notes": d.get("notes", ""),
            }
            for d in donations
        ],
        "reports": [
            {
                "month": r.get("month"),
                "status": r.get("status"),
                "summary": r.get("summary"),
                "created_at": r.get("created_at"),
            }
            for r in reports
        ],
    }


# -----------------------------
# Seed
# -----------------------------
INDONESIAN_NAMES_M = ["Bapak Ahmad Fauzi", "Bapak Hasan Bisri", "Bapak Muhammad Iqbal", "Bapak Rahmat Hidayat", "Bapak Abdul Karim"]
INDONESIAN_NAMES_F = ["Ibu Siti Aminah", "Ibu Fatimah Zahra", "Ibu Aisyah Nur", "Ibu Khadijah Salsabila"]
CHILD_NAMES = ["Ahmad Fauzan", "Muhammad Rizky", "Yusuf Ibrahim", "Aisyah Salsabila", "Fatimah Nur", "Zaki Ramadhan", "Hafizh Al-Fatih", "Nabila Az-Zahra", "Ibrahim Adnan", "Khadijah Alifa"]
SCHOOLS = ["Pesantren Al-Hidayah", "MA Insan Kamil", "SMA Al-Amin", "SMP Darul Ulum", "MI An-Nur"]
JOBS = ["Petani", "Wiraswasta", "Buruh Harian", "Ibu Rumah Tangga", "Pedagang"]


async def seed_admin_and_data():
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_name = os.environ.get("ADMIN_NAME", "Administrator")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": admin_name,
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    else:
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
            logger.info("Admin password updated from env")

    # Sample data
    if await db.guardians.count_documents({}) > 0:
        return

    logger.info("Seeding demo data...")

    guardians = []
    all_names = INDONESIAN_NAMES_M[:3] + INDONESIAN_NAMES_F[:2]
    statuses = ["Rutin", "Rutin", "Tidak Rutin", "Insidentil", "Rutin"]
    for i, n in enumerate(all_names):
        g = {
            "id": str(uuid.uuid4()),
            "name": n,
            "contact": f"+62 812-{random.randint(1000,9999)}-{random.randint(1000,9999)}",
            "email": f"donatur{i+1}@example.com",
            "address": random.choice(["Bandung", "Jakarta", "Yogyakarta", "Surabaya", "Bogor"]),
            "status": statuses[i],
            "notes": "Donatur setia program Orang Tua Asuh",
            "portal_token": secrets.token_urlsafe(24),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        guardians.append(g)
    await db.guardians.insert_many([dict(g) for g in guardians])

    children = []
    for i, n in enumerate(CHILD_NAMES):
        c = {
            "id": str(uuid.uuid4()),
            "name": n,
            "nim": f"2024{str(i+1).zfill(4)}",
            "generation": random.choice(["2023", "2024", "2025"]),
            "birth_date": f"20{random.randint(8,12)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            "address": random.choice(["Cianjur", "Garut", "Sumedang", "Ciamis", "Tasikmalaya"]),
            "father_name": f"Bapak {random.choice(['Sudirman', 'Kurniawan', 'Hidayat', 'Susanto'])}",
            "father_job": random.choice(JOBS),
            "mother_name": f"Ibu {random.choice(['Sumiati', 'Rohani', 'Lestari', 'Wahyuni'])}",
            "mother_job": random.choice(JOBS),
            "photo_url": "",
            "school": random.choice(SCHOOLS),
            "aspiration": random.choice(["Menjadi hafizh Al-Qur'an", "Menjadi dokter", "Menjadi guru", "Menjadi ulama"]),
            "status": "Aktif",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        children.append(c)
    await db.children.insert_many([dict(c) for c in children])

    # Relations many-to-many
    rels = []
    # Guardian 0 -> child 0,1,2
    for c in children[:3]:
        rels.append({"id": str(uuid.uuid4()), "guardian_id": guardians[0]["id"], "child_id": c["id"], "notes": "", "created_at": now_iso()})
    # Guardian 1 -> child 2,3,4
    for c in children[2:5]:
        rels.append({"id": str(uuid.uuid4()), "guardian_id": guardians[1]["id"], "child_id": c["id"], "notes": "", "created_at": now_iso()})
    # Guardian 2 -> child 5,6
    for c in children[5:7]:
        rels.append({"id": str(uuid.uuid4()), "guardian_id": guardians[2]["id"], "child_id": c["id"], "notes": "", "created_at": now_iso()})
    # Guardian 3 -> child 7,8
    for c in children[7:9]:
        rels.append({"id": str(uuid.uuid4()), "guardian_id": guardians[3]["id"], "child_id": c["id"], "notes": "", "created_at": now_iso()})
    # Guardian 4 -> child 0, 9 (child 0 has two guardians)
    rels.append({"id": str(uuid.uuid4()), "guardian_id": guardians[4]["id"], "child_id": children[0]["id"], "notes": "", "created_at": now_iso()})
    rels.append({"id": str(uuid.uuid4()), "guardian_id": guardians[4]["id"], "child_id": children[9]["id"], "notes": "", "created_at": now_iso()})
    await db.relations.insert_many(rels)

    # Donations
    donations = []
    months = ["2026-06", "2026-07", "2026-08"]
    for g in guardians:
        for m in months:
            amt = random.choice([500_000, 750_000, 1_000_000, 1_500_000, 2_000_000])
            donations.append({
                "id": str(uuid.uuid4()),
                "guardian_id": g["id"],
                "donation_date": f"{m}-{random.randint(1,25):02d}",
                "donation_month": m,
                "amount": amt,
                "method": random.choice(["Transfer Bank", "QRIS", "Tunai"]),
                "notes": "",
                "created_at": now_iso(),
            })
    await db.donations.insert_many(donations)

    # Developments
    devs = []
    categories = ["Akademik", "Keagamaan", "Hafalan", "Karakter", "Kedisiplinan"]
    contents = {
        "Akademik": "Menunjukkan peningkatan nilai matematika dan bahasa Indonesia pada rapor tengah semester.",
        "Keagamaan": "Aktif mengikuti kajian mingguan dan meningkatkan bacaan Al-Qur'an dengan tajwid yang baik.",
        "Hafalan": "Berhasil menyelesaikan hafalan Juz 30 dan mulai menghafal Juz 29.",
        "Karakter": "Menunjukkan sikap disiplin, sopan, dan bertanggung jawab terhadap tugas harian.",
        "Kedisiplinan": "Kehadiran 100% pada semester berjalan dan aktif dalam kegiatan ekstrakurikuler.",
    }
    for c in children:
        for cat in random.sample(categories, 3):
            devs.append({
                "id": str(uuid.uuid4()),
                "child_id": c["id"],
                "academic_year": "2025/2026",
                "semester": "Semester 2",
                "period_month": "2026-07",
                "category": cat,
                "title": f"Capaian {cat} — {c['name']}",
                "content": contents[cat],
                "note": "",
                "created_at": now_iso(),
            })
    await db.developments.insert_many(devs)

    # Reports (partial)
    reports = []
    for i, g in enumerate(guardians):
        for m in ["2026-06", "2026-07"]:
            status = "Terlapor"
            reports.append({
                "id": str(uuid.uuid4()),
                "guardian_id": g["id"],
                "month": m,
                "summary": f"Laporan perkembangan anak asuh untuk periode {m} telah disampaikan. Anak-anak dalam kondisi sehat dan mengalami kemajuan positif di bidang akademik dan keagamaan.",
                "status": status,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        # Some pending for current month 2026-08
        if i % 2 == 0:
            reports.append({
                "id": str(uuid.uuid4()),
                "guardian_id": g["id"],
                "month": "2026-08",
                "summary": "Laporan bulan Agustus 2026 telah disampaikan kepada donatur.",
                "status": "Terlapor",
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
    await db.reports.insert_many(reports)

    # Settings
    if not await db.settings.find_one({"id": "main"}):
        await db.settings.insert_one({
            "id": "main",
            "institution_name": "Yayasan Insan Peduli Umat",
            "tagline": "Membina generasi Qur'ani, membangun masa depan umat",
            "contact": "+62 812-3456-7890",
            "address": "Jl. Kebajikan No. 12, Bandung",
        })

    logger.info("Seed complete")


# -----------------------------
# Mount router
# -----------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.guardians.create_index("portal_token", unique=True)
    await db.children.create_index("nim", unique=True)
    await db.relations.create_index([("guardian_id", 1), ("child_id", 1)], unique=True)
    init_storage()
    await seed_admin_and_data()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
