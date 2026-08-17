"""
WhatsApp Shield - Campaign Verification Report (ReportLab renderer)

Premium A4 portrait report generated entirely from live campaign data.

Architecture
------------
Two ReportLab page templates (no SimpleDocTemplate):
  * "First"  -> full dark charcoal->emerald header + hero section (campaign
                card, KPI cards, meta bar) drawn on canvas at fixed positions,
                plus a content Frame that starts BELOW the hero so the table
                never overlaps the header.
  * "Later"  -> compact 10mm continuation header + a Frame starting below it.

The verification-results table is a normal flowable Table (repeatRows=1) so
large datasets paginate automatically, repeat the header on every page and
split strictly between rows (never through a row). Status / Type / Profile
cells are vector Drawings (no emoji, no missing glyphs, no oversized images):
status badges, business/consumer icons and circular avatars with a safe
placeholder fallback. Profile images are square-cropped and circular-masked
with Pillow when available; otherwise a vector placeholder is drawn.

Everything is computed from the supplied data: campaign name, country,
stats (Total Checked / Registered / Not Registered / Yield), shield mode,
filter label and table rows. Nothing is hardcoded.
"""

import os
import io
import shutil
import tempfile
import base64
import urllib.request
from collections import Counter
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, NextPageTemplate,
    Paragraph, Table, TableStyle,
)
from reportlab.graphics.shapes import (
    Drawing, Rect, Circle, String, Line, Wedge, Group, Path, Image as GImage,
)


def rounded_rect_path(x, y, w, h, r):
    """Return a Path (reportlab.graphics) drawing a rounded rectangle."""
    r = min(r, w / 2, h / 2)
    k = 0.5523 * r
    p = Path()
    p.moveTo(x + r, y)
    p.lineTo(x + w - r, y)
    p.curveTo(x + w - r + k, y, x + w, y + r - k, x + w, y + r)
    p.lineTo(x + w, y + h - r)
    p.curveTo(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h)
    p.lineTo(x + r, y + h)
    p.curveTo(x + r - k, y + h, x, y + h - r + k, x, y + h - r)
    p.lineTo(x, y + r)
    p.curveTo(x, y + r - k, x + r - k, y, x + r, y)
    p.closePath()
    return p

try:
    from PIL import Image as PILImage, ImageDraw as PILDraw, ImageOps as PILOps
    _HAS_PIL = True
except Exception:  # pragma: no cover - Pillow is a soft dependency
    _HAS_PIL = False


# ---------------------------------------------------------------------------
# Brand palette
# ---------------------------------------------------------------------------
NAVY = colors.HexColor('#0B0F17')
EMERALD_DARK = colors.HexColor('#064E3B')
EMERALD = colors.HexColor('#10B981')
GREEN_600 = colors.HexColor('#059669')
GREEN_700 = colors.HexColor('#047857')
GREEN_800 = colors.HexColor('#15803D')
GREEN_TINT = colors.HexColor('#F0FDF4')
GREEN_TINT_BORDER = colors.HexColor('#DCFCE7')
RED_600 = colors.HexColor('#DC2626')
RED_700 = colors.HexColor('#B91C1C')
RED_TINT = colors.HexColor('#FEF2F2')
RED_TINT_BORDER = colors.HexColor('#FEE2E2')
AMBER_700 = colors.HexColor('#B45309')
AMBER_TINT = colors.HexColor('#FEF3C7')
AMBER_TINT_BORDER = colors.HexColor('#FDE68A')
SLATE_500 = colors.HexColor('#64748B')
SLATE_600 = colors.HexColor('#475569')
SLATE_400 = colors.HexColor('#94A3B8')
ZINC_400 = colors.HexColor('#9CA3AF')
DARK_TEXT = colors.HexColor('#0F172A')
BORDER = colors.HexColor('#E2E8F0')
HEADER_BG = colors.HexColor('#F1F5F9')
ZEBRA_EVEN = colors.HexColor('#FAFAFC')
ZEBRA_ODD = colors.white
PLACEHOLDER_BG = colors.HexColor('#F1F5F9')

WHITE = colors.white

# Country code -> display name (fallback only; live data carries names)
_COUNTRY_NAMES = {
    'AE': 'United Arab Emirates', 'SA': 'Saudi Arabia', 'IN': 'India',
    'US': 'United States', 'GB': 'United Kingdom', 'PH': 'Philippines',
    'NP': 'Nepal', 'BD': 'Bangladesh', 'PK': 'Pakistan', 'BR': 'Brazil',
    'ID': 'Indonesia', 'MY': 'Malaysia', 'SG': 'Singapore', 'EG': 'Egypt',
    'NG': 'Nigeria', 'KE': 'Kenya', 'ZA': 'South Africa', 'MX': 'Mexico',
    'RU': 'Russia', 'CN': 'China', 'JP': 'Japan', 'KR': 'South Korea',
    'AU': 'Australia', 'CA': 'Canada', 'Unknown': 'Unknown',
}

# ---------------------------------------------------------------------------
# Layout constants (mm, A4 portrait 210 x 297)
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4  # points
MARGIN_L = 12 * mm
MARGIN_R = 12 * mm
USABLE_W = PAGE_W - MARGIN_L - MARGIN_R  # 186mm
CONTENT_LEFT = MARGIN_L

HEADER_H = 26 * mm          # full page-1 header
CAMPAIGN_CARD_TOP = 31 * mm
CAMPAIGN_CARD_H = 14 * mm
KPI_TOP = CAMPAIGN_CARD_TOP + CAMPAIGN_CARD_H + 4 * mm
KPI_H = 17 * mm
META_TOP = KPI_TOP + KPI_H + 4 * mm
META_H = 12 * mm
HERO_BOTTOM = META_TOP + META_H
TABLE_TOP = HERO_BOTTOM + 6 * mm     # content starts below the hero
FOOTER_LINE = 14 * mm                 # from page bottom
FOOTER_TEXT = 8 * mm

COMPACT_HDR_H = 10 * mm
AVATAR_MM = 5.82                       # 22px @96dpi
ROW_H = 40                             # points - uniform data-row height

# Column widths (percent of usable width) -> points
_COL_PCT = [0.05, 0.25, 0.20, 0.18, 0.20, 0.12]
COL_W = [USABLE_W * p for p in _COL_PCT]


def _from_top(mm_from_top):
    """Convert a distance from the top of the page to canvas y (bottom origin)."""
    return PAGE_H - mm_from_top * mm


def _truncate(text, font, size, max_w):
    """Truncate to fit max_w using an ellipsis. Font-dependent."""
    text = str(text if text is not None else '')
    if stringWidth(text, font, size) <= max_w:
        return text
    ell = '...'
    while text and stringWidth(text + ell, font, size) > max_w:
        text = text[:-1]
    return text + ell


def _format_phone(r):
    phone = r.get('formatted') or r.get('number') or ''
    phone = str(phone).strip()
    if phone and not phone.startswith('+'):
        phone = '+' + phone
    return phone


def _status_of(r):
    if r.get('exists'):
        return 'Registered'
    if r.get('isValidFormat', True):
        return 'Not Registered'
    return 'Invalid Format'


def _format_export_timestamp(ts_iso=None):
    if ts_iso:
        try:
            dt = datetime.fromisoformat(str(ts_iso).replace('Z', '+00:00'))
        except (ValueError, TypeError):
            dt = datetime.now()
    else:
        dt = datetime.now()
    return dt.strftime('%B %d, %Y \u00b7 %H:%M')


def _resolve_country(campaign_data, results):
    ccode = campaign_data.get('countryCode')
    cname = campaign_data.get('countryName')

    code = None
    if ccode and len(str(ccode)) == 2 and str(ccode).isalpha():
        code = str(ccode).upper()
    else:
        counts = Counter(
            r.get('detectedCountry') for r in (results or [])
            if r.get('detectedCountry') and str(r.get('detectedCountry')) not in ('', 'Unknown', 'N/A')
        )
        if counts:
            code = counts.most_common(1)[0][0].upper()
        elif ccode:
            code = str(ccode).upper()

    code = code or 'Unknown'
    if not cname or str(cname) in ('', 'Unknown', 'N/A'):
        cname = _COUNTRY_NAMES.get(code, code)
    return code, str(cname)


def _campaign_display_name(campaign_data, country_name):
    named = campaign_data.get('name')
    if named:
        return str(named)
    date_str = ''
    ts = campaign_data.get('timestamp')
    if ts:
        try:
            d = datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
            date_str = ' - ' + d.strftime('%m/%d/%Y')
        except (ValueError, TypeError):
            pass
    return 'Audience Scan - {}{}'.format(country_name, date_str)


def _shield_mode(campaign_data):
    mode = campaign_data.get('shieldMode')
    if mode is None:
        mode = campaign_data.get('aiMode')
    if mode is None or mode is False:
        return 'Disabled'
    if isinstance(mode, str) and str(mode).lower() in ('off', 'disabled', 'none'):
        return 'Disabled'
    return 'Enabled'


# ---------------------------------------------------------------------------
# Vector drawing helpers (ReportLab graphics = safe, no emoji glyphs)
# ---------------------------------------------------------------------------
def status_drawing(status):
    """Pill badge with label; sized to text, vertically centered."""
    cfg = {
        'Registered': (GREEN_TINT, GREEN_TINT_BORDER, GREEN_800),
        'Not Registered': (RED_TINT, RED_TINT_BORDER, RED_700),
        'Invalid Format': (AMBER_TINT, AMBER_TINT_BORDER, AMBER_700),
    }
    bg, border, fg = cfg.get(status, (HEADER_BG, BORDER, SLATE_600))
    font = 'Helvetica-Bold'
    size = 7.5
    tw = stringWidth(status, font, size)
    pw = tw + 16
    ph = 14
    d = Drawing(COL_W[2], ROW_H)
    px = 6
    py = (ROW_H - ph) / 2
    badge = rounded_rect_path(px, py, pw, ph, 6)
    badge.fillColor = bg
    badge.strokeColor = border
    badge.strokeWidth = 0.4
    d.add(badge)
    d.add(String(px + pw / 2, py + ph / 2 - size * 0.35, status,
                 fontName=font, fontSize=size, fillColor=fg, textAnchor='middle'))
    return d


def type_drawing(label):
    """Vector icon (briefcase / person) + label."""
    d = Drawing(COL_W[3], ROW_H)
    ix = 6
    cy = ROW_H / 2
    if label == 'Business':
        bx = ix + 4.5
        by = cy - 4.6
        bw, bh = 9, 6.6
        d.add(Rect(bx, by, bw, bh, fillColor=SLATE_600, strokeColor=None))
        d.add(Rect(bx + 3.1, by + bh - 0.6, 2.8, 2.0, fillColor=SLATE_600, strokeColor=None))
    else:
        cx = ix + 4.5
        d.add(Circle(cx, cy + 3.2, 2.5, fillColor=SLATE_500, strokeColor=None))
        d.add(Wedge(cx, cy - 3.6, 7.2, 180, 360, fillColor=SLATE_500, strokeColor=None))
    tx = ix + 14
    tw = COL_W[3] - tx - 2
    font, size = 'Helvetica', 8.5
    txt = _truncate(label, font, size, tw)
    d.add(String(tx, cy - size * 0.35, txt, fontName=font, fontSize=size, fillColor=DARK_TEXT))
    return d


def _circle_avatar_bytes(raw):
    if not _HAS_PIL:
        return None
    img = PILImage.open(io.BytesIO(raw))
    img = PILOps.exif_transpose(img).convert('RGBA')
    w, h = img.size
    s = min(w, h)
    img = img.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    img = img.resize((64, 64))
    mask = PILImage.new('L', (64, 64), 0)
    PILDraw.Draw(mask).ellipse((0, 0, 63, 63), fill=255)
    img.putalpha(mask)
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    return buf.getvalue()


def avatar_drawing(raw, img_dir=None, idx=0):
    """Circular avatar (masked image) or safe vector placeholder. Fits cell."""
    d = Drawing(COL_W[5], ROW_H)
    cx = COL_W[5] / 2
    cy = ROW_H / 2
    r = AVATAR_MM * mm / 2
    if raw:
        try:
            png = _circle_avatar_bytes(raw)
            if png:
                if img_dir:
                    path = os.path.join(img_dir, 'avatar-{}.png'.format(idx))
                    with open(path, 'wb') as fh:
                        fh.write(png)
                    d.add(GImage(cx, cy, r * 2, r * 2, path,
                                 preserveAspectRatio=False, anchor='c'))
                else:
                    d.add(GImage(cx, cy, r * 2, r * 2, ImageReader(io.BytesIO(png)),
                                 preserveAspectRatio=False, anchor='c'))
        except Exception:
            pass
    else:
        d.add(Circle(cx, cy, r, fillColor=PLACEHOLDER_BG, strokeColor=None))
        d.add(Circle(cx, cy + r * 0.18, r * 0.26, fillColor=ZINC_400, strokeColor=None))
        d.add(Wedge(cx, cy + r * 0.02, r * 0.62, 180, 360, fillColor=ZINC_400, strokeColor=None))
    d.add(Circle(cx, cy, r, fillColor=None, strokeColor=BORDER, strokeWidth=0.4))
    return d


def _avatar_raw(r, cache):
    """Resolve avatar bytes for a record (URL / data-URI / file path)."""
    if not (r.get('exists') and (r.get('avatar') or r.get('profilePhotoAvailable'))):
        return None
    avatar = r.get('avatar')
    if not avatar:
        return None
    if isinstance(avatar, bytes):
        return avatar
    avatar = str(avatar)
    if avatar in cache:
        return cache[avatar]
    raw = None
    try:
        if avatar.startswith('data:'):
            b64 = avatar.split(',', 1)[1] if ',' in avatar else avatar
            raw = base64.b64decode(b64)
        elif os.path.isfile(avatar):
            with open(avatar, 'rb') as fh:
                raw = fh.read()
        elif avatar.startswith(('http://', 'https://')):
            req = urllib.request.Request(
                avatar, headers={'User-Agent': 'WhatsAppShield/1.0'}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read()
    except Exception:
        raw = None
    cache[avatar] = raw
    return raw


# ---------------------------------------------------------------------------
# Page 1 canvas drawing (header + hero)
# ---------------------------------------------------------------------------
def _draw_gradient(canvas):
    strips = 24
    top = PAGE_H
    for i in range(strips):
        t = i / (strips - 1) if strips > 1 else 0
        r = round(11 + (6 - 11) * t)
        g = round(15 + (78 - 15) * t)
        b = round(42 + (59 - 42) * t)
        canvas.setFillColorRGB(r / 255, g / 255, b / 255)
        canvas.rect(0, top - HEADER_H + (HEADER_H * i) / strips, PAGE_W,
                    HEADER_H / strips + 0.5, fill=1)
    canvas.setFillColorRGB(16 / 255, 185 / 255, 129 / 255)
    canvas.rect(0, top - HEADER_H - 0.7, PAGE_W, 0.7, fill=1)


def _draw_shield_logo(canvas, x, y, size):
    """Emerald rounded square + white check mark (x,y = top-left, size in pt)."""
    canvas.setFillColorRGB(16 / 255, 185 / 255, 129 / 255)
    canvas.roundRect(x, y - size, size, size, size * 0.26, stroke=0, fill=1)
    canvas.setStrokeColorRGB(1, 1, 1)
    canvas.setLineWidth(size * 0.11)
    canvas.setLineCap(1)  # round
    canvas.line(x + size * 0.22, y - size * 0.55,
                x + size * 0.42, y - size * 0.75)
    canvas.line(x + size * 0.42, y - size * 0.75,
                x + size * 0.80, y - size * 0.30)
    canvas.setLineCap(0)
    canvas.setLineWidth(0.2)


def _draw_page1_header(canvas, meta):
    _draw_gradient(canvas)

    # Left: logo + brand
    left_x = float(MARGIN_L)
    logo_top = _from_top((HEADER_H - 11 * mm) / 2)  # 11mm logo, centered
    _draw_shield_logo(canvas, left_x, logo_top, 11 * mm)
    tx = left_x + 11 * mm + 3 * mm

    canvas.setFont('Helvetica-Bold', 14)
    canvas.setFillColorRGB(1, 1, 1)
    canvas.drawString(tx, _from_top(9.8), 'WHATSAPP SHIELD')
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColorRGB(156 / 255, 163 / 255, 175 / 255)
    canvas.drawString(tx, _from_top(14.6), 'Enterprise Audience Validation')

    # Right: PDF badge + title + timestamp
    right_x = PAGE_W - float(MARGIN_R)
    badge_w = 13 * mm
    badge_h = 5.5 * mm
    badge_left = right_x - badge_w
    badge_top = _from_top(4 * mm)
    canvas.setFillColorRGB(16 / 255, 185 / 255, 129 / 255, 0.15)
    canvas.setStrokeColorRGB(16 / 255, 185 / 255, 129 / 255)
    canvas.setLineWidth(0.35)
    canvas.roundRect(badge_left, badge_top - badge_h, badge_w, badge_h,
                     1.4 * mm, stroke=1, fill=1)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColorRGB(1, 1, 1)
    canvas.drawCentredString(badge_left + badge_w / 2, badge_top - badge_h / 2 - 1.1, '[PDF]')

    canvas.setFont('Helvetica-Bold', 11)
    canvas.setFillColorRGB(1, 1, 1)
    canvas.drawRightString(right_x, _from_top(10.2), 'Campaign Verification Report')
    canvas.setFont('Helvetica', 8)
    canvas.setFillColorRGB(100 / 255, 116 / 255, 139 / 255)
    canvas.drawRightString(right_x, _from_top(15.4), 'Exported: ' + meta['exportTimestamp'])


def _draw_campaign_card(canvas, meta):
    bottom = _from_top(CAMPAIGN_CARD_TOP + CAMPAIGN_CARD_H)
    canvas.setFillColorRGB(1, 1, 1)
    canvas.setStrokeColorRGB(226 / 255, 232 / 255, 240 / 255)
    canvas.setLineWidth(0.2)
    canvas.roundRect(CONTENT_LEFT, bottom, USABLE_W, CAMPAIGN_CARD_H, 2 * mm, stroke=1, fill=1)

    canvas.setFillColorRGB(16 / 255, 185 / 255, 129 / 255)
    canvas.roundRect(CONTENT_LEFT + 2.5 * mm, bottom + 2.5 * mm,
                     1.0 * mm, CAMPAIGN_CARD_H - 5 * mm, 0.5 * mm, stroke=0, fill=1)

    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColorRGB(100 / 255, 116 / 255, 139 / 255)
    canvas.drawString(CONTENT_LEFT + 6 * mm, _from_top(CAMPAIGN_CARD_TOP + 3.4 * mm), 'CAMPAIGN NAME')

    canvas.setFont('Helvetica-Bold', 13)
    canvas.setFillColorRGB(15 / 255, 23 / 255, 42 / 255)
    name = _truncate(meta['campaignName'], 'Helvetica-Bold', 13, USABLE_W - 14 * mm)
    canvas.drawString(CONTENT_LEFT + 6 * mm, _from_top(CAMPAIGN_CARD_TOP + 10.5 * mm), name)


def _kpi_icon(canvas, kind, cx, cy, s):
    canvas.saveState()
    if kind == 'total':
        canvas.setFillColorRGB(148 / 255, 163 / 255, 184 / 255)
        for i in range(3):
            w = s * (0.9 - i * 0.18)
            canvas.rect(cx - w / 2, cy + (i - 1) * s * 0.34, w, s * 0.14, fill=1, stroke=0)
    elif kind == 'registered':
        canvas.setFillColorRGB(5 / 255, 150 / 255, 105 / 255)
        canvas.circle(cx, cy, s * 0.5, fill=1, stroke=0)
        canvas.setStrokeColorRGB(1, 1, 1)
        canvas.setLineWidth(s * 0.14)
        canvas.setLineCap(1)
        canvas.line(cx - s * 0.24, cy, cx - s * 0.06, cy + s * 0.2)
        canvas.line(cx - s * 0.06, cy + s * 0.2, cx + s * 0.28, cy - s * 0.22)
        canvas.setLineCap(0)
    elif kind == 'not_registered':
        canvas.setFillColorRGB(220 / 255, 38 / 255, 38 / 255)
        canvas.circle(cx, cy, s * 0.5, fill=1, stroke=0)
        canvas.setStrokeColorRGB(1, 1, 1)
        canvas.setLineWidth(s * 0.14)
        canvas.setLineCap(1)
        d = s * 0.24
        canvas.line(cx - d, cy - d, cx + d, cy + d)
        canvas.line(cx - d, cy + d, cx + d, cy - d)
        canvas.setLineCap(0)
    else:  # yield
        canvas.setFillColorRGB(16 / 255, 185 / 255, 129 / 255)
        base = cy - s * 0.42
        bw = s * 0.18
        gap = s * 0.1
        for i in range(3):
            hgt = s * (0.26 + i * 0.2)
            canvas.rect(cx - s * 0.52 + i * (bw + gap), base, bw, hgt, fill=1, stroke=0)
    canvas.restoreState()


def _draw_kpi_cards(canvas, meta):
    gap = 2.5 * mm
    card_w = (USABLE_W - 3 * gap) / 4
    cards = meta['kpis']
    bottom = _from_top(KPI_TOP + KPI_H)
    for i, k in enumerate(cards):
        x = CONTENT_LEFT + i * (card_w + gap)
        canvas.setFillColorRGB(*(c / 255 for c in k['bg']))
        canvas.setStrokeColorRGB(*(c / 255 for c in k['border']))
        canvas.setLineWidth(0.25)
        canvas.roundRect(x, bottom, card_w, KPI_H, 2 * mm, stroke=1, fill=1)

        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColorRGB(100 / 255, 116 / 255, 139 / 255)
        canvas.drawString(x + 5 * mm, _from_top(KPI_TOP + 5 * mm), k['label'])

        canvas.setFont('Helvetica-Bold', 20)
        canvas.setFillColorRGB(*(c / 255 for c in k['color']))
        canvas.drawString(x + 5 * mm, _from_top(KPI_TOP + KPI_H - 3.6 * mm), str(k['value']))

        _kpi_icon(canvas, k['icon'], x + card_w - 6.5 * mm, _from_top(KPI_TOP + 6 * mm), 5 * mm)


def _draw_meta_bar(canvas, meta):
    bottom = _from_top(META_TOP + META_H)
    canvas.setFillColorRGB(1, 1, 1)
    canvas.setStrokeColorRGB(226 / 255, 232 / 255, 240 / 255)
    canvas.setLineWidth(0.2)
    canvas.roundRect(CONTENT_LEFT, bottom, USABLE_W, META_H, 2 * mm, stroke=1, fill=1)

    cell_w = USABLE_W / 3
    canvas.setStrokeColorRGB(226 / 255, 232 / 255, 240 / 255)
    canvas.setLineWidth(0.15)
    for i in (1, 2):
        dx = CONTENT_LEFT + i * cell_w
        canvas.line(dx, bottom + 2 * mm, dx, bottom + META_H - 2 * mm)

    label_y = _from_top(META_TOP + 3.2 * mm)
    value_y = _from_top(META_TOP + 9.4 * mm)

    # 1) Country
    x = CONTENT_LEFT + 5 * mm
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColorRGB(100 / 255, 116 / 255, 139 / 255)
    canvas.drawString(x, label_y, 'COUNTRY')
    label_w = stringWidth('COUNTRY', 'Helvetica', 7.5)

    chip_x = x + label_w + 4 * mm
    chip_w = 9 * mm
    chip_h = 5 * mm
    chip_y = value_y - chip_h + 0.4 * mm
    canvas.setFillColorRGB(241 / 255, 245 / 255, 249 / 255)
    canvas.setStrokeColorRGB(226 / 255, 232 / 255, 240 / 255)
    canvas.setLineWidth(0.15)
    canvas.roundRect(chip_x, chip_y, chip_w, chip_h, 1.2 * mm, stroke=1, fill=1)
    canvas.setFont('Helvetica-Bold', 6.5)
    canvas.setFillColorRGB(71 / 255, 85 / 255, 105 / 255)
    canvas.drawCentredString(chip_x + chip_w / 2, chip_y + chip_h / 2 - 1.0, meta['countryCode'].upper())

    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColorRGB(15 / 255, 23 / 255, 42 / 255)
    name_w = cell_w - label_w - chip_w - 17 * mm
    canvas.drawString(chip_x + chip_w + 3 * mm, value_y,
                      _truncate(meta['countryName'], 'Helvetica-Bold', 9, name_w))

    # 2) Shield Mode
    x2 = CONTENT_LEFT + cell_w + 5 * mm
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColorRGB(100 / 255, 116 / 255, 139 / 255)
    canvas.drawString(x2, label_y, 'SHIELD MODE')
    label_w2 = stringWidth('SHIELD MODE', 'Helvetica', 7.5)

    mode = meta['shieldMode']
    is_on = mode == 'Enabled'
    badge_x = x2 + label_w2 + 4 * mm
    badge_w = 14 * mm
    badge_h = 5 * mm
    badge_y = value_y - badge_h + 0.4 * mm
    if is_on:
        bg_c = (240 / 255, 253 / 255, 244 / 255)
        bd_c = (220 / 255, 252 / 255, 231 / 255)
        fg_c = (21 / 255, 128 / 255, 61 / 255)
    else:
        bg_c = (241 / 255, 245 / 255, 249 / 255)
        bd_c = (226 / 255, 232 / 255, 240 / 255)
        fg_c = (71 / 255, 85 / 255, 105 / 255)
    canvas.setFillColorRGB(*bg_c)
    canvas.setStrokeColorRGB(*bd_c)
    canvas.setLineWidth(0.15)
    canvas.roundRect(badge_x, badge_y, badge_w, badge_h, 1.2 * mm, stroke=1, fill=1)
    canvas.setFont('Helvetica-Bold', 6.5)
    canvas.setFillColorRGB(*fg_c)
    canvas.drawCentredString(badge_x + badge_w / 2, badge_y + badge_h / 2 - 1.0, mode)

    # 3) Filter
    x3 = CONTENT_LEFT + 2 * cell_w + 5 * mm
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColorRGB(100 / 255, 116 / 255, 139 / 255)
    canvas.drawString(x3, label_y, 'FILTER')
    label_w3 = stringWidth('FILTER', 'Helvetica', 7.5)
    canvas.setFont('Helvetica-Bold', 8.5)
    canvas.setFillColorRGB(15 / 255, 23 / 255, 42 / 255)
    fw = cell_w - label_w3 - 12 * mm
    canvas.drawString(x3 + label_w3 + 4 * mm, value_y,
                      _truncate(meta['filterLabel'], 'Helvetica-Bold', 8.5, fw))


def _draw_compact_header(canvas, meta):
    top = PAGE_H
    canvas.setFillColorRGB(1, 1, 1)
    canvas.rect(0, top - COMPACT_HDR_H, PAGE_W, COMPACT_HDR_H, fill=1)
    canvas.setStrokeColorRGB(226 / 255, 232 / 255, 240 / 255)
    canvas.setLineWidth(0.15)
    canvas.line(0, top - COMPACT_HDR_H, PAGE_W, top - COMPACT_HDR_H)

    logo_top = _from_top((COMPACT_HDR_H - 5 * mm) / 2)
    _draw_shield_logo(canvas, CONTENT_LEFT, logo_top, 5 * mm)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColorRGB(15 / 255, 23 / 255, 42 / 255)
    canvas.drawString(CONTENT_LEFT + 7.5 * mm, _from_top(COMPACT_HDR_H / 2 - 1.2), 'WhatsApp Shield')

    right_text = '{}  \u00b7  Exported: {}'.format(meta['campaignName'], meta['exportTimestamp'])
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColorRGB(100 / 255, 116 / 255, 139 / 255)
    canvas.drawRightString(PAGE_W - float(MARGIN_R), _from_top(COMPACT_HDR_H / 2 - 1.0),
                           _truncate(right_text, 'Helvetica', 7.5, 132 * mm))


def _draw_footer(canvas, page_num):
    canvas.setStrokeColorRGB(226 / 255, 232 / 255, 240 / 255)
    canvas.setLineWidth(0.15)
    canvas.line(CONTENT_LEFT, FOOTER_LINE, PAGE_W - float(MARGIN_R), FOOTER_LINE)
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColorRGB(148 / 255, 163 / 255, 184 / 255)
    canvas.drawString(CONTENT_LEFT, FOOTER_TEXT, 'WhatsApp Shield v1.0.0')
    canvas.drawRightString(PAGE_W - float(MARGIN_R), FOOTER_TEXT, 'Page {}'.format(page_num))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def render_pdf_report(campaign_data, results_data, filters=None):
    """Render a Campaign Verification Report PDF and return raw bytes.

    campaign_data : dict (id, timestamp, phone, countryCode/countryName,
                     shieldMode/aiMode, name(optional))
    results_data  : list of per-number records (number, formatted, exists,
                     isValidFormat, isBusiness, displayName, verifiedName,
                     avatar, profilePhotoAvailable, detectedCountry)
    filters       : dict (filterType/filterLabel) or plain label string.
    """
    campaign_data = campaign_data or {}
    results = list(results_data or campaign_data.get('results') or [])

    total = len(results)
    registered = sum(1 for r in results if r.get('exists'))
    not_registered = sum(1 for r in results if not r.get('exists') and r.get('isValidFormat', True))
    invalid = total - registered - not_registered
    yield_pct = round((registered / total) * 100) if total > 0 else 0

    country_code, country_name = _resolve_country(campaign_data, results)

    if isinstance(filters, str):
        filter_label = filters or 'All Results'
    elif isinstance(filters, dict):
        filter_label = filters.get('filterLabel') or filters.get('filterType') or 'All Results'
    else:
        filter_label = 'All Results'

    meta = {
        'campaignName': _campaign_display_name(campaign_data, country_name),
        'countryCode': country_code,
        'countryName': country_name,
        'shieldMode': _shield_mode(campaign_data),
        'filterLabel': filter_label,
        'exportTimestamp': _format_export_timestamp(),
        'kpis': [
            {'label': 'TOTAL CHECKED', 'value': total,
             'color': (15, 23, 42), 'bg': (255, 255, 255), 'border': (226, 232, 240), 'icon': 'total'},
            {'label': 'REGISTERED', 'value': registered,
             'color': (5, 150, 105), 'bg': (240, 253, 244), 'border': (220, 252, 231), 'icon': 'registered'},
            {'label': 'NOT REGISTERED', 'value': not_registered,
             'color': (220, 38, 38), 'bg': (254, 242, 242), 'border': (254, 226, 226), 'icon': 'not_registered'},
            {'label': 'YIELD RATIO', 'value': '{}%'.format(yield_pct),
             'color': (4, 120, 87), 'bg': (255, 255, 255), 'border': (226, 232, 240), 'icon': 'yield'},
        ],
    }

    output_io = io.BytesIO()
    doc = BaseDocTemplate(
        output_io, pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R, topMargin=0, bottomMargin=0,
    )

    img_dir = tempfile.mkdtemp(prefix='wa-pdf-')
    first_frame = Frame(
        CONTENT_LEFT, FOOTER_LINE + 2 * mm, USABLE_W,
        PAGE_H - TABLE_TOP - FOOTER_LINE - 2 * mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    later_frame = Frame(
        CONTENT_LEFT, FOOTER_LINE + 2 * mm, USABLE_W,
        PAGE_H - (COMPACT_HDR_H + 4 * mm) - FOOTER_LINE - 2 * mm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )

    def on_first(canvas, canvas_doc):
        canvas.saveState()
        _draw_page1_header(canvas, meta)
        _draw_campaign_card(canvas, meta)
        _draw_kpi_cards(canvas, meta)
        _draw_meta_bar(canvas, meta)
        _draw_footer(canvas, 1)
        canvas.restoreState()

    def on_later(canvas, canvas_doc):
        canvas.saveState()
        _draw_compact_header(canvas, meta)
        _draw_footer(canvas, canvas.getPageNumber())
        canvas.restoreState()

    doc.addPageTemplates([
        PageTemplate(id='First', frames=[first_frame], onPage=on_first),
        PageTemplate(id='Later', frames=[later_frame], onPage=on_later),
    ])

    story = [NextPageTemplate('Later')]
    try:
        story.extend(_build_table(results, img_dir))
        doc.build(story)
    finally:
        shutil.rmtree(img_dir, ignore_errors=True)
    return output_io.getvalue()


def _build_table(results, img_dir=None):
    """Build the verification table flowable(s) - returns list of flowables."""
    header = ['#', 'Phone Number', 'Status', 'Type', 'Display Name', 'Profile']

    header_style = ParagraphStyle(
        'hdr', fontName='Helvetica-Bold', fontSize=8, leading=10,
        textColor=SLATE_600, alignment=TA_LEFT)
    header_style_c = ParagraphStyle('hdrC', parent=header_style, alignment=TA_CENTER)

    phone_style = ParagraphStyle(
        'ph', fontName='Courier', fontSize=8.5, leading=11,
        textColor=DARK_TEXT, alignment=TA_LEFT)
    name_style = ParagraphStyle(
        'nm', fontName='Helvetica', fontSize=8.5, leading=11,
        textColor=DARK_TEXT, alignment=TA_LEFT)
    name_style_off = ParagraphStyle('nmOff', parent=name_style, textColor=SLATE_500)

    head_cells = [
        Paragraph('#', header_style_c),
        Paragraph('Phone Number', header_style),
        Paragraph('Status', header_style),
        Paragraph('Type', header_style),
        Paragraph('Display Name', header_style),
        Paragraph('Profile', header_style_c),
    ]

    avatar_cache = {}
    rows = [head_cells]

    for idx, r in enumerate(results, 1):
        phone = _format_phone(r)
        phone_par = Paragraph(_truncate(phone, 'Courier', 8.5, COL_W[1] - 6), phone_style) if phone \
            else Paragraph('-', name_style_off)

        disp = r.get('displayName') or r.get('verifiedName') or ''
        disp = str(disp)
        if not disp or disp in ('None', 'none'):
            name_cell = Paragraph(_truncate('-', 'Helvetica', 8.5, COL_W[4] - 6), name_style_off)
        else:
            name_cell = Paragraph(_truncate(disp, 'Helvetica', 8.5, COL_W[4] - 6), name_style)

        raw = _avatar_raw(r, avatar_cache)

        rows.append([
            Paragraph(str(idx), ParagraphStyle('ix', fontName='Helvetica', fontSize=8,
                                               textColor=SLATE_400, alignment=TA_CENTER)),
            phone_par,
            status_drawing(_status_of(r)),
            type_drawing('Business' if r.get('isBusiness') else 'Consumer'),
            name_cell,
            avatar_drawing(raw, img_dir, idx),
        ])

    # Empty state
    if not results:
        empty = ParagraphStyle('empty', fontName='Helvetica', fontSize=9,
                               leading=13, textColor=SLATE_500, alignment=TA_CENTER)
        rows.append([Paragraph('No verification results in the current selection.',
                               empty)])

    table = Table(rows, colWidths=COL_W, repeatRows=1, splitByRow=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), SLATE_600),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
        ('LINEBELOW', (0, 0), (-1, 0), 1, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (5, 0), (5, -1), 'CENTER'),
        ('TOPPADDING', (0, 1), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 0),
        ('LEFTPADDING', (0, 1), (-1, -1), 2),
        ('RIGHTPADDING', (0, 1), (-1, -1), 2),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
    ]
    # Zebra rows + vertical alignment for drawing columns
    for i in range(1, len(rows)):
        if i == len(rows) - 1 and not results:
            style.append(('SPAN', (0, i), (-1, i)))
            style.append(('BACKGROUND', (0, i), (-1, i), ZEBRA_ODD))
            style.append(('TOPPADDING', (0, i), (-1, i), 10))
            style.append(('BOTTOMPADDING', (0, i), (-1, i), 10))
            continue
        style.append(('BACKGROUND', (0, i), (-1, i),
                      ZEBRA_ODD if i % 2 == 1 else ZEBRA_EVEN))
        style.append(('VALIGN', (2, i), (5, i), 'MIDDLE'))
        style.append(('VALIGN', (0, i), (1, i), 'MIDDLE'))

    table.setStyle(TableStyle(style))
    return [table]


def render_history_report(campaigns, account_label=None, filters=None):
    """Aggregate all campaigns into one report using the same template.

    campaigns : list of campaign dicts (each may carry its own `results`)
    """
    campaigns = list(campaigns or [])
    results = []
    for c in campaigns:
        results.extend(c.get('results') or [])
    if account_label is None:
        account_label = campaigns[0].get('phone', 'Account') if campaigns else 'Account'
    aggregate = {
        'name': 'Complete Account History - {}'.format(account_label),
        'countryCode': campaigns[0].get('countryCode') if campaigns else None,
        'shieldMode': 'Enabled' if any(c.get('shieldMode') or c.get('aiMode') for c in campaigns) else 'Disabled',
        'timestamp': campaigns[0].get('timestamp') if campaigns else None,
    }
    return render_pdf_report(aggregate, results, filters)


def export_pdf_to_file(campaign_data, results_data, filters=None, output_path=None):
    """Render and optionally persist to disk. Returns bytes when no path."""
    pdf_bytes = render_pdf_report(campaign_data, results_data, filters)
    if output_path:
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(pdf_bytes)
        return None
    return pdf_bytes


def export_history_to_file(campaigns, account_label=None, filters=None, output_path=None):
    """Render an aggregated account-history report and optionally persist."""
    pdf_bytes = render_history_report(campaigns, account_label, filters)
    if output_path:
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(pdf_bytes)
        return None
    return pdf_bytes
