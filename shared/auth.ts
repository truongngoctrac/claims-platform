// User roles in the system
export enum UserRole {
  ADMIN = "admin",
  CLAIMS_MANAGER = "claims_manager",
  CLAIM_EXECUTIVE = "claim_executive",
  CUSTOMER = "customer",
  HOSPITAL_STAFF = "hospital_staff",
}

// User interface
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  department?: string;
  phoneNumber?: string;
}

// Authentication requests/responses
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  phoneNumber?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
}

// Claim assignment interfaces
export interface ClaimAssignment {
  id: string;
  claimId: string;
  assignedTo: string; // user ID
  assignedBy: string; // user ID
  assignedAt: string;
  status: "active" | "completed" | "transferred";
  priority: "low" | "medium" | "high";
  deadline?: string;
  notes?: string;
}

export interface AssignClaimRequest {
  claimId: string;
  assignedTo: string;
  priority: "low" | "medium" | "high";
  deadline?: string;
  notes?: string;
}

// Notification interfaces
export interface Notification {
  id: string;
  userId: string;
  type: "claim_assigned" | "claim_updated" | "deadline_reminder" | "system";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: any; // Additional notification data
}

export interface NotificationRequest {
  userId: string;
  type: Notification["type"];
  title: string;
  message: string;
  data?: any;
}

// Email notification interfaces (mocked for now)
export interface EmailNotification {
  to: string;
  subject: string;
  template:
    | "claim_submitted"
    | "claim_assigned"
    | "claim_status_update"
    | "password_reset";
  data: any;
}
