export function portalFor(user) {
  if (user?.roles?.includes('Admin')) return 'admin'
  if (user?.roles?.includes('Staff')) return 'staff'
  return 'customer'
}

export const portalPaths = {
  customer: '/my-parking',
  staff: '/staff/check-in',
  admin: '/admin',
}
