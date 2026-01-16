/**
 * Utility functions for detecting and handling booking currency
 * This ensures consistent currency detection across all pages
 */

/**
 * Detect the original currency of a booking
 * @param {Object} booking - The booking object
 * @param {Object} exchangeRates - Exchange rates object (e.g., { USD: 50, EUR: 54 })
 * @returns {Object} { currency: string, value: number } - Original currency and value
 */
export const detectBookingOriginalCurrency = (booking, exchangeRates = { USD: 50 }) => {
  if (!booking) {
    return { currency: 'EGP', value: 0, originalCurrency: 'EGP' }
  }

  const usdRate = exchangeRates.USD || 50

  // Priority 1: If totalBookingPriceCurrency exists, use it (most reliable)
  if (booking.totalBookingPriceCurrency) {
    const value = typeof booking.totalBookingPrice === 'number'
      ? booking.totalBookingPrice
      : (parseFloat(booking.totalBookingPrice || booking.totalAmount || 0) || 0)
    return { currency: booking.totalBookingPriceCurrency, value, originalCurrency: booking.totalBookingPriceCurrency }
  }

  // Priority 2: Check if totalAmountUSD exists and is different from totalBookingPrice
  const hasTotalAmountUSD = booking.totalAmountUSD !== undefined && booking.totalAmountUSD !== null
  const totalBookingPriceValue = typeof booking.totalBookingPrice === 'number'
    ? booking.totalBookingPrice
    : (parseFloat(booking.totalBookingPrice || booking.totalAmount || 0) || 0)
  const totalAmountUSDValue = booking.totalAmountUSD || 0

  // If totalAmountUSD exists and is significantly different from totalBookingPrice,
  // it means totalBookingPrice is in a different currency
  if (hasTotalAmountUSD && totalAmountUSDValue > 0) {
    // If they're equal or very close (within 0.01), it was saved in USD
    if (Math.abs(totalAmountUSDValue - totalBookingPriceValue) < 0.01) {
      return { currency: 'USD', value: totalAmountUSDValue, originalCurrency: 'USD' }
    }

    // If totalBookingPrice is very small (< 1) and totalAmountUSD is reasonable (>= 1),
    // it's likely that totalBookingPrice was incorrectly saved in EGP but should be USD
    if (totalBookingPriceValue < 1 && totalAmountUSDValue >= 1) {
      console.warn(`[Currency Detection] Booking ${booking._id || booking.id} has small totalBookingPrice (${totalBookingPriceValue}) but reasonable totalAmountUSD (${totalAmountUSDValue}), assuming USD`)
      return { currency: 'USD', value: totalAmountUSDValue, originalCurrency: 'USD' }
    }

    // If totalBookingPrice is large and totalAmountUSD is different,
    // calculate which currency makes sense
    // If totalBookingPrice / usdRate ≈ totalAmountUSD, then totalBookingPrice is in EGP
    const calculatedUSD = totalBookingPriceValue / usdRate
    if (Math.abs(calculatedUSD - totalAmountUSDValue) < 0.01) {
      return { currency: 'EGP', value: totalBookingPriceValue, originalCurrency: 'EGP' }
    }

    // Otherwise, if totalAmountUSD exists and is reasonable, use it as USD
    if (totalAmountUSDValue >= 1) {
      return { currency: 'USD', value: totalAmountUSDValue, originalCurrency: 'USD' }
    }
  }

  // Priority 3: Check booking.currency field
  const bookingCurrency = booking.currency || 'USD'
  if (bookingCurrency && bookingCurrency !== 'USD') {
    // If currency is not USD and value is reasonable, use it
    if (totalBookingPriceValue > 0) {
      return { currency: bookingCurrency, value: totalBookingPriceValue, originalCurrency: bookingCurrency }
    }
  }

  // Priority 4: If currency is USD and value is reasonable (> 1), it's USD
  if (bookingCurrency === 'USD' && totalBookingPriceValue >= 1) {
    return { currency: 'USD', value: totalBookingPriceValue, originalCurrency: 'USD' }
  }

  // Priority 5: If value is very small (< 1), it might be old format in USD
  // But we need to check if it makes sense as EGP
  if (totalBookingPriceValue > 0 && totalBookingPriceValue < 1) {
    // Very small values are likely in USD (old format)
    if (hasTotalAmountUSD && totalAmountUSDValue > 1) {
      console.warn(`[Currency Detection] Booking ${booking._id || booking.id} has very small totalBookingPrice (${totalBookingPriceValue}), using totalAmountUSD (${totalAmountUSDValue}) as USD`)
      return { currency: 'USD', value: totalAmountUSDValue, originalCurrency: 'USD' }
    }
    // Otherwise, assume it's EGP (very small amount)
    return { currency: 'EGP', value: totalBookingPriceValue, originalCurrency: 'EGP' }
  }

  // Default: EGP for new bookings or if we can't determine
  // Log warning for old bookings without currency info
  if (!hasTotalAmountUSD && totalBookingPriceValue > 0) {
    console.warn(`[Currency Detection] Booking ${booking._id || booking.id} (${booking.guestName || 'Unknown'}) missing currency info, defaulting to EGP. Value: ${totalBookingPriceValue}`)
  }
  return { currency: 'EGP', value: totalBookingPriceValue || 0, originalCurrency: 'EGP' }
}

/**
 * Convert booking amount to USD
 * @param {Object} booking - The booking object
 * @param {Object} exchangeRates - Exchange rates object (used as fallback if booking doesn't have locked rate)
 * @returns {number} Amount in USD
 */
export const getBookingAmountInUSD = (booking, exchangeRates = { USD: 50 }) => {
  const { currency, value } = detectBookingOriginalCurrency(booking, exchangeRates)

  if (!value || value === 0) return 0
  if (currency === 'USD') return value

  // IMPORTANT: Use locked exchange rate from booking if available (preserves booking value regardless of current rates)
  // If booking has exchangeRateAtBooking, use it instead of current exchange rates
  const lockedRates = booking.exchangeRateAtBooking || {}
  const usdRate = lockedRates.USD || exchangeRates.USD || 50

  // Convert from currency to USD using locked rate if available
  if (currency === 'EGP') {
    // Use locked EGP rate if available, otherwise use current rate
    const egpToUsdRate = lockedRates.USD || exchangeRates.USD || 50
    return value / egpToUsdRate
  }

  // For other currencies, convert via EGP using locked rates if available
  const currencyRate = lockedRates[currency] || exchangeRates[currency] || usdRate
  const amountInEGP = value * currencyRate
  return amountInEGP / usdRate
}

/**
 * Convert booking paid amount to USD
 * @param {Object} booking - The booking object
 * @param {Object} exchangeRates - Exchange rates object (used as fallback if booking doesn't have locked rate)
 * @returns {number} Paid amount in USD
 */
export const getBookingPaidAmountInUSD = (booking, exchangeRates = { USD: 50 }) => {
  if (!booking) return 0

  // Get total booking amount first to cap paid amount (uses locked rate if available)
  const bookingTotalUSD = getBookingAmountInUSD(booking, exchangeRates)

  // IMPORTANT: Use locked exchange rate from booking if available
  const lockedRates = booking.exchangeRateAtBooking || {}
  const usdRate = lockedRates.USD || exchangeRates.USD || 50

  // New format: paidAmount is already in USD
  if (booking.paidAmount !== undefined) {
    const paidAmount = typeof booking.paidAmount === 'number'
      ? booking.paidAmount
      : (parseFloat(booking.paidAmount || 0) || 0)

    // If paidAmount is very small and we have payments array, calculate from payments
    if (paidAmount < 0.01 && booking.payments && Array.isArray(booking.payments) && booking.payments.length > 0) {
      const calculatedPaid = booking.payments.reduce((sum, payment) => {
        if (!payment || !payment.amount) return sum
        const paymentAmount = parseFloat(payment.amount) || 0
        const paymentCurrency = payment.currency || 'EGP'

        if (paymentCurrency === 'USD') return sum + paymentAmount

        // Use locked rate for payment currency if available
        const paymentUsdRate = lockedRates.USD || exchangeRates.USD || 50
        if (paymentCurrency === 'EGP') {
          return sum + (paymentAmount / paymentUsdRate)
        }

        const currencyRate = lockedRates[paymentCurrency] || exchangeRates[paymentCurrency] || paymentUsdRate
        const amountInEGP = paymentAmount * currencyRate
        return sum + (amountInEGP / paymentUsdRate)
      }, 0)

      // Cap calculated paid amount at total booking amount
      return Math.min(calculatedPaid, bookingTotalUSD)
    }

    // Cap paid amount at total booking amount
    return Math.min(paidAmount, bookingTotalUSD)
  }

  // Old format: might need conversion using locked rates
  const bookingCurrency = booking.totalBookingPriceCurrency || booking.currency || 'USD'
  const paidRaw = typeof booking.paidAmount === 'number'
    ? booking.paidAmount
    : (parseFloat(booking.paidAmount || 0) || 0)

  if (!paidRaw || paidRaw === 0) return 0

  let paidAmountUSD = 0
  if (bookingCurrency === 'USD') {
    paidAmountUSD = paidRaw
  } else if (bookingCurrency === 'EGP') {
    // Use locked rate if available
    paidAmountUSD = paidRaw / usdRate
  } else {
    const currencyRate = lockedRates[bookingCurrency] || exchangeRates[bookingCurrency] || usdRate
    const amountInEGP = paidRaw * currencyRate
    paidAmountUSD = amountInEGP / usdRate
  }

  // IMPORTANT: Cap paid amount at total booking amount to prevent data inconsistencies
  return Math.min(paidAmountUSD, bookingTotalUSD)
}

