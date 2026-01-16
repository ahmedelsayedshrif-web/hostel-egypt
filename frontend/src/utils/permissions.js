/**
 * Permission utility functions
 * Default implementation - allows all operations for now
 */

export const canViewPartnerShares = (userRole) => {
  // Allow viewing partner shares for admin, developer, and manager roles
  return userRole === 'admin' || userRole === 'developer' || userRole === 'manager'
}

export const canAddApartment = (userRole) => {
  // Allow adding apartments for admin, developer, and manager roles
  return userRole === 'admin' || userRole === 'developer' || userRole === 'manager'
}

export const canDeleteApartment = (userRole) => {
  // Allow deleting apartments for admin and developer roles only
  return userRole === 'admin' || userRole === 'developer'
}

export const canEditBooking = (userRole) => {
  // Allow editing bookings for admin, developer, and manager roles
  return userRole === 'admin' || userRole === 'developer' || userRole === 'manager'
}

export const canDeleteBooking = (userRole) => {
  // Allow deleting bookings for admin and developer roles only
  return userRole === 'admin' || userRole === 'developer'
}

export const canAddBooking = (userRole) => {
  // Allow adding bookings for admin, developer, and manager roles
  return userRole === 'admin' || userRole === 'developer' || userRole === 'manager'
}
