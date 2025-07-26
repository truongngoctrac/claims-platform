import { RequestHandler } from "express";
import { database } from "../database";
import { AuthRequest, canManageClaims, canAssignClaims } from "../auth";
import { AssignClaimRequest } from "../../shared/auth";

// Get all claims (with role-based filtering)
export const handleGetClaims: RequestHandler = async (
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

    let claims;

    // Filter claims based on user role
    switch (req.user.role) {
      case "admin":
      case "claims_manager":
        // Managers and admins can see all claims
        claims = database.getAllClaims();
        break;
      case "claim_executive":
        // Executives can see unassigned claims and their own assigned claims
        const unassigned = database.getUnassignedClaims();
        const assigned = database.getClaimsByAssignee(req.user.id);
        claims = [...unassigned, ...assigned];
        break;
      case "customer":
        // Customers can only see their own claims
        claims = database
          .getAllClaims()
          .filter((claim) => claim.customerId === req.user.id);
        break;
      default:
        claims = [];
    }

    res.json({
      success: true,
      claims,
    });
  } catch (error) {
    console.error("Get claims error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get claim by ID
export const handleGetClaim: RequestHandler = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { id } = req.params;
    const claim = database.getClaimById(id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    // Check if user has permission to view this claim
    const canView =
      canManageClaims(req.user) ||
      claim.customerId === req.user.id ||
      claim.assignedTo === req.user.id;

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      claim,
    });
  } catch (error) {
    console.error("Get claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Assign claim to user
export const handleAssignClaim: RequestHandler = async (
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

    // Check if user can assign claims
    if (!canAssignClaims(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions to assign claims",
      });
    }

    const {
      claimId,
      assignedTo,
      priority,
      deadline,
      notes,
    }: AssignClaimRequest = req.body;

    if (!claimId || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Claim ID and assignee are required",
      });
    }

    // Check if claim exists
    const claim = database.getClaimById(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    // Check if assignee exists and is a claim executive
    const assignee = await database.getUserById(assignedTo);
    if (
      !assignee ||
      !["claim_executive", "claims_manager"].includes(assignee.role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignee",
      });
    }

    // Update claim assignment
    const updatedClaim = database.updateClaimAssignment(claimId, assignedTo);

    // Create assignment record
    const assignment = database.createAssignment({
      claimId,
      assignedTo,
      assignedBy: req.user.id,
      assignedAt: new Date().toISOString(),
      status: "active",
      priority: priority || "medium",
      deadline,
      notes,
    });

    // Create notification for assignee
    database.createNotification({
      userId: assignedTo,
      type: "claim_assigned",
      title: "New Claim Assigned",
      message: `You have been assigned claim ${claimId}`,
      data: {
        claimId,
        assignedBy: req.user.id,
        priority: priority || "medium",
      },
    });

    // Mock email notification (would be real in production)
    console.log(
      `Email notification sent to ${assignee.email}: Claim ${claimId} assigned`,
    );

    res.json({
      success: true,
      claim: updatedClaim,
      assignment,
      message: "Claim assigned successfully",
    });
  } catch (error) {
    console.error("Assign claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Self-assign claim (for claim executives)
export const handleSelfAssignClaim: RequestHandler = async (
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

    // Only claim executives can self-assign
    if (req.user.role !== "claim_executive") {
      return res.status(403).json({
        success: false,
        message: "Only claim executives can self-assign claims",
      });
    }

    const { claimId } = req.params;
    const { priority, notes } = req.body;

    // Check if claim exists and is unassigned
    const claim = database.getClaimById(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    if (claim.assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Claim is already assigned",
      });
    }

    // Update claim assignment
    const updatedClaim = database.updateClaimAssignment(claimId, req.user.id);

    // Create assignment record
    const assignment = database.createAssignment({
      claimId,
      assignedTo: req.user.id,
      assignedBy: req.user.id, // Self-assigned
      assignedAt: new Date().toISOString(),
      status: "active",
      priority: priority || "medium",
      notes,
    });

    res.json({
      success: true,
      claim: updatedClaim,
      assignment,
      message: "Claim self-assigned successfully",
    });
  } catch (error) {
    console.error("Self-assign claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update claim status
export const handleUpdateClaimStatus: RequestHandler = async (
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

    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Check if claim exists
    const claim = database.getClaimById(id);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    // Check if user has permission to update this claim
    const canUpdate =
      canManageClaims(req.user) || claim.assignedTo === req.user.id;

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Update claim status
    const updatedClaim = database.updateClaimStatus(id, status);

    // Create notification for customer (if exists)
    if (claim.customerId) {
      database.createNotification({
        userId: claim.customerId,
        type: "claim_updated",
        title: "Claim Status Updated",
        message: `Your claim ${id} status has been updated to ${status}`,
        data: {
          claimId: id,
          newStatus: status,
          updatedBy: req.user.id,
        },
      });

      // Mock email notification
      console.log(
        `Email notification sent to customer: Claim ${id} status updated to ${status}`,
      );
    }

    res.json({
      success: true,
      claim: updatedClaim,
      message: "Claim status updated successfully",
    });
  } catch (error) {
    console.error("Update claim status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get unassigned claims (for claim pool)
export const handleGetUnassignedClaims: RequestHandler = async (
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

    if (!canManageClaims(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const unassignedClaims = database.getUnassignedClaims();

    res.json({
      success: true,
      claims: unassignedClaims,
    });
  } catch (error) {
    console.error("Get unassigned claims error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
