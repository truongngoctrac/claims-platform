import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { authenticate, authorize } from "./auth";
import { UserRole } from "@shared/auth";

// Import route handlers
import {
  handleLogin,
  handleRegister,
  handleProfile,
  handleLogout,
} from "./routes/auth";
import {
  handleGetClaims,
  handleGetClaim,
  handleAssignClaim,
  handleSelfAssignClaim,
  handleUpdateClaimStatus,
  handleGetUnassignedClaims,
} from "./routes/claims";
import {
  handleGetUsers,
  handleGetUsersByRole,
  handleGetClaimExecutives,
  handleGetUserAssignments,
  handleGetAllAssignments,
} from "./routes/users";
import {
  handleGetNotifications,
  handleMarkNotificationRead,
  handleCreateNotification,
  handleGetUnreadCount,
} from "./routes/notifications";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "ClaimFlow API is running!" });
  });

  // Legacy demo route
  app.get("/api/demo", handleDemo);

  // Authentication routes (public)
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", handleLogout);

  // Protected authentication routes
  app.get("/api/auth/profile", authenticate, handleProfile);
  app.post(
    "/api/auth/register",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleRegister,
  );

  // Claims routes
  app.get("/api/claims", authenticate, handleGetClaims);
  app.get("/api/claims/unassigned", authenticate, handleGetUnassignedClaims);
  app.get("/api/claims/:id", authenticate, handleGetClaim);
  app.post(
    "/api/claims/assign",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleAssignClaim,
  );
  app.post(
    "/api/claims/:claimId/self-assign",
    authenticate,
    handleSelfAssignClaim,
  );
  app.put("/api/claims/:id/status", authenticate, handleUpdateClaimStatus);

  // User management routes
  app.get(
    "/api/users",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleGetUsers,
  );
  app.get(
    "/api/users/role/:role",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleGetUsersByRole,
  );
  app.get(
    "/api/users/claim-executives",
    authenticate,
    handleGetClaimExecutives,
  );
  app.get(
    "/api/users/:userId/assignments",
    authenticate,
    handleGetUserAssignments,
  );
  app.get(
    "/api/assignments",
    authenticate,
    authorize([UserRole.ADMIN, UserRole.CLAIMS_MANAGER]),
    handleGetAllAssignments,
  );

  // Notification routes
  app.get("/api/notifications", authenticate, handleGetNotifications);
  app.get(
    "/api/notifications/unread-count",
    authenticate,
    handleGetUnreadCount,
  );
  app.put(
    "/api/notifications/:id/read",
    authenticate,
    handleMarkNotificationRead,
  );
  app.post(
    "/api/notifications",
    authenticate,
    authorize([UserRole.ADMIN]),
    handleCreateNotification,
  );

  return app;
}
