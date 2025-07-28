import * as jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User, UserRole } from "../shared/auth";

// JWT secret (in production, use environment variable)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Extended request interface to include user
export interface AuthRequest extends Request {
  user?: User;
}

// Generate JWT token
export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "24h",
    },
  );
}

// Verify JWT token
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication middleware
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  // Add user info to request
  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
  } as User;

  next();
}

// Authorization middleware for specific roles
export function authorize(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
}

// Role check utilities
export function isAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN;
}

export function isClaimsManager(user: User): boolean {
  return user.role === UserRole.CLAIMS_MANAGER;
}

export function isClaimExecutive(user: User): boolean {
  return user.role === UserRole.CLAIM_EXECUTIVE;
}

export function isCustomer(user: User): boolean {
  return user.role === UserRole.CUSTOMER;
}

export function canManageClaims(user: User): boolean {
  return [
    UserRole.ADMIN,
    UserRole.CLAIMS_MANAGER,
    UserRole.CLAIM_EXECUTIVE,
  ].includes(user.role);
}

export function canAssignClaims(user: User): boolean {
  return [UserRole.ADMIN, UserRole.CLAIMS_MANAGER].includes(user.role);
}
