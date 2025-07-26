import { RequestHandler } from "express";
import { database } from "../database";
import { AuthRequest } from "../auth";
import { NotificationRequest } from "../../shared/auth";

// Get user notifications
export const handleGetNotifications: RequestHandler = async (
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

    const notifications = database.getNotificationsByUser(req.user.id);
    const unreadCount = database.getUnreadNotificationCount(req.user.id);

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Mark notification as read
export const handleMarkNotificationRead: RequestHandler = async (
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

    const success = database.markNotificationAsRead(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create notification (admin/system only)
export const handleCreateNotification: RequestHandler = async (
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

    // Only admins can create system notifications
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { userId, type, title, message, data }: NotificationRequest =
      req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    const notification = database.createNotification({
      userId,
      type,
      title,
      message,
      data,
    });

    res.status(201).json({
      success: true,
      notification,
      message: "Notification created successfully",
    });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get unread notification count
export const handleGetUnreadCount: RequestHandler = async (
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

    const unreadCount = database.getUnreadNotificationCount(req.user.id);

    res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
