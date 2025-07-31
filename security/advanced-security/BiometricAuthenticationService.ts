import { BiometricTemplate } from "../types";
import { EventEmitter } from "events";

interface BiometricVerification {
  id: string;
  user_id: string;
  template_id: string;
  verification_score: number;
  threshold: number;
  verified: boolean;
  verification_time: number;
  timestamp: Date;
}

export class BiometricAuthenticationService extends EventEmitter {
  private templates: Map<string, BiometricTemplate[]> = new Map();
  private verifications: BiometricVerification[] = [];

  async enrollBiometric(
    userId: string,
    biometricType: BiometricTemplate["biometric_type"],
    templateData: string,
    deviceId: string,
  ): Promise<{
    template_id: string;
    quality_score: number;
    enrollment_complete: boolean;
  }> {
    const qualityScore = this.assessTemplateQuality(templateData);

    if (qualityScore < 0.7) {
      throw new Error("Biometric template quality too low for enrollment");
    }

    const template: BiometricTemplate = {
      id: `template_${Date.now()}`,
      user_id: userId,
      biometric_type: biometricType,
      template_data: this.encryptTemplate(templateData),
      quality_score: qualityScore,
      enrollment_date: new Date(),
      last_used: new Date(),
      usage_count: 0,
      device_id: deviceId,
      active: true,
    };

    const userTemplates = this.templates.get(userId) || [];
    userTemplates.push(template);
    this.templates.set(userId, userTemplates);

    this.emit("biometric_enrolled", {
      user_id: userId,
      type: biometricType,
      quality: qualityScore,
    });

    return {
      template_id: template.id,
      quality_score: qualityScore,
      enrollment_complete: true,
    };
  }

  async verifyBiometric(
    userId: string,
    biometricType: BiometricTemplate["biometric_type"],
    templateData: string,
  ): Promise<{ verified: boolean; confidence: number; template_used: string }> {
    const userTemplates = this.templates.get(userId) || [];
    const matchingTemplates = userTemplates.filter(
      (t) => t.biometric_type === biometricType && t.active,
    );

    if (matchingTemplates.length === 0) {
      return { verified: false, confidence: 0, template_used: "none" };
    }

    let bestMatch = { score: 0, template: null as BiometricTemplate | null };

    for (const template of matchingTemplates) {
      const score = this.compareTemplates(template.template_data, templateData);
      if (score > bestMatch.score) {
        bestMatch = { score, template };
      }
    }

    const threshold = this.getVerificationThreshold(biometricType);
    const verified = bestMatch.score >= threshold;

    if (verified && bestMatch.template) {
      bestMatch.template.last_used = new Date();
      bestMatch.template.usage_count++;
    }

    const verification: BiometricVerification = {
      id: `verify_${Date.now()}`,
      user_id: userId,
      template_id: bestMatch.template?.id || "none",
      verification_score: bestMatch.score,
      threshold,
      verified,
      verification_time: 150, // Mock time in ms
      timestamp: new Date(),
    };

    this.verifications.push(verification);
    this.emit("biometric_verified", verification);

    return {
      verified,
      confidence: bestMatch.score,
      template_used: bestMatch.template?.id || "none",
    };
  }

  async getBiometricStatistics(userId?: string): Promise<{
    total_templates: number;
    by_type: Record<string, number>;
    verification_success_rate: number;
    average_confidence: number;
    active_templates: number;
  }> {
    const templates = userId
      ? this.templates.get(userId) || []
      : Array.from(this.templates.values()).flat();

    const verifications = userId
      ? this.verifications.filter((v) => v.user_id === userId)
      : this.verifications;

    const byType: Record<string, number> = {};
    templates.forEach((t) => {
      byType[t.biometric_type] = (byType[t.biometric_type] || 0) + 1;
    });

    const successfulVerifications = verifications.filter(
      (v) => v.verified,
    ).length;
    const successRate =
      verifications.length > 0
        ? (successfulVerifications / verifications.length) * 100
        : 0;

    const avgConfidence =
      verifications.length > 0
        ? verifications.reduce((sum, v) => sum + v.verification_score, 0) /
          verifications.length
        : 0;

    return {
      total_templates: templates.length,
      by_type: byType,
      verification_success_rate: successRate,
      average_confidence: avgConfidence,
      active_templates: templates.filter((t) => t.active).length,
    };
  }

  async isHealthy(): Promise<boolean> {
    return true; // Biometric service is always healthy
  }

  private assessTemplateQuality(templateData: string): number {
    // Mock quality assessment
    return Math.random() * 0.4 + 0.6; // 0.6 to 1.0
  }

  private encryptTemplate(templateData: string): string {
    // Mock encryption
    return Buffer.from(templateData).toString("base64");
  }

  private compareTemplates(
    storedTemplate: string,
    inputTemplate: string,
  ): number {
    // Mock biometric comparison - would use actual biometric matching algorithms
    return Math.random() * 0.3 + 0.7; // Simulate good match
  }

  private getVerificationThreshold(
    biometricType: BiometricTemplate["biometric_type"],
  ): number {
    const thresholds = {
      fingerprint: 0.85,
      face: 0.8,
      voice: 0.75,
      iris: 0.9,
      palm: 0.82,
    };
    return thresholds[biometricType] || 0.8;
  }
}
