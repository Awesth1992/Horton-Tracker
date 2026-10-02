from pathlib import Path
import os
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8080/"
OUT = Path(__file__).resolve().parents[1]
PASS = "Test-adgang-2026!"

with sync_playwright() as p:
    bundled = "/opt/pw-browsers/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell"
    browser_path = os.getenv("PLAYWRIGHT_CHROMIUM_EXECUTABLE") or (bundled if Path(bundled).exists() else None)
    browser = p.chromium.launch(headless=True, executable_path=browser_path)
    context = browser.new_context(locale="da-DK", accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(f"console {msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.locator("#unlock-passphrase").fill(PASS)
    page.locator("#unlock-confirm").fill(PASS)
    page.get_by_role("button", name="Lås op").click()
    page.get_by_role("heading", name="Dit mønster. På dine præmisser.").wait_for()

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
    assert '"format": "horton-tracker-vault"' in raw
    assert "Smoke test" not in raw
    assert "Rindende eller rødt øje" not in raw

    page.reload()
    page.locator("#unlock-passphrase").fill(PASS)
    page.get_by_role("button", name="Lås op").click()
    page.wait_for_function("document.querySelector('#dashboard-count').textContent === '1'")

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
