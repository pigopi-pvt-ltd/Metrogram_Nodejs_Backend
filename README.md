# MetroGram - Modular RBAC Backend with MongoDB / Mongoose

**MetroGram** is a modular Node.js + Express backend with MongoDB and Mongoose where **each domain is fully encapsulated inside its own module folder** containing its `model`, `controller`, `service`, and `routes`.

---

## 📂 Project Structure

```text
src/
├── config/
│   └── db.js
├── constants/
│   └── roles.js
├── middleware/
│   ├── auth.js
│   ├── roleCheck.js
│   └── errorHandler.js
├── modules/
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   └── auth.routes.js
│   ├── user/
│   │   ├── user.model.js
│   │   ├── user.controller.js
│   │   ├── user.service.js
│   │   └── user.routes.js
│   ├── superAdmin/
│   │   ├── superAdmin.model.js
│   │   ├── superAdmin.controller.js
│   │   ├── superAdmin.service.js
│   │   └── superAdmin.routes.js
│   ├── manager/
│   │   ├── manager.model.js
│   │   ├── manager.controller.js
│   │   ├── manager.service.js
│   │   └── manager.routes.js
│   ├── employee/
│   │   ├── employee.model.js
│   │   ├── employee.controller.js
│   │   ├── employee.service.js
│   │   └── employee.routes.js
│   ├── customer/
│   │   ├── customer.model.js
│   │   ├── customer.controller.js
│   │   ├── customer.service.js
│   │   └── customer.routes.js
│   ├── service/
│   │   ├── service.model.js
│   │   ├── service.controller.js
│   │   ├── service.service.js
│   │   └── service.routes.js
│   ├── card/
│   │   ├── cardPlan.model.js
│   │   ├── card.controller.js
│   │   ├── card.service.js
│   │   └── card.routes.js
│   └── dashboard/
│       ├── dashboard.controller.js
│       ├── dashboard.service.js
│       └── dashboard.routes.js
├── seed/
│   ├── seedAll.js
│   └── seedSuperAdmin.js
├── app.js
└── server.js
```

---

## 🏛️ Database Modeling (Base User + Referenced Profiles + Services & Cards)

- **Base `User` model (`modules/user/user.model.js`)**:
  - `firstName`, `lastName`, `email`, `password` (bcrypt hashed)
  - `phoneNumber`, `role` (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`, `CUSTOMER`)
  - `profile`: `ObjectId` referencing the role document via dynamic `refPath`
  - `profileModel`: String (`SuperAdmin`, `Manager`, `Employee`, `Customer`)
  - `isActive`, `createdBy`, `timestamps`

- **Role-Specific Models (Connected via Reference)**:
  - **`SuperAdmin` (`modules/superAdmin/superAdmin.model.js`)**: `user`, `adminLevel`, `permissions`, `systemNotes`
  - **`Manager` (`modules/manager/manager.model.js`)**: `user`, `department`, `branch`, `managedEmployees`, `maxTeamSize`
  - **`Employee` (`modules/employee/employee.model.js`)**: `user`, `employeeCode`, `designation`, `department`, `manager`
  - **`Customer` (`modules/customer/customer.model.js`)**: `user`, `customerCode`, `membershipType`, `aadharNumber`, `panNumber`, `hasCard`, `activeCard`, `cardHistory`, `address`, `loyaltyPoints`

- **Diagnostic Test / Medical Services (`modules/service/service.model.js`)**:
  - `testName` (e.g. "Complete Blood Count (CBC)")
  - `description`
  - `testType` (e.g. "Blood Test", "Biochemistry", "Urine Test")
  - `reportTime` (e.g. "24 Hours", "Same Day")
  - `sampleType` (e.g. "Blood Sample", "Urine Sample")
  - `price` (standard test price)
  - `discountedPrice` (discounted price for health card holders)
  - `parametersMeasured` (array of measured parameters: RBC, WBC, Platelets, etc.)
  - `requiresFasting` (Boolean) & `fastingDuration`
  - `preparationInstructions`
  - `isActive`, `createdBy`

- **Membership Cards & Plans (`modules/card/cardPlan.model.js`)**:
  - `name` (e.g. "MetroCare Annual Health Card")
  - `planType` (`MONTHLY`, `YEARLY`, `QUARTERLY`)
  - `price`
  - `validityInDays`
  - `description`
  - `benefits` (array of benefits/perks)
  - `discountPercentage`
  - `badge`, `isActive`, `createdBy`

---

## 🔐 Role Creation & Permission Hierarchy

| Requester Role | Allowed To Create | Prohibited From Creating |
|---|---|---|
| **Super Admin (Boss)** | `MANAGER`, `EMPLOYEE`, `CUSTOMER` | - |
| **Manager** | `EMPLOYEE`, `CUSTOMER` | `SUPER_ADMIN`, `MANAGER` |
| **Employee** | `CUSTOMER` | `SUPER_ADMIN`, `MANAGER`, `EMPLOYEE` |
| **Customer** | *None* | All roles |

---

## 📡 Modular API Endpoints

### 🩺 1. Medical Services / Diagnostic Tests (`/api/services`)
- `GET /api/services` — List all diagnostic tests (Public for landing page & users; supports search, `testType`, `requiresFasting`, `isActive`, pagination).
- `GET /api/services/categories` — Get distinct test types/categories and sample types (Public).
- `GET /api/services/:id` — View details of a single diagnostic test (Public).
- `POST /api/services` — Create new diagnostic test (`SUPER_ADMIN` only).
- `PUT /api/services/:id` — Update diagnostic test (`SUPER_ADMIN` only).
- `PATCH /api/services/:id/status` — Toggle test active status (`SUPER_ADMIN` only).
- `DELETE /api/services/:id` — Delete diagnostic test (`SUPER_ADMIN` only).

### 💳 2. Membership Health Cards (`/api/cards`)
- `GET /api/cards/plans` — List active card plans & benefits (Public for landing page & users).
- `GET /api/cards/plans/:id` — Get single card plan details (Public).
- `POST /api/cards/plans` — Create new card plan (`SUPER_ADMIN` only).
- `PUT /api/cards/plans/:id` — Update card plan (`SUPER_ADMIN` only).
- `PATCH /api/cards/plans/:id/status` — Toggle card plan status (`SUPER_ADMIN` only).
- `DELETE /api/cards/plans/:id` — Delete card plan (`SUPER_ADMIN` only).
- `POST /api/cards/purchase` — Purchase and activate card plan (Authenticated Customer).
- `POST /api/cards/assign` — Assign card plan to customer (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).
- `GET /api/cards/my-card` — View current active card & benefits (Authenticated Customer).
- `GET /api/cards/customer/:userId` — View customer's card status (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`).

### 🔑 3. Auth Module (`/api/auth`)
- `POST /api/auth/login` — Public login (sets HTTP-Only cookie `token`)
- `POST /api/auth/logout` — Public logout (clears HTTP-Only cookie `token`)
- `GET /api/auth/me` — Get current logged-in user & profile

### 📊 4. Dashboard Module (`/api/dashboard`)
- `GET /api/dashboard/stats` — Role-based statistics & metrics (All authenticated roles)

### 🛡️ 5. Super Admin Module (`/api/super-admin`)
- `GET /api/super-admin/profile` — Super Admin only

### 👔 6. Manager Module (`/api/managers`)
- `POST /api/managers` — Create manager (`SUPER_ADMIN` only)
- `GET /api/managers` — List all managers (`SUPER_ADMIN`, `MANAGER`)
- `GET /api/managers/:userId` — Get manager profile (`SUPER_ADMIN`, `MANAGER`)
- `PUT /api/managers/:userId` — Update manager (`SUPER_ADMIN` only)
- `DELETE /api/managers/:userId` — Delete manager (`SUPER_ADMIN` only)

### 💼 7. Employee Module (`/api/employees`)
- `POST /api/employees` — Create employee (`SUPER_ADMIN`, `MANAGER`)
- `GET /api/employees` — List all employees (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `GET /api/employees/:userId` — Get employee profile (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `PUT /api/employees/:userId` — Update employee (`SUPER_ADMIN`, `MANAGER`)
- `DELETE /api/employees/:userId` — Delete employee (`SUPER_ADMIN`, `MANAGER`)

### 🛍️ 8. Customer Module (`/api/customers`)
- `POST /api/customers` — Create customer with Aadhar & PAN (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `GET /api/customers` — List all customers (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `GET /api/customers/:userId` — Get customer profile (All authenticated roles)
- `PUT /api/customers/:userId` — Update customer (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `DELETE /api/customers/:userId` — Delete customer (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)

### 👥 9. Generic User Module (`/api/users`)
- `POST /api/users` — Generic creation (hierarchy verified)
- `POST /api/users/manager` — Create manager
- `POST /api/users/employee` — Create employee
- `POST /api/users/customer` — Create customer with Aadhar & PAN
- `GET /api/users` — Query users (filtering, search, pagination)
- `GET /api/users/:id` — Get user by ID
- `PUT /api/users/:id` — Update user & profile (hierarchy protected)
- `PATCH /api/users/:id/status` — Toggle active/inactive status
- `DELETE /api/users/:id` — Delete user & profile (hierarchy protected)

---

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Seed Super Admin, Lab Services, Card Plans & Sample Accounts:**
   ```bash
   bun run seed
   ```

3. **Start the development server:**
   ```bash
   bun run dev
   # or
   bun dev
   ```
