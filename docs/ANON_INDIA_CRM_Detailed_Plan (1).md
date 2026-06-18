# ANON INDIA — Real Estate CRM System
## Complete Detailed Plan — All Modules

**Company:** ANON INDIA  
**Document type:** Full system specification  
**Scope:** 18 modules, all phases  

---

## Table of Contents

1. [Lead Management System](#1-lead-management-system)
2. [WhatsApp API Integration](#2-whatsapp-api-integration)
3. [Sales Team Management](#3-sales-team-management)
4. [Property & Inventory Management](#4-property--inventory-management)
5. [Client Management](#5-client-management)
6. [Booking & Payment Management](#6-booking--payment-management)
7. [Channel Partner / Broker Portal](#7-channel-partner--broker-portal)
8. [Post-Sale Customer Portal](#8-post-sale-customer-portal)
9. [Construction Progress Tracking](#9-construction-progress-tracking)
10. [Website Requirements](#10-website-requirements)
11. [Digital Marketing Integration](#11-digital-marketing-integration)
12. [HR & Hiring Management](#12-hr--hiring-management)
13. [Reports & Analytics](#13-reports--analytics)
14. [Automation Engine](#14-automation-engine)
15. [Legal & Compliance (RERA)](#15-legal--compliance-rera)
16. [Loan & Home Finance CRM](#16-loan--home-finance-crm)
17. [Mobile App](#17-mobile-app)
18. [Security, Infrastructure & Backup](#18-security-infrastructure--backup)
19. [Technology Stack & Architecture](#19-technology-stack--architecture)
20. [Development Timeline & Costing](#20-development-timeline--costing)

---

## 1. Lead Management System

### Overview
Central hub for all incoming leads from every source. Every lead that enters the business — whether from Facebook, walk-ins, WhatsApp, or referrals — must land here with full context, be assigned immediately, and be tracked through every stage until closure or disqualification.

---

### 1.1 Lead Capture & Sources

| Source | Method | Auto-fields captured |
|---|---|---|
| Facebook Ads | Facebook Lead API webhook | Name, phone, ad name, campaign, ad set |
| Instagram Ads | Meta Lead API webhook | Name, phone, creative ID |
| Google Ads | Google Ads webhook + UTM | Name, phone, keyword, campaign |
| Website Forms | REST API form submission | Name, phone, city, project interest |
| WhatsApp | WhatsApp API inbound | Phone, message, timestamp |
| Manual Entry | CRM form by team member | All fields manually entered |
| Walk-in / Site Visit | Visitor register kiosk/tablet | Name, phone, visit date, source |
| Referral | Referral link tracking | Name, phone, referred-by client ID |
| IVR / Missed Call | Telephony webhook | Phone, call time, IVR option selected |
| Portal (99acres, MagicBricks) | Email parser / API | Name, phone, project interest |

---

### 1.2 Lead Profile — Complete Fields

**Basic Information**
- Full Name
- Primary Mobile Number
- Alternate Mobile Number
- Email Address
- City / Location
- Locality / Area of Interest

**Interest Details**
- Interested Project (dropdown — from inventory)
- Property Type (plot / villa / apartment / commercial)
- Budget Range (min–max)
- Configuration (2BHK / 3BHK / plot size)
- Purpose (investment / self-use / rental)
- Timeline to Buy (immediate / 3 months / 6 months / 1 year+)

**Lead Metadata**
- Lead Source (auto-populated)
- Campaign Name (auto from UTM)
- Ad Set Name
- Keyword (for Google)
- Landing Page URL
- Device Type (mobile / desktop)
- UTM Source / Medium / Campaign / Term / Content
- Lead Creation Date & Time
- Lead ID (auto-generated)

**Assignment & Status**
- Assigned To (sales advisor)
- Team / Branch
- Current Stage
- Lead Temperature (Hot / Warm / Cold — auto-calculated)
- Lead Score (0–100 — AI-calculated)
- SLA Status (On-time / Overdue / Breached)

**Follow-up Fields**
- Next Follow-up Date & Time
- Last Contacted Date
- Last Activity
- Number of Attempts
- Preferred Contact Time
- Preferred Contact Method (call / WhatsApp / email)

**Notes & History**
- Call notes (timestamped)
- WhatsApp chat link
- Email thread
- Documents attached

---

### 1.3 Lead Stages & Pipeline

```
New Lead → Contacted → Interested → Site Visit Scheduled → Site Visit Done
→ Negotiation → Booking Done → Closed (Won)
                             → Not Interested (Lost)
                             → Future Follow-up (Nurture)
```

**Stage definitions:**

| Stage | Definition | Max allowed time | Action triggered |
|---|---|---|---|
| New Lead | Just entered the system | 2 hours | Auto-assign + WhatsApp greeting |
| Contacted | First call/message made | 24 hours from creation | Log call outcome |
| Interested | Lead confirmed interest | 48 hours | Schedule site visit |
| Site Visit Scheduled | Visit date confirmed | — | Send confirmation WhatsApp + reminder |
| Site Visit Done | Visit completed | 24 hours post-visit | Send thank-you + follow-up |
| Negotiation | Price/terms discussion ongoing | — | Manager notification |
| Closed Won | Booking done | — | Create client record |
| Not Interested | Confirmed not buying | — | Tag reason + archive |
| Future Follow-up | Interest but not now | — | Add to drip nurture sequence |

---

### 1.4 Lead Scoring (AI-based, 0–100)

Score is auto-calculated and updates in real time based on:

| Signal | Weight |
|---|---|
| Budget matches available inventory | +20 |
| Responded to first contact within 1 hour | +15 |
| Came from high-quality source (referral / walk-in) | +15 |
| Has visited site | +20 |
| Replied to WhatsApp | +10 |
| Opened email | +5 |
| Viewed project brochure/link | +5 |
| Multiple follow-up attempts with no response | -10 |
| Very large budget mismatch | -15 |
| Source is low-quality (unverified portal) | -5 |

**Score bands:**
- 80–100 → Hot 🔴 (call within 30 minutes)
- 50–79 → Warm 🟡 (call within 4 hours)
- 0–49 → Cold 🔵 (nurture sequence)

---

### 1.5 Auto Lead Assignment Rules

Admin configures round-robin or rule-based assignment:

- **Round Robin:** Distribute equally across available advisors
- **Rule-based:**
  - By city/location → assign to branch
  - By project interest → assign to project specialist
  - By budget range → assign to senior/junior advisor
  - By source → Facebook leads → Team A; walk-ins → Team B
- **Load balancing:** Cap maximum open leads per advisor (configurable, e.g. max 50)
- **Availability check:** Only assign to advisors who are marked present/active
- **Fallback:** If no advisor available, assign to team manager

---

### 1.6 Duplicate Detection

- Check by mobile number (exact match)
- Check by name + city (fuzzy match, 80%+ similarity)
- Check by email
- On duplicate found:
  - Show alert to the person entering
  - Show original lead owner and current stage
  - Options: Merge / Assign to same advisor / Create separate record with link
- Auto-merge incoming API leads that match existing mobile number

---

### 1.7 Follow-up Management

- **Reminders:** Push notification + SMS to advisor at scheduled time
- **Overdue alerts:** If follow-up time passed with no action → alert advisor + manager
- **SLA breach:** If lead stays in "New Lead" for 2+ hours with no contact → alert manager
- **Follow-up outcomes to log after each attempt:**
  - Connected — interested
  - Connected — not interested now
  - Not reachable — will retry
  - Number invalid
  - Asked to call back (set new time)
  - Left voicemail
- **Auto-reschedule:** If "not reachable" selected, system suggests next attempt time

---

### 1.8 Call History & Notes

- Every call logged with: date, time, duration, outcome, notes
- Advisor adds notes in a rich text field after each interaction
- Notes are timestamped and show which advisor added them
- Manager can add manager notes (visible to all) or private manager notes
- WhatsApp chat automatically appended to lead timeline
- Email thread linked from lead record
- Documents (brochures sent, cost sheets shared) attached to lead record

---

### 1.9 Lead Views & Filters

**Default views:**
- My Leads (assigned to logged-in advisor)
- All Leads (manager/admin)
- Hot Leads (score 80+)
- Overdue Follow-ups
- Today's Follow-ups
- New Today / This Week
- Stage-wise Kanban Board

**Filter options:**
- Date range
- Source
- Project
- Stage
- Advisor
- Score range
- City
- Budget range
- Lead temperature

**Bulk actions:**
- Reassign selected leads
- Export to Excel
- Add to WhatsApp broadcast list
- Mark as duplicate
- Delete (admin only)

---

## 2. WhatsApp API Integration

### Overview
Full two-way WhatsApp communication built into the CRM. All chats visible in one inbox. Team members reply from within the CRM — no personal phones needed for business communication.

---

### 2.1 WhatsApp API Provider

**Recommended provider:** Interakt / Wati / AiSensy (all built on Meta Business API)

**Setup requirements:**
- Verified Meta Business Account
- Dedicated business phone number (not personal)
- WABA (WhatsApp Business Account) approval
- Message template pre-approval from Meta

**Cost structure:**
- Platform fee: ₹2,499–₹7,999/month depending on provider and team size
- Per conversation: ₹0.45–₹0.80 per user-initiated conversation (24-hour window)
- Business-initiated conversations (templates): ₹0.75–₹1.20 per conversation
- Free tier: First 1,000 conversations/month free (Meta policy)

---

### 2.2 Shared Team Inbox

- One WhatsApp number for the business
- All incoming messages appear in shared CRM inbox
- Conversations assigned to specific advisors (like a support ticket)
- Unassigned conversations visible to all managers
- Team members see only their assigned conversations (configurable)
- Real-time new message notifications
- Read receipts visible
- Online/typing indicator

**Conversation statuses:**
- New (unread, unassigned)
- Assigned (to an advisor)
- In Progress
- Waiting for client reply
- Resolved / Closed

---

### 2.3 Auto-Reply System

**Triggers and responses:**

| Trigger | Auto-reply |
|---|---|
| Any new inbound message (outside office hours) | "Thank you for reaching out to ANON INDIA. Our team will contact you shortly. Office hours: 9AM–7PM." |
| Keyword: "price" / "rate" / "cost" | Send project brochure + cost sheet template |
| Keyword: "location" / "where" | Send Google Maps link + project address |
| Keyword: "visit" / "site visit" | "We'd love to show you! Please share your preferred date." |
| First-time message from unknown number | Greeting + quick reply buttons (See Projects / Talk to Advisor / Schedule Visit) |
| After site visit (automated, 2 hours post-visit) | Thank-you message + feedback link |

---

### 2.4 Message Templates (Pre-approved)

All templates must be approved by Meta before use. Build and manage templates inside the CRM.

**Lead nurturing templates:**

1. **Welcome template** — sent immediately when lead enters system
   > "Hi [Name] 👋 Thank you for your interest in [Project Name] by ANON INDIA. Our advisor [Advisor Name] will call you shortly. Meanwhile, view the project: [Link]"

2. **Site visit confirmation**
   > "Hi [Name], your site visit to [Project Name] is confirmed for [Date] at [Time]. Address: [Location]. See you there! — Team ANON INDIA"

3. **Site visit reminder** (sent night before)
   > "Reminder: Your visit to [Project Name] is tomorrow at [Time]. Call us if you need to reschedule: [Phone]"

4. **Follow-up after no contact**
   > "Hi [Name], we tried reaching you regarding [Project Name]. Please let us know the best time to call. Tap below to reply."

5. **Price escalation alert**
   > "Important: Current pre-launch pricing for [Project Name] ends on [Date]. Lock in your unit at the best price. Call [Advisor]: [Phone]"

6. **Payment reminder**
   > "Hi [Name], a payment of ₹[Amount] for [Plot Number] is due on [Date]. Pay here: [Link]. Contact us for any queries."

7. **Birthday wish**
   > "Happy Birthday [Name]! 🎂 Wishing you joy and prosperity. — Team ANON INDIA"

8. **Festival greeting**
   > "Wishing you and your family a Happy [Festival]! 🎉 — Team ANON INDIA"

---

### 2.5 Broadcast & Campaigns

- Create audience lists (by project interest, stage, city, budget)
- Send broadcast to list using approved template
- Schedule broadcasts for a future date/time
- Broadcast analytics: sent / delivered / read / replied
- Opt-out tracking: mark contacts who reply STOP
- Cannot broadcast to opted-out contacts (TRAI compliance)
- Campaign ROI: track which broadcast led to site visits or bookings

---

### 2.6 Lead Capture via WhatsApp

- Any unknown number messaging the business number → auto-create lead record in CRM
- Fields captured: phone number, first message, timestamp
- Advisor can then fill in remaining fields from the chat
- Click-to-WhatsApp ad leads → tracked with campaign source

---

### 2.7 WhatsApp Chatbot

For qualification before human handoff:

```
Bot: Hi! Welcome to ANON INDIA. How can I help?
  1. View Projects
  2. Schedule Site Visit
  3. Talk to Advisor
  4. Check Payment Status

User selects: 1 → View Projects
Bot: Which city are you looking in?
  1. Jaipur  2. Delhi NCR  3. Other

User selects: 1 → Jaipur
Bot: Great! What is your budget?
  1. Under ₹20L  2. ₹20L–₹40L  3. ₹40L–₹60L  4. Above ₹60L

Bot: Thank you! Here are our projects in Jaipur within your budget: [Project List]
Bot: Would you like to schedule a site visit? [Yes / No]

If Yes → capture preferred date → create site visit in CRM → assign advisor
```

- Bot → Human handoff: when user selects "Talk to Advisor" or after 3 bot turns
- All bot conversation stored in lead timeline
- Bot active 24/7; human advisors active during office hours only

---

### 2.8 Access Control

- Admin: full access to all conversations, templates, broadcasts
- Manager: access to team's conversations, can broadcast, can create templates
- Sales Advisor: access to own assigned conversations only
- Telecaller: read-only access to conversations, can send pre-defined quick replies only

---

## 3. Sales Team Management

### Overview
Full visibility into team performance, activity, and productivity. Every call, follow-up, visit, and closure tracked. Daily scorecards auto-generated for each member.

---

### 3.1 Roles & Permission Matrix

| Feature | Admin | Manager | Sales Advisor | Telecaller |
|---|---|---|---|---|
| View all leads | ✅ | ✅ | Own only | Own only |
| Reassign leads | ✅ | Team only | ❌ | ❌ |
| Delete leads | ✅ | ❌ | ❌ | ❌ |
| View team reports | ✅ | Team only | Own only | Own only |
| Add inventory | ✅ | ✅ | ❌ | ❌ |
| Approve bookings | ✅ | ✅ | ❌ | ❌ |
| Send broadcasts | ✅ | ✅ | ❌ | ❌ |
| Create templates | ✅ | ✅ | ❌ | ❌ |
| Export data | ✅ | ✅ | ❌ | ❌ |
| View client payments | ✅ | ✅ | Assigned only | ❌ |
| Access HR module | ✅ | ❌ | ❌ | ❌ |

---

### 3.2 Team Member Profile

Each team member's profile contains:
- Personal info (name, photo, phone, email, DOB, joining date)
- Role & designation
- Branch / team assignment
- Login credentials
- Monthly target (₹ revenue / number of bookings / number of site visits)
- Current month performance vs target
- Historical performance (month-wise)
- Lead assignment history
- Attendance log
- Leave records
- Documents (Aadhar, PAN, offer letter, agreements)

---

### 3.3 Performance Tracking — Daily KPIs

For each advisor, tracked daily:

| Metric | Description |
|---|---|
| Calls made | Total outbound calls logged in CRM |
| Connected calls | Calls where someone picked up |
| Connection rate | Connected / Total calls × 100 |
| Follow-ups completed | Scheduled follow-ups marked done |
| New leads contacted | New leads called within 2 hours |
| Site visits scheduled | New site visits booked |
| Site visits completed | Actual visits done |
| Proposals/cost sheets sent | Documents shared with leads |
| Bookings done | Closed deals |
| Revenue generated | Total booking value closed |
| WhatsApp messages sent | Template + chat messages |

---

### 3.4 Target vs Achievement Dashboard

- Monthly targets set by admin per advisor and per team
- Live progress bar: target vs current achievement
- Breakdown by: site visits / bookings / revenue
- Alerts when advisor is <50% of target at mid-month
- Incentive slab tracker:
  - e.g. 0–2 bookings: base salary only
  - 3–5 bookings: base + 1% commission
  - 6+ bookings: base + 1.5% commission + bonus
- Commission auto-calculated based on bookings logged

---

### 3.5 Attendance & Activity Tracking

**Attendance:**
- Mobile app check-in (GPS-verified) at start of day
- Check-out at end of day
- Late arrival / early departure flagged
- Leave application → manager approval workflow
- Leave types: casual / sick / earned / unpaid
- Monthly attendance summary auto-generated

**Activity tracking:**
- Last active in CRM (timestamp)
- Calls made today
- Follow-ups pending today
- Messages sent today
- CRM idle time alert (if advisor hasn't logged any activity in 2+ hours during office hours)

---

### 3.6 Team Communication

- Internal announcements from admin/manager (broadcast within CRM)
- Team chat (group messaging within CRM — not WhatsApp)
- Manager can pin announcements on team dashboard
- New project launch notifications pushed to all team members
- Achievement shoutouts (admin posts: "Congratulations [Name] on closing [Project]!")

---

### 3.7 Daily Performance Report (Auto-generated)

Sent to each advisor at 7PM:
- Your calls today: X
- Follow-ups completed: X / X scheduled
- Leads pending contact: X
- Site visits this week: X
- Your target this month: ₹ X — current: ₹ X (X%)
- Tomorrow's follow-up list (top 5 by score)

Sent to managers at 7:30PM:
- Team summary: calls / follow-ups / visits / bookings
- Bottom 3 performers (needs attention)
- Leads with SLA breaches
- Hot leads not contacted in 24 hours

---

## 4. Property & Inventory Management

### Overview
Complete digital inventory of all projects, plots, units, and their real-time availability. Any advisor can check plot status live. Booking instantly marks a plot as sold/held.

---

### 4.1 Project Setup

Each project record contains:

**Basic Details**
- Project name
- Project type (plotted development / villa / apartment / commercial)
- City & locality
- Full address + Google Maps pin
- RERA number
- Project status (pre-launch / launched / under construction / ready to move / sold out)
- Launch date
- Expected completion date
- Project description (for website)

**Project Team**
- Project manager (internal)
- Sales team assigned to this project
- Legal team contact
- Contractor/builder name

**Media**
- Master layout image (plot map)
- Project images (gallery)
- Brochure PDF
- Price list PDF
- Location map
- Amenities list
- Video walkthrough / drone footage link
- 360° virtual tour link

---

### 4.2 Plot / Unit Inventory

Each plot/unit record:

| Field | Description |
|---|---|
| Plot Number | Unique identifier (e.g., A-101) |
| Plot Size | In sq yards / sq ft |
| Plot Type | Corner / Regular / Facing park / Facing road |
| Facing Direction | North / South / East / West |
| Floor (for apartments) | Floor number |
| Configuration | 2BHK / 3BHK / Studio / Plot (for apartments) |
| Base Price | Per sq yard / total |
| Premium | Corner premium / facing premium / floor rise |
| Total Price | Auto-calculated |
| Current Status | Available / Soft Hold / Booked / Registered / Sold |
| Hold By | Advisor name (if on soft hold) |
| Hold Expiry | Date/time after which hold auto-releases |
| Booked By | Client name + ID |
| Booking Date | Date of booking |
| Documents | Upload title deed, layout approval, NOC |

---

### 4.3 Visual Plot Map

- Upload project layout image
- Overlay clickable plot polygons on the image
- Color coding:
  - Green → Available
  - Yellow → Soft Hold
  - Red → Booked / Sold
  - Grey → Not for sale / Road / Common area
- Click any plot → opens plot detail sidebar
- Advisor can soft-hold a plot from this view
- Admin can release holds from this view
- Embed this map on the website (public view: available/sold only, no client details)

---

### 4.4 Soft Hold / Inventory Lock

- Advisor can place a soft hold on a plot for a negotiating client
- Hold duration: configurable by admin (default: 48 hours)
- On hold: plot turns yellow on map, unavailable to other advisors
- Hold expiry: auto-releases, plot turns green again, advisor notified
- Manager can manually release a hold
- Only one hold per plot at a time
- Advisor can hold max 3 plots simultaneously (configurable)
- Log of all holds: who held, when, how long, outcome (booked or released)

---

### 4.5 Price Management

- Base price set per plot (or per sq yard)
- Premium matrix:
  - Corner plots: +X%
  - Park-facing: +X%
  - Main road facing: +X%
  - East-facing: +X%
- Price escalation scheduling:
  - Set escalation date and % increase
  - System auto-updates price on that date
  - Notify all advisors on escalation day
  - Send WhatsApp alert to leads who haven't booked yet (urgency trigger)
- Cost sheet generator:
  - Select plot → auto-generate detailed cost sheet PDF
  - Includes: plot price + premiums + development charges + registration charges + GST + total payable
  - Branded with ANON INDIA letterhead
  - Share directly via WhatsApp or email from CRM

---

### 4.6 Document Management (Inventory)

Per project, store and manage:
- Layout approval (from local authority)
- NOC documents
- RERA registration certificate
- Land title documents
- Environmental clearance
- Bank approvals (for home loan)
- Demand letter templates
- Agreement to sale template
- Sale deed template

Access control: Legal documents visible to admin + legal team only. Brochures/price lists visible to all advisors.

---

## 5. Client Management

### Overview
Once a lead converts to a booking, they become a client. Full client lifecycle managed here — from booking to possession. This is the post-sales CRM.

---

### 5.1 Client Profile

**Personal Details**
- Full name
- Date of birth
- PAN number (encrypted)
- Aadhar number (encrypted)
- Mobile (primary + alternate)
- Email
- Permanent address
- Communication address
- Photograph

**Co-applicant Details** (if applicable)
- Same fields as above
- Relationship to primary applicant

**Nominee Details**
- Name, relationship, DOB, contact

**Professional Details**
- Occupation type (salaried / self-employed / business)
- Company name / business name
- Monthly income
- Annual income

**KYC Status**
- Aadhar submitted: yes/no
- PAN submitted: yes/no
- Photo submitted: yes/no
- Address proof: yes/no
- KYC verification status: pending / verified / rejected

---

### 5.2 Booking Record

Linked to each client:
- Booking ID (auto-generated)
- Project name
- Plot number
- Plot size
- Total sale value
- Booking amount paid
- Payment plan selected
- Booking date
- Agreement date
- Expected possession date
- Assigned advisor
- Referred by (broker / client / campaign)
- Commission details

---

### 5.3 Payment Tracking

**Payment schedule:**
- Multiple payment plan types:
  - Down payment plan (50% now, 50% on possession)
  - Construction-linked plan (payments linked to construction milestones)
  - Subvention scheme (bank pays builder, client pays bank EMI later)
  - Custom installment plan
- Each installment record:
  - Due date
  - Amount due
  - Amount received
  - Payment date
  - Payment mode (NEFT / cheque / UPI / demand draft)
  - Transaction ID / cheque number
  - Receipt generated: yes/no
  - Status: pending / paid / overdue / waived

**Auto-alerts:**
- 7 days before due date: WhatsApp reminder to client
- 3 days before: SMS reminder
- On due date: WhatsApp + SMS + email
- If overdue: daily reminder + manager alert
- After payment received: auto-generate receipt + send to client

**Late payment charges:**
- Configure % per day after due date
- Auto-calculate and add to next demand

---

### 5.4 Document Management (Client)

Documents to collect and store per client:
- KYC documents (Aadhar, PAN, photo, address proof)
- Booking form (signed)
- Allotment letter
- Agreement to sale (registered)
- Sale deed
- NOC for loan
- Possession letter
- Handover checklist (signed)

Each document:
- Upload by team or client (via client portal)
- Status: pending / uploaded / verified / rejected
- Expiry date (for time-bound docs)
- E-sign status

---

### 5.5 Site Visit History

Full log of all visits:
- Pre-booking visits (from lead stage)
- Post-booking visits (construction site visits)
- Possession walk-through
- Each visit: date, time, accompanied by (advisor name), observations, client feedback, photos

---

### 5.6 Communication History

Full timeline view per client showing:
- All calls (with notes)
- All WhatsApp messages
- All emails
- All SMS
- All system notifications sent
- All documents shared
- All payments made
- Construction updates received
- Complaints raised and resolved

---

### 5.7 Complaints & After-Sales Support

- Client can raise complaint via portal or advisor logs it
- Complaint categories: payment dispute / document issue / construction delay / quality issue / billing error / other
- Assigned to relevant team (legal / accounts / construction)
- Status: open / in progress / resolved / escalated
- SLA per category (e.g. billing errors: resolve in 2 business days)
- Client notified on status change via WhatsApp + email
- Satisfaction rating after resolution

---

## 6. Booking & Payment Management

### Overview
Handles the critical moment of converting a lead to a booked client — with proper documentation, digital payments, and approval workflows.

---

### 6.1 Booking Process Flow

```
1. Advisor logs booking intent → selects plot + client
2. System checks plot availability (auto)
3. System generates cost sheet with breakdown
4. Advisor shares cost sheet with client (WhatsApp/email)
5. Client confirms verbally
6. Advisor initiates booking in CRM
7. Booking form auto-generated (from template)
8. Client signs booking form (physical or e-sign via Digio)
9. Booking payment processed (online link or offline receipt)
10. Manager approval (if required by admin settings)
11. Booking confirmed → plot status → Booked
12. Allotment letter auto-generated + sent to client
13. Lead converted to client record
14. Commission auto-calculated and logged
```

---

### 6.2 Booking Form Generation

Auto-populated from system data:
- Client name, address, PAN
- Plot number, size, facing
- Project name, RERA number
- Total sale consideration
- Booking amount
- Balance payment schedule
- Terms and conditions
- Signature fields (client + advisor + manager)

Output: PDF generated instantly, sent to client via WhatsApp + email.

---

### 6.3 Payment Gateway Integration

**Provider: Razorpay**

Capabilities enabled:
- Payment link generation (send unique link per transaction)
- UPI / Net banking / Debit card / Credit card / EMI
- Auto-reconciliation (payment received → CRM record updated automatically)
- Payment receipt auto-generation
- Refund processing (admin only, with approval workflow)
- Partial payment support
- International payments (NRI buyers — Razorpay supports this)

**Offline payments:**
- Bank transfer (NEFT/RTGS): enter UTR number + bank confirmation date
- Cheque: enter cheque number + bank + date + amount
- DD (demand draft): same as cheque
- Cash (with limit — ₹19,999 max per Income Tax rules)
- All offline payments require manager verification

---

### 6.4 Allotment Letter & Agreement

**Allotment letter:** Generated within 24 hours of booking confirmation
- Template pre-configured with all project + client + plot details
- Branded ANON INDIA letterhead
- Director signature (can be digital)
- Sent to client via WhatsApp + email + physical copy option

**Agreement to Sale:**
- Generated after booking amount + 20% (configurable threshold) received
- Legal team review before issuance
- E-sign integration (Digio/SignDesk) with Aadhaar OTP
- Registered agreement: upload scanned copy after sub-registrar registration
- RERA requires registration within 30 days of execution

---

### 6.5 Demand Letter Automation

Linked to construction milestones (see Module 9):
- When milestone % complete → system triggers demand letter
- Letter specifies: amount due, due date, bank details, penalty clause
- Auto-sent via WhatsApp + email + PDF attachment
- Tracked: sent / opened / paid / overdue

---

### 6.6 Cancellation & Refund Process

- Advisor or client raises cancellation request
- Manager reviews and approves/rejects
- If approved: cancellation charges calculated (per agreement terms)
- Refund amount calculated
- Refund request sent to accounts team
- Accounts processes refund (bank transfer)
- Refund logged + receipt generated
- Plot status reset to Available
- Client record archived (not deleted — for audit)

---

## 7. Channel Partner / Broker Portal

### Overview
Separate login portal for external brokers and referral agents. They can register leads, track their leads' progress, and see their earned commissions — without accessing sensitive client or company data.

---

### 7.1 Broker Registration & Onboarding

- Broker self-registers on portal or invited by ANON INDIA team
- Registration form: name, firm name, RERA registration number, city, contact, bank details
- Verification by ANON INDIA admin (approve/reject)
- On approval: welcome email + login credentials + onboarding kit
- Onboarding kit: project brochures, price lists, commission structure PDF, brand kit

---

### 7.2 Broker Dashboard

Broker sees:
- My Leads (leads they registered) and current stage
- My Bookings (leads that converted to bookings)
- My Earnings (commission earned + pending + paid)
- Project inventory (available plots only — no client details)
- Download zone (brochures, price lists, cost sheets)
- Company announcements (new project launches, price escalations)

---

### 7.3 Lead Registration by Broker

- Broker enters lead in their portal: name, phone, project interest, budget
- ANON INDIA CRM auto-creates this as an inbound lead tagged with source: Broker + Broker Name
- ANON INDIA advisor assigned internally — broker does NOT see advisor details
- Broker sees only stage updates (e.g. "Your lead is at: Site Visit Scheduled")
- Duplicate protection: if broker's lead matches an existing lead (same phone) → shown as duplicate + FIFO rule applied for commission

---

### 7.4 Commission Management

**Commission structure (configurable by admin):**
- Percentage of booking value (e.g. 2%)
- Fixed amount per booking
- Tiered: higher commission for higher-value bookings
- Bonus: extra commission for first 3 bookings in a month

**Commission lifecycle:**
```
Lead booked → Commission calculated (auto) → Pending (awaiting payment threshold)
→ Approved by manager → Payment processed → Paid
```

**Broker sees per booking:**
- Booking value: ₹ X
- Commission %: X%
- Commission amount: ₹ X
- Status: Pending / Approved / Paid
- Expected payment date
- Payment made date + UTR number

**Admin sees:**
- Total commission liability per month
- Commission paid / pending / disputed
- Top performing brokers
- Commission payment batch processing (pay all approved commissions in one batch)

---

### 7.5 Broker Performance Tracking (Admin view)

- Total leads registered by broker
- Lead-to-booking conversion rate
- Total bookings done
- Total commission earned
- Active / Inactive status (no activity in 90 days → auto-flag)
- City/project specialization

---

## 8. Post-Sale Customer Portal

### Overview
A dedicated login for clients to self-serve their post-booking needs — reducing inbound support calls by 60–70%. Clients can view payment status, download documents, check construction progress, and raise complaints.

---

### 8.1 Client Login

- Login via mobile OTP (no password needed — OTP-based auth)
- Mobile-friendly (responsive web + can be wrapped into an app)
- Branded as "ANON INDIA Client Portal" or a custom name

---

### 8.2 Portal Dashboard

Client sees at a glance:
- Property booked: [Project Name] — [Plot Number]
- Payment progress: ₹X paid of ₹X total (progress bar)
- Next payment due: ₹X on [Date]
- Construction status: [Stage] — X% complete
- Documents ready to download: X pending
- Open complaints: X

---

### 8.3 Payment Section

- Full payment schedule (all installments)
- Each installment: due date, amount, status (paid / pending / overdue)
- Payment history with receipts (downloadable PDF)
- Pay online button → Razorpay payment link
- Request payment extension (raises a ticket for accounts team)

---

### 8.4 Documents Section

Client can download (when made available by ANON INDIA team):
- Allotment letter
- Booking form
- Agreement to sale
- Payment receipts
- Demand letters received
- NOC for bank loan
- Possession letter (when issued)

Client can also upload:
- KYC documents (if pending)
- Loan sanction letter
- Any documents requested by team

---

### 8.5 Construction Progress

- Phase-wise construction updates with photos (uploaded by ANON INDIA team)
- Timeline view: each milestone with completion date
- Latest update highlighted
- Notification when new update posted

---

### 8.6 Raise a Complaint / Request

- Client submits: category + description + optional photo
- Ticket number generated
- Email + WhatsApp confirmation to client
- Client tracks status in portal
- Notified on resolution

---

### 8.7 Contact / Support

- Dedicated advisor's name and phone (assigned to client)
- WhatsApp chat button (opens conversation in business WhatsApp)
- FAQs section (project-specific)

---

## 9. Construction Progress Tracking

### Overview
Phase-by-phase tracking of construction milestones. This is the backbone of construction-linked payment plans — each milestone completion triggers a payment demand.

---

### 9.1 Milestone Setup (Per Project)

Admin defines milestones at project creation. Example for plotted development:

| Milestone | % of total value | Description |
|---|---|---|
| Booking | 10% | At booking |
| Plot demarcation | 10% | Individual plots marked on ground |
| Boundary wall completion | 15% | Perimeter wall completed |
| Internal roads (base layer) | 15% | Road foundation laid |
| Underground utilities | 10% | Water, drainage, electricity lines laid |
| Road surfacing | 10% | Tarmac / concrete road complete |
| Street lighting | 5% | Poles and lights installed |
| Landscaping | 5% | Parks, green areas |
| Possession | 20% | Final demand |
| **Total** | **100%** | |

For apartments, milestones are slab-by-slab (Ground floor slab, 1st floor slab, etc.).

---

### 9.2 Milestone Updates

- Site engineer / admin marks milestone as complete with:
  - Completion date
  - Photo evidence (mandatory, min 3 photos)
  - Notes / description
  - % complete (can be partial, e.g. 60% of boundary wall done)
- On full milestone completion:
  - All clients in construction-linked plan → demand letter auto-generated + sent
  - Client portal updated with new progress
  - Client push notification sent

---

### 9.3 Construction Dashboard

Admin / manager views:
- All active projects with current milestone
- Delayed milestones (expected date passed, not marked complete)
- Demand letters triggered this month
- Revenue expected from current milestone (total outstanding × % due)
- Photo gallery per milestone

---

### 9.4 Delay Management

- If milestone passes expected date → red flag in dashboard
- Manager notes reason for delay
- Revised expected date updated
- Communication to affected clients (WhatsApp template: "Update on your project timeline")
- RERA compliance: delays must be reported to RERA authority (alert generated)

---

## 10. Website Requirements

### Overview
A modern, fast, SEO-optimized real estate website that acts as the primary lead generation engine for ANON INDIA. Every page is built to capture leads.

---

### 10.1 Pages & Structure

**Home**
- Hero with lead capture form (name, phone, project interest — 3 fields only)
- Featured projects section (live availability pulled from CRM inventory)
- Why ANON INDIA (trust signals: years of experience, plots delivered, happy clients)
- Testimonials (with photo and project)
- Latest blog posts
- WhatsApp floating button (opens with pre-filled message)
- Awards / certifications
- Google reviews embed

**Projects**
- Project listing page (filter by city / type / status)
- Individual project page:
  - Gallery (photos + video + 360° tour)
  - Master layout (interactive plot map)
  - Amenities list
  - Location map
  - RERA details
  - Price range (not full price list — drives inquiries)
  - EMI calculator widget
  - Lead capture form (prominent, sticky on mobile)
  - Download brochure (captures name + phone before download)
  - Nearby landmarks

**Gallery**
- Project-wise photo/video gallery
- Drone footage
- Construction progress photos (for under-construction projects)

**About Us**
- Company story, mission, values
- Team section (optional)
- Milestones/achievements
- RERA registration details

**Blog**
- Real estate investment advice
- Project updates
- Market trends (Jaipur/city-specific)
- SEO-targeted articles (e.g. "Plots for sale in [City]")

**Contact**
- Office address with map
- Phone / WhatsApp / email
- Contact form (goes directly to CRM as a lead)
- Office hours

**Career**
- Open positions listing
- Job application form (goes to HR module)

**Privacy Policy / Terms** (RERA required)

---

### 10.2 Lead Capture Strategy

Every page has a lead capture mechanism:
- Homepage hero form
- Project pages: sticky side form (desktop) / bottom sheet (mobile)
- Brochure download gate (form before download)
- EMI calculator: result shown after entering name + phone
- Exit intent popup (shows when user moves mouse toward tab close)
- WhatsApp button: opens with pre-filled message ("Hi, I'm interested in [Project Name]")
- Blog: bottom-of-article CTA form

---

### 10.3 Technical Requirements

**Performance:**
- Page load time: under 2 seconds on 4G (Core Web Vitals: LCP < 2.5s)
- Image optimization: WebP format, lazy loading
- CDN: Cloudflare
- Mobile score: 90+ on Google PageSpeed

**SEO:**
- Semantic HTML (H1, H2, H3 hierarchy)
- Meta titles and descriptions per page (configurable from CMS)
- Schema markup: RealEstateListing, Organization, LocalBusiness
- Sitemap.xml auto-generated
- Canonical URLs
- City + project keyword targeting
- Blog with minimum 2 posts/month (for organic traffic)

**Integrations:**
- Google Analytics 4
- Meta Pixel (Facebook)
- Google Tag Manager (central tag management)
- Google Search Console
- Hotjar / Microsoft Clarity (heatmaps, session recordings)
- Intercom or Tidio (live chat widget — optional)

**CMS:**
- Content manageable by non-technical team
- Add/edit project pages without developer
- Upload new gallery photos independently
- Publish blog posts with SEO fields
- Update contact info / team section

---

### 10.4 EMI Calculator Widget

Fields:
- Property price (auto-filled if on project page)
- Down payment %
- Loan amount (auto-calculated)
- Interest rate
- Loan tenure (years)

Output:
- Monthly EMI
- Total interest payable
- Total amount payable
- Amortization schedule (optional toggle)

After calculating → CTA: "Check your loan eligibility — talk to our finance advisor" → opens WhatsApp or lead form.

---

## 11. Digital Marketing Integration

### Overview
Complete marketing intelligence — know exactly which campaigns are driving quality leads, site visits, and bookings. Make budget decisions based on data.

---

### 11.1 Facebook & Instagram Leads

- Meta Lead Ads → Facebook Lead API → Webhook → CRM (real-time, no delay)
- Fields mapped automatically: name, phone, ad name, campaign, ad set, form ID
- UTM parameters captured for all click-through ads
- Duplicate check on phone number before creating record
- Lead quality tagging: high / medium / low (based on source performance history)

---

### 11.2 Google Ads Integration

- Google Ads conversion tracking → tag on thank-you page / form submission
- Call conversion tracking (Google forwarding numbers)
- Keyword-level tracking: which keyword generated which lead
- CRM captures: utm_source=google, utm_campaign=X, utm_term=keyword
- Lead → booking → revenue tracked back to the originating Google campaign

---

### 11.3 UTM Tracking Framework

All campaign URLs use consistent UTM structure:
```
utm_source = facebook / google / instagram / whatsapp / organic / referral / portal
utm_medium = cpc / social / email / sms / whatsapp
utm_campaign = [project-name]-[city]-[month]
utm_content = [ad-creative-id]
utm_term = [keyword] (Google only)
```

- UTM data captured on every lead
- Stored in lead record
- Used in all ROI reports

---

### 11.4 Meta Pixel & Conversion API

- Pixel fires on: page view, lead form view, form submission, brochure download
- Conversion API (server-side): booking event sent to Meta when booking logged in CRM
  - This allows Meta to optimize for actual buyers, not just form fills
  - Significantly improves ad quality over time
- Custom audiences:
  - Website visitors (last 30/60/90 days)
  - Lead form openers (not submitted)
  - Existing clients (for exclusion from lead campaigns)
  - Lookalike audiences based on booked clients

---

### 11.5 Marketing ROI Dashboard

Per campaign / source:

| Metric | Calculation |
|---|---|
| Leads generated | Count of leads with this source |
| Cost per lead | Ad spend ÷ leads |
| Site visits generated | Count of site visits from this source |
| Cost per site visit | Ad spend ÷ site visits |
| Bookings generated | Count of bookings from this source |
| Cost per booking | Ad spend ÷ bookings |
| Revenue generated | Sum of booking values from this source |
| ROAS | Revenue ÷ ad spend |
| Lead-to-visit rate | Site visits ÷ leads × 100 |
| Visit-to-booking rate | Bookings ÷ site visits × 100 |

Ad spend data entered manually by marketing manager (or via Google Ads / Meta Ads API auto-sync).

---

### 11.6 Competitor & Market Intelligence (Future)

- Track competitor project launches in target cities
- Monitor property portal listings vs own listings
- Price benchmarking against nearby projects

---

## 12. HR & Hiring Management

### Overview
Manage the full employee lifecycle — from job posting to exit — within the CRM.

---

### 12.1 Recruitment

**Job Postings:**
- Create opening: title, department, location, experience required, JD, salary range
- Post to website career page (auto-sync)
- Share on LinkedIn / Naukri (manual sharing, link generated)
- Each posting gets a unique application URL

**Application Management:**
- Applications come in via career page form
- Fields captured: name, phone, email, current company, current CTC, expected CTC, experience, resume (PDF upload)
- Auto-acknowledgement email to applicant
- Pipeline stages: Applied → Shortlisted → Interview Scheduled → Interview Done → Offer → Joined / Rejected

**Interview Scheduling:**
- Schedule interview: date, time, mode (in-person / video), interviewer
- Auto-send interview invite to candidate (email + WhatsApp)
- Interviewer gets calendar invite
- Post-interview: interviewer fills feedback form (rating 1–5, skills assessment, recommendation)

---

### 12.2 Employee Records

On joining, create employee profile:
- Personal details (same as client profile — DOB, Aadhar, PAN, address)
- Employment details: designation, department, reporting manager, joining date, probation end date
- Salary: CTC breakdown (basic, HRA, allowances, PF, professional tax)
- Bank details (for salary credit)
- Documents: offer letter, appointment letter, ID proofs, educational certificates, last employer's relieving letter
- Emergency contact

---

### 12.3 Attendance & Leave

- Mobile check-in/check-out (GPS tagged)
- Late arrival flag (if check-in after 9:30AM, configurable)
- Half-day marking
- Leave application in app → manager approves/rejects
- Leave balance tracker (per leave type: casual, sick, earned)
- Monthly attendance report auto-generated
- Holiday calendar (national + company holidays)

---

### 12.4 Payroll (Basic)

- Monthly salary calculation based on: base CTC + attendance (deduct for LOP) + incentives earned
- Tax deduction (TDS) configuration
- PF deduction (12% employee + 12% employer)
- Professional tax (state-specific)
- Salary slip generation (PDF) — sent to employee WhatsApp + email
- Payroll summary for accounts: total payout per month

(Note: For advanced payroll with TDS returns / Form 16, integrate with Greythr or Keka HR.)

---

### 12.5 Training & Development

- Training module assignments (for new joiners)
- Knowledge base articles (project FAQs, sales scripts, objection handling)
- Quiz/assessment after training module
- Certification on completion
- Training completion tracker (admin view)

---

### 12.6 Exit Management

- Resignation logged by HR
- Last working day set
- Exit checklist: asset return / access revocation / clearance from all departments
- Full and final settlement calculation
- Relieving letter + experience letter generation
- Alumni record (for rehire consideration)

---

## 13. Reports & Analytics

### Overview
Every business decision should be data-driven. The reports module gives management complete visibility from lead generation to revenue, down to individual advisor performance.

---

### 13.1 Executive Dashboard (Admin View)

Top-level KPIs visible at a glance:
- Total leads this month (vs last month — trend arrow)
- Total site visits this month
- Total bookings this month
- Total revenue booked
- Lead-to-visit conversion rate
- Visit-to-booking conversion rate
- Cost per lead (this month)
- Cost per booking (this month)
- Collection this month (payments received)
- Outstanding receivables (payments due)

Charts:
- Daily lead trend (line chart — last 30 days)
- Source-wise lead split (donut chart)
- Project-wise booking split (bar chart)
- Revenue trend (month-on-month last 12 months)

---

### 13.2 Lead Reports

| Report | Description |
|---|---|
| Daily lead count | By source, by advisor, by project |
| Lead source performance | Leads / site visits / bookings / cost per lead per source |
| Lead ageing | How long leads have been in each stage |
| SLA compliance | % of leads contacted within 2 hours |
| Duplicate lead report | All duplicates detected this month |
| Lost lead analysis | Reasons why leads marked Not Interested |
| Lead funnel | Stage-wise count + drop-off rate |

---

### 13.3 Sales Reports

| Report | Description |
|---|---|
| Advisor scorecard | Calls / follow-ups / visits / bookings per advisor |
| Team performance | Team-level summary |
| Target vs achievement | Per advisor, per team, per project |
| Booking report | All bookings: date, advisor, project, plot, client, value |
| Site visit report | All visits: date, advisor, lead, outcome |
| Conversion funnel | Lead → contacted → interested → visit → booked |
| Revenue report | Booking value by project, by advisor, by month |

---

### 13.4 Financial Reports

| Report | Description |
|---|---|
| Collection report | Payments received: date, client, project, amount, mode |
| Outstanding report | Pending payments: due date, amount, days overdue |
| Demand letter report | Demands issued vs payments received |
| Commission payable | Broker commissions due this month |
| Commission paid | Payment history per broker |
| Project revenue summary | Total sold value per project vs unsold inventory value |

---

### 13.5 Inventory Reports

| Report | Description |
|---|---|
| Availability report | Available / held / booked / sold count per project |
| Plot ageing report | Available plots: how long unsold (30/60/90/180 days) |
| Price change log | All price updates with date and changed-by |
| Soft hold report | All current holds + expiry + advisor |

---

### 13.6 Export & Scheduling

- All reports: export to Excel / PDF
- Schedule any report: daily / weekly / monthly → auto-email to configured recipients
- Custom date range on all reports
- Role-based report access (advisors see own data, managers see team, admin sees all)

---

## 14. Automation Engine

### Overview
A visual, configurable automation builder. No coding required. Admin sets up "if this happens → do this" rules that run 24/7.

---

### 14.1 Automation Builder (Visual)

Each automation has:
- **Trigger:** What event starts this automation
- **Condition (optional):** Filter (e.g. only for specific project or source)
- **Delay (optional):** Wait X hours/days before acting
- **Action:** What to do

---

### 14.2 Pre-built Automation Templates

**New lead automations:**
```
TRIGGER: New lead created
CONDITION: Source = Facebook Ads
ACTION: Send WhatsApp template "Welcome - Facebook"
DELAY: Immediate
```

```
TRIGGER: New lead created
ACTION: Assign to advisor (round robin)
DELAY: Immediate
```

```
TRIGGER: New lead created
ACTION: Send push notification to assigned advisor
DELAY: Immediate
```

**Follow-up automations:**
```
TRIGGER: Lead stage = Contacted, no activity for 48 hours
ACTION: Send WhatsApp "Follow-up nudge" template to lead
+ Send push notification to advisor: "Lead [Name] has not been followed up"
```

```
TRIGGER: Site visit scheduled date approaching
DELAY: 1 day before
ACTION: Send WhatsApp reminder to lead
+ Send reminder notification to advisor
```

```
TRIGGER: Site visit completed (stage changes to "Site Visit Done")
DELAY: 2 hours
ACTION: Send WhatsApp thank-you message to lead
```

```
TRIGGER: Lead not contacted in 2 hours after creation
ACTION: Alert manager via push notification + email
```

**Client automations:**
```
TRIGGER: Payment due date approaching
DELAY: 7 days before due date
ACTION: Send WhatsApp payment reminder to client
```

```
TRIGGER: Payment due date
ACTION: Send WhatsApp payment reminder (day of)
+ Send email with demand letter PDF
```

```
TRIGGER: Payment overdue (due date passed, not paid)
ACTION: Send daily WhatsApp reminder to client
+ Alert advisor and manager
```

```
TRIGGER: Client birthday (DOB field)
ACTION: Send WhatsApp birthday greeting template
```

```
TRIGGER: Booking anniversary (booking date)
ACTION: Send WhatsApp anniversary message
```

**Broker automations:**
```
TRIGGER: Broker's lead changes stage
ACTION: Send portal notification to broker with stage update
```

```
TRIGGER: Commission approved
ACTION: Send WhatsApp to broker: "Your commission of ₹X has been approved"
```

---

### 14.3 Custom Automation Builder

Admin can create custom automations with:

**Triggers:**
- Lead created
- Lead stage changed (to any specific stage)
- Lead assigned
- Follow-up overdue
- Site visit scheduled / completed
- Booking created
- Payment received
- Payment overdue
- Construction milestone complete
- Document uploaded
- Complaint raised
- Date-based (birthday, anniversary, due date)

**Conditions (filters):**
- Source equals X
- Project equals X
- Budget range
- Advisor equals X
- City equals X
- Lead score above/below X

**Actions:**
- Send WhatsApp template (select template)
- Send SMS
- Send email (select template)
- Create follow-up reminder (for advisor)
- Send push notification (to advisor / manager / admin)
- Change lead stage
- Assign to advisor
- Add tag to lead

**Delays:**
- Immediate
- After X minutes / hours / days
- On a specific date/time

---

### 14.4 Automation Log

- All automations that fired: timestamp, lead/client, automation name, action taken, status (success/failed)
- Failed automation alerts (e.g. WhatsApp delivery failed)
- Automation performance stats: how many times fired, success rate

---

## 15. Legal & Compliance (RERA)

### Overview
Real estate in India is heavily regulated. RERA (Real Estate Regulation and Development Act) compliance is not optional — it is legally mandatory.

---

### 15.1 RERA Project Registration

Per project, store and display:
- RERA registration number
- RERA registration date
- RERA expiry date (alert 60 days before expiry for renewal)
- State RERA authority name
- RERA website link for this project
- RERA-mandated project disclosures (carpet area, FSI, approvals)

**RERA compliance checks:**
- Advertise only with RERA number displayed (auto-adds to all marketing material templates)
- Agreement must be registered within 30 days — CRM tracks and alerts
- Delay reporting: if milestone delayed > 3 months → generate RERA delay report template
- Quarterly progress report submission reminder (as per state RERA rules)

---

### 15.2 Document Compliance

Checklist per project (admin tracks completion):
- [ ] RERA registration certificate
- [ ] Land title (clear title report from lawyer)
- [ ] Layout approval from local authority
- [ ] Building plan approval
- [ ] Environmental clearance (if applicable)
- [ ] Fire NOC
- [ ] Bank approval for home loan (tie-up with banks)
- [ ] All contractor agreements signed

---

### 15.3 Legal Document Templates

Pre-configured, legally reviewed templates (filled by ANON INDIA's lawyer, stored in system):
- Booking form
- Agreement to sale (RERA-compliant format)
- Allotment letter
- Demand letter
- Cancellation letter
- Possession letter
- Handover checklist
- NOC for bank loan

---

### 15.4 Data Privacy Compliance

- DPDP (Digital Personal Data Protection) Act, India — collect only what's needed
- Explicit consent checkbox on all forms ("I agree to receive communications from ANON INDIA")
- Opt-out management: clients/leads can request data deletion
- Data deletion workflow: admin confirms, data anonymized (not hard-deleted for audit trail)
- WhatsApp opt-out management (mandatory per TRAI)
- PAN / Aadhar: encrypted at database level, access-logged

---

## 16. Loan & Home Finance CRM

### Overview
Most Indian buyers need home loans. Your sales team should be equipped to guide buyers through the loan process — and track it.

---

### 16.1 Bank Tie-up Management

Admin maintains list of approved bank / NBFC tie-ups per project:
- Bank name
- Loan product name
- Applicable projects
- Maximum loan % (e.g. 75% of property value)
- Interest rate (floating / fixed)
- Processing fee
- RM contact (bank's relationship manager assigned to ANON INDIA)
- Turnaround time (days for sanction)

---

### 16.2 Client Loan Tracking

Per client, track their loan journey:

| Stage | Fields |
|---|---|
| Eligibility check | Monthly income, existing EMIs, credit score (if disclosed) |
| Bank selected | Bank name, RM contacted on date |
| Application submitted | Date, loan amount applied, processing fee paid |
| Documents submitted | Checklist: income proof, KYC, property docs, NOC |
| Sanction received | Date, sanctioned amount, interest rate, tenure |
| Disbursement | Date, amount disbursed, tranche (if multiple) |
| Rejected | Date, reason, alternate bank tried |

---

### 16.3 Loan-linked Payment Tracking

For subvention / construction-linked loans:
- Disbursement schedule linked to construction milestones
- When milestone complete → system alerts: "Loan disbursement tranche X due from bank"
- Track expected vs actual disbursement date
- Alert if bank delays disbursement (common pain point)

---

### 16.4 DSA / Loan Agent Management

If ANON INDIA works with DSAs (Direct Selling Agents) for loan facilitation:
- DSA profile: name, firm, NBFC/bank empanelment, contact
- Assign DSA to client
- Track loan processing by DSA
- DSA commission (if applicable) tracked separately

---

## 17. Mobile App

### Overview
Android (and optionally iOS) app for the field sales team. Built in React Native — one codebase, both platforms.

---

### 17.1 Core App Features

**Dashboard:**
- Today's follow-ups (sorted by priority / lead score)
- Leads pending first contact
- Overdue follow-ups (red)
- Today's site visits
- My performance today: calls / follow-ups / visits

**Lead Management:**
- View assigned leads
- Update lead stage
- Log call outcome + notes (voice-to-text option)
- Schedule next follow-up
- View lead history / timeline
- Call lead directly from app (call logged automatically)
- WhatsApp lead directly from app (chat opens in WhatsApp)

**Site Visit Management:**
- View scheduled visits
- GPS check-in at site visit location (verifies actual presence)
- Log visit outcome + client feedback
- Take and upload photos from site
- Schedule follow-up from visit record

**WhatsApp:**
- View assigned WhatsApp conversations
- Send quick replies from CRM
- Send approved templates

**Inventory:**
- View project-wise plot availability
- Check plot details (size, price, status)
- Place soft hold on a plot for a client
- Download cost sheet PDF

**Notifications:**
- Push notifications: new lead assigned, follow-up due, SLA breach alert, manager message
- In-app notification center (full history)

**Attendance:**
- Mobile check-in / check-out (GPS tagged)
- Leave application
- View own attendance record

---

### 17.2 Offline Mode

- Lead list and today's follow-ups cached for offline access
- Can add notes offline → sync when internet available
- Shows "offline" indicator clearly
- Cannot place holds or update stages offline (real-time data needed)

---

### 17.3 App Security

- Biometric login (fingerprint / face ID)
- Session timeout after 15 minutes of inactivity (configurable)
- Cannot screenshot client data (Android FLAG_SECURE)
- Remote wipe if device reported lost (admin-initiated)
- All API calls over HTTPS
- Certificate pinning

---

## 18. Security, Infrastructure & Backup

### Overview
Enterprise-grade security for a system that handles sensitive client financial and personal data.

---

### 18.1 Authentication & Access

- JWT-based session tokens (15-minute expiry, auto-refresh)
- 2FA mandatory for Admin and Manager roles (TOTP via Google Authenticator)
- OTP-based login for sales advisors (phone OTP)
- Failed login lockout: 5 attempts → 30-minute lockout → admin alert
- IP whitelist option (admin can restrict login to office IP only)
- Single device session for mobile app (new login on another device logs out old)
- Admin can force-logout any user remotely

---

### 18.2 Data Security

- All data in transit: TLS 1.3 encryption (HTTPS everywhere)
- Data at rest: AES-256 encryption (database level)
- PAN / Aadhar: field-level encryption (stored encrypted, decrypted only on authorized view)
- PAN / Aadhar views: logged (who viewed, when)
- Database not publicly accessible (private network only, accessed via app server)
- No sensitive data in URLs or browser history

---

### 18.3 Audit Trail

Every significant action logged:
- User, timestamp, action, record affected, old value → new value
- Actions logged: login / logout / lead create / lead edit / stage change / delete / export / document view / payment create / booking create / user role change
- Audit log: read-only (not editable even by admin)
- Retained for 7 years (legal requirement)
- Exportable (for legal/compliance needs)

---

### 18.4 Role-based Data Access

- Each user sees only the data their role permits (enforced at API level, not just UI)
- Row-level security: advisors see only their assigned leads (even if they query the API directly)
- Branch-level isolation: multi-branch setup — each branch sees only its own data (admin sees all)

---

### 18.5 Infrastructure

**Hosting: AWS (recommended)**

| Service | Purpose |
|---|---|
| EC2 (t3.medium → t3.large) | App servers (auto-scaling group) |
| RDS PostgreSQL (db.t3.medium) | Primary database (Multi-AZ for failover) |
| ElastiCache Redis | Session cache, job queues |
| S3 | Document / media storage |
| CloudFront | CDN for website and media |
| SES | Transactional emails |
| SNS | Push notifications |
| Route 53 | DNS management |
| WAF | Web Application Firewall (block attacks) |
| CloudWatch | Monitoring + alerts |

**Estimated monthly AWS cost:**
- Phase 1 (small team, MVP): ₹12,000–₹18,000/month
- Phase 2 (full launch, 20–50 users): ₹20,000–₹35,000/month
- Phase 3 (scaled, 100+ users, multi-branch): ₹40,000–₹70,000/month

---

### 18.6 Backup & Disaster Recovery

- **Database:** Automated daily snapshots (retained 30 days) + point-in-time recovery (PITR) enabled
- **Files (S3):** Versioning enabled, cross-region replication to secondary S3 bucket
- **RTO (Recovery Time Objective):** < 4 hours (system restored within 4 hours of failure)
- **RPO (Recovery Point Objective):** < 1 hour (maximum 1 hour of data loss)
- **Monthly restore test:** Admin runs test restore every month to verify backup integrity
- **Multi-AZ RDS:** Database automatically fails over to standby in < 2 minutes if primary fails

---

## 19. Technology Stack & Architecture

### 19.1 Recommended Stack

| Layer | Technology | Reason |
|---|---|---|
| Web Frontend | Next.js 14 (React) | SSR for SEO, fast, large ecosystem |
| Mobile App | React Native | Single codebase → Android + iOS |
| Backend API | Node.js + NestJS | Scalable, TypeScript, great for REST + WebSocket |
| AI / ML Services | Python + FastAPI | Lead scoring, chatbot, analytics |
| Primary Database | PostgreSQL | Relational, ACID-compliant, scales well |
| Cache / Queue | Redis | Sessions, job queues, rate limiting |
| Document / Media | AWS S3 | Scalable, cheap, reliable |
| Search | Elasticsearch | Full-text search on leads + clients |
| Realtime | Socket.io | WhatsApp inbox live updates, notifications |
| Email | AWS SES / SendGrid | Transactional emails |
| SMS | Twilio / MSG91 | OTP + notifications |
| WhatsApp | Interakt / Wati | Built on Meta Business API |
| Telephony | Exotel / Knowlarity | IVR, click-to-call, call recording |
| Payments | Razorpay | India-specific, UPI + EMI + cards |
| E-sign | Digio | Aadhaar-based e-sign, India-compliant |
| CI/CD | GitHub Actions | Automated testing + deployment |
| Monitoring | Datadog / CloudWatch | Performance + error tracking |

---

### 19.2 System Architecture Overview

```
[Mobile App] ─────────────────────────────────────────┐
[Web App (Next.js)] ──────────────────────────────────┤
[Website (Next.js)] ──────────────────────────────────┤
                                                        ▼
                                              [API Gateway / Load Balancer]
                                                        │
                            ┌───────────────────────────┤
                            ▼                           ▼
                     [NestJS API Server]        [Python AI Service]
                     (Auth, CRUD, Business       (Lead scoring,
                      Logic, Webhooks)            chatbot, analytics)
                            │
            ┌───────────────┼──────────────────────┐
            ▼               ▼                      ▼
      [PostgreSQL]      [Redis Cache]           [AWS S3]
      (Main DB)         (Sessions,              (Files,
                         Queues, Cache)          Documents,
                                                 Media)
                            │
                    [Background Jobs]
                    (Bull Queue / Redis)
                    - WhatsApp sends
                    - Email sends
                    - Report generation
                    - Automation engine
                    - Reminders

[External APIs]
- Meta Lead API (Facebook/Instagram)
- Google Ads API
- WhatsApp Business API (Interakt/Wati)
- Razorpay (Payments)
- Exotel (Telephony)
- Digio (E-sign)
```

---

### 19.3 Database Schema (Key Tables)

```sql
-- Core entities (abbreviated for overview)

leads (id, name, phone, email, city, budget_min, budget_max,
       project_id, source, utm_source, utm_campaign, utm_medium,
       stage, score, temperature, assigned_to, created_at, updated_at)

lead_activities (id, lead_id, type, notes, outcome, 
                 performed_by, created_at)

projects (id, name, type, city, address, rera_number, 
          status, launch_date, completion_date)

plots (id, project_id, plot_number, size_sqyd, facing, type,
       base_price, premium, total_price, status, 
       held_by, held_until, booked_by_client_id)

clients (id, lead_id, name, phone, email, pan_encrypted,
         aadhar_encrypted, dob, address, kyc_status)

bookings (id, client_id, plot_id, project_id, total_value,
          booking_amount, advisor_id, broker_id, 
          booking_date, agreement_date, status)

payments (id, booking_id, client_id, amount_due, due_date,
          amount_paid, paid_date, mode, transaction_id,
          status, receipt_url)

users (id, name, phone, email, role, branch_id, 
       target_monthly, is_active)

brokers (id, name, firm, rera_number, city, bank_details,
         commission_rate, status)

automations (id, name, trigger, conditions, actions, 
             delay_value, delay_unit, is_active)

audit_logs (id, user_id, action, table_name, record_id,
            old_values, new_values, ip_address, created_at)
```

---

## 20. Development Timeline & Costing

### 20.1 Phase-wise Development Plan

**Phase 1 — Core CRM (Month 1–4)**
- Lead management (all sources + pipeline + assignment)
- Sales team management (roles, KPIs, dashboard)
- Basic inventory management (projects + plots + availability)
- WhatsApp API integration (inbox + templates + auto-reply)
- Basic reports (lead, sales, team)
- Admin panel
- Web app (desktop-first)

**Phase 2 — Client & Booking (Month 5–7)**
- Client management (full profile + KYC)
- Booking workflow (form → payment → allotment letter)
- Payment tracking (schedule + receipts + reminders)
- Razorpay integration
- Digio e-sign integration
- Broker / channel partner portal
- Mobile app (Android — React Native)
- Advanced automation engine

**Phase 3 — Website & Marketing (Month 8–9)**
- Real estate website (all pages)
- CMS for content management
- Meta Pixel + Google Ads integration
- UTM tracking + ROI dashboard
- WhatsApp chatbot
- EMI calculator widget
- SEO foundation

**Phase 4 — Advanced Modules (Month 10–12)**
- Post-sale customer portal
- Construction progress tracking
- RERA compliance module
- Loan / finance CRM
- HR & hiring module
- AI lead scoring
- Advanced analytics
- IVR / telephony (Exotel)
- iOS app (React Native)

---

### 20.2 Team Required for Development

| Role | Phase 1 | Phase 2–4 | Engagement |
|---|---|---|---|
| Project Manager | 1 | 1 | Full-time |
| Backend Developer (Node.js) | 2 | 2 | Full-time |
| Frontend Developer (Next.js) | 1 | 2 | Full-time |
| React Native Developer | — | 1 | Full-time |
| Python Developer (AI/ML) | — | 1 | Part-time |
| UI/UX Designer | 1 | 1 | Full-time |
| QA Tester | 1 | 1 | Full-time |
| DevOps | 1 | 1 | Part-time |

---

### 20.3 Cost Estimate

**Development cost (one-time):**

| Phase | Scope | Estimated cost |
|---|---|---|
| Phase 1 | Core CRM | ₹8–12 lakhs |
| Phase 2 | Client, booking, broker, mobile | ₹6–9 lakhs |
| Phase 3 | Website + marketing | ₹3–5 lakhs |
| Phase 4 | Advanced modules + AI | ₹5–8 lakhs |
| **Total** | **Full system** | **₹22–34 lakhs** |

*Ranges depend on whether you hire a freelance team, a development agency, or build in-house.*

---

**Monthly recurring costs (post-launch):**

| Service | Monthly cost |
|---|---|
| AWS hosting (Phase 1 scale) | ₹12,000–₹18,000 |
| WhatsApp API (Interakt/Wati) | ₹3,000–₹8,000 |
| WhatsApp conversation charges (Meta) | ₹2,000–₹8,000 (volume-dependent) |
| Exotel / telephony | ₹2,500–₹6,000 |
| Razorpay (2% per transaction — no monthly fee) | Variable |
| Digio e-sign | ₹500–₹2,000 (per doc × volume) |
| SendGrid / SES (email) | ₹500–₹1,500 |
| SMS (MSG91) | ₹500–₹2,000 |
| Monitoring / tools | ₹1,000–₹2,000 |
| **Total monthly** | **₹22,000–₹47,500** |

---

**Maintenance cost (post-launch, ongoing):**

| Type | Monthly cost |
|---|---|
| Bug fixes + small enhancements | ₹20,000–₹35,000 |
| Dedicated developer (part-time) | ₹25,000–₹50,000 |
| Security patches + updates | Included in above |
| **Total maintenance** | **₹25,000–₹50,000/month** |

---

### 20.4 Build vs Buy Decision

| Option | Pros | Cons | Cost |
|---|---|---|---|
| Build custom (recommended) | 100% tailored, competitive advantage, own your data | Higher upfront cost, longer timeline | ₹22–34L build + ₹25–50K/month |
| Buy Sell.do (India real estate SaaS) | Quick start, purpose-built | Monthly fee, limited customization, your data on their server | ₹15,000–₹40,000/month |
| Buy Salesforce + real estate plugin | Enterprise-grade | Very expensive, complex, overkill for early stage | ₹50,000–₹1.5L/month |
| Buy Privyr (lead management only) | Simple, WhatsApp-integrated | Only lead management — not full CRM | ₹2,000–₹5,000/month |

**Recommendation:** Start with Sell.do or Privyr for first 6–12 months while revenue grows. Then build custom with learnings from real usage. Rushing custom development without usage insights leads to building the wrong things.

---

### 20.5 Scalability Path

The architecture above supports:
- Year 1: 1 city, 1–2 projects, 10–20 users → same infrastructure
- Year 2: 2–3 cities, 5–10 projects, 50–100 users → upgrade to t3.large + read replica DB
- Year 3+: Multi-state, 20+ projects, 200+ users → separate services, microservices if needed, dedicated servers per region

Data isolation for branches: already designed in schema (branch_id on all records).

AI upgrades (future): lead scoring model improves with data volume (reliable at 10,000+ leads). Chatbot gets smarter with conversation history. Predictive analytics (who will book this month) possible at 5,000+ bookings.

---

*End of ANON INDIA CRM Detailed Plan*  
*Document version: 1.0*  
*Modules: 18 | Features specified: 200+ | Ready for Claude Code implementation*
