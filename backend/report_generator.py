import os
import io
import matplotlib
matplotlib.use('Agg') # Thread-safe non-interactive backend
import matplotlib.pyplot as plt
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_cyclone_pdf(cyclone_name, metadata, track_points, damage_report, filepath):
    """
    Generate a highly styled, professional PDF report for a cyclone event.
    """
    doc = SimpleDocTemplate(
        filepath,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0F172A'), # slate-900
        spaceAfter=15
    )
    
    h2_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1E293B'), # slate-800
        spaceBefore=15,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569') # slate-600
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        fontName='Helvetica-Bold',
        textColor=colors.white
    )
    
    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#1E293B')
    )

    story = []
    
    # 1. Header block
    story.append(Paragraph(f"GeoCyclone India - Cyclone Assessment Report", title_style))
    story.append(Paragraph(f"Event Study: <b>{cyclone_name} ({metadata['year']})</b>", ParagraphStyle('Sub', parent=title_style, fontSize=14, leading=16, textColor=colors.HexColor('#4F46E5'))))
    story.append(Spacer(1, 15))
    
    # 2. Metadata Table
    summary_data = [
        [
            Paragraph("<b>Parameter</b>", table_header_style), 
            Paragraph("<b>Value</b>", table_header_style),
            Paragraph("<b>Parameter</b>", table_header_style), 
            Paragraph("<b>Value</b>", table_header_style)
        ],
        [
            Paragraph("Cyclone Category", table_body_style), Paragraph(str(metadata['peak_category']), table_body_style),
            Paragraph("Peak Wind Speed", table_body_style), Paragraph(f"{metadata['max_wind_speed']} knots", table_body_style)
        ],
        [
            Paragraph("Min Central Pressure", table_body_style), Paragraph(f"{metadata['min_pressure']} hPa", table_body_style),
            Paragraph("Landfall Location/State", table_body_style), Paragraph(str(metadata.get('landfall_state', 'N/A')), table_body_style)
        ],
        [
            Paragraph("Duration", table_body_style), Paragraph(f"{metadata['duration_hours']} hours", table_body_style),
            Paragraph("Basin", table_body_style), Paragraph(str(metadata['basin']), table_body_style)
        ]
    ]
    
    t_summary = Table(summary_data, colWidths=[130, 130, 130, 130])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F8FAFC')),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 20))
    
    # 3. Charts & Track Plots (using matplotlib)
    chart_img = generate_charts_image(track_points)
    if chart_img:
        story.append(Paragraph("Meteorological Trends (Pressure & Wind)", h2_style))
        story.append(Image(chart_img, width=500, height=220))
        story.append(Spacer(1, 15))
        
    # 4. Damage Summary Card
    story.append(Paragraph("Estimated Damage & Economic Loss Assessment", h2_style))
    sum_rep = damage_report["summary"]
    dmg_summary_data = [
        [
            Paragraph("<b>Total Economic Loss</b>", table_header_style),
            Paragraph("<b>Crop Damage</b>", table_header_style),
            Paragraph("<b>Infrastructure Loss</b>", table_header_style),
            Paragraph("<b>Exposed Assets</b>", table_header_style)
        ],
        [
            Paragraph(f"${sum_rep['total_economic_loss_usd_millions']}M USD", table_body_style),
            Paragraph(f"${sum_rep['crop_loss_usd_millions']}M USD", table_body_style),
            Paragraph(f"${sum_rep['infrastructure_loss_usd_millions']}M USD", table_body_style),
            Paragraph(f"{sum_rep['assets_exposed']} units ({sum_rep['assets_damaged']} damaged)", table_body_style)
        ]
    ]
    t_dmg = Table(dmg_summary_data, colWidths=[130, 130, 130, 130])
    t_dmg.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#B91C1C')), # Dark red theme
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#F87171')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#FEF2F2')),
    ]))
    story.append(t_dmg)
    story.append(Spacer(1, 20))
    
    # 5. District-wise Detailed Vulnerability Table
    story.append(Paragraph("District-wise Exposure Breakdown", h2_style))
    dist_data = [
        [
            Paragraph("<b>District</b>", table_header_style),
            Paragraph("<b>State</b>", table_header_style),
            Paragraph("<b>Risk Class</b>", table_header_style),
            Paragraph("<b>Houses Damaged</b>", table_header_style),
            Paragraph("<b>Crops Damaged (Ha)</b>", table_header_style),
            Paragraph("<b>Loss ($M USD)</b>", table_header_style)
        ]
    ]
    
    for row in damage_report["district_details"]:
        dist_data.append([
            Paragraph(row["district_name"], table_body_style),
            Paragraph(row["state"], table_body_style),
            Paragraph(f"<font color='{get_risk_color(row['risk_class'])}'><b>{row['risk_class']}</b></font>", table_body_style),
            Paragraph(f"{row['buildings_damaged']:,}", table_body_style),
            Paragraph(f"{row['crops_damaged_ha']:,}", table_body_style),
            Paragraph(f"${row['economic_loss_usd_millions']}M", table_body_style)
        ])
        
    t_dist = Table(dist_data, colWidths=[90, 80, 80, 90, 95, 85])
    t_dist.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (3,1), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    
    story.append(t_dist)
    
    # Build document
    doc.build(story)

def get_risk_color(risk_class):
    if risk_class == "Extreme":
        return "#DC2626" # red-600
    elif risk_class in ["Very High", "High"]:
        return "#EA580C" # orange-600
    elif risk_class == "Moderate":
        return "#D97706" # amber-600
    else:
        return "#16A34A" # green-600

def generate_charts_image(track_points):
    """
    Renders wind speed and central pressure curves and returns as a BytesIO stream.
    """
    if not track_points:
        return None
        
    # Extrapolate values
    winds = [t["wind_speed"] for t in track_points]
    pressures = [t["pressure"] for t in track_points]
    hours = [i*6 for i in range(len(track_points))]
    
    fig, ax1 = plt.subplots(figsize=(7, 3))
    
    # Primary axis - Wind Speed
    color = '#1E3A8A' # Dark blue
    ax1.set_xlabel('Hours from Formation')
    ax1.set_ylabel('Wind Speed (knots)', color=color)
    ax1.plot(hours, winds, color=color, linewidth=2.5, marker='o', label='Wind Speed')
    ax1.tick_params(axis='y', labelcolor=color)
    ax1.grid(True, linestyle='--', alpha=0.5)
    
    # Secondary axis - Pressure
    ax2 = ax1.twinx()
    color = '#DC2626' # Red
    ax2.set_ylabel('Central Pressure (hPa)', color=color)
    ax2.plot(hours, pressures, color=color, linewidth=2, linestyle='--', marker='x', label='Pressure')
    ax2.tick_params(axis='y', labelcolor=color)
    
    plt.title('Cyclone Intensity Profile over Time', fontsize=12, fontweight='bold', pad=10)
    fig.tight_layout()
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150)
    buf.seek(0)
    plt.close(fig)
    return buf
