# QA Testing Guide - Development Fund Integration

## ⚠️ CRITICAL ISSUE FIXED: Edit Booking Logic

**Issue Found:** When editing a booking and changing the Development Deduction, the system was not updating the fund transaction correctly.

**Fix Applied:** The backend now:
1. Finds the existing fund transaction linked to the booking
2. Calculates the difference between old and new deduction amounts
3. Updates the existing transaction (not creating duplicates)
4. Handles edge cases (deduction removed, new deduction added to booking without one)

---

## 🧪 Test Scenarios

### Test 1: The "Inflow" Test ✅

**Steps:**
1. Open the booking modal (`/bookings` → "إضافة حجز جديد")
2. Fill in required fields (apartment, room, guest, dates)
3. Set **Total Booking Price**: $500
4. Set **Development Deduction Type**: "Fixed"
5. Set **Development Deduction Value**: 2500 (EGP)
6. Verify the **"Development Deduction (USD)"** field shows: ~$50.00 (if exchange rate is 50)
7. Check **Estimated Net Profit** calculation
8. Click "حفظ"

**Expected Results:**
- ✅ Booking is saved successfully
- ✅ Development Fund balance increases by ~$50
- ✅ New transaction appears in `/fund` page
- ✅ Transaction type is "إيداع" (Deposit)
- ✅ Transaction description includes booking ID
- ✅ Transaction is marked as "تلقائي" (System Generated)

**Console Output to Check:**
```
API Request: POST /api/bookings
✅ Fund transaction created: deposit $50.00
```

---

### Test 2: The "Calculation" Test ✅

**Steps:**
1. Open booking modal
2. Fill basic booking info
3. Set **Total Booking Price**: $1000
4. Set **Platform Commission**: $150 (15%)
5. Set **Development Deduction Type**: "Percent"
6. Set **Development Deduction Value**: 5 (%)

**Expected Results in "Estimated Net Profit" section:**
- ✅ **إجمالي الحجز**: $1000.00
- ✅ **- عمولة المنصة**: -$150.00
- ✅ **- صندوق التطوير**: -$50.00 (5% of $1000)
- ✅ **= المبلغ القابل للتوزيع**: $800.00
- ✅ **- نصيب الشركاء**: [Calculated based on apartment partners]
- ✅ **= صافي الربح المتوقع**: [Distributable - Partner Share]

**Formula Verification:**
```
Final Distributable = Total - Platform Commission - Development Deduction
Net Profit = Final Distributable - Partner Share (Owner Amount)
```

**Test Edge Cases:**
- Change deduction type (None → Percent → Fixed) - values should recalculate
- Change total booking price - development deduction should update accordingly
- Change exchange rate - fixed amount deduction should convert correctly

---

### Test 3: The "Outflow" Test ✅

**Steps:**
1. Go to `/fund` page
2. Note the current balance
3. Click **"سحب سريع"** (Quick Withdraw)
4. Enter:
   - **Amount (USD)**: $25
   - **Amount (EGP)**: Should auto-calculate (or manually enter 1250)
   - **Description**: "صيانة الشقة - إصلاح التكييف"
5. Click **"تأكيد السحب"**

**Expected Results:**
- ✅ Balance decreases by $25
- ✅ New transaction appears with type "سحب" (Withdrawal)
- ✅ Transaction is marked as "يدوي" (Manual)
- ✅ Description is saved correctly

**Test Negative Balance:**
1. Try to withdraw more than current balance
2. Expected: Warning message appears
3. Expected: Transaction is still created (allows debt tracking)
4. Expected: Balance shows as negative (red card)

---

### Test 4: The "Edit" Test ⚠️ **CRITICAL - NOW FIXED**

**Steps:**
1. Create a booking with Development Deduction:
   - Total: $500
   - Dev Deduction: Fixed 2500 EGP (~$50)
2. Verify fund balance increased by $50
3. Go back to bookings list
4. Click **Edit** on the booking you just created
5. Change Development Deduction to:
   - **Type**: Percent
   - **Value**: 10 (%)
   - This should be ~$50 (10% of $500)
6. Click **"حفظ"**

**Expected Results (After Fix):**
- ✅ Booking is updated successfully
- ✅ **Fund balance should NOT double** (should stay at same amount or adjust correctly)
- ✅ **Only ONE transaction exists** for this booking in fund table
- ✅ If deduction increased: Transaction amount should be updated to new value
- ✅ If deduction decreased: Transaction amount should be decreased accordingly
- ✅ If deduction removed (set to None): Old deposit should be reversed (or transaction deleted/updated)

**Before Fix (What Was Wrong):**
- ❌ System would create a NEW transaction, causing duplicate entries
- ❌ Fund balance would incorrectly increase by the new amount without adjusting for old amount

**After Fix:**
- ✅ System finds existing transaction and updates it
- ✅ Balance reflects the correct change (difference only)

**Additional Test Cases for Edit:**
1. **No Deduction → Add Deduction**: Should create new transaction
2. **Deduction → Remove Deduction**: Should reverse/delete transaction
3. **Fixed → Percent** (with different value): Should update transaction amount
4. **Percent → Fixed**: Should recalculate and update transaction

---

## 🔍 What to Check in Browser Console

**During All Tests, Monitor:**

```javascript
// 1. API Requests
API Request: POST /api/bookings
API Request: PUT /api/bookings/:id
API Request: GET /api/fund/balance
API Request: GET /api/fund/transactions
API Request: POST /api/fund/withdraw

// 2. Error Messages (if any)
Error response: 400 / 500
Error fetching fund data

// 3. Calculations (check Network tab → Response)
{
  "balance": 50.00,
  "balanceEGP": 2500.00,
  "transactionCount": 1
}
```

---

## 📊 Data Integrity Checks

### Check Database Directly (if possible):
1. Open JSON database file
2. Verify `fundTransactions` collection:
   - Each booking should have at most ONE deposit transaction
   - Transaction `bookingId` should match booking `_id`
   - Transaction `amount` should match booking `developmentDeduction`

### Check Fund Balance Formula:
```
Balance = SUM(deposits) - SUM(withdrawals)
```

Verify this matches what's shown on `/fund` page.

---

## ⚠️ Known Issues / Notes

1. **Exchange Rate**: Fixed amounts are assumed to be in EGP and converted using the booking's exchange rate. Make sure exchange rate is set correctly.

2. **Rounding**: Small differences (< $0.01) might occur due to floating point arithmetic. System uses 0.01 threshold for "meaningful difference."

3. **Edit Booking Edge Case**: If you edit a booking and change the apartment, the fund transaction still references the original apartment. This is intentional (historical accuracy).

---

## ✅ Success Criteria

All tests pass if:
- ✅ No duplicate fund transactions for same booking
- ✅ Fund balance always accurate (deposits - withdrawals)
- ✅ Real-time calculations in booking modal are correct
- ✅ Edit booking correctly updates fund transaction
- ✅ Negative balance tracking works correctly
- ✅ All transactions visible in `/fund` table

---

## 🐛 Reporting Issues

If you find any issues, note:
1. **Test Number**: Which test failed?
2. **Steps to Reproduce**: Exact steps you took
3. **Expected vs Actual**: What should happen vs what happened
4. **Console Errors**: Any error messages in browser console
5. **API Response**: Check Network tab for API responses

---

## 🚀 Ready for Testing

**Status**: ✅ **READY**

All critical logic has been implemented and the Edit Booking issue has been fixed. You can now proceed with testing all 4 scenarios.

**Next Steps After Testing:**
- If all tests pass → Proceed to Phase 3 (Inventory)
- If issues found → Fix immediately before moving forward

