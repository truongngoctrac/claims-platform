import bcrypt from "bcryptjs";
import { User, UserRole, ClaimAssignment, Notification } from "../shared/auth";

// In-memory database (replace with real database later)
class Database {
  private users: User[] = [];
  private claims: any[] = [];
  private assignments: ClaimAssignment[] = [];
  private notifications: Notification[] = [];

  constructor() {
    this.initializeData();
  }

  private async initializeData() {
    // Create default users with hashed passwords
    const defaultPassword = await bcrypt.hash("password123", 10);

    this.users = [
      {
        id: "admin-1",
        email: "admin@claimflow.com",
        firstName: "System",
        lastName: "Administrator",
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date().toISOString(),
        department: "IT",
      },
      {
        id: "manager-1",
        email: "manager@claimflow.com",
        firstName: "Sarah",
        lastName: "Wilson",
        role: UserRole.CLAIMS_MANAGER,
        isActive: true,
        createdAt: new Date().toISOString(),
        department: "Claims",
        phoneNumber: "+1-555-0101",
      },
      {
        id: "executive-1",
        email: "mike@claimflow.com",
        firstName: "Mike",
        lastName: "Johnson",
        role: UserRole.CLAIM_EXECUTIVE,
        isActive: true,
        createdAt: new Date().toISOString(),
        department: "Claims",
        phoneNumber: "+1-555-0102",
      },
      {
        id: "executive-2",
        email: "lisa@claimflow.com",
        firstName: "Lisa",
        lastName: "Brown",
        role: UserRole.CLAIM_EXECUTIVE,
        isActive: true,
        createdAt: new Date().toISOString(),
        department: "Claims",
        phoneNumber: "+1-555-0103",
      },
      {
        id: "customer-1",
        email: "john@example.com",
        firstName: "John",
        lastName: "Smith",
        role: UserRole.CUSTOMER,
        isActive: true,
        createdAt: new Date().toISOString(),
        phoneNumber: "+1-555-0201",
      },
    ];

    // Store password separately (in real app, this would be in the user record)
    this.userPasswords = new Map();
    for (const user of this.users) {
      this.userPasswords.set(user.id, defaultPassword);
    }

    // Initialize sample claims
    this.claims = [
      {
        id: "CLM-2024-001",
        customerId: "customer-1",
        customer: "John Smith",
        type: "Auto Insurance",
        amount: "$12,500",
        status: "pending",
        priority: "high",
        submitted: "2024-01-15",
        description: "Vehicle collision on highway",
        documents: ["police_report.pdf", "estimate.pdf"],
      },
      {
        id: "CLM-2024-002",
        customerId: "customer-1",
        customer: "Maria Garcia",
        type: "Home Insurance",
        amount: "$8,200",
        status: "pending",
        priority: "medium",
        submitted: "2024-01-14",
        description: "Water damage from burst pipe",
        documents: ["photos.zip", "repair_estimate.pdf"],
      },
      {
        id: "CLM-2024-003",
        customerId: "customer-1",
        customer: "David Chen",
        type: "Health Insurance",
        amount: "$3,400",
        status: "in-review",
        priority: "low",
        submitted: "2024-01-12",
        description: "Emergency room visit",
        documents: ["medical_bill.pdf"],
        assignedTo: "executive-2",
      },
    ];
  }

  private userPasswords = new Map<string, string>();

  // User management
  async createUser(
    userData: Omit<User, "id" | "createdAt">,
    password: string,
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user: User = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.users.push(user);
    this.userPasswords.set(user.id, hashedPassword);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) || null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) || null;
  }

  async validatePassword(userId: string, password: string): Promise<boolean> {
    const hashedPassword = this.userPasswords.get(userId);
    if (!hashedPassword) return false;
    return bcrypt.compare(password, hashedPassword);
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      user.lastLogin = new Date().toISOString();
    }
  }

  getAllUsers(): User[] {
    return this.users;
  }

  getUsersByRole(role: UserRole): User[] {
    return this.users.filter((user) => user.role === role);
  }

  // Claims management
  getAllClaims(): any[] {
    return this.claims;
  }

  getClaimById(id: string): any | null {
    return this.claims.find((claim) => claim.id === id) || null;
  }

  updateClaimStatus(claimId: string, status: string): any | null {
    const claim = this.claims.find((c) => c.id === claimId);
    if (claim) {
      claim.status = status;
      claim.lastUpdated = new Date().toISOString();
    }
    return claim;
  }

  updateClaimAssignment(claimId: string, assignedTo: string): any | null {
    const claim = this.claims.find((c) => c.id === claimId);
    if (claim) {
      claim.assignedTo = assignedTo;
      claim.status = "in-review";
      claim.assignedAt = new Date().toISOString();
    }
    return claim;
  }

  getUnassignedClaims(): any[] {
    return this.claims.filter((claim) => !claim.assignedTo);
  }

  getClaimsByAssignee(userId: string): any[] {
    return this.claims.filter((claim) => claim.assignedTo === userId);
  }

  // Assignment management
  createAssignment(assignment: Omit<ClaimAssignment, "id">): ClaimAssignment {
    const newAssignment: ClaimAssignment = {
      ...assignment,
      id: `assignment-${Date.now()}`,
    };
    this.assignments.push(newAssignment);
    return newAssignment;
  }

  getAssignmentsByUser(userId: string): ClaimAssignment[] {
    return this.assignments.filter(
      (assignment) => assignment.assignedTo === userId,
    );
  }

  getAllAssignments(): ClaimAssignment[] {
    return this.assignments;
  }

  // Notifications management
  createNotification(
    notification: Omit<Notification, "id" | "createdAt" | "isRead">,
  ): Notification {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(newNotification);
    return newNotification;
  }

  getNotificationsByUser(userId: string): Notification[] {
    return this.notifications
      .filter((notification) => notification.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  markNotificationAsRead(notificationId: string): boolean {
    const notification = this.notifications.find(
      (n) => n.id === notificationId,
    );
    if (notification) {
      notification.isRead = true;
      return true;
    }
    return false;
  }

  getUnreadNotificationCount(userId: string): number {
    return this.notifications.filter(
      (notification) => notification.userId === userId && !notification.isRead,
    ).length;
  }
}

export const database = new Database();
