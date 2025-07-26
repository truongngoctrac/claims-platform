import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface WebSocketConnection {
  id: string;
  socketId: string;
  userId: string;
  userRole: string;
  connectedAt: Date;
  lastActivity: Date;
  rooms: string[];
  metadata: Record<string, any>;
}

export interface WebSocketMessage {
  id: string;
  type: string;
  payload: any;
  senderId: string;
  targetId?: string;
  targetRoom?: string;
  timestamp: Date;
  persistent: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface MessageRoutingRule {
  id: string;
  name: string;
  condition: (message: WebSocketMessage, connection: WebSocketConnection) => boolean;
  action: 'allow' | 'block' | 'transform' | 'route';
  target?: string;
  transform?: (message: WebSocketMessage) => WebSocketMessage;
  priority: number;
  active: boolean;
}

export class WebSocketService extends EventEmitter {
  private io: SocketIOServer;
  private connections: Map<string, WebSocketConnection> = new Map();
  private messageHistory: Map<string, WebSocketMessage[]> = new Map();
  private routingRules: MessageRoutingRule[] = [];
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();
  private rooms: Map<string, Set<string>> = new Map();

  constructor(httpServer: HttpServer) {
    super();
    this.initializeSocketIO(httpServer);
    this.setupDefaultRoutingRules();
    this.startMaintenanceTasks();
  }

  // 2.2.41 WebSocket server implementation
  private initializeSocketIO(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // 2.2.45 Authentication cho WebSocket
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        
        // Attach user info to socket
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        socket.userName = decoded.name;
        
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  // 2.2.43 Connection management
  private handleConnection(socket: any): void {
    const connection: WebSocketConnection = {
      id: uuidv4(),
      socketId: socket.id,
      userId: socket.userId,
      userRole: socket.userRole,
      connectedAt: new Date(),
      lastActivity: new Date(),
      rooms: [],
      metadata: {
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      }
    };

    this.connections.set(socket.id, connection);
    
    // Join user-specific room
    const userRoom = `user:${socket.userId}`;
    socket.join(userRoom);
    connection.rooms.push(userRoom);

    // Join role-specific room
    const roleRoom = `role:${socket.userRole}`;
    socket.join(roleRoom);
    connection.rooms.push(roleRoom);

    this.emit('userConnected', connection);

    // Setup event handlers
    this.setupSocketEventHandlers(socket);

    console.log(`User ${socket.userId} connected (${socket.id})`);
  }

  private setupSocketEventHandlers(socket: any): void {
    // 2.2.44 Message routing system
    socket.on('message', async (data: any) => {
      try {
        if (!this.checkRateLimit(socket.userId)) {
          socket.emit('error', { message: 'Rate limit exceeded' });
          return;
        }

        const message: WebSocketMessage = {
          id: uuidv4(),
          type: data.type,
          payload: data.payload,
          senderId: socket.userId,
          targetId: data.targetId,
          targetRoom: data.targetRoom,
          timestamp: new Date(),
          persistent: data.persistent || false,
          priority: data.priority || 'medium'
        };

        await this.routeMessage(message, socket);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Join room
    socket.on('join-room', (roomName: string) => {
      const connection = this.connections.get(socket.id);
      if (!connection) return;

      // Validate room access
      if (this.canJoinRoom(connection, roomName)) {
        socket.join(roomName);
        connection.rooms.push(roomName);
        
        // Add to room tracking
        if (!this.rooms.has(roomName)) {
          this.rooms.set(roomName, new Set());
        }
        this.rooms.get(roomName)!.add(socket.id);

        socket.emit('room-joined', { room: roomName });
        this.emit('userJoinedRoom', { connection, room: roomName });
      } else {
        socket.emit('error', { message: 'Access denied to room' });
      }
    });

    // Leave room
    socket.on('leave-room', (roomName: string) => {
      const connection = this.connections.get(socket.id);
      if (!connection) return;

      socket.leave(roomName);
      connection.rooms = connection.rooms.filter(room => room !== roomName);
      
      // Remove from room tracking
      const roomConnections = this.rooms.get(roomName);
      if (roomConnections) {
        roomConnections.delete(socket.id);
        if (roomConnections.size === 0) {
          this.rooms.delete(roomName);
        }
      }

      socket.emit('room-left', { room: roomName });
    });

    // Heartbeat for connection monitoring
    socket.on('heartbeat', () => {
      const connection = this.connections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
        this.connections.set(socket.id, connection);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason);
    });

    // 2.2.48 Connection recovery mechanisms
    socket.on('reconnect-request', async (lastMessageId: string) => {
      try {
        const missedMessages = await this.getMissedMessages(socket.userId, lastMessageId);
        socket.emit('missed-messages', missedMessages);
      } catch (error) {
        socket.emit('error', { message: 'Failed to retrieve missed messages' });
      }
    });
  }

  // 2.2.42 Real-time event broadcasting
  async broadcastToRoom(roomName: string, event: string, data: any): Promise<void> {
    const message: WebSocketMessage = {
      id: uuidv4(),
      type: event,
      payload: data,
      senderId: 'system',
      targetRoom: roomName,
      timestamp: new Date(),
      persistent: true,
      priority: 'medium'
    };

    // Store message if persistent
    if (message.persistent) {
      await this.storeMessage(message);
    }

    this.io.to(roomName).emit(event, data);
    this.emit('messageBroadcast', { roomName, event, data });
  }

  async broadcastToUser(userId: string, event: string, data: any): Promise<void> {
    const userRoom = `user:${userId}`;
    await this.broadcastToRoom(userRoom, event, data);
  }

  async broadcastToRole(role: string, event: string, data: any): Promise<void> {
    const roleRoom = `role:${role}`;
    await this.broadcastToRoom(roleRoom, event, data);
  }

  async broadcastGlobal(event: string, data: any, excludeUser?: string): Promise<void> {
    const message: WebSocketMessage = {
      id: uuidv4(),
      type: event,
      payload: data,
      senderId: 'system',
      timestamp: new Date(),
      persistent: true,
      priority: 'high'
    };

    if (message.persistent) {
      await this.storeMessage(message);
    }

    if (excludeUser) {
      const excludeSocket = this.getSocketByUserId(excludeUser);
      if (excludeSocket) {
        excludeSocket.broadcast.emit(event, data);
      }
    } else {
      this.io.emit(event, data);
    }

    this.emit('globalBroadcast', { event, data });
  }

  // Message routing
  private async routeMessage(message: WebSocketMessage, senderSocket: any): Promise<void> {
    const connection = this.connections.get(senderSocket.id);
    if (!connection) return;

    // Apply routing rules
    for (const rule of this.routingRules.filter(r => r.active).sort((a, b) => a.priority - b.priority)) {
      if (rule.condition(message, connection)) {
        switch (rule.action) {
          case 'block':
            return;
          case 'transform':
            if (rule.transform) {
              message = rule.transform(message);
            }
            break;
          case 'route':
            if (rule.target) {
              message.targetRoom = rule.target;
            }
            break;
        }
      }
    }

    // Store message if persistent
    if (message.persistent) {
      await this.storeMessage(message);
    }

    // Route message
    if (message.targetId) {
      // Direct message to specific user
      const targetRoom = `user:${message.targetId}`;
      this.io.to(targetRoom).emit('message', message);
    } else if (message.targetRoom) {
      // Message to specific room
      this.io.to(message.targetRoom).emit('message', message);
    } else {
      // Broadcast to all connected users
      this.io.emit('message', message);
    }

    this.emit('messageRouted', message);
  }

  // 2.2.47 Message persistence
  private async storeMessage(message: WebSocketMessage): Promise<void> {
    const roomKey = message.targetRoom || message.targetId || 'global';
    
    if (!this.messageHistory.has(roomKey)) {
      this.messageHistory.set(roomKey, []);
    }

    const messages = this.messageHistory.get(roomKey)!;
    messages.push(message);

    // Keep only last 1000 messages per room
    if (messages.length > 1000) {
      messages.splice(0, messages.length - 1000);
    }

    this.messageHistory.set(roomKey, messages);
  }

  private async getMissedMessages(userId: string, lastMessageId: string): Promise<WebSocketMessage[]> {
    const userRoom = `user:${userId}`;
    const messages = this.messageHistory.get(userRoom) || [];
    
    const lastMessageIndex = messages.findIndex(m => m.id === lastMessageId);
    if (lastMessageIndex === -1) {
      // Return last 10 messages if last message not found
      return messages.slice(-10);
    }

    return messages.slice(lastMessageIndex + 1);
  }

  // 2.2.49 Rate limiting cho messages
  private checkRateLimit(userId: string): boolean {
    const key = userId;
    const now = new Date();
    const limit = this.rateLimits.get(key);

    const maxMessages = 100; // per minute

    if (!limit || limit.resetAt < now) {
      this.rateLimits.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + 60 * 1000) // 1 minute
      });
      return true;
    }

    if (limit.count >= maxMessages) {
      return false;
    }

    limit.count++;
    this.rateLimits.set(key, limit);
    return true;
  }

  private handleDisconnection(socket: any, reason: string): void {
    const connection = this.connections.get(socket.id);
    if (!connection) return;

    // Remove from all rooms
    connection.rooms.forEach(roomName => {
      const roomConnections = this.rooms.get(roomName);
      if (roomConnections) {
        roomConnections.delete(socket.id);
        if (roomConnections.size === 0) {
          this.rooms.delete(roomName);
        }
      }
    });

    this.connections.delete(socket.id);
    this.emit('userDisconnected', { connection, reason });

    console.log(`User ${socket.userId} disconnected (${socket.id}): ${reason}`);
  }

  // 2.2.46 Scalable WebSocket architecture
  private setupDefaultRoutingRules(): void {
    this.routingRules = [
      {
        id: 'admin-only-alerts',
        name: 'Admin Only Alerts',
        condition: (message) => message.type === 'system_alert',
        action: 'route',
        target: 'role:admin',
        priority: 1,
        active: true
      },
      {
        id: 'claim-updates-to-assigned',
        name: 'Claim Updates to Assigned User',
        condition: (message) => message.type.startsWith('claim_'),
        action: 'route',
        target: message => `claim:${message.payload.claimId}`,
        priority: 2,
        active: true
      },
      {
        id: 'rate-limit-spam',
        name: 'Block Spam Messages',
        condition: (message, connection) => {
          const recentMessages = this.getRecentMessagesByUser(connection.userId, 10000); // 10 seconds
          return recentMessages.length > 10;
        },
        action: 'block',
        priority: 0,
        active: true
      }
    ];
  }

  // 2.2.50 WebSocket monitoring
  getConnectionStats(): any {
    const connections = Array.from(this.connections.values());
    const now = new Date();
    
    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => 
        (now.getTime() - c.lastActivity.getTime()) < 60000 // active in last minute
      ).length,
      connectionsByRole: this.groupBy(connections, 'userRole'),
      averageConnectionDuration: this.calculateAverageConnectionDuration(connections),
      roomStats: this.getRoomStats(),
      messageStats: this.getMessageStats()
    };
  }

  private getRecentMessagesByUser(userId: string, timeWindow: number): WebSocketMessage[] {
    const cutoff = new Date(Date.now() - timeWindow);
    const allMessages = Array.from(this.messageHistory.values()).flat();
    
    return allMessages.filter(m => 
      m.senderId === userId && m.timestamp > cutoff
    );
  }

  private canJoinRoom(connection: WebSocketConnection, roomName: string): boolean {
    // Room access control logic
    if (roomName.startsWith('admin:') && connection.userRole !== 'admin') {
      return false;
    }
    
    if (roomName.startsWith('claim:')) {
      // Check if user has access to specific claim
      const claimId = roomName.split(':')[1];
      return this.canAccessClaim(connection.userId, connection.userRole, claimId);
    }

    return true;
  }

  private canAccessClaim(userId: string, userRole: string, claimId: string): boolean {
    // Mock access control - in real implementation would check database
    if (userRole === 'admin' || userRole === 'claims_manager') {
      return true;
    }
    
    // Check if claim is assigned to user or belongs to user
    return true; // Simplified for demo
  }

  private getSocketByUserId(userId: string): any {
    for (const [socketId, connection] of this.connections.entries()) {
      if (connection.userId === userId) {
        return this.io.sockets.sockets.get(socketId);
      }
    }
    return null;
  }

  private getRoomStats(): any {
    const roomStats: Record<string, number> = {};
    for (const [roomName, connections] of this.rooms.entries()) {
      roomStats[roomName] = connections.size;
    }
    return roomStats;
  }

  private getMessageStats(): any {
    const totalMessages = Array.from(this.messageHistory.values())
      .reduce((sum, messages) => sum + messages.length, 0);
    
    const messagesByType: Record<string, number> = {};
    Array.from(this.messageHistory.values()).flat().forEach(message => {
      messagesByType[message.type] = (messagesByType[message.type] || 0) + 1;
    });

    return {
      totalStored: totalMessages,
      byType: messagesByType
    };
  }

  private calculateAverageConnectionDuration(connections: WebSocketConnection[]): number {
    if (connections.length === 0) return 0;
    
    const now = new Date();
    const totalDuration = connections.reduce((sum, conn) => 
      sum + (now.getTime() - conn.connectedAt.getTime()), 0
    );
    
    return totalDuration / connections.length / 1000; // seconds
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  private startMaintenanceTasks(): void {
    // Clean up old messages every hour
    setInterval(() => {
      this.cleanupOldMessages();
    }, 60 * 60 * 1000);

    // Reset rate limits every minute
    setInterval(() => {
      this.resetRateLimits();
    }, 60 * 1000);

    // Check connection health every 30 seconds
    setInterval(() => {
      this.checkConnectionHealth();
    }, 30 * 1000);
  }

  private cleanupOldMessages(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    for (const [roomKey, messages] of this.messageHistory.entries()) {
      const filteredMessages = messages.filter(m => m.timestamp > cutoff);
      this.messageHistory.set(roomKey, filteredMessages);
    }
  }

  private resetRateLimits(): void {
    const now = new Date();
    for (const [key, limit] of this.rateLimits.entries()) {
      if (limit.resetAt < now) {
        this.rateLimits.delete(key);
      }
    }
  }

  private checkConnectionHealth(): void {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [socketId, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastActivity.getTime() > staleThreshold) {
        // Disconnect stale connections
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }

  // Public API methods
  async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    try {
      await this.broadcastToUser(userId, event, data);
      return true;
    } catch (error) {
      console.error('Failed to send message to user:', error);
      return false;
    }
  }

  async sendToRoom(roomName: string, event: string, data: any): Promise<boolean> {
    try {
      await this.broadcastToRoom(roomName, event, data);
      return true;
    } catch (error) {
      console.error('Failed to send message to room:', error);
      return false;
    }
  }

  getActiveUsers(): string[] {
    return Array.from(this.connections.values()).map(conn => conn.userId);
  }

  getUserConnections(userId: string): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.userId === userId);
  }

  isUserOnline(userId: string): boolean {
    return this.getUserConnections(userId).length > 0;
  }
}
