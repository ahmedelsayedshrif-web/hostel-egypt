/**
 * Calculate partner profits using Waterfall logic
 * 
 * Waterfall Distribution:
 * 1. Operating Profit = Revenue - Expenses - Commissions
 * 2. Investor Share = Operating Profit × (investor.percentage / 100)
 * 3. Company Profit = Operating Profit - SUM(Investor Shares)
 * 4. Company Owner Share = Company Profit × (companyOwner.percentage / 100)
 */

/**
 * Calculate partner profits for bookings using Waterfall logic
 * 
 * @param {Array} bookings - Array of bookings
 * @param {Array} apartments - Array of apartments with partners
 * @param {Array} expenses - Array of expenses
 * @param {Object} exchangeRates - Exchange rates object (e.g., { USD: 50, EUR: 54 })
 * @param {Function} convertToUSD - Function to convert amount to USD
 * @returns {Object} Object with partnerProfits array and summary
 */
export const calculateWaterfallPartnerProfits = (
    bookings,
    apartments,
    expenses = [],
    exchangeRates = {},
    convertToUSD = (amount, currency) => amount
) => {
    const partnerProfitsMap = {}

    // First, initialize all partners from apartments (even without bookings)
    // This ensures all partners are included in the result, even if they have no earnings
    apartments.forEach(apt => {
        if (!apt || !apt.partners || !Array.isArray(apt.partners) || apt.partners.length === 0) {
            return
        }

        const allPartners = apt.partners.filter(p => (p.percentage || 0) > 0)
        allPartners.forEach(partner => {
            // Normalize partner key: trim whitespace and use lowercase for consistent matching
            const partnerName = (partner.name || '').trim()
            const partnerKey = partnerName || partner.partnerId || partner.owner || 'unknown'
            // Use normalized name as key to ensure same partners are grouped together
            const normalizedKey = partnerKey.toLowerCase().trim()

            if (!partnerProfitsMap[normalizedKey]) {
                partnerProfitsMap[normalizedKey] = {
                    partnerId: partner.partnerId || partner.owner || normalizedKey,
                    name: partnerName || normalizedKey, // Use original name for display
                    amount: 0,
                    bookingsCount: 0,
                    percentage: partner.percentage || 0, // This will be overwritten by actual percentages from apartments
                    type: partner.type || 'investor',
                    apartments: [] // Array to store apartment info with percentages
                }
            }
            // Add apartment info with percentage for this partner
            if (!partnerProfitsMap[normalizedKey].apartments.find(a => a.id === (apt._id || apt.id))) {
                partnerProfitsMap[normalizedKey].apartments.push({
                    id: apt._id || apt.id,
                    name: apt.name || 'شقة غير محددة',
                    percentage: partner.percentage || 0
                })
            }
        })
    })

    // Group bookings by apartment
    const bookingsByApartment = {}
    bookings.forEach(booking => {
        const aptId = booking.apartment?._id || booking.apartment?.id || booking.apartment
        if (!aptId) return

        if (!bookingsByApartment[aptId]) {
            bookingsByApartment[aptId] = []
        }
        bookingsByApartment[aptId].push(booking)
    })

    // Calculate for each apartment with bookings
    Object.keys(bookingsByApartment).forEach(aptId => {
        const apt = apartments.find(a => (a._id || a.id) === aptId)
        if (!apt || !apt.partners || !Array.isArray(apt.partners) || apt.partners.length === 0) {
            return
        }

        const apartmentBookings = bookingsByApartment[aptId]

        // Calculate total revenue for apartment (in USD)
        let apartmentRevenue = 0
        let apartmentPlatformCommission = 0
        let apartmentTransferCommission = 0

        apartmentBookings.forEach(booking => {
            const bookingCurrency = booking.totalBookingPriceCurrency || booking.currency || 'USD'
            const totalRaw = booking.totalBookingPrice || booking.totalAmountUSD || booking.totalAmount || 0
            const revenueUSD = convertToUSD(totalRaw, bookingCurrency)
            apartmentRevenue += revenueUSD

            // Platform commission (Re-introduced as per user request to keep 'as is')
            const platformCommissionRaw = booking.platformCommission || 0
            const platformCommissionUSD = convertToUSD(platformCommissionRaw, bookingCurrency)
            apartmentPlatformCommission += platformCommissionUSD

            // Transfer commission (keep this as it's a real expense)
            const transferCommissionRaw = booking.transferCommissionAmount || booking.transferCommissionExpense || 0
            const transferCommissionUSD = convertToUSD(transferCommissionRaw, bookingCurrency)
            apartmentTransferCommission += transferCommissionUSD
        })

        // Calculate total expenses for apartment (in USD)
        let apartmentExpenses = 0

        // Monthly expenses
        if (apt.monthlyExpenses && Array.isArray(apt.monthlyExpenses)) {
            apt.monthlyExpenses.forEach(exp => {
                const expenseAmountEGP = exp.amount || 0
                const usdRate = exchangeRates.USD || 50
                apartmentExpenses += expenseAmountEGP / usdRate
            })
        }

        // Individual expenses
        expenses.forEach(exp => {
            const expAptId = exp.apartment?._id || exp.apartment?.id || exp.apartment
            if (expAptId === aptId) {
                const expenseAmount = exp.amount || 0
                const expenseCurrency = exp.currency || 'EGP'
                const expenseUSD = convertToUSD(expenseAmount, expenseCurrency)
                apartmentExpenses += expenseUSD
            }
        })

        // Step 1: Calculate Operating Profit (Revenue - Platform Commission - Transfer Commission - Expenses)
        // Platform commission is deducted as requested
        const operatingProfit = apartmentRevenue - apartmentPlatformCommission - apartmentTransferCommission - apartmentExpenses

        // Separate partners into investors and company owners
        const investors = apt.partners.filter(p => (p.type || 'investor') === 'investor' && (p.percentage || 0) > 0)
        const companyOwners = apt.partners.filter(p => (p.type || 'investor') === 'company_owner' && (p.percentage || 0) > 0)

        // Step 2: Calculate Investor Shares (from Operating Profit)
        // IMPORTANT: Partner shares cannot be negative - if Operating Profit is negative, partners get 0
        let totalInvestorShares = 0
        investors.forEach(investor => {
            const investorShare = operatingProfit > 0
                ? operatingProfit * ((investor.percentage || 0) / 100)
                : 0 // Partners cannot have negative shares
            totalInvestorShares += investorShare

            // IMPORTANT: Use normalized name as primary key for consistent matching across all pages
            // Normalize partner key: trim whitespace and use lowercase for consistent matching
            const investorName = (investor.name || '').trim()
            const partnerKey = investorName || investor.partnerId || investor.owner || 'unknown'
            const normalizedKey = partnerKey.toLowerCase().trim()

            if (!partnerProfitsMap[normalizedKey]) {
                partnerProfitsMap[normalizedKey] = {
                    partnerId: investor.partnerId || investor.owner || normalizedKey,
                    name: investorName || normalizedKey, // Use original name for display
                    amount: 0,
                    bookingsCount: 0,
                    percentage: investor.percentage || 0,
                    type: 'investor',
                    apartments: []
                }
            }
            // Add apartment info with percentage for this partner
            if (!partnerProfitsMap[normalizedKey].apartments.find(a => a.id === (apt._id || apt.id))) {
                partnerProfitsMap[normalizedKey].apartments.push({
                    id: apt._id || apt.id,
                    name: apt.name || 'شقة غير محددة',
                    percentage: investor.percentage || 0
                })
            }

            // Add investor share to partner profits
            partnerProfitsMap[normalizedKey].amount += investorShare
            // Only count bookings if there are actual bookings for this apartment
            if (apartmentBookings.length > 0) {
                partnerProfitsMap[normalizedKey].bookingsCount += apartmentBookings.length
            }
        })

        // Step 3: Calculate Company Profit
        // IMPORTANT: Company Profit cannot be negative - if Operating Profit is negative, Company Profit is 0
        const companyProfit = Math.max(0, operatingProfit - totalInvestorShares)

        // Step 4: Calculate Company Owner Shares (from Company Profit)
        // Calculate total company owner percentage
        const totalCompanyOwnerPercentage = companyOwners.reduce((sum, co) => sum + (co.percentage || 0), 0)

        // IMPORTANT: Company owners only get shares if Company Profit is positive
        if (totalCompanyOwnerPercentage > 0 && companyProfit > 0) {
            companyOwners.forEach(companyOwner => {
                // Each company owner gets their percentage of company profit
                const companyOwnerShare = companyProfit * ((companyOwner.percentage || 0) / 100)

                // IMPORTANT: Use normalized name as primary key for consistent matching across all pages
                // Normalize partner key: trim whitespace and use lowercase for consistent matching
                const companyOwnerName = (companyOwner.name || '').trim()
                const partnerKey = companyOwnerName || companyOwner.partnerId || companyOwner.owner || 'unknown'
                const normalizedKey = partnerKey.toLowerCase().trim()

                if (!partnerProfitsMap[normalizedKey]) {
                    partnerProfitsMap[normalizedKey] = {
                        partnerId: companyOwner.partnerId || companyOwner.owner || normalizedKey,
                        name: companyOwnerName || normalizedKey, // Use original name for display
                        amount: 0,
                        bookingsCount: 0,
                        percentage: companyOwner.percentage || 0,
                        type: 'company_owner',
                        apartments: []
                    }
                }
                // Add apartment info with percentage for this partner
                if (!partnerProfitsMap[normalizedKey].apartments.find(a => a.id === (apt._id || apt.id))) {
                    partnerProfitsMap[normalizedKey].apartments.push({
                        id: apt._id || apt.id,
                        name: apt.name || 'شقة غير محددة',
                        percentage: companyOwner.percentage || 0
                    })
                }

                // Add company owner share to partner profits
                partnerProfitsMap[normalizedKey].amount += companyOwnerShare
                // Only count bookings if there are actual bookings for this apartment
                if (apartmentBookings.length > 0) {
                    partnerProfitsMap[normalizedKey].bookingsCount += apartmentBookings.length
                }
            })
        }
    })

    // Convert to array and add EGP amounts
    // IMPORTANT: Ensure no partner amount is negative
    // IMPORTANT: Include ALL partners, even those with 0 earnings
    const usdRate = exchangeRates.USD || 47.49
    const partnerProfits = Object.values(partnerProfitsMap).map(p => ({
        ...p,
        amount: Math.max(0, p.amount || 0), // Ensure amount is never negative
        totalEGP: Math.max(0, p.amount || 0) * usdRate,
        totalUSD: Math.max(0, p.amount || 0)
    }))

    const totalPartnerProfits = partnerProfits.reduce((sum, p) => sum + p.amount, 0)

    return {
        partnerProfits,
        summary: {
            totalPartnerProfits,
            totalInvestorProfits: partnerProfits
                .filter(p => p.type === 'investor')
                .reduce((sum, p) => sum + p.amount, 0),
            totalCompanyOwnerProfits: partnerProfits
                .filter(p => p.type === 'company_owner')
                .reduce((sum, p) => sum + p.amount, 0)
        }
    }
}
