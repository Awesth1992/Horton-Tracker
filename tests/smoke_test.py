from pathlib import Path
import os
import json
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8080/"
OUT = Path(__file__).resolve().parents[1]
PASS = "Test-adgang-2026!"
drive_state = {"envelope": None, "revision": 0}

def fulfill_json(route, data):
    route.fulfill(status=200, content_type="application/json", body=json.dumps(data))

def mock_google_drive(route):
    request = route.request
    parsed = urlsplit(request.url)
    if parsed.path == "/drive/v3/files" and request.method == "GET":
        if drive_state["envelope"] is None:
            fulfill_json(route, {"files": []})
        else:
            fulfill_json(route, {"files": [{"id": "horton-vault", "name": "horton-tracker.vault.json", "modifiedTime": str(drive_state["revision"]), "md5Checksum": str(drive_state["revision"])}]})
    elif parsed.path == "/drive/v3/files/horton-vault" and request.method == "GET":
        route.fulfill(status=200, content_type="application/json", body=json.dumps(drive_state["envelope"]))
    elif parsed.path.startswith("/upload/drive/v3/files"):
        if request.method == "PATCH":
            drive_state["envelope"] = request.post_data_json
        else:
            boundary = request.headers["content-type"].split("boundary=", 1)[1]
            parts = request.post_data.split(f"--{boundary}")
            payloads = []
            for part in parts:
                if "\r\n\r\n" not in part:
                    continue
                content = part.split("\r\n\r\n", 1)[1].strip()
                try:
                    payloads.append(json.loads(content))
                except json.JSONDecodeError:
                    pass
            drive_state["envelope"] = payloads[-1]
        drive_state["revision"] += 1
        fulfill_json(route, {"id": "horton-vault", "name": "horton-tracker.vault.json", "modifiedTime": str(drive_state["revision"]), "md5Checksum": str(drive_state["revision"])})
    else:
        route.continue_()

with sync_playwright() as p:
    bundled = "/opt/pw-browsers/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell"
    browser_path = os.getenv("PLAYWRIGHT_CHROMIUM_EXECUTABLE") or (bundled if Path(bundled).exists() else None)
    browser = p.chromium.launch(headless=True, executable_path=browser_path)
    context = browser.new_context(locale="da-DK", accept_downloads=True)
    context.route("https://accounts.google.com/gsi/client", lambda route: route.fulfill(status=200, content_type="application/javascript", body="window.google={accounts:{oauth2:{initTokenClient:cfg=>({requestAccessToken:()=>cfg.callback({access_token:'test-token',expires_in:3600})})}}};"))
    context.route("https://www.googleapis.com/drive/v3/**", mock_google_drive)
    context.route("https://www.googleapis.com/upload/drive/v3/**", mock_google_drive)
    page = context.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(f"console {msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.get_by_role("heading", name="Dit mønster. På dine præmisser.").wait_for()
    assert "Kryptering er fra" in page.locator("#encryption-state").inner_text()

    page.get_by_role("button", name="Registrér nyt anfald").click()
    page.get_by_role("button", name="Gem registrering").click()
    page.get_by_text("Kontrollér registreringen").wait_for()

    page.locator("#attack-date").fill("2026-10-02")
    page.locator("#start-time").fill("21:15")
    page.locator("#end-time").fill("22:05")
    page.get_by_text("Højre side", exact=True).click()
    page.locator('input[name="intensity"][value="4"] + span').click()
    page.locator('input[name="symptoms"][value="Rindende eller rødt øje"] + span').click()
    page.locator('input[name="wokeFromSleep"][value="Nej"] + span').click()
    page.locator('input[name="triggers"][value="Ingen åbenlyse triggere"] + span').click()
    page.locator('input[name="treatments"][value="Tog ingen medicin"] + span').click()
    page.locator("#notes").fill("Smoke test – må ikke optræde i krypteret backup.")
    page.get_by_role("button", name="Gem registrering").click()
    page.locator("#dashboard-count").wait_for()
    assert page.locator("#dashboard-count").inner_text() == "1"
    assert page.locator("#metric-duration").inner_text() == "50 min"

    page.locator('.rail [data-view-target="backup"]').click()
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Hent backupfil").click()
    backup_path = download_info.value.path()
    raw = Path(backup_path).read_text(encoding="utf-8")
    assert '"format": "horton-tracker-vault-plain"' in raw
    assert "Smoke test" in raw

    page.locator('.rail [data-view-target="settings"]').click()
    page.get_by_role("button", name="Aktivér kryptering").click()
    page.locator("#secret-value").fill(PASS)
    page.locator("#secret-confirm").fill(PASS)
    page.get_by_role("button", name="Fortsæt").click()
    assert "adgangssætning kræves ved opstart" in page.locator("#encryption-state").inner_text()
    page.locator('.rail [data-view-target="backup"]').click()
    with page.expect_download() as encrypted_download_info:
        page.get_by_role("button", name="Hent backupfil").click()
    encrypted_raw = Path(encrypted_download_info.value.path()).read_text(encoding="utf-8")
    assert '"format": "horton-tracker-vault"' in encrypted_raw
    assert "Smoke test" not in encrypted_raw
    assert "Rindende eller rødt øje" not in encrypted_raw

    page.reload()
    page.locator("#unlock-passphrase").fill(PASS)
    page.get_by_role("button", name="Lås op").click()
    page.wait_for_function("document.querySelector('#dashboard-count').textContent === '1'")

    page.locator('.rail [data-view-target="backup"]').click()
    with page.expect_download() as encrypted_download_info:
        page.get_by_role("button", name="Hent backupfil").click()
    raw = Path(encrypted_download_info.value.path()).read_text(encoding="utf-8")
    assert '"format": "horton-tracker-vault"' in raw
    assert "Smoke test" not in raw
    assert "Rindende eller rødt øje" not in raw

    page.locator('.rail [data-view-target="backup"]').click()
    with page.expect_download() as csv_download:
        page.get_by_role("button", name="Eksportér CSV").click()
    csv_raw = Path(csv_download.value.path()).read_text(encoding="utf-8-sig")
    assert "Smoke test" in csv_raw and "2026-10-02" in csv_raw
    with page.expect_popup() as popup_info:
        page.get_by_role("button", name="Åbn klinikrapport").click()
    report = popup_info.value
    report.wait_for_load_state("domcontentloaded")
    assert "Klinikrapport" in report.title()
    assert report.get_by_text("Smoke test", exact=False).count() > 0
    report.close()

    page.get_by_role("button", name="Forbind Google-konto").click()
    page.get_by_role("heading", name="Backup og eksport").wait_for()
    page.locator("#google-drive-live-sync").check()
    page.wait_for_function("document.querySelector('#google-drive-meta').textContent.includes('Live sync · senest')")
    assert drive_state["envelope"]["format"] == "horton-tracker-vault"

    drive_state["envelope"] = {
        "format": "horton-tracker-vault-plain",
        "version": 1,
        "data": {
            "schemaVersion": 1,
            "createdAt": "2026-10-03T03:00:00.000Z",
            "updatedAt": "2026-10-03T03:10:00.000Z",
            "profile": {},
            "entries": [{"id": "from-second-device", "date": "2026-10-03", "startTime": "03:00", "endTime": "03:10", "durationMinutes": 10, "side": "Venstre side", "intensity": 2, "symptoms": [], "wokeFromSleep": "Nej", "sleepType": "", "triggers": [], "treatments": ["Tog ingen medicin"], "treatmentEffect": "Ikke relevant (tog ikke medicin)", "notes": "Second device", "createdAt": "2026-10-03T03:00:00.000Z", "updatedAt": "2026-10-03T03:10:00.000Z"}],
            "deletedEntries": []
        }
    }
    drive_state["revision"] += 1
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_function("document.querySelector('#dashboard-count').textContent === '2'")
    assert drive_state["envelope"]["format"] == "horton-tracker-vault"

    page.locator('[data-view-target="dashboard"]').first.click()
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    page.screenshot(path=str(OUT / "tests" / "verified-dashboard.png"), full_page=True)
    context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    page.locator("#unlock-passphrase").fill(PASS)
    page.get_by_role("button", name="Lås op").click()
    page.wait_for_function("document.querySelector('#dashboard-count').textContent === '1'")
    context.set_offline(False)

    assert not errors, "\n".join(errors)
    print("PASS: encrypted save, validation, reload, backup confidentiality, and offline shell verified")
    browser.close()
