import { RequestHandler } from "express";
import { database } from "../database";
import { generateToken, AuthRequest } from "../auth";
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  AuthResponse,
} from "../../shared/auth";

// Login handler
export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      } as LoginResponse);
    }

    // Find user by email
    const user = await database.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      } as LoginResponse);
    }

    // Validate password
    const isValidPassword = await database.validatePassword(user.id, password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      } as LoginResponse);
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      } as LoginResponse);
    }

    // Update last login
    await database.updateUserLastLogin(user.id);

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      user,
      token,
      message: "Login successful",
    } as LoginResponse);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    } as LoginResponse);
  }
};

// Register handler (for admin creating new users)
export const handleRegister: RequestHandler = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      department,
      phoneNumber,
    }: RegisterRequest = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      } as AuthResponse);
    }

    // Check if user already exists
    const existingUser = await database.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      } as AuthResponse);
    }

    // Create new user
    const newUser = await database.createUser(
      {
        email,
        firstName,
        lastName,
        role,
        isActive: true,
        department,
        phoneNumber,
      },
      password,
    );

    // Remove sensitive data from response
    const { ...userResponse } = newUser;

    res.status(201).json({
      success: true,
      user: userResponse,
      message: "User created successfully",
    } as AuthResponse);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    } as AuthResponse);
  }
};

// Get current user profile
export const handleProfile: RequestHandler = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Get full user details
    const user = await database.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Logout handler (client-side token removal mainly)
export const handleLogout: RequestHandler = async (req, res) => {
  // In a more complex system, you might want to blacklist the token
  res.json({
    success: true,
    message: "Logged out successfully",
  });
};
