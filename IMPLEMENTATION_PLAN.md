# Implementation Plan: Three-Module Enhancement

## Module 1: Smart "Guest Origin" & Internal Transfers Logic

### 1.1 Database Schema Updates
- Add fields to bookings:
  - `originType`: 'external' | 'internal_transfer'
  - `originApartmentId`: string (if internal_transfer)
  - `originRoomId`: string (if internal_transfer)
  - `transferCommissionAmount`: number (commission deducted from transfer)
  - `transferFromBookingId`: string (reference to original booking)

### 1.2 UI Updates (Bookings.jsx)
- Replace text input for `guestOrigin` with dropdown/select
- Options:
  - External: List of countries/cities (free text with suggestions)
  - Internal: "Transfer from [Apartment Name] - Room [Room Number]" (from existing bookings)
- Same for `guestDestination`
- Add logic to detect when origin is an internal transfer
- Show transfer commission warning when applicable

### 1.3 Backend Logic (main.js)
- In POST /api/bookings:
  - If originType is 'internal_transfer' and source is platform:
    - Find original booking (from originApartmentId/roomId)
    - Calculate commission from original booking
    - Store as transferCommissionAmount
    - Deduct from A2's revenue as transfer expense

## Module 2: Temporal Commission Deduction (Month-End Logic)

### 2.1 Database Schema
- Add to bookings:
  - `commissionStatus`: 'pending' | 'applied' | 'deferred'
  - `commissionAppliedDate`: date (when commission was deducted)

### 2.2 Financial Calculation Updates
- Update `/api/financial/*` endpoints:
  - Filter bookings by checkout date, not check-in date
  - Only deduct commission if `checkOut <= monthEnd`
  - Mark commission as 'pending' if booking is ongoing
  - Mark as 'applied' when checkout date passes

### 2.3 Cross-Month Booking Handling
- Split revenue by nights per month
- Apply full commission in checkout month only
- Update financial reports to show:
  - Revenue by month
  - Commission status per booking

## Module 3: Hierarchical Partner Profit Distribution

### 3.1 Database Schema
- Add to partners:
  - `type`: 'investor' | 'company_owner' (default: 'investor')

### 3.2 UI Updates (Partners.jsx)
- Add dropdown in Add/Edit Partner form:
  - Partner Type: Investor / Company Owner
- Display type in partner list

### 3.3 Profit Distribution Logic
- Step 1: Calculate Net Operating Profit
  - Total Revenue - Expenses (Maintenance, Electricity, Commissions) = Net Profit
  
- Step 2: Distribute to Investors
  - If apartment has partners with type='investor':
    - Calculate their share from Net Operating Profit
    - Deduct from Net Profit
  
- Step 3: Company Share
  - Remaining = Company's Profit
  
- Step 4: Distribute to Company Owners
  - Split Company Profit among company_owner partners
  - NOT from operating profit directly

### 3.4 Financial API Updates
- Update `/api/financial/*` to:
  - Calculate per apartment
  - Apply investor distribution first
  - Calculate company profit
  - Distribute to company owners
  - Update dashboard to show company owners' combined share as "Hostel Egypt" revenue

---

## Implementation Order

1. **Module 3.1 & 3.2** - Partner type field (simplest, no dependencies)
2. **Module 1.1** - Database schema for transfers
3. **Module 1.2** - UI for transfer selection
4. **Module 1.3** - Transfer commission logic
5. **Module 2.1 & 2.2** - Commission date logic
6. **Module 3.3 & 3.4** - Profit distribution logic

---

## File Changes Summary

### Backend (electron/main.js)
- Update database schema initialization
- Update booking creation logic (transfer detection)
- Update financial calculation endpoints
- Add profit distribution functions

### Frontend
- `Bookings.jsx`: Update origin/destination to dropdown with transfer options
- `Partners.jsx`: Add partner type selector
- `Financial.jsx`: Display new profit distribution structure

---

## Testing Checklist
- [ ] Internal transfer booking creates commission expense
- [ ] Commission deducted only on checkout month
- [ ] Cross-month bookings split correctly
- [ ] Investor partners get share from net profit
- [ ] Company owners get share from company profit
- [ ] Financial reports show correct distributions
