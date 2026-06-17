from playwright.sync_api import sync_playwright
from pathlib import Path

SVG = Path("/Users/chris/Dropbox/git_reps_v4/cdb_desktop_recorder/assets/bik_cdb_logos_main_v_1_cdb_logo_6.svg").read_text()

def html(dark: bool):
    bg = "#1b1b26" if dark else "#ffffff"
    override = "<style>.k{fill:#e7e7ee !important;}</style>" if dark else ""
    return f"""
<!doctype html><html><head><meta charset=utf-8>
<style>
  html,body{{margin:0;padding:0;background:transparent;}}
  .canvas{{width:1024px;height:1024px;background:transparent;
    display:flex;align-items:center;justify-content:center;}}
  .plate{{width:824px;height:824px;background:{bg};border-radius:180px;
    position:relative;display:flex;align-items:flex-start;justify-content:center;
    overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.20);}}
  .logo{{width:520px;height:520px;margin-top:84px;}}
  .logo svg{{width:100%;height:100%;}}
  .badge{{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);
    background:#daa049;border-radius:36px;height:140px;min-width:360px;
    display:flex;align-items:center;justify-content:center;gap:22px;padding:0 46px;}}
  .badge .pdf{{font:800 88px -apple-system,'Helvetica Neue',Arial,sans-serif;
    color:#fff;letter-spacing:2px;line-height:1;}}
  .arrows{{display:flex;flex-direction:column;gap:9px;}}
  .arrows span{{display:block;width:0;height:0;border-left:25px solid transparent;
    border-right:25px solid transparent;}}
  .arrows .down{{border-top:29px solid #fff;}}
  .arrows .up{{border-bottom:29px solid #fff;}}
</style>{override}</head>
<body><div class=canvas><div class=plate>
  <div class=logo>{SVG}</div>
  <div class=badge>
    <div class=arrows><span class=down></span><span class=up></span></div>
    <div class=pdf>PDF</div>
  </div>
</div></div></body></html>"""

out = Path("/Users/chris/Dropbox/git_reps_v4/cdb_desktop_pdf_compressor/icon-src")
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    for dark, name in [(False,"icon-light.png"),(True,"icon-dark.png")]:
        pg = b.new_page(viewport={"width":1024,"height":1024}, device_scale_factor=1)
        pg.set_content(html(dark))
        # transparent screenshot of the full canvas
        pg.locator(".canvas").screenshot(path=str(out/name), omit_background=True)
        pg.close()
    b.close()
print("OK")
