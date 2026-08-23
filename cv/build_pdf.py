"""Build the PDF CV.

Design constraints: single column, real selectable text, no tables, images, or
text boxes. Hierarchy comes from size, weight, colour, and spacing only - never
from layout a parser has to reconstruct, and never from letter-spacing faked with
spaces, which would corrupt the extracted text.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem, HRFlowable
from reportlab.lib import colors

NAVY  = colors.HexColor('#1F3D5C')
INK   = colors.HexColor('#1A1A1A')
MUTED = colors.HexColor('#4A5560')
RULE  = colors.HexColor('#C3CAD2')

def style(name, **kw):
    base = dict(fontName='Helvetica', fontSize=8.8, leading=11.0,
                alignment=TA_LEFT, textColor=INK, spaceAfter=2)
    base.update(kw)
    return ParagraphStyle(name, **base)

NAME    = style('name',    fontName='Helvetica-Bold', fontSize=19,  leading=21,   textColor=NAVY, spaceAfter=1)
ROLE    = style('role',    fontSize=10.2, leading=12.5, textColor=MUTED, spaceAfter=3)
CONTACT = style('contact', fontSize=8.4,  leading=10.6, textColor=MUTED, spaceAfter=0.5)
HEAD    = style('head',    fontName='Helvetica-Bold', fontSize=9.4, leading=11.5,
                textColor=NAVY, spaceBefore=8, spaceAfter=2.5)
SUMMARY = style('summary', alignment=TA_JUSTIFY, leading=11.4)
EMP     = style('emp',     fontName='Helvetica-Bold', fontSize=9.1, spaceBefore=5.5, spaceAfter=0.5)
POST    = style('post',    fontName='Helvetica-Oblique', fontSize=8.6, textColor=MUTED, spaceAfter=2.5)
BULLET  = style('bullet',  leading=10.9, spaceAfter=1.4)
DEGREE  = style('degree',  fontName='Helvetica-Bold', fontSize=9.0, spaceBefore=3, spaceAfter=0.5)

def section(text):
    return [Paragraph(text.upper(), HEAD),
            HRFlowable(width='100%', thickness=0.6, color=RULE,
                       spaceBefore=0, spaceAfter=4, lineCap='round')]

def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, BULLET), leftIndent=9, value='bulletchar') for t in items],
        bulletType='bullet', bulletChar='•', bulletFontSize=7.5,
        bulletColor=NAVY, leftIndent=9, bulletOffsetY=-0.6, spaceAfter=0,
    )

def job(employer, location, post, dates, items):
    return [Paragraph(f'{employer}, {location}', EMP),
            Paragraph(f'{post}&nbsp;&nbsp;|&nbsp;&nbsp;{dates}', POST),
            bullets(items)]

story = []

# ---- Header ----
story += [
    Paragraph('ADITYA KUMAR', NAME),
    Paragraph('Operations and Inventory Manager', ROLE),
    Paragraph('Chandigarh, India (Open to Relocate)&nbsp;&nbsp;|&nbsp;&nbsp;+91 77196 00906'
              '&nbsp;&nbsp;|&nbsp;&nbsp;adityakumar.sparda@gmail.com', CONTACT),
    Paragraph('linkedin.com/in/xadityak', CONTACT),
    HRFlowable(width='100%', thickness=1.1, color=NAVY, spaceBefore=5, spaceAfter=0),
]

story += section('Professional Summary')
story += [Paragraph(
    'Operations and Inventory Manager with over 4 years of experience in supply chain operations, '
    'inventory control, and domestic and international dispatch across healthcare, D2C e-commerce, and '
    'marketplace businesses. Consistently maintains 98% or better on-time dispatch SLA while managing '
    'logistics through Shiprocket and DHL. Experienced Zoho CRM administrator supporting customer '
    'lifecycle management, with proven strength in demand forecasting, warehouse reconciliation, MIS '
    'reporting, and leading inventory and dispatch teams.', SUMMARY)]

story += section('Core Skills')
for label, items in [
    ('Supply Chain and Logistics', 'Inventory Management, Demand Forecasting, Domestic Dispatch (Shiprocket), International Logistics (DHL), Customs Documentation, SLA and TAT Management, Quick Commerce Operations, D2C Operations, Warehouse Reconciliation, Reorder Point Planning, Cycle Counting'),
    ('Systems and CRM', 'Zoho CRM Administration, Zoconut, Shopify, Unicommerce, HubSpot, Oracle'),
    ('Data and Reporting', 'Power BI, MIS Dashboards, Advanced Microsoft Excel, Inventory Reconciliation, Reporting and Reconciliation'),
    ('Automation and Design', 'AI-Assisted Workflow Automation, SOP Development, Process Optimization, Figma Prototyping'),
    ('Leadership', 'Team Management, Task Allocation, Vendor Coordination, Escalation Management'),
]:
    story.append(Paragraph(f'<font color="#1F3D5C"><b>{label}</b></font>&nbsp;&nbsp;{items}', style('sk', spaceAfter=2.6)))

story += section('Professional Experience')
story += job('GLEUHR Wellness', 'Chandigarh, India',
             'Operations Manager, Inventory and Dispatch', 'May 2026 to Present', [
    'Manage the end-to-end physical and system inventory lifecycle across clinic and complementary product categories, covering stock availability, warehouse reconciliation, and cycle counts.',
    'Control reorder points for fast-moving SKUs, eliminating stockouts while holding reorder spend within budget.',
    'Direct domestic dispatch operations through Shiprocket and manage international freight, tracking, and customs documentation through DHL.',
    'Maintain a 24 to 48 hour dispatch SLA across web, sales, and B2B orders.',
    'Produce daily, weekly, and monthly MIS reporting covering inventory accuracy, RTO receipts, and cycle counts.',
    'Lead a 4-member inventory and dispatch team, optimizing task allocation and reducing expiry write-offs.',
])
story += job('Sova Health', 'Gurugram, India',
             'Team Lead, Operations and Unicommerce Dispatch System', 'January 2024 to April 2026', [
    "Scaled the brand's quick-commerce revenue from approximately INR 50 lakh to INR 4.3 crore in 8 months across Blinkit, Zepto, and Swiggy Instamart.",
    'Built an automation that cut order-processing turnaround from roughly 48 hours to around 10 minutes.',
    'Served as the dedicated Zoho Manager, customizing workflows in Zoho CRM and Zoconut to track patient lifecycles, automate client follow-ups, and resolve escalations, sustaining a CSAT score of 95% or higher.',
    'Managed a client portfolio of 1,600+ accounts alongside end-to-end dispatch of gut microbiome diagnostic kits across PAN India, maintaining an on-time SLA of 98% or better.',
    'Managed Shopify-based order processing and marketplace operations across Amazon and Flipkart, including inventory reconciliation and refunds.',
])
story += job('Policy Bazaar', 'Gurugram, India',
             'Relationship Manager, Client Relations', 'May 2021 to May 2022', [
    'Managed client onboarding and acted as the primary client contact for SLA governance and issue resolution.',
    'Produced HRMIS reporting across client accounts.',
])

story += section('Education')
story += [Paragraph('Master of Business Administration, Human Resources and Marketing', DEGREE),
          Paragraph('Chandigarh University&nbsp;&nbsp;|&nbsp;&nbsp;July 2022 to June 2024', style('u', textColor=MUTED)),
          Paragraph('Bachelor of Business Administration (Honours), Marketing and Banking', DEGREE),
          Paragraph('Lovely Professional University&nbsp;&nbsp;|&nbsp;&nbsp;July 2019 to May 2022', style('u2', textColor=MUTED))]

story += section('Publications')
story += [Paragraph('Adoption of Voice Command by Indian Retail Customers, February 2024', DEGREE),
          Paragraph('Primary research on voice recognition technology adoption among 200 young consumers in '
                    'Kharar, Punjab, analyzing consumer perception and voice commerce growth in India.', style('pub'))]

doc = SimpleDocTemplate('Aditya_Kumar_CV.pdf', pagesize=A4,
                        leftMargin=15*mm, rightMargin=15*mm,
                        topMargin=12*mm, bottomMargin=12*mm,
                        title='Aditya Kumar - Operations and Inventory Manager - CV',
                        author='Aditya Kumar', subject='Curriculum Vitae')
doc.build(story)
print('wrote Aditya_Kumar_CV.pdf')
