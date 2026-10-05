import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import errorHandler from "./middleware/errorHandler.js";

// Import module routes
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/user/user.routes.js";
import superAdminRoutes from "./modules/superAdmin/superAdmin.routes.js";
import managerRoutes from "./modules/manager/manager.routes.js";
import employeeRoutes from "./modules/employee/employee.routes.js";
import customerRoutes from "./modules/customer/customer.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import serviceRoutes from "./modules/service/service.routes.js";
import cardRoutes from "./modules/card/card.routes.js";
import paymentRoutes from "./modules/payment/payment.routes.js";

const app = express();

// Allowed Origins for CORS credentials
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:5173"
].filter(Boolean);

// Global Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, credentials allowed
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-webhook-signature", "x-webhook-timestamp"]
  })
);
app.use(cookieParser());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
app.use(express.urlencoded({ extended: true }));

// Welcome / API Documentation route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to MetroGram API",
    modules: {
      auth: "/api/auth",
      users: "/api/users",
      superAdmin: "/api/super-admin",
      managers: "/api/managers",
      employees: "/api/employees",
      customers: "/api/customers",
      dashboard: "/api/dashboard",
      services: "/api/services",
      cards: "/api/cards",
      payments: "/api/payments"
    },
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount Module Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/payments", paymentRoutes);

// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
