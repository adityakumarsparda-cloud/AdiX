// Build the DOCX CV. Mirrors build_pdf.py: single column, no tables or text
// boxes, hierarchy from size/weight/colour only, so ATS parsers read it in order.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
  LevelFormat, convertInchesToTwip,
} = require('docx');

const FONT  = 'Calibri';
const NAVY  = '1F3D5C';
const INK   = '1A1A1A';
const MUTED = '4A5560';
const RULE  = 'C3CAD2';

const run = (text, o = {}) => new TextRun({
  text, font: FONT, size: o.size ?? 18, bold: o.bold, italics: o.italics,
  color: o.color ?? INK, characterSpacing: o.spacing,
});

const sectionHeading = (text) => new Paragraph({
  spacing: { before: 170, after: 55 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: RULE, space: 2 } },
  children: [run(text.toUpperCase(), { size: 19, bold: true, color: NAVY, spacing: 14 })],
});

const employer = (name, location) => new Paragraph({
  spacing: { before: 110, after: 10 },
  children: [run(`${name}, ${location}`, { size: 18, bold: true })],
});

const post = (title, dates) => new Paragraph({
  spacing: { after: 50 },
  children: [run(`${title}  |  ${dates}`, { size: 17, italics: true, color: MUTED })],
});

const bullet = (text) => new Paragraph({
  numbering: { reference: 'cv-bullets', level: 0 },
  spacing: { after: 28, line: 226 },
  children: [run(text, { size: 18 })],
});

const skill = (label, items) => new Paragraph({
  spacing: { after: 52, line: 226 },
  children: [run(`${label}  `, { size: 18, bold: true, color: NAVY }), run(items, { size: 18 })],
});

const line = (text, o = {}) => new Paragraph({
  spacing: { before: o.before ?? 0, after: o.after ?? 40, line: 226 },
  children: [run(text, o)],
});

const job = (name, location, title, dates, items) =>
  [employer(name, location), post(title, dates), ...items.map(bullet)];

const doc = new Document({
  creator: 'Aditya Kumar',
  title: 'Aditya Kumar - Operations and Inventory Manager - CV',
  description: 'Curriculum Vitae',
  numbering: {
    config: [{
      reference: 'cv-bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: {
          paragraph: { indent: { left: convertInchesToTwip(0.2), hanging: convertInchesToTwip(0.14) } },
          run: { font: FONT, size: 16, color: NAVY },
        },
      }],
    }],
  },
  sections: [{
    properties: { page: { margin: { top: 620, right: 700, bottom: 620, left: 700 } } },
    children: [
      // ---- Header ----
      line('ADITYA KUMAR', { size: 38, bold: true, color: NAVY, after: 10 }),
      line('Operations and Inventory Manager', { size: 20, color: MUTED, after: 30 }),
      line('Chandigarh, India (Open to Relocate)  |  +91 77196 00906  |  adityakumar.sparda@gmail.com',
           { size: 17, color: MUTED, after: 10 }),
      new Paragraph({
        spacing: { after: 20 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: NAVY, space: 4 } },
        children: [run('linkedin.com/in/xadityak', { size: 17, color: MUTED })],
      }),

      // ---- Summary ----
      sectionHeading('Professional Summary'),
      line(
        'Operations and Inventory Manager with over 4 years of experience in supply chain operations, ' +
        'inventory control, and domestic and international dispatch across healthcare, D2C e-commerce, and ' +
        'marketplace businesses. Consistently maintains 98% or better on-time dispatch SLA while managing ' +
        'logistics through Shiprocket and DHL. Experienced Zoho CRM administrator supporting customer ' +
        'lifecycle management, with proven strength in demand forecasting, warehouse reconciliation, MIS ' +
        'reporting, and leading inventory and dispatch teams.'
      ),

      // ---- Skills ----
      sectionHeading('Core Skills'),
      skill('Supply Chain and Logistics',
        'Inventory Management, Demand Forecasting, Domestic Dispatch (Shiprocket), International Logistics (DHL), ' +
        'Customs Documentation, SLA and TAT Management, Quick Commerce Operations, D2C Operations, ' +
        'Warehouse Reconciliation, Reorder Point Planning, Cycle Counting'),
      skill('Systems and CRM', 'Zoho CRM Administration, Zoconut, Shopify, Unicommerce, HubSpot, Oracle'),
      skill('Data and Reporting',
        'Power BI, MIS Dashboards, Advanced Microsoft Excel, Inventory Reconciliation, Reporting and Reconciliation'),
      skill('Automation and Design',
        'AI-Assisted Workflow Automation, SOP Development, Process Optimization, Figma Prototyping'),
      skill('Leadership', 'Team Management, Task Allocation, Vendor Coordination, Escalation Management'),

      // ---- Experience ----
      sectionHeading('Professional Experience'),
      ...job('GLEUHR Wellness', 'Chandigarh, India',
             'Operations Manager, Inventory and Dispatch', 'May 2026 to Present', [
        'Manage the end-to-end physical and system inventory lifecycle across clinic and complementary product categories, covering stock availability, warehouse reconciliation, and cycle counts.',
        'Control reorder points for fast-moving SKUs, eliminating stockouts while holding reorder spend within budget.',
        'Direct domestic dispatch operations through Shiprocket and manage international freight, tracking, and customs documentation through DHL.',
        'Maintain a 24 to 48 hour dispatch SLA across web, sales, and B2B orders.',
        'Produce daily, weekly, and monthly MIS reporting covering inventory accuracy, RTO receipts, and cycle counts.',
        'Lead a 4-member inventory and dispatch team, optimizing task allocation and reducing expiry write-offs.',
      ]),
      ...job('Sova Health', 'Gurugram, India',
             'Team Lead, Operations and Unicommerce Dispatch System', 'January 2024 to April 2026', [
        "Scaled the brand's quick-commerce revenue from approximately INR 50 lakh to INR 4.3 crore in 8 months across Blinkit, Zepto, and Swiggy Instamart.",
        'Built an automation that cut order-processing turnaround from roughly 48 hours to around 10 minutes.',
        'Served as the dedicated Zoho Manager, customizing workflows in Zoho CRM and Zoconut to track patient lifecycles, automate client follow-ups, and resolve escalations, sustaining a CSAT score of 95% or higher.',
        'Managed a client portfolio of 1,600+ accounts alongside end-to-end dispatch of gut microbiome diagnostic kits across PAN India, maintaining an on-time SLA of 98% or better.',
        'Managed Shopify-based order processing and marketplace operations across Amazon and Flipkart, including inventory reconciliation and refunds.',
      ]),
      ...job('Policy Bazaar', 'Gurugram, India',
             'Relationship Manager, Client Relations', 'May 2021 to May 2022', [
        'Managed client onboarding and acted as the primary client contact for SLA governance and issue resolution.',
        'Produced HRMIS reporting across client accounts.',
      ]),

      // ---- Education ----
      sectionHeading('Education'),
      line('Master of Business Administration, Human Resources and Marketing', { bold: true, after: 10, before: 40 }),
      line('Chandigarh University  |  July 2022 to June 2024', { size: 17, color: MUTED }),
      line('Bachelor of Business Administration (Honours), Marketing and Banking', { bold: true, after: 10, before: 60 }),
      line('Lovely Professional University  |  July 2019 to May 2022', { size: 17, color: MUTED }),

      // ---- Publications ----
      sectionHeading('Publications'),
      line('Adoption of Voice Command by Indian Retail Customers, February 2024', { bold: true, after: 10, before: 40 }),
      line('Primary research on voice recognition technology adoption among 200 young consumers in Kharar, ' +
           'Punjab, analyzing consumer perception and voice commerce growth in India.'),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('Aditya_Kumar_CV.docx', buf);
  console.log('wrote Aditya_Kumar_CV.docx', buf.length, 'bytes');
});
