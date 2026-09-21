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
│   └── customer/
│       ├── customer.model.js
│       ├── customer.controller.js
│       ├── customer.service.js
│       └── customer.routes.js
├── seed/
│   └── seedSuperAdmin.js
├── app.js
└── server.js
```

---

## 🏛️ Database Modeling (Base User + Referenced Profiles)

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
  - **`Customer` (`modules/customer/customer.model.js`)**: `user`, `customerCode`, `membershipType`, `address`, `loyaltyPoints`

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

### 🔑 Auth Module (`/api/auth`)
- `POST /api/auth/login` — Public login (sets HTTP-Only cookie `token`)
- `POST /api/auth/logout` — Public logout (clears HTTP-Only cookie `token`)
- `GET /api/auth/me` — Get current logged-in user & profile

### 🛡️ Super Admin Module (`/api/super-admin`)
- `GET /api/super-admin/profile` — Super Admin only

### 📊 Dashboard Module (`/api/dashboard`)
- `GET /api/dashboard/stats` — Role-based statistics & recent activity (All authenticated roles)

### 👔 Manager Module (`/api/managers`)
- `POST /api/managers` — Create manager (`SUPER_ADMIN` only)
- `GET /api/managers` — List all managers (`SUPER_ADMIN`, `MANAGER`)
- `GET /api/managers/:userId` — Get manager profile (`SUPER_ADMIN`, `MANAGER`)
- `PUT /api/managers/:userId` — Update manager (`SUPER_ADMIN` only)
- `DELETE /api/managers/:userId` — Delete manager (`SUPER_ADMIN` only)

### 💼 Employee Module (`/api/employees`)
- `POST /api/employees` — Create employee (`SUPER_ADMIN`, `MANAGER`)
- `GET /api/employees` — List all employees (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `GET /api/employees/:userId` — Get employee profile (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `PUT /api/employees/:userId` — Update employee (`SUPER_ADMIN`, `MANAGER`)
- `DELETE /api/employees/:userId` — Delete employee (`SUPER_ADMIN`, `MANAGER`)

### 🛍️ Customer Module (`/api/customers`)
- `POST /api/customers` — Create customer (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `GET /api/customers` — List all customers (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `GET /api/customers/:userId` — Get customer profile (All authenticated roles)
- `PUT /api/customers/:userId` — Update customer (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)
- `DELETE /api/customers/:userId` — Delete customer (`SUPER_ADMIN`, `MANAGER`, `EMPLOYEE`)

### 👥 User Module (`/api/users`)
- `POST /api/users` — Generic creation (hierarchy verified)
- `POST /api/users/manager` — Create manager
- `POST /api/users/employee` — Create employee
- `POST /api/users/customer` — Create customer
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

2. **Seed Super Admin (Boss):**
   ```bash
   bun run seed
   ```

3. **Start the server:**
   ```bash
   bun run dev
   # or
   bun dev
   ```
