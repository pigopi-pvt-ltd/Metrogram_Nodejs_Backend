# AGENTS.md - MetroGram Backend

Instructions, architecture guide, and operational rules for AI agents working in this repository.

---

## 📌 Project Overview

**MetroGram** is a modular **Node.js / Express** backend application backed by **MongoDB & Mongoose**, managed with the **Bun** runtime and package manager. It implements a polymorphic, reference-based Role-Based Access Control (RBAC) architecture with hierarchical user management, alongside comprehensive modules for Diagnostic Medical Services (Lab Tests) and Membership Health Cards.

---

## ⚙️ Core Technology Stack & Tooling

| Component | Tool / Technology |
|---|---|
| **Runtime & Package Manager** | **Bun** (`>= 1.0.0`) |
| **Module System** | **ES Modules (`import` / `export`)** (`"type": "module"`) |
| **Framework** | Express.js 4.x |
| **Database & ODM** | MongoDB with Mongoose 8.x |
| **Authentication** | JWT (`jsonwebtoken`) via HTTP-Only Cookies & Bearer Tokens |
| **Cookie Parser** | `cookie-parser` with CORS `credentials: true` |
| **Security / Hashing** | `bcryptjs` |

---

## 📜 Development & Operational Commands

Always use `bun` (not `npm` or `yarn`):

```bash
# Install dependencies
bun install

# Start development server with live reload (Bun native watcher)
bun dev

# Run production server
bun start

# Seed default Super Admin, Diagnostic Tests, Card Plans, & Sample Accounts
bun run seed
```

---

## 🏛️ Architectural Patterns & Code Conventions

### 1. Module System: Strict ES Modules (ESM)
- **Rule**: All JavaScript files **must** use ES Module syntax with file extensions in relative imports:
  - Imports: `import foo from './foo.js';` or `import { bar } from './bar.js';`
  - Exports: `export default ...;` or `export const ...;` / `export { ... };`
- **Do NOT** use CommonJS syntax (`require(...)` or `module.exports = ...`).

### 2. Modular Domain Structure
Every business domain lives inside its own folder in `src/modules/<domain>/` and follows a strict 4-file separation of concerns:

```text
src/modules/<domain>/
├── <domain>.model.js       # Mongoose schema, model definition, and indexes
├── <domain>.service.js     # Pure business logic, DB queries, data transforms (Class instance default exported)
├── <domain>.controller.js  # Express handlers, req/res handling, status codes (Class instance default exported)
└── <domain>.routes.js      # Express Router, middleware bindings, path definitions
```

When creating a new domain:
1. Create all 4 files inside `src/modules/<domain>/`.
2. Mount the routes in `src/app.js` (`app.use('/api/<endpoint>', <domain>Routes)`).

### 3. Polymorphic Base User + Reference Profile Model
The authentication and user identity system separates the core account from role-specific metadata:

- **Base Model (`src/modules/user/user.model.js`)**:
  - Contains shared fields: `firstName`, `lastName`, `email`, `password`, `phoneNumber`, `role`, `isActive`, `createdBy`.
  - Uses dynamic polymorphic reference via Mongoose `refPath`:
    ```javascript
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'profileModel'
    },
    profileModel: {
      type: String,
      enum: ['SuperAdmin', 'Manager', 'Employee', 'Customer']
    }
    ```
- **Profile Models**:
  - `SuperAdmin` (`src/modules/superAdmin/superAdmin.model.js`): `adminLevel`, `permissions`, `systemNotes`
  - `Manager` (`src/modules/manager/manager.model.js`): `department`, `branch`, `managedEmployees`, `maxTeamSize`
  - `Employee` (`src/modules/employee/employee.model.js`): `employeeCode`, `designation`, `department`, `manager`
  - `Customer` (`src/modules/customer/customer.model.js`): `customerCode`, `membershipType`, `aadharNumber`, `panNumber`, `hasCard`, `activeCard`, `cardHistory`, `address`, `loyaltyPoints`

### 4. RBAC & Role Hierarchy Rules
Role permissions are defined in `src/constants/roles.js`:

| Role | Hierarchy Level | Allowed to Create & Manage | Prohibited From Managing |
|---|---|---|---|
| `SUPER_ADMIN` | Level 4 | `MANAGER`, `EMPLOYEE`, `CUSTOMER`, Services & Card Plans | - |
| `MANAGER` | Level 3 | `EMPLOYEE`, `CUSTOMER`, Card Assignment | `SUPER_ADMIN`, `MANAGER`, Service & Card Plan Configuration |
| `EMPLOYEE` | Level 2 | `CUSTOMER`, Card Assignment | `SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`, Service & Card Plan Configuration |
| `CUSTOMER` | Level 1 | *None (Self Profile & Card Purchase Only)* | All roles |

#### Middleware Usage:
- `protect`: Verifies JWT from HTTP-Only cookie `req.cookies.token` (or `Authorization: Bearer <token>`), loads active user and populates their `profile` on `req.user`.
- `authorize(...roles)`: Restricts route access to specific roles.
- `verifyCanCreateRole`: Enforces role creation permissions when creating new accounts.

---

## 📡 Complete API Endpoints Map

### 🩺 1. Medical Services / Diagnostic Tests (`/api/services`)
- `GET /api/services` — List diagnostic tests with filters (`testType`, `search`, `requiresFasting`, `isActive`, `page`, `limit`) [Public for Landing Page].
- `GET /api/services/categories` — Get unique test types/categories and sample types [Public].
- `GET /api/services/:id` — View details of single diagnostic test [Public].
- `POST /api/services` — Create new diagnostic test (`SUPER_ADMIN` only).
- `PUT /api/services/:id` — Update diagnostic test (`SUPER_ADMIN` only).
- `PATCH /api/services/:id/status` — Toggle test active/inactive status (`SUPER_ADMIN` only).
- `DELETE /api/services/:id` — Delete diagnostic test (`SUPER_ADMIN` only).

### 💳 2. Membership Health Cards (`/api/cards`)
- `GET /api/cards/plans` — List active card plans (`MONTHLY`, `YEARLY`, `QUARTERLY`) [Public for Landing Page].
- `GET /api/cards/plans/:id` — View single card plan [Public].
- `POST /api/cards/plans` — Create new card plan (`SUPER_ADMIN` only).
- `PUT /api/cards/plans/:id` — Update card plan (`SUPER_ADMIN` only).
- `PATCH /api/cards/plans/:id/status` — Toggle card plan status (`SUPER_ADMIN` only).
- `DELETE /api/cards/plans/:id` — Delete card plan (`SUPER_ADMIN` only).
- `POST /api/cards/purchase` — Direct card assignment / mock purchase.
- `POST /api/cards/assign` — Assign card plan to customer (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/cards/my-card` — View logged-in customer's active card details and validity.
- `GET /api/cards/customer/:userId` — View specific customer's card details (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).

### 💰 3. Cashfree Payment Gateway & Transactions (`/api/payments`)
- `GET /api/payments/config` — Get frontend Cashfree environment & API config (`SANDBOX` vs `PRODUCTION`).
- `POST /api/payments/create-order` — Create payment order and Cashfree session for Health Card or Diagnostic Service (applies health card member discounts automatically).
- `POST /api/payments/verify/:orderId` or `GET /api/payments/verify/:orderId` — Verify order with Cashfree and fulfill card subscription or diagnostic booking.
- `POST /api/payments/webhook` — Public webhook listener for Cashfree signature-verified event notifications.
- `GET /api/payments/order/:orderId` — View single payment transaction details.
- `GET /api/payments/my-payments` — Customer's payment history with pagination.
- `POST /api/payments/refund/:orderId` — Initiate automated Cashfree refund for a paid order (`SUPER_ADMIN`, `MANAGER`). Blocks CARD entities.
- `GET /api/payments/refunds/:orderId` — Fetch refund status and history from Cashfree.
- `GET /api/payments` — Admin/Manager query all payment transactions with filters (`status`, `entityType`, date range, search).

### 🩺 4. Diagnostic Service Bookings (`/api/services/bookings`)
- `GET /api/services/bookings/my-bookings` — Customer view test bookings.
- `GET /api/services/bookings` — Staff view all diagnostic test bookings (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/services/bookings/:id` — View single diagnostic test booking.
- `POST /api/services/bookings/:id/cancel` — Cancel test booking with automated Cashfree refund (checks sample status).
- `GET /api/services/bookings/:id/receipt` — Download PDF receipt for diagnostic booking.
- `PATCH /api/services/bookings/:id/status` — Update sample collection status, completion time, or report URL (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).

### 🧾 5. Invoices & Receipts (`/api/receipts`)
- `GET /api/receipts/cards/my-card/pdf` — Download PDF receipt for logged-in customer's active health card.
- `GET /api/receipts/cards/my-card` — Get JSON receipt data for logged-in customer's active health card.
- `GET /api/receipts/cards/customer/:userId/pdf` — Staff download PDF receipt for a customer's health card (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/receipts/bookings/:bookingIdentifier/pdf` — Download PDF receipt for a service booking (by `bookingCode` or ID).
- `GET /api/receipts/bookings/:bookingIdentifier` — Get JSON receipt data for a service booking.
- `GET /api/receipts/payments/:paymentIdentifier/pdf` — Download PDF receipt for a payment transaction (by `orderId` or ID).
- `GET /api/receipts/payments/:paymentIdentifier` — Get JSON receipt data for a payment transaction.
- Also available as direct route shortcuts:
  - `GET /api/cards/my-card/receipt`
  - `GET /api/services/bookings/:id/receipt`
  - `GET /api/payments/order/:orderId/receipt`

### 🔑 5. Auth Module (`/api/auth`)
- `POST /api/auth/register` — Public customer self-registration with personal info, optional Aadhar & PAN details, and document uploads (`aadharImage`, `panImage`) stored in Cloudinary. Automatically creates customer profile and returns JWT + user. Accepts `multipart/form-data` or JSON.
- `POST /api/auth/login` — Public login for all roles (sets HTTP-Only cookie `token`).
- `POST /api/auth/logout` — Logout user (clears HTTP-Only cookie `token`).
- `GET /api/auth/me` — Get current logged-in user with populated profile.
- `POST /api/auth/change-password` — Change password for authenticated user (requires `currentPassword`, `newPassword`, optional `confirmPassword`).
- `POST /api/auth/forgot-password` — Request 6-digit password reset OTP email (requires `email`).
- `POST /api/auth/reset-password` — Verify reset OTP and set new password (requires `email`, `otp`, `newPassword`, optional `confirmPassword`).

### 📊 6. Dashboard Module (`/api/dashboard`)
- `GET /api/dashboard/stats` — Role-based metrics, KPI stats, team capacity, revenue, and recent activity.

### 🛡️ 7. Super Admin Module (`/api/super-admin`)
- `GET /api/super-admin/profile` — Super Admin profile details (`SUPER_ADMIN` only).

### 👔 8. Manager Module (`/api/managers`)
- `POST /api/managers` — Create manager user & profile (`SUPER_ADMIN` only).
- `GET /api/managers` — List all managers (`SUPER_ADMIN`, `MANAGER`).
- `GET /api/managers/:userId` — View manager profile (`SUPER_ADMIN`, `MANAGER`).
- `PUT /api/managers/:userId` — Update manager user & profile (`SUPER_ADMIN` only).
- `DELETE /api/managers/:userId` — Delete manager & profile (`SUPER_ADMIN` only).

### 💼 9. Employee Module (`/api/employees`)
- `POST /api/employees` — Create employee user & profile (`SUPER_ADMIN`, `MANAGER`).
- `GET /api/employees` — List all employees (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/employees/:userId` — View employee profile (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `PUT /api/employees/:userId` — Update employee user & profile (`SUPER_ADMIN`, `MANAGER`).
- `DELETE /api/employees/:userId` — Delete employee & profile (`SUPER_ADMIN`, `MANAGER`).

### 🛍️ 10. Customer Module (`/api/customers`)
- `POST /api/customers` — Create customer with Aadhar & PAN details and optional document images (`aadharImage`, `panImage`) stored in Cloudinary (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`). Accepts `multipart/form-data` or JSON.
- `GET /api/customers` — List all customers (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/customers/:userId` — View customer profile (All authenticated roles).
- `PUT /api/customers/:userId` — Update customer with Aadhar & PAN details and document images (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`, or the `CUSTOMER` updating their own profile). Accepts `multipart/form-data` or JSON.
- `DELETE /api/customers/:userId` — Delete customer & profile and remove stored document images from Cloudinary (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).

### 👥 11. Generic User Module (`/api/users`)
- `POST /api/users` — Generic creation (enforces role creation hierarchy).
- `POST /api/users/manager` — Dedicated manager creation endpoint.
- `POST /api/users/employee` — Dedicated employee creation endpoint.
- `POST /api/users/customer` — Dedicated customer creation endpoint with Aadhar & PAN numbers and document images (`aadharImage`, `panImage`). Accepts `multipart/form-data` or JSON.
- `GET /api/users` — Query users (filtering by `role`, `search` query, and pagination `page`, `limit`).
- `GET /api/users/:id` — Get single user by ID with populated profile.
- `PUT /api/users/:id` — Update user and linked profile (enforces hierarchy permissions).
- `PATCH /api/users/:id/status` — Toggle user active/inactive status (`isActive: true/false`).
- `DELETE /api/users/:id` — Delete user and linked profile document (enforces hierarchy permissions).

---

## 🗂️ Project Directory Map

```text
.
├── .env                  # Environment variables (PORT, MONGODB_URI, JWT_SECRET, etc.)
├── .env.example          # Template for environment variables
├── .gitignore            # Git ignore configuration
├── bun.lock              # Bun lockfile
├── package.json          # Project metadata, scripts, dependencies ("type": "module")
├── README.md             # Project documentation
├── AGENTS.md             # AI Agent instructions and architectural guide
└── src/
    ├── config/
    │   └── db.js         # Mongoose MongoDB connection setup
    ├── constants/
    │   └── roles.js      # Roles enum, profile model mapping, hierarchy map
    ├── middleware/
    │   ├── auth.js       # JWT validation & user attachment
    │   ├── roleCheck.js  # Role authorization & hierarchy enforcement
    │   └── errorHandler.js # Global error handling middleware
    ├── modules/          # Encapsulated domain modules
    │   ├── auth/         # Login, token generation, /me
    │   ├── dashboard/    # Role-based dashboard stats
    │   ├── user/         # Base user querying, generic creation & CRUD
    │   ├── superAdmin/   # Super admin profile & operations
    │   ├── manager/      # Manager profiles & operations
    │   ├── employee/     # Employee profiles & operations
    │   ├── customer/     # Customer profiles & operations
    │   ├── service/      # Diagnostic tests & lab services
    │   └── card/         # Health card plans & customer subscriptions
    ├── seed/
    │   ├── seedAll.js    # Comprehensive seed script
    │   └── seedSuperAdmin.js # Seed script for default super admin
    ├── app.js            # Express app configuration & route mounting
    └── server.js         # Server entry point & DB connection initialization
```

---

## 🛡️ Guidelines for AI Agents Making Changes

1. **Always use ES Modules (ESM)**: Use `import` and `export` statements with explicit `.js` extensions for local module paths.
2. **Follow Service/Controller Pattern**: Keep HTTP handling inside controllers and business logic/database queries inside services.
3. **Error Handling**: Wrap controller logic in `try/catch` and forward unhandled errors to `next(error)`. Return consistent JSON error objects (`{ success: false, message: ... }`).
4. **Data Integrity**: When creating users with role profiles, ensure both the base `User` and the corresponding profile document are created and linked properly.
5. **Security**: Never expose plain text passwords or return password hashes in API responses (the `User` model defaults `password: { select: false }`).
