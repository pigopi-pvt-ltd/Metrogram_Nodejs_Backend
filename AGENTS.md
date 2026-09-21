# AGENTS.md - MetroGram Backend

Instructions, architecture guide, and operational rules for AI agents working in this repository.

---

## 📌 Project Overview

**MetroGram** is a modular **Node.js / Express** backend application backed by **MongoDB & Mongoose**, managed with the **Bun** runtime and package manager. It implements a polymorphic, reference-based Role-Based Access Control (RBAC) architecture with hierarchical user management.

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

# Seed default Super Admin user (Boss)
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
2. Mount the routes in [`src/app.js`](file:///Users/anik/projects/cardbe/src/app.js) (`app.use('/api/<endpoint>', <domain>Routes)`).

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
  - `Customer` (`src/modules/customer/customer.model.js`): `customerCode`, `membershipType`, `address`, `loyaltyPoints`

### 4. RBAC & Role Hierarchy Rules
Role permissions are defined in [`src/constants/roles.js`](file:///Users/anik/projects/cardbe/src/constants/roles.js):

| Role | Hierarchy Level | Allowed to Create & Manage | Prohibited From Managing |
|---|---|---|---|
| `SUPER_ADMIN` | Level 4 | `MANAGER`, `EMPLOYEE`, `CUSTOMER` | - |
| `MANAGER` | Level 3 | `EMPLOYEE`, `CUSTOMER` | `SUPER_ADMIN`, `MANAGER` |
| `EMPLOYEE` | Level 2 | `CUSTOMER` | `SUPER_ADMIN`, `MANAGER`, `EMPLOYEE` |
| `CUSTOMER` | Level 1 | *None (Self Profile Only)* | All roles |

#### Middleware Usage:
- `protect`: Verifies JWT from HTTP-Only cookie `req.cookies.token` (or `Authorization: Bearer <token>`), loads active user and populates their `profile` on `req.user`.
- `authorize(...roles)`: Restricts route access to specific roles.
- `verifyCanCreateRole`: Enforces role creation permissions when creating new accounts.

---

## 📡 Complete API Endpoints Map

### 🔑 1. Auth Module (`/api/auth`)
- `POST /api/auth/login` — Public login for all roles (sets HTTP-Only cookie `token`).
- `POST /api/auth/logout` — Logout user (clears HTTP-Only cookie `token`).
- `GET /api/auth/me` — Get current logged-in user with populated profile.

### 📊 2. Dashboard Module (`/api/dashboard`)
- `GET /api/dashboard/stats` — Role-based metrics, KPI stats, team capacity, and recent activity.

### 🛡️ 3. Super Admin Module (`/api/super-admin`)
- `GET /api/super-admin/profile` — Super Admin profile details (`SUPER_ADMIN` only).

### 👔 4. Manager Module (`/api/managers`)
- `POST /api/managers` — Create manager user & profile (`SUPER_ADMIN` only).
- `GET /api/managers` — List all managers (`SUPER_ADMIN`, `MANAGER`).
- `GET /api/managers/:userId` — View manager profile (`SUPER_ADMIN`, `MANAGER`).
- `PUT /api/managers/:userId` — Update manager user & profile (`SUPER_ADMIN` only).
- `DELETE /api/managers/:userId` — Delete manager & profile (`SUPER_ADMIN` only).

### 💼 5. Employee Module (`/api/employees`)
- `POST /api/employees` — Create employee user & profile (`SUPER_ADMIN`, `MANAGER`).
- `GET /api/employees` — List all employees (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/employees/:userId` — View employee profile (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `PUT /api/employees/:userId` — Update employee user & profile (`SUPER_ADMIN`, `MANAGER`).
- `DELETE /api/employees/:userId` — Delete employee & profile (`SUPER_ADMIN`, `MANAGER`).

### 🛍️ 6. Customer Module (`/api/customers`)
- `POST /api/customers` — Create customer user & profile (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/customers` — List all customers (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/customers/:userId` — View customer profile (All authenticated roles).
- `PUT /api/customers/:userId` — Update customer user & profile (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `DELETE /api/customers/:userId` — Delete customer & profile (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).

### 👥 7. Generic User Module (`/api/users`)
- `POST /api/users` — Generic creation (enforces role creation hierarchy).
- `POST /api/users/manager` — Dedicated manager creation endpoint.
- `POST /api/users/employee` — Dedicated employee creation endpoint.
- `POST /api/users/customer` — Dedicated customer creation endpoint.
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
    │   └── customer/     # Customer profiles & operations
    ├── seed/
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
