import { AuthenticationEvent } from "../types";
import { EventEmitter } from "events";

interface MFAMethod {
  id: string;
  user_id: string;
  type: "totp" | "sms" | "email" | "push" | "hardware_token" | "biometric";
  enabled: boolean;
  verified: boolean;
  secret?: string;
  phone_number?: string;
  email?: string;
  device_id?: string;
  backup_codes: string[];
  created_at: Date;
  last_used?: Date;
}

interface MFAChallenge {
  id: string;
  user_id: string;
  method_type: string;
  code: string;
  expires_at: Date;
  attempts: number;
  max_attempts: number;
  verified: boolean;
  created_at: Date;
}

export class MultiFactorAuthService extends EventEmitter {
  private mfaMethods: Map<string, MFAMethod[]> = new Map();
  private challenges: Map<string, MFAChallenge> = new Map();

  async setupMFA(
    userId: string,
    type: MFAMethod["type"],
    details: any,
  ): Promise<{ secret?: string; qr_code?: string; setup_complete: boolean }> {
    const method: MFAMethod = {
      id: `mfa_${Date.now()}`,
      user_id: userId,
      type,
      enabled: false,
      verified: false,
      backup_codes: this.generateBackupCodes(),
      created_at: new Date(),
      ...details,
    };

    const userMethods = this.mfaMethods.get(userId) || [];
    userMethods.push(method);
    this.mfaMethods.set(userId, userMethods);

    if (type === "totp") {
      const secret = this.generateTOTPSecret();
      method.secret = secret;
      return {
        secret,
        qr_code: this.generateQRCode(secret),
        setup_complete: false,
      };
    }

    return { setup_complete: true };
  }

  async verifyMFA(
    userId: string,
    code: string,
    methodType?: string,
  ): Promise<{ verified: boolean; method_used: string }> {
    const userMethods = this.mfaMethods.get(userId) || [];
    const method = methodType
      ? userMethods.find((m) => m.type === methodType && m.enabled)
      : userMethods.find((m) => m.enabled);

    if (!method) {
      return { verified: false, method_used: "none" };
    }

    const verified = await this.validateCode(method, code);

    if (verified) {
      method.last_used = new Date();
      this.emit("mfa_verified", { user_id: userId, method: method.type });
    }

    return { verified, method_used: method.type };
  }

  async createChallenge(
    userId: string,
    methodType: string,
  ): Promise<{ challenge_id: string; delivery_method: string }> {
    const userMethods = this.mfaMethods.get(userId) || [];
    const method = userMethods.find((m) => m.type === methodType && m.enabled);

    if (!method) {
      throw new Error("MFA method not found or not enabled");
    }

    const challenge: MFAChallenge = {
      id: `challenge_${Date.now()}`,
      user_id: userId,
      method_type: methodType,
      code: this.generateChallengeCode(methodType),
      expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      attempts: 0,
      max_attempts: 3,
      verified: false,
      created_at: new Date(),
    };

    this.challenges.set(challenge.id, challenge);

    if (methodType === "sms") {
      await this.sendSMS(method.phone_number!, challenge.code);
    } else if (methodType === "email") {
      await this.sendEmail(method.email!, challenge.code);
    }

    return { challenge_id: challenge.id, delivery_method: methodType };
  }

  async isHealthy(): Promise<boolean> {
    return this.mfaMethods.size >= 0;
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10),
    );
  }

  private generateTOTPSecret(): string {
    return Math.random().toString(36).substring(2, 32);
  }

  private generateQRCode(secret: string): string {
    return `otpauth://totp/HealthcareApp?secret=${secret}`;
  }

  private generateChallengeCode(methodType: string): string {
    return methodType === "sms"
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : Math.random().toString(36).substring(2, 8);
  }

  private async validateCode(
    method: MFAMethod,
    code: string,
  ): Promise<boolean> {
    if (method.type === "totp") {
      return this.validateTOTP(method.secret!, code);
    }
    return method.backup_codes.includes(code);
  }

  private validateTOTP(secret: string, code: string): boolean {
    // Mock TOTP validation
    return code.length === 6 && /^\d+$/.test(code);
  }

  private async sendSMS(phoneNumber: string, code: string): Promise<void> {
    this.emit("sms_sent", { phone: phoneNumber, code });
  }

  private async sendEmail(email: string, code: string): Promise<void> {
    this.emit("email_sent", { email, code });
  }
}
