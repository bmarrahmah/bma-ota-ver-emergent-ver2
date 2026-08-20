"""Backend tests for Portal Orang Tua Asuh (POTA)."""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "bmarrahmah@gmail.com"
ADMIN_PASSWORD = "Admin@2026"

TEST_STATE = {}


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    session.headers.update({"Authorization": f"Bearer {data['token']}"})
    return data


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert isinstance(d["token"], str) and len(d["token"]) > 20

    def test_login_wrong_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, session, auth):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------- Dashboard ----------
class TestDashboard:
    def test_stats(self, session, auth):
        r = session.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        assert d["total_guardians"] >= 5
        assert d["total_children"] >= 10
        assert "status_distribution" in d
        for k in ["Rutin", "Tidak Rutin", "Insidentil", "Tidak Aktif"]:
            assert k in d["status_distribution"]
        assert isinstance(d["recent_activity"], list)
        assert "donation_this_month" in d


# ---------- Guardians ----------
class TestGuardians:
    def test_list(self, session, auth):
        r = session.get(f"{BASE_URL}/api/guardians")
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 5
        g = arr[0]
        for k in ["id", "name", "portal_token", "children_count", "total_donation", "status"]:
            assert k in g, f"missing {k}"
        assert "_id" not in g

    def test_create_and_verify(self, session, auth):
        payload = {"name": "TEST_OTA_A", "contact": "+62-800", "email": "test_ota_a@example.com",
                   "address": "TX", "status": "Tidak Rutin", "notes": ""}
        r = session.post(f"{BASE_URL}/api/guardians", json=payload)
        assert r.status_code == 200
        g = r.json()
        assert g["name"] == "TEST_OTA_A"
        assert g["status"] == "Tidak Rutin"
        assert g.get("portal_token") and len(g["portal_token"]) > 10
        TEST_STATE["guardian_id"] = g["id"]
        TEST_STATE["portal_token"] = g["portal_token"]

        # GET back
        r2 = session.get(f"{BASE_URL}/api/guardians/{g['id']}")
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_OTA_A"

    def test_portal_token_unique(self, session, auth):
        r1 = session.post(f"{BASE_URL}/api/guardians", json={"name": "TEST_OTA_B", "status": "Rutin"})
        r2 = session.post(f"{BASE_URL}/api/guardians", json={"name": "TEST_OTA_C", "status": "Insidentil"})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["portal_token"] != r2.json()["portal_token"]
        TEST_STATE["guardian_id_b"] = r1.json()["id"]
        TEST_STATE["guardian_id_c"] = r2.json()["id"]

    def test_regenerate_token(self, session, auth):
        gid = TEST_STATE["guardian_id"]
        old = TEST_STATE["portal_token"]
        r = session.post(f"{BASE_URL}/api/guardians/{gid}/regenerate-token")
        assert r.status_code == 200
        new_token = r.json()["portal_token"]
        assert new_token and new_token != old
        # Old token should now 404
        r_old = requests.get(f"{BASE_URL}/api/portal/{old}")
        assert r_old.status_code == 404
        # New token works
        r_new = requests.get(f"{BASE_URL}/api/portal/{new_token}")
        assert r_new.status_code == 200
        TEST_STATE["portal_token"] = new_token


# ---------- Children ----------
class TestChildren:
    def test_list(self, session, auth):
        r = session.get(f"{BASE_URL}/api/children")
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 10
        assert "_id" not in arr[0]
        assert "guardians_count" in arr[0]

    def test_create_and_duplicate_nim(self, session, auth):
        nim = f"TEST{uuid.uuid4().hex[:6]}"
        payload = {"name": "TEST_Anak_A", "nim": nim, "generation": "2025",
                   "birth_date": "2010-01-01", "school": "SMA X", "status": "Aktif"}
        r = session.post(f"{BASE_URL}/api/children", json=payload)
        assert r.status_code == 200
        c = r.json()
        assert c["nim"] == nim
        TEST_STATE["child_id"] = c["id"]

        # Duplicate NIM
        r_dup = session.post(f"{BASE_URL}/api/children", json=payload)
        assert r_dup.status_code == 400


# ---------- Upload ----------
class TestUpload:
    def test_upload_and_fetch(self, session, auth):
        # minimal 1x1 PNG
        import base64
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        files = {"file": ("test.png", png_bytes, "image/png")}
        # requests will set proper multipart headers; must remove content-type header
        headers = {k: v for k, v in session.headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{BASE_URL}/api/upload/photo", files=files, headers=headers)
        if r.status_code == 500 and "Storage tidak tersedia" in r.text:
            pytest.skip("Object storage not available in this env")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["url"].startswith("/api/files/")
        # Fetch back
        r2 = requests.get(f"{BASE_URL}{d['url']}")
        assert r2.status_code == 200
        assert r2.content == png_bytes or len(r2.content) > 0


# ---------- Relations ----------
class TestRelations:
    def test_create_duplicate_delete(self, session, auth):
        gid = TEST_STATE["guardian_id"]
        cid = TEST_STATE["child_id"]
        r = session.post(f"{BASE_URL}/api/relations", json={"guardian_id": gid, "child_id": cid, "notes": ""})
        assert r.status_code == 200
        rel_id = r.json()["id"]
        # Duplicate
        r_dup = session.post(f"{BASE_URL}/api/relations", json={"guardian_id": gid, "child_id": cid})
        assert r_dup.status_code == 400
        # Delete
        r_del = session.delete(f"{BASE_URL}/api/relations/{rel_id}")
        assert r_del.status_code == 200
        # Now creation works again
        r_re = session.post(f"{BASE_URL}/api/relations", json={"guardian_id": gid, "child_id": cid})
        assert r_re.status_code == 200


# ---------- Donations ----------
class TestDonations:
    def test_create_no_child_field(self, session, auth):
        gid = TEST_STATE["guardian_id"]
        payload = {"guardian_id": gid, "donation_date": "2026-01-15", "donation_month": "2026-01",
                   "amount": 1234500, "method": "Transfer Bank", "notes": "TEST"}
        r = session.post(f"{BASE_URL}/api/donations", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["amount"] == 1234500
        assert "child_id" not in d
        TEST_STATE["donation_id"] = d["id"]

    def test_list_with_name(self, session, auth):
        r = session.get(f"{BASE_URL}/api/donations")
        assert r.status_code == 200
        arr = r.json()
        assert any(x.get("guardian_name") for x in arr)


# ---------- Developments ----------
class TestDevelopments:
    def test_create(self, session, auth):
        cid = TEST_STATE["child_id"]
        payload = {"child_id": cid, "academic_year": "2025/2026", "semester": "Semester 2",
                   "period_month": "2026-01", "category": "Akademik", "title": "TEST title",
                   "content": "TEST content"}
        r = session.post(f"{BASE_URL}/api/developments", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "TEST title"
        assert d["category"] == "Akademik"


# ---------- Reports ----------
class TestReports:
    def test_upsert_and_month_merge(self, session, auth):
        gid = TEST_STATE["guardian_id"]
        month = "2026-01"
        # Upsert
        r1 = session.post(f"{BASE_URL}/api/reports",
                          json={"guardian_id": gid, "month": month, "summary": "S1", "status": "Terlapor"})
        assert r1.status_code == 200
        assert r1.json()["summary"] == "S1"
        # Upsert again
        r2 = session.post(f"{BASE_URL}/api/reports",
                          json={"guardian_id": gid, "month": month, "summary": "S2", "status": "Terlapor"})
        assert r2.status_code == 200
        assert r2.json()["summary"] == "S2"
        assert r1.json()["id"] == r2.json()["id"]

        # GET ?month= merges guardians
        r3 = session.get(f"{BASE_URL}/api/reports", params={"month": month})
        assert r3.status_code == 200
        arr = r3.json()
        guardian_ids = {x["guardian_id"] for x in arr}
        # All guardians included
        gr = session.get(f"{BASE_URL}/api/guardians").json()
        assert guardian_ids >= {g["id"] for g in gr}
        statuses = {x["status"] for x in arr}
        assert "Terlapor" in statuses
        assert "Belum Terlapor" in statuses
        # Our upserted one is Terlapor
        ours = next(x for x in arr if x["guardian_id"] == gid)
        assert ours["status"] == "Terlapor"
        assert ours["summary"] == "S2"


# ---------- Public Portal ----------
class TestPortal:
    def test_public_portal_no_auth(self):
        token = TEST_STATE["portal_token"]
        r = requests.get(f"{BASE_URL}/api/portal/{token}")
        assert r.status_code == 200
        d = r.json()
        assert "guardian" in d and d["guardian"]["name"] == "TEST_OTA_A"
        assert "children" in d
        assert "donations" in d and isinstance(d["donations"], list)
        # Ensure no child attribution / no guardian_id leak in donations
        for don in d["donations"]:
            assert "child_id" not in don
            assert "child_name" not in don
            assert "guardian_id" not in don
            assert set(don.keys()).issubset({"donation_date", "donation_month", "amount", "notes"})
        assert "reports" in d
        assert "institution" in d

    def test_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/portal/nonexistent_token_zzz")
        assert r.status_code == 404


# ---------- Settings ----------
class TestSettings:
    def test_get_update(self, session, auth):
        r = session.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        original_name = r.json()["institution_name"]

        new_name = "TEST_Yayasan_" + uuid.uuid4().hex[:6]
        r2 = session.put(f"{BASE_URL}/api/settings",
                         json={"institution_name": new_name, "tagline": "T", "contact": "C", "address": "A"})
        assert r2.status_code == 200
        assert r2.json()["institution_name"] == new_name
        # Revert
        session.put(f"{BASE_URL}/api/settings",
                    json={"institution_name": original_name, "tagline": "", "contact": "", "address": ""})


# ---------- Users (multi-admin) ----------
class TestUsers:
    def test_list_users_includes_admin(self, session, auth):
        r = session.get(f"{BASE_URL}/api/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        assert any(u["email"] == ADMIN_EMAIL for u in users)
        # Response must not leak password_hash or _id
        for u in users:
            assert "password_hash" not in u
            assert "_id" not in u
            assert "id" in u and "email" in u

    def test_create_user_and_duplicate_email(self, session, auth):
        email = f"test_admin_{uuid.uuid4().hex[:6]}@example.com"
        payload = {"email": email, "password": "TempPass1!", "name": "TEST Admin"}
        r = session.post(f"{BASE_URL}/api/users", json=payload)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["email"] == email
        assert u["name"] == "TEST Admin"
        assert u["role"] == "admin"
        assert "password_hash" not in u
        TEST_STATE["new_user_id"] = u["id"]
        TEST_STATE["new_user_email"] = email
        TEST_STATE["new_user_pw"] = "TempPass1!"

        # Duplicate email should fail
        r_dup = session.post(f"{BASE_URL}/api/users", json=payload)
        assert r_dup.status_code == 400

    def test_create_user_short_password(self, session, auth):
        r = session.post(f"{BASE_URL}/api/users", json={
            "email": f"short_{uuid.uuid4().hex[:6]}@example.com",
            "password": "123", "name": "X"
        })
        assert r.status_code == 400

    def test_update_user_name_and_avatar(self, session, auth):
        uid = TEST_STATE["new_user_id"]
        r = session.put(f"{BASE_URL}/api/users/{uid}",
                        json={"name": "TEST Admin Updated", "avatar_url": "/api/files/x.png"})
        assert r.status_code == 200
        u = r.json()
        assert u["name"] == "TEST Admin Updated"
        assert u["avatar_url"] == "/api/files/x.png"
        assert "password_hash" not in u

    def test_reset_user_password_and_login(self, session, auth):
        uid = TEST_STATE["new_user_id"]
        email = TEST_STATE["new_user_email"]
        new_pw = "NewReset123!"
        r = session.post(f"{BASE_URL}/api/users/{uid}/reset-password", json={"new_password": new_pw})
        assert r.status_code == 200
        # short pw rejected
        r_short = session.post(f"{BASE_URL}/api/users/{uid}/reset-password", json={"new_password": "abc"})
        assert r_short.status_code == 400
        # Login with new pw
        login_sess = requests.Session()
        r_login = login_sess.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": new_pw})
        assert r_login.status_code == 200
        d = r_login.json()
        assert d["email"] == email
        assert "avatar_url" in d  # login response includes avatar_url
        TEST_STATE["new_user_pw"] = new_pw
        TEST_STATE["new_user_token"] = d["token"]

    def test_reset_password_unknown_user(self, session, auth):
        r = session.post(f"{BASE_URL}/api/users/{uuid.uuid4()}/reset-password",
                         json={"new_password": "abcdef"})
        assert r.status_code == 404

    def test_cannot_delete_own_account(self, session, auth):
        # Find the admin's id
        r = session.get(f"{BASE_URL}/api/auth/me")
        me_id = r.json()["id"]
        r_del = session.delete(f"{BASE_URL}/api/users/{me_id}")
        assert r_del.status_code == 400


# ---------- Change Password (uses temp user, does NOT touch primary admin) ----------
class TestChangePassword:
    def test_change_password_flow(self, session, auth):
        # Use the temp user created above; login as them
        email = TEST_STATE["new_user_email"]
        pw = TEST_STATE["new_user_pw"]
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        rlog = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
        assert rlog.status_code == 200
        s.headers.update({"Authorization": f"Bearer {rlog.json()['token']}"})

        # Wrong current pw
        r_wrong = s.post(f"{BASE_URL}/api/auth/change-password",
                         json={"current_password": "wrong-pw", "new_password": "AnotherPass1!"})
        assert r_wrong.status_code == 400

        # New pw too short
        r_short = s.post(f"{BASE_URL}/api/auth/change-password",
                        json={"current_password": pw, "new_password": "abc"})
        assert r_short.status_code == 400

        # Correct change
        new_pw = "ChangedPass9!"
        r_ok = s.post(f"{BASE_URL}/api/auth/change-password",
                     json={"current_password": pw, "new_password": new_pw})
        assert r_ok.status_code == 200

        # Old pw rejected
        r_old = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": email, "password": pw})
        assert r_old.status_code == 401

        # New pw works
        r_new = requests.post(f"{BASE_URL}/api/auth/login",
                             json={"email": email, "password": new_pw})
        assert r_new.status_code == 200
        assert "avatar_url" in r_new.json()
        TEST_STATE["new_user_pw"] = new_pw


# ---------- Settings logo_url ----------
class TestSettingsLogo:
    def test_settings_accepts_logo_url(self, session, auth):
        # Get current
        original = session.get(f"{BASE_URL}/api/settings").json()
        logo = "/api/files/portal-ota/photos/test-logo.png"
        payload = {
            "institution_name": original.get("institution_name", "Yayasan"),
            "tagline": original.get("tagline", ""),
            "contact": original.get("contact", ""),
            "address": original.get("address", ""),
            "logo_url": logo,
        }
        r = session.put(f"{BASE_URL}/api/settings", json=payload)
        assert r.status_code == 200
        assert r.json().get("logo_url") == logo

        # GET returns it
        g = session.get(f"{BASE_URL}/api/settings").json()
        assert g.get("logo_url") == logo
        TEST_STATE["original_settings"] = {
            "institution_name": original.get("institution_name", "Yayasan"),
            "tagline": original.get("tagline", ""),
            "contact": original.get("contact", ""),
            "address": original.get("address", ""),
            "logo_url": original.get("logo_url", ""),
        }

    def test_portal_includes_logo_url(self, session, auth):
        token = TEST_STATE.get("portal_token")
        assert token, "portal_token missing from state"
        r = requests.get(f"{BASE_URL}/api/portal/{token}")
        assert r.status_code == 200
        d = r.json()
        assert "institution" in d
        assert "logo_url" in d["institution"]
        # Non-empty since we just set it
        assert d["institution"]["logo_url"].endswith("test-logo.png")


# ---------- Login response includes avatar_url ----------
class TestLoginAvatar:
    def test_login_response_has_avatar_url(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "avatar_url" in d  # field must be present (may be empty string)
        assert isinstance(d["avatar_url"], str)


# ---------- Delete last admin protection ----------
class TestDeleteLastAdmin:
    def test_last_admin_protection(self, session, auth):
        """Ensure last-remaining-admin cannot be deleted.
        Approach: delete all non-primary users, then attempt to delete the primary
        as a different admin (impossible since only one is left) -> we validate the
        rule by inspecting behavior: with N users, deleting all others should still
        leave the primary undeletable via self-delete (400), and if only one user
        remains, deleting any user (which would be self) returns 400.
        """
        # Fetch all users
        users = session.get(f"{BASE_URL}/api/users").json()
        me = session.get(f"{BASE_URL}/api/auth/me").json()
        me_id = me["id"]
        # Delete every non-primary user
        for u in users:
            if u["id"] != me_id:
                session.delete(f"{BASE_URL}/api/users/{u['id']}")
        # Now try to delete self -> should get 400 (either own-account or last-admin)
        r = session.delete(f"{BASE_URL}/api/users/{me_id}")
        assert r.status_code == 400
        # Confirm still exactly 1 user
        users_after = session.get(f"{BASE_URL}/api/users").json()
        assert len(users_after) == 1
        assert users_after[0]["id"] == me_id


# ---------- Cleanup ----------
def test_zzz_cleanup(session, auth):
    # Restore settings
    original = TEST_STATE.get("original_settings")
    if original:
        session.put(f"{BASE_URL}/api/settings", json=original)
    for k in ("guardian_id", "guardian_id_b", "guardian_id_c"):
        gid = TEST_STATE.get(k)
        if gid:
            session.delete(f"{BASE_URL}/api/guardians/{gid}")
    cid = TEST_STATE.get("child_id")
    if cid:
        session.delete(f"{BASE_URL}/api/children/{cid}")
    # Delete temp user if still present
    uid = TEST_STATE.get("new_user_id")
    if uid:
        session.delete(f"{BASE_URL}/api/users/{uid}")
