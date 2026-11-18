# Agent-Facing Support System Guide

## Overview

This guide provides comprehensive documentation for the Agent-Facing Support System implemented in the SMC Unlisted Stox platform. The system consists of three interconnected panels: User-Facing (existing), Agent-Facing (new), and Admin-Facing (enhanced).

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Panel    │    │  Ticketing Svc  │    │  Support Panel  │
│                 │    │                 │    │                 │
│ - Create tickets│◄──►│ - Ticket CRUD   │◄──►│ - Agent login   │
│ - Rate/Reopen   │    │ - Auto-assign   │    │ - Dashboard     │
│ - View status   │    │ - SLA tracking  │    │ - Ticket mgmt   │
└─────────────────┘    │ - Notifications │    └─────────────────┘
                       │ - Scheduler     │
┌─────────────────┐    │                 │    ┌─────────────────┐
│  Admin Panel    │    └─────────────────┘    │   Auth Service  │
│                 │                           │                 │
│ - Support agents│◄─────────────────────────►│ - Agent CRUD    │
│ - Ticket oversight│                         │ - Availability  │
│ - Manual assign │                           └─────────────────┘
└─────────────────┘
```

### Key Features

- **Auto-assignment**: Round-robin or workload-based ticket distribution
- **SLA tracking**: Priority-based deadlines with automatic escalation
- **Feedback loop**: User rating/reopen system with escalation thresholds
- **Role-based access**: Permission-gated features for senior/junior agents
- **Real-time monitoring**: Cron jobs for SLA breaches and maintenance
- **Multi-panel authentication**: Separate cookies for different user types

## Architecture Deep Dive

### Services

- **`ticketing-service` (port 3001)**: Core ticket management, assignment, SLA monitoring, notifications, and background scheduling
- **`auth-service` (port 3002)**: Support agent CRUD operations and availability management
- **`stocks-service` (port 3003)**: Support panel authentication (login/logout/verify)

### Databases

- **`db-ticketing`**: Tickets, comments, attachments, labels, ticket history
- **`db-unlistedstock`**: Admin records with SUPPORT_AGENT role, availability, and active ticket counts

### Frontend

- **`/support/*`**: Support Panel (agent login, dashboard, ticket management)
- **`/admin/support-agents`**: Support agent management interface
- **`/admin/support-tickets`**: Administrative ticket oversight

## Ticket Lifecycle Workflows

### Workflow 1: User Creates Ticket → Auto-Assignment

1. User submits ticket via `/dashboard/support` (existing interface)
2. `POST /tickets` → `TicketService.create()` → `AssignmentService.autoAssignTicket()`
3. Strategy: Round-Robin (default) or Workload-based (configurable)
4. Agent's `activeTicketCount` incremented
5. Notification sent to agent (console log placeholder)

### Workflow 2: Agent Resolves Ticket → User Feedback

1. Agent clicks "Resolve" in Support Panel → `POST /tickets/:id/resolve`
2. Sets `resolvedAt`, `resolvedBy`, status='resolved'
3. User receives email (placeholder) with rate/reopen options
4. If no action in 7 days → auto-closed by cron job

### Workflow 3: User Reopens Ticket → Agent Notification

1. User clicks "Reopen" → `POST /tickets/:id/reopen`
2. Increments `reopenCount`, resets status to 'open'
3. If `reopenCount >= 3` → auto-escalates to Super Admin
4. Original agent notified (console log)

### Workflow 4: SLA Breach → Auto-Escalation

1. Cron job runs every 15 min → `SlaService.checkSlaBreaches()`
2. Finds tickets where `dueDate < now` and status not resolved/closed
3. Escalates to first available Super Admin
4. Sets `escalatedAt`, `escalatedTo`, status='escalated'
5. Email sent to Super Admin (placeholder)

### Workflow 5: Admin Manual Assignment

1. Admin selects ticket(s) in `/admin/support-tickets` → clicks "Assign"
2. `TicketAssignmentDialog` shows agent availability and workload warnings (>15 tickets)
3. Confirmation dialog → `POST /tickets/:id/assign`
4. Previous agent's count decremented, new agent's incremented

### Workflow 6: Support Agent Login

1. Navigate to `/support/login` → enter credentials
2. `POST /auth/support/login` (stocks-service) → validates SUPPORT_AGENT role
3. Sets `support_panel_token` cookie (7d expiry)
4. Redirects to `/support/dashboard`
5. Middleware validates token on all `/support/*` routes

### Workflow 7: Admin Creates Support Agent

1. Super Admin navigates to `/admin/support-agents` → "Create Support Agent"
2. `SupportAgentForm` dialog: email, name, password, manual permission selection
3. Checkboxes: view_tickets, update_ticket_status, assign_tickets, add_internal_notes, escalate_tickets, view_ticket_history, view_all_tickets
4. `POST /admins/support-agent` (auth-service) → validates permissions
5. Agent can now login to Support Panel

## API Endpoint Reference

### Support Panel Endpoints (stocks-service)

- `POST /auth/support/login` - Login with SUPPORT_AGENT credentials
- `POST /auth/support/logout` - Clear support_panel_token cookie
- `GET /auth/support/verify` - Validate session (uses SupportJwtAuthGuard)

### Ticket Management Endpoints (ticketing-service)

- `POST /tickets/:id/resolve` - Mark ticket resolved (body: `{ resolvedBy: string }`)
- `POST /tickets/:id/reopen` - Reopen resolved ticket (body: `{ reopenedBy: string, reopenReason: string }`)
- `POST /tickets/:id/rate` - Rate and close ticket (body: `{ ratedBy: string, rating: 1-5, feedback?: string }`)
- `POST /tickets/:id/assign` - Manual assignment (body: `{ agentId: string, assignedBy: string }`)
- `POST /tickets/:id/escalate` - Escalate to Super Admin
- `GET /tickets/stats` - Dashboard statistics (filters: dateRange, agentId)
- `GET /tickets` - List tickets (filters: status, priority, category, assignedTo, escalated, unassigned, createdFrom, createdTo, reopenCount)

### Support Agent Management Endpoints (auth-service)

- `POST /admins/support-agent` - Create Support Agent (body: `{ email, fullName, password, permissions: string[] }`)
- `PATCH /admins/:id/availability` - Update availability (body: `{ availability: 'available'|'busy'|'unavailable', availabilityNote?: string }`)
- `GET /admins` - List all admins (Super Admin only)

## Configuration Guide

### SLA Timeframes (`ticketing-service/.env`)

```env
SLA_URGENT_HOURS=4    # 4 hours
SLA_HIGH_HOURS=24     # 24 hours
SLA_MEDIUM_HOURS=48   # 48 hours (default)
SLA_LOW_HOURS=72      # 72 hours
```

### Assignment Strategy (`ticketing-service/.env`)

```env
TICKET_ASSIGNMENT_STRATEGY=round-robin  # or 'workload'
```

- `round-robin`: Distributes tickets evenly across available agents (uses in-memory index)
- `workload`: Assigns to agent with lowest `activeTicketCount`

### Cron Jobs (`ticketing-service/.env`)

```env
CRON_SLA_BREACH_CHECK=*/15 * * * *          # Every 15 minutes
CRON_AGENT_AVAILABILITY_UPDATE=0 0 * * *    # Daily at midnight
CRON_AUTO_CLOSE_RESOLVED=0 2 * * *          # Daily at 2 AM
AUTO_CLOSE_RESOLVED_DAYS=7                  # Days before auto-close
```

### Email Notifications (placeholder, future integration)

```env
# SendGrid
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_key
EMAIL_FROM=support@yourdomain.com

# AWS SES
EMAIL_SERVICE=aws-ses
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
EMAIL_FROM=support@yourdomain.com
```

## Testing Checklist

### Prerequisites

1. Run `pnpm db:seed` in `packages/db-unlistedstock` (creates 2 support agents)
2. Start all services: `pnpm dev` (or individually: auth-service, stocks-service, ticketing-service, web)
3. Verify databases: `db-unlistedstock` (admins), `db-ticketing` (tickets)

### Test Scenarios

####  Scenario 1: User Creates Ticket → Auto-Assignment

1. Login as user at `/login` (use existing user or create one)
2. Navigate to `/dashboard/support` → "Create Ticket"
3. Fill form: Title, Description, Priority (urgent/high/medium/low), Category
4. Submit → Check console logs in `ticketing-service`:
   - `🔄 Auto-assigning ticket {id} using strategy: round-robin`
   - ` Assigned ticket {id} to agent {agentId}`
5. Verify in database: `ticket.assignedTo` = agent ID, `admin.activeTicketCount` incremented
6. **Expected:** Ticket auto-assigned to `supportagent@test.com` (first available agent)

####  Scenario 2: Agent Resolves Ticket → User Notification

1. Login as `supportagent@test.com` / `agent123` at `/support/login`
2. Navigate to `/support/tickets` → "My Tickets" tab
3. Click on assigned ticket → "Resolve" button
4. Confirm resolution → Check console logs:
   - `📧 Resolution Email - Ticket #{id}`
5. Verify in database: `ticket.status='resolved'`, `ticket.resolvedAt` set, `ticket.resolvedBy` = agent ID
6. **Expected:** Ticket marked resolved, user would receive email (placeholder logs)

####  Scenario 3: User Reopens Ticket → Agent Notification

1. As user, navigate to resolved ticket → "Reopen" button
2. Enter reopen reason → Submit
3. Check console logs:
   - `📧 Reopen Notification - Ticket #{id}`
4. Verify: `ticket.status='open'`, `ticket.reopenCount=1`, `ticket.resolvedAt=null`
5. Reopen 2 more times (total 3) → Check for auto-escalation:
   - `🔄 Ticket {id} reached 3rd reopen, auto-escalating`
   - `ticket.status='escalated'`, `ticket.escalatedTo` = Super Admin ID
6. **Expected:** First 2 reopens notify agent, 3rd triggers escalation

####  Scenario 4: SLA Breach → Admin Escalation

1. Create ticket with priority='urgent' (4h SLA)
2. Wait 4+ hours OR manually update `ticket.dueDate` to past date in database
3. Wait for cron job (runs every 15 min) OR manually trigger:
   - In `ticketing-service`, call `SchedulerService.checkSlaBreaches()` via debugger/test
4. Check console logs:
   - `🔍 [CRON] Starting SLA breach check...`
   - ` [CRON] Escalated 1 tickets`
   - `📧 Escalation Email - Ticket #{id}`
5. Verify: `ticket.status='escalated'`, `ticket.escalatedAt` set, `ticket.escalatedTo` = Super Admin
6. **Expected:** Overdue ticket auto-escalated, Super Admin notified

####  Scenario 5: Admin Manual Assignment → Confirmation

1. Login as `superadmin@test.com` / `admin123` at `/admin/login`
2. Navigate to `/admin/support-tickets` → "All" tab
3. Select unassigned or assigned ticket → "Assign" button
4. `TicketAssignmentDialog` opens:
   - Shows agent list with availability badges (🟢 Available, 🟡 Busy, 🔴 Unavailable)
   - Shows active ticket count per agent
   - Warning if agent has >15 tickets: "⚠️ Agent has high workload"
5. Select agent → "Confirm Assignment"
6. Verify: `ticket.assignedTo` updated, previous agent's count decremented, new agent's incremented
7. **Expected:** Ticket reassigned with confirmation, workload warnings shown

####  Scenario 6: Support Agent Login → Panel Access

1. Navigate to `/support/login`
2. Enter `supportagent@test.com` / `agent123`
3. Submit → Redirected to `/support/dashboard`
4. Verify:
   - Dashboard shows KPI cards (Total Tickets, Open, Resolved Today, SLA Compliance, Avg Resolution Time)
   - Charts render (Tickets by Status pie, by Priority bar, Resolution Trend line)
   - Sidebar shows: Dashboard, My Tickets, All Tickets (if has `view_all_tickets`), Escalated
5. Try accessing `/admin` → Redirected to `/support/dashboard` (middleware blocks)
6. **Expected:** Support Agent can only access Support Panel, not Admin Panel

####  Scenario 7: Admin Creates Support Agent → Permissions Applied

1. As Super Admin, navigate to `/admin/support-agents` → "Create Support Agent"
2. Fill form:
   - Email: `testagent@test.com`
   - Full Name: `Test Agent`
   - Password: `test123`
   - Permissions: Check `view_tickets`, `update_ticket_status`, `add_internal_notes` (leave `escalate_tickets` unchecked)
3. Submit → Verify in database: `admin.role='SUPPORT_AGENT'`, `admin.permissions=['view_tickets', 'update_ticket_status', 'add_internal_notes']`
4. Login as `testagent@test.com` at `/support/login`
5. Navigate to `/support/tickets` → Open ticket details
6. Verify UI:
   - "Resolve" button visible (has `update_ticket_status`)
   - "Escalate" button **hidden** (lacks `escalate_tickets`)
   - "Add Internal Note" visible (has `add_internal_notes`)
7. **Expected:** Permission-based UI rendering works, junior agent cannot escalate

## Troubleshooting

### Issue: 401 Unauthorized on Support Dashboard

- **Cause:** `support_panel_token` cookie not sent to ticketing-service (cross-port)
- **Fix:** Implemented in T17 - frontend extracts token from cookie, sends in `Authorization: Bearer` header
- **Verify:** Check Network tab in DevTools → `/tickets/stats` request has `Authorization` header

### Issue: Support Agent has empty permissions, cannot do anything

- **Cause:** Seed script intentionally left permissions empty per Zero Trust policy
- **Fix:** Run updated seed script (this ticket) to create agents with proper permissions
- **Verify:** Check Prisma Studio → `Admin` table → `supportagent@test.com` has `permissions` array with 7 items

### Issue: Tickets not auto-assigning

- **Cause:** No available agents (all marked `unavailable` or `busy`)
- **Fix:** Update agent availability via `/admin/support-agents` → toggle to "Available"
- **Verify:** Check `admin.availability='available'` in database

### Issue: SLA escalation not happening

- **Cause:** Cron job not running or `dueDate` not set
- **Fix:** Check `ticketing-service` logs for ` [CRON] Scheduler jobs registered`. Verify `ticket.dueDate` is in the past.
- **Verify:** Manually trigger `SchedulerService.checkSlaBreaches()` via debugger

### Issue: "Escalate" button visible for junior agent

- **Cause:** Frontend permission check missing or incorrect
- **Fix:** Verify `useSupportAuth()` returns correct permissions, check `canEscalate` logic in `SupportTicketDetailsDialog`
- **Verify:** Login as `juniorsupport@test.com`, open ticket, button should be hidden

### Issue: Agent's activeTicketCount incorrect

- **Cause:** Ticket closed/resolved without calling `unassignTicket()`
- **Fix:** Ensure `rateTicket()` and auto-close cron call `AssignmentService.unassignTicket()`
- **Verify:** Check `ticket.service.ts` lines 742, 180 - both call `unassignTicket()`

## Future Enhancements

- **Email Integration:** Replace `NotificationService` console logs with SendGrid/AWS SES
- **Real-time Updates:** Add WebSocket for live ticket updates in Support Panel
- **Advanced Analytics:** Agent performance metrics (avg resolution time, satisfaction ratings)
- **Multi-language Support:** i18n for ticket categories, statuses
- **File Attachments in Comments:** Extend comment model to support uploads
- **Ticket Templates:** Pre-filled forms for common issues
- **Knowledge Base Integration:** Link tickets to help articles
- **Slack/Teams Integration:** Notifications via chat platforms

## Seed Data Reference

### Super Admin

- Email: `superadmin@test.com`
- Password: `admin123`
- Role: `SUPER_ADMIN`
- Permissions: All (22 permissions)
- Access: Admin Panel, CMS Panel, Support Panel

### Senior Support Agent

- Email: `supportagent@test.com`
- Password: `agent123`
- Role: `SUPPORT_AGENT`
- Permissions: `view_tickets`, `update_ticket_status`, `assign_tickets`, `add_internal_notes`, `escalate_tickets`, `view_ticket_history`, `view_all_tickets`
- Access: Support Panel only

### Junior Support Agent

- Email: `juniorsupport@test.com`
- Password: `junior123`
- Role: `SUPPORT_AGENT`
- Permissions: `view_tickets`, `update_ticket_status`, `add_internal_notes`, `view_ticket_history` (no escalate, assign, or view_all)
- Access: Support Panel only (limited features)

## Related Documentation

- `AUTHENTICATION_TESTING_GUIDE.md` - Panel authentication system
- `PHASE5_AUTHENTICATION_FIXES.md` - Auth implementation details
- `apps/ticketing-service/README.md` - Service-specific setup
- `packages/db-ticketing/prisma/schema.prisma` - Ticket database schema
- `packages/db-unlistedstock/prisma/schema.prisma` - Admin database schema