export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  CUSTOMER: 'CUSTOMER'
};

export const PROFILE_MODELS = {
  [ROLES.SUPER_ADMIN]: 'SuperAdmin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.EMPLOYEE]: 'Employee',
  [ROLES.CUSTOMER]: 'Customer'
};

// Hierarchy definition:
// Super Admin can add Manager, Employee, Customer
// Manager can add Employee, Customer
// Employee can add Customer
// Customer cannot add any users
export const ROLE_CREATION_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.CUSTOMER],
  [ROLES.MANAGER]: [ROLES.EMPLOYEE, ROLES.CUSTOMER],
  [ROLES.EMPLOYEE]: [ROLES.CUSTOMER],
  [ROLES.CUSTOMER]: []
};

export default {
  ROLES,
  PROFILE_MODELS,
  ROLE_CREATION_PERMISSIONS
};
