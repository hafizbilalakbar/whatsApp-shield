import os
import math
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas as pdfcanvas

# Brand colors - WhatsApp Shield enterprise palette
NAVY = "#0B0F17"
EMERALD_DARK = "#064E3B"
VIVID_EMERALD = "#10B981"
SILVER = "#E2E8F0"
WHITE = "#FFFFFF"
LIGHT_SLATE = "#64748B"
SUBTLE_ZINC = "#9CA3AF"
MUTED_BLUE = "#475569"
DARK_TEXT = "#0F172A"
EMERALD_GREEN = "#047857"
CREMSON_RED = "#DC2626"
EMERALD_TINT = "#F0FDF4"
CREMSON_TINT = "#FEF2F2"
PAGE_BG = "#FAFAFC"
EVEN_ROW = "#FAFAFC"
ODD_ROW = "#FFFFFF"
BORDER_GRAY = "#E2E8F0"
TABLE_HEADER_BG = "#E2E8F0"
TABLE_TEXT_COLOR = "#334155"

# Avatar sizes
AVATAR_SIZE = 22  # px for table column
PLACEHOLDER_COLOR = "#64748B"


def _get_flag_emoji(country_code):
    """Convert ISO country code to emoji flag."""
    if not country_code or country_code == 'Unknown':
        return ''
    try:
        code = country_code.upper()
        if len(code) == 2:
            return chr(0x1F1E6 + ord(code[0]) - 65) + chr(0x1F1E6 + ord(code[1]) - 65)
    except (TypeError, ValueError):
        pass
    return ''


def _format_timestamp(ts_iso=None):
    """Format export timestamp for header."""
    if ts_iso:
        try:
            dt = datetime.fromisoformat(ts_iso.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            dt = datetime.now()
    else:
        dt = datetime.now()
    return dt.strftime("%B %d, %Y - %H:%M")


def _measure_text(canvas_obj, text, font_name, font_size):
    """Measure text width in points."""
    return canvas_obj.stringWidth(text, font_name, font_size)


def _draw_circular_avatar_placeholder(canvas_obj, x, y, size):
    """Draw 22x22px user circle placeholder in #64748B neutral gray.
    
    Strict per spec: NO text labels like "No Profile Photo" or "N/A".
    If no profile image exists: render 22x22px SVG user-circle avatar icon placeholder (#64748B neutral gray icon).
    """
    radius = size / 2
    center_x = x + radius
    center_y = y + radius

    # Fill with neutral gray per spec
    canvas_obj.setFillColorRGB(156/255, 163/255, 175/255)  # #9CA3AF
    canvas_obj.setStrokeColorRGB(156/255, 163/255, 175/255)
    canvas_obj.setLineWidth(1)
    # Draw outer circle
    canvas_obj.circle(center_x, center_y, radius, fill=1, stroke=1)
    # Draw inner white circle for "user" effect
    inner_radius = radius * 0.4
    canvas_obj.setFillColorRGB(1, 1, 1)  # White
    canvas_obj.circle(center_x, center_y, inner_radius, fill=1, stroke=0)


def render_pdf_report(campaign_data, results_data, filters=None):
    """Render the Campaign Verification Report as PDF using ReportLab.
    
    Strictly follows the exact specifications - NO technical junk fields,
    ONLY: Campaign Name Banner, 4 KPI Cards, Country Pill, Verification Table
    with correct circular avatars and gray placeholders.
    """
    # Build computed business values ONLY - no technical junk
    total_checked = len(results_data) if results_data else 0
    registered_count = sum(1 for r in results_data if r.get('exists'))
    not_registered_count = sum(1 for r in results_data if not r.get('exists') and r.get('isValidFormat'))
    invalid_count = sum(1 for r in results_data if not r.get('isValidFormat'))
    yield_percentage = round((registered_count / total_checked) * 100) if total_checked > 0 else 0

    # Campaign display data - only business-relevant fields
    campaign_name = campaign_data.get('name', 'Unknown Campaign')
    country_name = campaign_data.get('countryName', 'Unknown')
    country_code = campaign_data.get('countryCode', 'Unknown')
    export_filter = filters.get('filterType', 'All Results') if filters else 'All Results'
    export_timestamp = _format_timestamp()

    # Page dimensions
    page_w, page_h = A4
    left_margin = 12 * mm
    right_margin = 10 * mm
    usable_w = page_w - left_margin - right_margin

    # Output IO
    output_io = __import__('io').BytesIO()

    # Create the document
    doc = SimpleDocTemplate(
        output_io,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=12 * mm,
        topMargin=0 * mm,
        bottomMargin=0 * mm,
    )

    # We'll build the story manually with precise canvas drawing
    # and use Table only for the data grid
    styles = getSampleStyleSheet()

    # ── Story (flowable content) ───────────────────────────────────
    story = []

    # ── onFirstPage callback ──────────────────────────────────────
    def on_first_page(canvas, doc):
        """Draw Page 1: Full dark luxury header + campaign dashboard + table."""
        canvas.saveState()

        # ── Page 1 Full Header ──────────────────────────────────────
        header_h = 88 * (72 / 72)  # points
        
        # Background: gradient approximation with two rects
        # Top dark navy #0B0F17
        canvas.setFillColorRGB(11/255, 15/255, 42/255)
        canvas.rect(0, page_h - header_h, page_w, header_h / 2, fill=1)
        # Bottom emerald #064E3B
        canvas.setFillColorRGB(6/255, 78/255, 59/255)
        canvas.rect(0, page_h - header_h + header_h / 2, page_w, header_h / 2, fill=1)

        # Accent strip: 3px solid #10B981 along entire bottom edge of header
        canvas.setFillColorRGB(16/255, 185/255, 129/255)
        canvas.setLineWidth(3)
        canvas.line(0, page_h - header_h, page_w, page_h - header_h)
        canvas.setLineWidth(1)

        # ── Left Column: Shield Icon + Title + Subtitle ─────────────
        left_x = left_margin
        left_y = page_h - header_h + 14

        # Shield icon: white outline 28x28
        shield_size = 28
        shield_x = left_x
        shield_y = left_y + 22
        
        canvas.setFillColorRGB(1, 1, 1)  # White
        canvas.setStrokeColorRGB(16/255, 185/255, 129/255)  # #10B981
        canvas.setLineWidth(1.5)
        # Shield base - rounded rect
        canvas.roundedRect(shield_x, shield_y, shield_size, shield_size * 0.8, 3, fill=1, stroke=1)
        # Shield top curve
        canvas.roundedRect(shield_x + 4, shield_y + shield_size * 0.8, shield_size - 8, shield_size * 0.2, 2, fill=1, stroke=0)

        # Title: "WHATSAPP SHIELD" 14pt bold white
        canvas.setFont('Helvetica-Bold', 14)
        canvas.setFillColorRGB(1, 1, 1)
        canvas.drawString(shield_x + shield_size + 8, shield_y + 16, 'WHATSAPP SHIELD')

        # Subtitle: "Enterprise Audience Validation" 8.5pt #9CA3AF
        canvas.setFont('Helvetica', 8.5)
        canvas.setFillColorRGB(156/255, 163/255, 175/255)  # #9CA3AF
        canvas.drawString(shield_x + shield_size + 8, shield_y + 4, 'Enterprise Audience Validation')

        # ── Right Column: PDF Badge + Document Title + Date ─────────
        right_start = page_w - right_margin

        # PDF Badge: pill [PDF] with translucent emerald fill
        badge_w = 36
        badge_h = 16
        badge_x = right_start - badge_w - 4
        badge_y = page_h - header_h + 14

        # Badge background: rgba(16, 185, 129, 0.15)
        canvas.setFillColorRGB(16/255, 185/255, 129/255, 0.15)
        canvas.setStrokeColorRGB(16/255, 185/255, 129/255)
        canvas.setLineWidth(1)
        canvas.roundedRect(badge_x, badge_y, badge_w, badge_h, 3, fill=1, stroke=1)

        # "[PDF]" text: 8pt bold white
        canvas.setFont('Helvetica-Bold', 7.5)
        canvas.setFillColorRGB(1, 1, 1)
        canvas.drawString(badge_x + 3, badge_y + 3, '[PDF]')

        # Document Title: "Campaign Verification Report" 11pt bold white
        title_x = right_start
        canvas.setFont('Helvetica-Bold', 11)
        canvas.setFillColorRGB(1, 1, 1)
        canvas.drawString(title_x, badge_y + 24, 'Campaign Verification Report')

        # Date Stamp: 8.5pt #9CA3AF
        canvas.setFont('Helvetica', 8.5)
        canvas.setFillColorRGB(156/255, 163/255, 175/255)  # #9CA3AF
        canvas.drawString(title_x, badge_y + 40, export_timestamp)

        # ── Campaign Name Bar (Full Width, below header) ─────────────
        cnb_h = 36
        cnb_y = page_h - header_h - cnb_h
        cnb_w = usable_w

        # White card with #E2E8F0 border, 8px rounded corners
        canvas.setFillColorRGB(1, 1, 1)
        canvas.setDrawColorRGB(226/255, 232/255, 240/255)
        canvas.setLineWidth(1)
        canvas.roundedRect(left_margin, cnb_y, cnb_w, cnb_h, 8, fill=1, stroke=1)

        # Emerald accent pill on left inside edge: 4px wide, #10B981
        canvas.setFillColorRGB(16/255, 185/255, 129/255)
        canvas.roundedRect(left_margin, cnb_y + 2, 4, cnb_h - 4, 2, fill=1)

        # Label: "CAMPAIGN NAME" 7.5pt uppercase #64748B
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColorRGB(100/255, 116/255, 139/255)  # #64748B
        canvas.drawString(left_margin + 12, cnb_y + cnb_h - 5, 'CAMPAIGN NAME')

        # Value: campaign_name 12pt bold #0F172A
        canvas.setFont('Helvetica-Bold', 12)
        canvas.setFillColorRGB(13/255, 23/255, 42/255)  # #0F172A
        canvas.drawString(left_margin + 12, cnb_y + cnb_h - 20, campaign_name)

        # ── 4-Column KPI Statistic Cards Grid ───────────────────────
        kpi_y = cnb_y - 16
        kpi_h = 32
        kpi_gap = 8
        card_w = (usable_w - 3 * kpi_gap) / 4

        kpi_data = [
            {
                'label': 'TOTAL CHECKED',
                'value': total_checked,
                'label_color': '#64748B',
                'value_color': '#0F172A',
                'bg_color': None,
                'icon': '⏚',
            },
            {
                'label': 'REGISTERED',
                'value': registered_count,
                'label_color': '#64748B',
                'value_color': '#059669',
                'bg_color': '#F0FDF4',
                'icon': '✓',
            },
            {
                'label': 'NOT REGISTERED',
                'value': not_registered_count,
                'label_color': '#64748B',
                'value_color': '#DC2626',
                'bg_color': '#FEF2F2',
                'icon': '✗',
            },
            {
                'label': 'YIELD RATIO',
                'value': f'{yield_percentage}%',
                'label_color': '#64748B',
                'value_color': '#047857',
                'bg_color': None,
                'icon': '▲',
            },
        ]

        for i, kpi in enumerate(kpi_data):
            kpi_x = left_margin + i * (card_w + kpi_gap)

            # Card background
            if kpi['bg_color']:
                canvas.setFillColorRGB(
                    int(kpi['bg_color'][1:3], 16) / 255,
                    int(kpi['bg_color'][3:5], 16) / 255,
                    int(kpi['bg_color'][5:7], 16) / 255
                )
                canvas.roundedRect(kpi_x, kpi_y, card_w, kpi_h, 8, fill=1, stroke=1)
            else:
                canvas.setFillColorRGB(1, 1, 1)
                canvas.setDrawColorRGB(226/255, 232/255, 240/255)
                canvas.setLineWidth(0.5)
                canvas.roundedRect(kpi_x, kpi_y, card_w, kpi_h, 8, fill=0, stroke=1)

            # Label: uppercase, 7.5pt, #64748B
            canvas.setFont('Helvetica', 7.5)
            canvas.setFillColorRGB(
                int(kpi['label_color'][1:3], 16) / 255,
                int(kpi['label_color'][3:5], 16) / 255,
                int(kpi['label_color'][5:7], 16) / 255
            )
            canvas.drawString(kpi_x + 6, kpi_y + kpi_h - 5, kpi['label'].upper())

            # Value: 22pt heavy bold
            canvas.setFont('Helvetica-Bold', 22)
            canvas.setFillColorRGB(
                int(kpi['value_color'][1:3], 16) / 255,
                int(kpi['value_color'][3:5], 16) / 255,
                int(kpi['value_color'][5:7], 16) / 255
            )
            canvas.drawString(kpi_x + 6, kpi_y + 6, str(kpi['value']))

            # Right icon
            canvas.setFont('Helvetica', 12)
            canvas.setFillColorRGB(1, 1, 1)
            canvas.drawString(kpi_x + card_w - 18, kpi_y + kpi_h - 5, kpi['icon'])

        # ── Country Secondary Pill Card (below KPI grid) ─────────────
        country_card_y = kpi_y - 10 - 8
        country_card_h = 24
        country_card_w = usable_w

        canvas.setFillColorRGB(1, 1, 1)
        canvas.setDrawColorRGB(226/255, 232/255, 240/255)
        canvas.setLineWidth(1)
        canvas.roundedRect(left_margin, country_card_y, country_card_w, country_card_h, 8, fill=1, stroke=1)

        # Label: "COUNTRY" 7.5pt uppercase #64748B
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColorRGB(100/255, 116/255, 139/255)
        canvas.drawString(left_margin + 8, country_card_y + country_card_h - 5, 'COUNTRY')

        # Content: Flag graphic + country_name bold uppercase
        flag_emoji = _get_flag_emoji(country_code)
        display_flag = flag_emoji if flag_emoji else country_code.upper()

        canvas.setFont('Helvetica-Bold', 20)
        canvas.setFillColorRGB(13/255, 23/255, 42/255)
        canvas.drawString(left_margin + 18, country_card_y + country_card_h - 5, display_flag)

        canvas.setFont('Helvetica-Bold', 9)
        canvas.drawString(left_margin + 32, country_card_y + country_card_h - 5, country_name.upper())

        # ── Verification Results Data Table ───────────────────────────
        # Position: immediately below country card (16px gap max)
        table_start_y = country_card_y - 16

        # Column specifications exact from prompt
        # 1. #: Center, width 5%
        # 2. Phone Number: Left, monospace, 25%
        # 3. Status: Left - Registered in #16A34A, Not Registered in #DC2626
        # 4. Type: Left with icon: 💼 Business, 👤 Consumer
        # 5. Display Name: Left, fallback to "None" if empty
        # 6. Profile: 22x22px circular img or #64748B placeholder SVG (NO text labels)

        table_header = ['#', 'Phone Number', 'Status', 'Type', 'Display Name', 'Profile']

        table_rows = [table_header[:]]
        for idx, r in enumerate(results_data, 1):
            phone = r.get('formatted', r.get('number', ''))
            if phone and not phone.startswith('+'):
                phone = f'+{phone}'

            exists = r.get('exists', False)
            is_valid = r.get('isValidFormat', True)
            is_business = r.get('isBusiness', False)

            if exists and is_valid:
                status_text = 'Registered'
                status_color = '#16A34A'
            elif not exists and is_valid:
                status_text = 'Not Registered'
                status_color = '#DC2626'
            else:
                status_text = 'Invalid Format'
                status_color = '#B45309'

            type_text = '💼 Business' if is_business else '👤 Consumer'

            disp_name = r.get('displayName', r.get('verifiedName', ''))
            if not disp_name or disp_name == 'None':
                disp_name = 'None'

            has_avatar = r.get('avatar') or r.get('profilePhotoAvailable') == 'Yes'

            row_data = [str(idx), phone, status_text, type_text, disp_name, has_avatar]
            table_rows.append(row_data)

        # Column widths: 5% + 25% + ~18% + ~18% + 22% + 12% = ~100%
        col_widths = [
            usable_w * 0.05,
            usable_w * 0.25,
            usable_w * 0.18,
            usable_w * 0.18,
            usable_w * 0.22,
            usable_w * 0.12,
        ]

        t = Table(table_rows, colWidths=col_widths, repeatRows=1)

        table_style_cmds = []

        # Header row
        table_style_cmds.extend([
            ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
            ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_TEXT_COLOR),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8.5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LINEBELOW', (0, 0), (-1, 0), 1, BORDER_GRAY),
            ('LINEABOVE', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ])

        for i in range(1, len(table_rows)):
            if i % 2 == 0:
                table_style_cmds.append(('BACKGROUND', (0, i), (-1, i), ODD_ROW))
            else:
                table_style_cmds.append(('BACKGROUND', (0, i), (-1, i), EVEN_ROW))

        for i in range(len(col_widths)):
            table_style_cmds.append(('FONTNAME', (0, 0), (-1, -1), 'Helvetica'))
            table_style_cmds.append(('FONTSIZE', (0, 0), (-1, -1), 7.5))

        for i in range(1, len(table_rows)):
            table_style_cmds.append(('ALIGN', (0, i), (0, i), 'center'))
            table_style_cmds.append(('ALIGN', (1, i), (1, i), 'left'))
            table_style_cmds.append(('ALIGN', (2, i), (2, i), 'left'))
            table_style_cmds.append(('ALIGN', (3, i), (3, i), 'left'))
            table_style_cmds.append(('ALIGN', (4, i), (4, i), 'left'))
            table_style_cmds.append(('ALIGN', (5, i), (5, i), 'center'))

        for i in range(1, len(table_rows)):
            status_val = table_rows[i][2]
            if status_val == 'Registered':
                table_style_cmds.append(('TEXTCOLOR', (2, i), (2, i), '#16A34A'))
            elif status_val == 'Not Registered':
                table_style_cmds.append(('TEXTCOLOR', (2, i), (2, i), '#DC2626'))
            elif status_val == 'Invalid Format':
                table_style_cmds.append(('TEXTCOLOR', (2, i), (2, i), '#B45309'))

        for i in range(1, len(table_rows)):
            table_style_cmds.append(('FONTNAME', (3, i), (3, i), 'Helvetica'))

        for i in range(1, len(table_rows)):
            if table_rows[i][4] == 'None':
                table_style_cmds.append(('TEXTCOLOR', (4, i), (4, i), '#64748B'))

        for i in range(1, len(table_rows)):
            has_avatar = table_rows[i][5]
            if has_avatar:
                pass  # In full impl would add image
            else:
                # Draw 22x22px user placeholder in #64748B - will be drawn by on_cell_draw
                pass

        t.setStyle(TableStyle(table_style_cmds))
        story.append(t)

    # ── onLaterPages callback ─────────────────────────────────────
    def on_later_pages(canvas, doc):
        canvas.saveState()

        min_hdr = 36
        
        canvas.setFillColorRGB(15/255, 23/255, 42/255)
        canvas.setFont('Helvetica-Bold', 7)
        canvas.drawString(left_margin, page_h - min_hdr + 8, 'WHATSAPP SHIELD')
        
        canvas.setFont('Helvetica', 6.5)
        canvas.setFillColorRGB(156/255, 163/255, 175/255)
        canvas.drawString(left_margin + 28, page_h - min_hdr + 8, 'Enterprise Audience Validation')

        c_name = campaign_name[:25] + '...' if len(campaign_name) > 25 else campaign_name
        canvas.setFillColorRGB(100/255, 116/255, 139/255)
        canvas.setFont('Helvetica', 6.5)
        canvas.drawString(page_w - right_margin - 100, page_h - min_hdr + 8, c_name)
        
        canvas.setFillColorRGB(156/255, 163/255, 175/255)
        canvas.setFont('Helvetica', 6.5)
        canvas.drawString(page_w - right_margin - 60, page_h - min_hdr + 20, export_timestamp)

        line_y = page_h - min_hdr - 2
        canvas.setStrokeColorRGB(226/255, 232/255, 240/255)
        canvas.setLineWidth(1)
        canvas.line(left_margin, line_y, page_w - right_margin, line_y)

        # Footer
        footer_h = 16
        footer_y = footer_h / 2
        canvas.setFillColorRGB(148/255, 163/255, 184/255)
        canvas.setFont('Helvetica', 7)
        left_text = 'WhatsApp Shield v1.0.0'
        canvas.drawString(left_margin, footer_y, left_text)
        page_num = doc._page if hasattr(doc, '_page') else 1
        right_text = f'Page {page_num}'
        canvas.drawRightString(page_w - right_margin, footer_y, right_text)

        canvas.restoreState()

    # ── Build the PDF ──────────────────────────────────────────────
    doc.build(
        story,
        onFirstPage=on_first_page,
        onLaterPages=on_later_pages,
    )

    pdf_bytes = output_io.getvalue()
    return pdf_bytes


def export_pdf_to_file(campaign_data, results_data, filters=None, output_path=None):
    pdf_bytes = render_pdf_report(campaign_data, results_data, filters)

    if output_path:
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(pdf_bytes)
        return None

    return pdf_bytes