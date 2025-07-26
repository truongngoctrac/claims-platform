import { RequestHandler } from "express";
import { database } from "../database";
import { AuthRequest } from "../auth";
import { UserRole } from "../../shared/auth";

// Get all users (admin only)
export const handleGetUsers: RequestHandler = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only admins and managers can view all users
    if (!["admin", "claims_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const users = database.getAllUsers();

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get users by role
export const handleGetUsersByRole: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { role } = req.params;

    // Validate role
    if (!Object.values(UserRole).includes(role as UserRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    // Only admins and managers can view users by role
    if (!["admin", "claims_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const users = database.getUsersByRole(role as UserRole);

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get users by role error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get claim executives (for assignment dropdown)
export const handleGetClaimExecutives: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only allow claims staff to see executives
    if (
      !["admin", "claims_manager", "claim_executive"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const executives = database.getUsersByRole(UserRole.CLAIM_EXECUTIVE);
    const managers = database.getUsersByRole(UserRole.CLAIMS_MANAGER);

    // Return both executives and managers as potential assignees
    const assignees = [...executives, ...managers];

    res.json({
      success: true,
      users: assignees,
    });
  } catch (error) {
    console.error("Get claim executives error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get user assignments
export const handleGetUserAssignments: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { userId } = req.params;

    // Users can only view their own assignments unless they're admin/manager
    if (
      userId !== req.user.id &&
      !["admin", "claims_manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const assignments = database.getAssignmentsByUser(userId);
    const claims = database.getClaimsByAssignee(userId);

    res.json({
      success: true,
      assignments,
      claims,
    });
  } catch (error) {
    console.error("Get user assignments error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all assignments (admin/manager only)
export const handleGetAllAssignments: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only admins and managers can view all assignments
    if (!["admin", "claims_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const assignments = database.getAllAssignments();

    res.json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.error("Get all assignments error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
