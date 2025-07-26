import { RequestHandler } from "express";
import { healthcareDatabase } from "../healthcare-database";
import { AuthRequest, canManageClaims } from "../auth";
import {
  CreateClaimRequest,
  AssignClaimRequest,
  ReviewClaimRequest,
  ClaimStatus,
  ClaimType,
} from "../../shared/healthcare";

// Get all healthcare claims (with role-based filtering)
export const handleGetHealthcareClaims: RequestHandler = async (
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
        claims = healthcareDatabase.getAllHealthcareClaims();
        break;
      case "claim_executive":
        // Executives can see unassigned claims and their own assigned claims
        const unassigned = healthcareDatabase.getUnassignedClaims();
        const assigned = healthcareDatabase.getClaimsByAssignee(req.user.id);
        claims = [...unassigned, ...assigned];
        break;
      case "customer":
        // Customers can only see their own claims
        claims = healthcareDatabase.getClaimsBySubmitter(req.user.id);
        break;
      default:
        claims = [];
    }

    res.json({
      success: true,
      claims,
    });
  } catch (error) {
    console.error("Get healthcare claims error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get healthcare claim by ID
export const handleGetHealthcareClaim: RequestHandler = async (
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
    const claim = healthcareDatabase.getHealthcareClaimById(id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    // Check if user has permission to view this claim
    const canView =
      canManageClaims(req.user) ||
      claim.submittedBy === req.user.id ||
      claim.processing.assignedTo === req.user.id;

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
    console.error("Get healthcare claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create new healthcare claim
export const handleCreateHealthcareClaim: RequestHandler = async (
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

    const claimData: CreateClaimRequest = req.body;

    // Validate required fields
    if (
      !claimData.patient ||
      !claimData.medical ||
      !claimData.financial ||
      !claimData.type
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required claim data",
      });
    }

    // Create the claim
    const newClaim = healthcareDatabase.createHealthcareClaim({
      submittedBy: req.user.id,
      submittedAt: new Date().toISOString(),
      type: claimData.type,
      status: ClaimStatus.DRAFT,
      priority: "medium",
      patient: claimData.patient,
      medical: claimData.medical,
      financial: claimData.financial,
      documents: [],
      processing: {
        comments: [],
      },
      external: {},
    });

    // Mock integration - send notification to insurance company
    console.log(
      `New healthcare claim ${newClaim.claimNumber} created for ${newClaim.patient.fullName}`,
    );

    res.status(201).json({
      success: true,
      claim: newClaim,
      message: "Healthcare claim created successfully",
    });
  } catch (error) {
    console.error("Create healthcare claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Submit healthcare claim (change status from draft to submitted)
export const handleSubmitHealthcareClaim: RequestHandler = async (
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
    const claim = healthcareDatabase.getHealthcareClaimById(id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    // Check if user owns this claim
    if (claim.submittedBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only submit your own claims",
      });
    }

    // Check if claim is in draft status
    if (claim.status !== ClaimStatus.DRAFT) {
      return res.status(400).json({
        success: false,
        message: "Only draft claims can be submitted",
      });
    }

    // Validate claim has required documents
    if (claim.documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one document is required to submit a claim",
      });
    }

    // Update claim status
    const updatedClaim = healthcareDatabase.updateHealthcareClaim(id, {
      status: ClaimStatus.SUBMITTED,
      submittedAt: new Date().toISOString(),
    });

    // Mock email notification to customer
    console.log(
      `Email sent to ${claim.patient.fullName}: Claim ${claim.claimNumber} submitted successfully`,
    );

    // Mock notification to TPA system
    console.log(`TPA notification: New claim ${claim.claimNumber} received`);

    res.json({
      success: true,
      claim: updatedClaim,
      message: "Claim submitted successfully",
    });
  } catch (error) {
    console.error("Submit healthcare claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Assign healthcare claim
export const handleAssignHealthcareClaim: RequestHandler = async (
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
    if (!["admin", "claims_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions to assign claims",
      });
    }

    const { claimId, assignedTo, priority, notes }: AssignClaimRequest =
      req.body;

    if (!claimId || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Claim ID and assignee are required",
      });
    }

    const claim = healthcareDatabase.getHealthcareClaimById(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    // Update claim assignment
    const updatedClaim = healthcareDatabase.updateHealthcareClaim(claimId, {
      status: ClaimStatus.UNDER_REVIEW,
      priority: priority || claim.priority,
      processing: {
        ...claim.processing,
        assignedTo,
        assignedAt: new Date().toISOString(),
        internalNotes: notes,
      },
    });

    // Add assignment comment
    healthcareDatabase.addComment(claimId, {
      authorId: req.user.id,
      authorName: `${req.user.firstName} ${req.user.lastName}`,
      authorRole: req.user.role,
      message: `Claim assigned to ${assignedTo}${notes ? `: ${notes}` : ""}`,
      type: "info",
      isInternal: true,
    });

    // Mock email notification to assignee
    console.log(
      `Email notification sent: Claim ${claim.claimNumber} assigned to ${assignedTo}`,
    );

    res.json({
      success: true,
      claim: updatedClaim,
      message: "Claim assigned successfully",
    });
  } catch (error) {
    console.error("Assign healthcare claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Self-assign healthcare claim
export const handleSelfAssignHealthcareClaim: RequestHandler = async (
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

    const claim = healthcareDatabase.getHealthcareClaimById(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    if (claim.processing.assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Claim is already assigned",
      });
    }

    if (claim.status !== ClaimStatus.SUBMITTED) {
      return res.status(400).json({
        success: false,
        message: "Only submitted claims can be self-assigned",
      });
    }

    // Update claim assignment
    const updatedClaim = healthcareDatabase.updateHealthcareClaim(claimId, {
      status: ClaimStatus.UNDER_REVIEW,
      priority: priority || claim.priority,
      processing: {
        ...claim.processing,
        assignedTo: req.user.id,
        assignedAt: new Date().toISOString(),
        internalNotes: notes,
      },
    });

    // Add self-assignment comment
    healthcareDatabase.addComment(claimId, {
      authorId: req.user.id,
      authorName: `${req.user.firstName} ${req.user.lastName}`,
      authorRole: req.user.role,
      message: `Self-assigned claim for processing${notes ? `: ${notes}` : ""}`,
      type: "info",
      isInternal: true,
    });

    res.json({
      success: true,
      claim: updatedClaim,
      message: "Claim self-assigned successfully",
    });
  } catch (error) {
    console.error("Self-assign healthcare claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Review healthcare claim
export const handleReviewHealthcareClaim: RequestHandler = async (
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

    // Check if user can review claims
    if (!["admin", "claims_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions to review claims",
      });
    }

    const { claimId, decision, approvedAmount, comments }: ReviewClaimRequest =
      req.body;

    if (!claimId || !decision || !comments) {
      return res.status(400).json({
        success: false,
        message: "Claim ID, decision, and comments are required",
      });
    }

    const claim = healthcareDatabase.getHealthcareClaimById(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    let newStatus: ClaimStatus;
    let updateData: any = {
      processing: {
        ...claim.processing,
        reviewedBy: req.user.id,
        reviewedAt: new Date().toISOString(),
      },
    };

    switch (decision) {
      case "approve":
        newStatus = ClaimStatus.APPROVED;
        if (approvedAmount) {
          updateData.financial = {
            ...claim.financial,
            approvedAmount,
          };
        }
        break;
      case "reject":
        newStatus = ClaimStatus.REJECTED;
        break;
      case "request_more_info":
        newStatus = ClaimStatus.PENDING_DOCUMENTS;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid decision",
        });
    }

    updateData.status = newStatus;

    // Update claim
    const updatedClaim = healthcareDatabase.updateHealthcareClaim(
      claimId,
      updateData,
    );

    // Add review comment
    healthcareDatabase.addComment(claimId, {
      authorId: req.user.id,
      authorName: `${req.user.firstName} ${req.user.lastName}`,
      authorRole: req.user.role,
      message: comments,
      type: "decision",
      isInternal: false,
    });

    // Mock email notification to customer
    const customerMessage =
      decision === "approve"
        ? `Your claim ${claim.claimNumber} has been approved${approvedAmount ? ` for ${approvedAmount.toLocaleString()} VND` : ""}`
        : decision === "reject"
          ? `Your claim ${claim.claimNumber} has been rejected`
          : `Additional documents required for claim ${claim.claimNumber}`;

    console.log(`Email sent to ${claim.patient.fullName}: ${customerMessage}`);

    res.json({
      success: true,
      claim: updatedClaim,
      message: "Claim reviewed successfully",
    });
  } catch (error) {
    console.error("Review healthcare claim error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Add comment to healthcare claim
export const handleAddClaimComment: RequestHandler = async (
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

    const { claimId } = req.params;
    const { message, type, isInternal } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Comment message is required",
      });
    }

    const claim = healthcareDatabase.getHealthcareClaimById(claimId);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: "Claim not found",
      });
    }

    // Check if user has permission to comment on this claim
    const canComment =
      canManageClaims(req.user) ||
      claim.submittedBy === req.user.id ||
      claim.processing.assignedTo === req.user.id;

    if (!canComment) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const comment = healthcareDatabase.addComment(claimId, {
      authorId: req.user.id,
      authorName: `${req.user.firstName} ${req.user.lastName}`,
      authorRole: req.user.role,
      message,
      type: type || "info",
      isInternal: isInternal || false,
    });

    res.json({
      success: true,
      comment,
      message: "Comment added successfully",
    });
  } catch (error) {
    console.error("Add claim comment error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get customer dashboard data
export const handleGetCustomerDashboard: RequestHandler = async (
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

    if (req.user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can access this dashboard",
      });
    }

    const dashboardData = healthcareDatabase.getCustomerDashboard(req.user.id);

    res.json({
      success: true,
      dashboard: dashboardData,
    });
  } catch (error) {
    console.error("Get customer dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get TPA dashboard data
export const handleGetTPADashboard: RequestHandler = async (
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

    if (!["claim_executive", "claims_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const dashboardData = healthcareDatabase.getTPADashboard(req.user.id);

    res.json({
      success: true,
      dashboard: dashboardData,
    });
  } catch (error) {
    console.error("Get TPA dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get insurance dashboard data
export const handleGetInsuranceDashboard: RequestHandler = async (
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

    if (!["admin", "claims_manager"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const dashboardData = healthcareDatabase.getInsuranceDashboard();

    res.json({
      success: true,
      dashboard: dashboardData,
    });
  } catch (error) {
    console.error("Get insurance dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
