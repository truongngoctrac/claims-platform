import { SecurityTrainingModule } from "../types";
import { EventEmitter } from "events";

interface TrainingAssignment {
  id: string;
  user_id: string;
  module_id: string;
  assigned_date: Date;
  due_date: Date;
  status: "assigned" | "in_progress" | "completed" | "overdue" | "failed";
  attempts: number;
  best_score: number;
  completion_date?: Date;
  time_spent_minutes: number;
  reminders_sent: number;
}

interface TrainingResult {
  id: string;
  assignment_id: string;
  user_id: string;
  module_id: string;
  score: number;
  passed: boolean;
  answers: Array<{ question: number; selected: number; correct: boolean }>;
  start_time: Date;
  end_time: Date;
  ip_address: string;
  device_info: string;
}

interface TrainingCampaign {
  id: string;
  name: string;
  description: string;
  target_roles: string[];
  module_ids: string[];
  start_date: Date;
  end_date: Date;
  mandatory: boolean;
  recurring: boolean;
  recurrence_interval_days?: number;
  auto_assign: boolean;
  reminder_schedule: number[]; // Days before due date
  enabled: boolean;
}

export class SecurityTrainingService extends EventEmitter {
  private modules: Map<string, SecurityTrainingModule> = new Map();
  private assignments: Map<string, TrainingAssignment> = new Map();
  private results: TrainingResult[] = [];
  private campaigns: Map<string, TrainingCampaign> = new Map();

  constructor() {
    super();
    this.initializeTrainingModules();
    this.initializeTrainingCampaigns();
  }

  async assignTraining(
    userId: string,
    moduleId: string,
    dueDate: Date,
    priority: "low" | "medium" | "high" = "medium",
  ): Promise<{
    assignment_id: string;
    estimated_duration: number;
    requirements: string[];
  }> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new Error(`Training module not found: ${moduleId}`);
    }

    const assignment: TrainingAssignment = {
      id: `assignment_${Date.now()}`,
      user_id: userId,
      module_id: moduleId,
      assigned_date: new Date(),
      due_date: dueDate,
      status: "assigned",
      attempts: 0,
      best_score: 0,
      time_spent_minutes: 0,
      reminders_sent: 0,
    };

    this.assignments.set(assignment.id, assignment);

    // Send assignment notification
    await this.sendAssignmentNotification(assignment, module);

    this.emit("training_assigned", {
      assignment_id: assignment.id,
      user_id: userId,
      module_name: module.title,
      due_date: dueDate,
    });

    return {
      assignment_id: assignment.id,
      estimated_duration: module.duration_minutes,
      requirements: ["browser_with_javascript", "stable_internet_connection"],
    };
  }

  async startTraining(
    assignmentId: string,
    userContext: { ip_address: string; device_info: string },
  ): Promise<{
    module: SecurityTrainingModule;
    session_id: string;
    time_limit_minutes: number;
  }> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    if (assignment.status === "completed") {
      throw new Error("Training already completed");
    }

    const module = this.modules.get(assignment.module_id);
    if (!module) {
      throw new Error(`Module not found: ${assignment.module_id}`);
    }

    assignment.status = "in_progress";
    assignment.attempts++;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.emit("training_started", {
      assignment_id: assignmentId,
      user_id: assignment.user_id,
      module_id: assignment.module_id,
      session_id: sessionId,
      attempt_number: assignment.attempts,
    });

    return {
      module,
      session_id: sessionId,
      time_limit_minutes: module.completion_criteria.time_limit_minutes,
    };
  }

  async submitTrainingResults(
    assignmentId: string,
    answers: number[],
    sessionContext: {
      session_id: string;
      ip_address: string;
      device_info: string;
      start_time: Date;
    },
  ): Promise<{
    passed: boolean;
    score: number;
    correct_answers: number;
    total_questions: number;
    can_retry: boolean;
    certificate_earned: boolean;
  }> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    const module = this.modules.get(assignment.module_id);
    if (!module) {
      throw new Error(`Module not found: ${assignment.module_id}`);
    }

    const endTime = new Date();
    const timeSpent = Math.round(
      (endTime.getTime() - sessionContext.start_time.getTime()) / 1000 / 60,
    );

    // Grade the answers
    const gradingResult = this.gradeAnswers(module.quiz_questions, answers);
    const passed =
      gradingResult.score >= module.completion_criteria.minimum_score;

    const result: TrainingResult = {
      id: `result_${Date.now()}`,
      assignment_id: assignmentId,
      user_id: assignment.user_id,
      module_id: assignment.module_id,
      score: gradingResult.score,
      passed,
      answers: gradingResult.answers,
      start_time: sessionContext.start_time,
      end_time: endTime,
      ip_address: sessionContext.ip_address,
      device_info: sessionContext.device_info,
    };

    this.results.push(result);

    // Update assignment
    assignment.time_spent_minutes += timeSpent;
    if (gradingResult.score > assignment.best_score) {
      assignment.best_score = gradingResult.score;
    }

    if (passed) {
      assignment.status = "completed";
      assignment.completion_date = new Date();
      await this.generateCertificate(assignment, module, result);
    } else {
      const canRetry =
        assignment.attempts < module.completion_criteria.retries_allowed;
      assignment.status = canRetry ? "assigned" : "failed";
    }

    const canRetry =
      assignment.attempts < module.completion_criteria.retries_allowed &&
      !passed;

    this.emit("training_completed", {
      assignment_id: assignmentId,
      user_id: assignment.user_id,
      module_id: assignment.module_id,
      passed,
      score: gradingResult.score,
      attempts: assignment.attempts,
    });

    return {
      passed,
      score: gradingResult.score,
      correct_answers: gradingResult.correct_count,
      total_questions: module.quiz_questions.length,
      can_retry: canRetry,
      certificate_earned: passed,
    };
  }

  async getTrainingProgress(userId: string): Promise<{
    total_assigned: number;
    completed: number;
    in_progress: number;
    overdue: number;
    completion_rate: number;
    upcoming_deadlines: Array<{ module_name: string; due_date: Date }>;
  }> {
    const userAssignments = Array.from(this.assignments.values()).filter(
      (a) => a.user_id === userId,
    );
    const now = new Date();

    const totalAssigned = userAssignments.length;
    const completed = userAssignments.filter(
      (a) => a.status === "completed",
    ).length;
    const inProgress = userAssignments.filter(
      (a) => a.status === "in_progress",
    ).length;
    const overdue = userAssignments.filter(
      (a) => a.due_date < now && a.status !== "completed",
    ).length;

    const upcomingDeadlines = userAssignments
      .filter((a) => a.status !== "completed" && a.due_date > now)
      .sort((a, b) => a.due_date.getTime() - b.due_date.getTime())
      .slice(0, 5)
      .map((a) => ({
        module_name: this.modules.get(a.module_id)?.title || "Unknown Module",
        due_date: a.due_date,
      }));

    return {
      total_assigned: totalAssigned,
      completed,
      in_progress: inProgress,
      overdue,
      completion_rate:
        totalAssigned > 0 ? (completed / totalAssigned) * 100 : 0,
      upcoming_deadlines: upcomingDeadlines,
    };
  }

  async getOrganizationStatistics(): Promise<{
    total_users_with_training: number;
    overall_completion_rate: number;
    by_module: Record<
      string,
      { assigned: number; completed: number; rate: number }
    >;
    by_department: Record<
      string,
      { assigned: number; completed: number; rate: number }
    >;
    overdue_training_count: number;
    average_score: number;
  }> {
    const allAssignments = Array.from(this.assignments.values());
    const uniqueUsers = new Set(allAssignments.map((a) => a.user_id));
    const completedAssignments = allAssignments.filter(
      (a) => a.status === "completed",
    );
    const now = new Date();
    const overdueCount = allAssignments.filter(
      (a) => a.due_date < now && a.status !== "completed",
    ).length;

    const byModule: Record<
      string,
      { assigned: number; completed: number; rate: number }
    > = {};
    for (const assignment of allAssignments) {
      const moduleId = assignment.module_id;
      if (!byModule[moduleId]) {
        byModule[moduleId] = { assigned: 0, completed: 0, rate: 0 };
      }
      byModule[moduleId].assigned++;
      if (assignment.status === "completed") {
        byModule[moduleId].completed++;
      }
    }

    // Calculate rates
    Object.keys(byModule).forEach((moduleId) => {
      const stats = byModule[moduleId];
      stats.rate =
        stats.assigned > 0 ? (stats.completed / stats.assigned) * 100 : 0;
    });

    const completedResults = this.results.filter((r) => r.passed);
    const averageScore =
      completedResults.length > 0
        ? completedResults.reduce((sum, r) => sum + r.score, 0) /
          completedResults.length
        : 0;

    return {
      total_users_with_training: uniqueUsers.size,
      overall_completion_rate:
        allAssignments.length > 0
          ? (completedAssignments.length / allAssignments.length) * 100
          : 0,
      by_module: byModule,
      by_department: {}, // Mock - would integrate with HR system
      overdue_training_count: overdueCount,
      average_score: averageScore,
    };
  }

  async scheduleTrainingCampaign(
    campaignName: string,
    targetRoles: string[],
    moduleIds: string[],
    startDate: Date,
    endDate: Date,
    mandatory: boolean = true,
  ): Promise<{ campaign_id: string; estimated_assignments: number }> {
    const campaign: TrainingCampaign = {
      id: `campaign_${Date.now()}`,
      name: campaignName,
      description: `Automated training campaign: ${campaignName}`,
      target_roles: targetRoles,
      module_ids: moduleIds,
      start_date: startDate,
      end_date: endDate,
      mandatory,
      recurring: false,
      auto_assign: true,
      reminder_schedule: [7, 3, 1], // 7, 3, and 1 days before due date
      enabled: true,
    };

    this.campaigns.set(campaign.id, campaign);

    // Estimate assignments (mock)
    const estimatedAssignments = targetRoles.length * moduleIds.length * 10; // 10 users per role

    this.emit("campaign_scheduled", {
      campaign_id: campaign.id,
      name: campaignName,
      start_date: startDate,
      estimated_assignments: estimatedAssignments,
    });

    return {
      campaign_id: campaign.id,
      estimated_assignments: estimatedAssignments,
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.modules.size > 0 && this.campaigns.size > 0;
  }

  // Private methods
  private gradeAnswers(
    questions: SecurityTrainingModule["quiz_questions"],
    answers: number[],
  ): {
    score: number;
    correct_count: number;
    answers: Array<{ question: number; selected: number; correct: boolean }>;
  } {
    let correctCount = 0;
    const gradedAnswers = [];

    for (let i = 0; i < questions.length && i < answers.length; i++) {
      const question = questions[i];
      const selectedAnswer = answers[i];
      const isCorrect = selectedAnswer === question.correct_answer;

      if (isCorrect) correctCount++;

      gradedAnswers.push({
        question: i,
        selected: selectedAnswer,
        correct: isCorrect,
      });
    }

    const score =
      questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    return {
      score: Math.round(score),
      correct_count: correctCount,
      answers: gradedAnswers,
    };
  }

  private async generateCertificate(
    assignment: TrainingAssignment,
    module: SecurityTrainingModule,
    result: TrainingResult,
  ): Promise<void> {
    const certificate = {
      id: `cert_${Date.now()}`,
      user_id: assignment.user_id,
      module_id: assignment.module_id,
      module_name: module.title,
      completion_date: assignment.completion_date,
      score: result.score,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    };

    this.emit("certificate_generated", certificate);
  }

  private async sendAssignmentNotification(
    assignment: TrainingAssignment,
    module: SecurityTrainingModule,
  ): Promise<void> {
    this.emit("assignment_notification", {
      user_id: assignment.user_id,
      module_title: module.title,
      due_date: assignment.due_date,
      estimated_duration: module.duration_minutes,
    });
  }

  private initializeTrainingModules(): void {
    const modules: SecurityTrainingModule[] = [
      {
        id: "healthcare_phishing_awareness",
        title: "Healthcare Phishing Awareness",
        description:
          "Learn to identify and respond to phishing attacks targeting healthcare organizations",
        category: "phishing",
        difficulty: "beginner",
        duration_minutes: 30,
        required_for_roles: ["all_staff", "nurses", "doctors", "admin_staff"],
        completion_criteria: {
          minimum_score: 80,
          time_limit_minutes: 45,
          retries_allowed: 2,
        },
        content_url: "/training/healthcare-phishing-awareness",
        quiz_questions: [
          {
            question:
              "What is the first thing you should do if you receive a suspicious email?",
            options: [
              "Click the link to verify",
              "Delete it immediately",
              "Report it to IT security",
              "Forward it to colleagues",
            ],
            correct_answer: 2,
            explanation:
              "Always report suspicious emails to IT security first before taking any other action.",
          },
          {
            question: "Which of these is a common sign of a phishing email?",
            options: [
              "Professional formatting",
              "Urgent language requiring immediate action",
              "Personalized greeting",
              "Company logo",
            ],
            correct_answer: 1,
            explanation:
              "Phishing emails often use urgent language to pressure victims into quick decisions.",
          },
          {
            question:
              "What should you do before clicking any link in an email?",
            options: [
              "Click it quickly",
              "Hover over it to see the actual URL",
              "Forward the email first",
              "Print the email",
            ],
            correct_answer: 1,
            explanation:
              "Always hover over links to verify the actual destination URL before clicking.",
          },
        ],
        created_at: new Date(),
        updated_at: new Date(),
        version: "1.0",
      },
      {
        id: "healthcare_data_protection",
        title: "Healthcare Data Protection (HIPAA/Vietnamese Healthcare Law)",
        description:
          "Understanding data protection requirements for healthcare organizations",
        category: "data_protection",
        difficulty: "intermediate",
        duration_minutes: 45,
        required_for_roles: ["doctors", "nurses", "admin_staff", "it_staff"],
        completion_criteria: {
          minimum_score: 85,
          time_limit_minutes: 60,
          retries_allowed: 1,
        },
        content_url: "/training/healthcare-data-protection",
        quiz_questions: [
          {
            question:
              "Under Vietnamese healthcare law, what is required when sharing patient data?",
            options: [
              "Patient consent",
              "Manager approval",
              "Written request",
              "Email confirmation",
            ],
            correct_answer: 0,
            explanation:
              "Patient consent is required before sharing any healthcare data under Vietnamese law.",
          },
          {
            question: "How long should healthcare records be retained?",
            options: ["1 year", "5 years", "7 years", "10 years"],
            correct_answer: 2,
            explanation:
              "Vietnamese healthcare regulations require medical records to be retained for at least 7 years.",
          },
        ],
        created_at: new Date(),
        updated_at: new Date(),
        version: "1.0",
      },
      {
        id: "password_security_healthcare",
        title: "Password Security for Healthcare Workers",
        description:
          "Best practices for creating and managing secure passwords in healthcare environments",
        category: "password_security",
        difficulty: "beginner",
        duration_minutes: 20,
        required_for_roles: ["all_staff"],
        completion_criteria: {
          minimum_score: 75,
          time_limit_minutes: 30,
          retries_allowed: 3,
        },
        content_url: "/training/password-security-healthcare",
        quiz_questions: [
          {
            question: "What makes a strong password for healthcare systems?",
            options: [
              "At least 8 characters with mixed case and numbers",
              "Simple word easy to remember",
              "Your birthday",
              "The hospital name",
            ],
            correct_answer: 0,
            explanation:
              "Strong passwords should be at least 8 characters long with mixed case letters, numbers, and special characters.",
          },
        ],
        created_at: new Date(),
        updated_at: new Date(),
        version: "1.0",
      },
    ];

    modules.forEach((module) => this.modules.set(module.id, module));
  }

  private initializeTrainingCampaigns(): void {
    const campaigns: TrainingCampaign[] = [
      {
        id: "annual_security_awareness",
        name: "Annual Security Awareness Campaign",
        description:
          "Mandatory annual security training for all healthcare staff",
        target_roles: ["all_staff"],
        module_ids: [
          "healthcare_phishing_awareness",
          "password_security_healthcare",
        ],
        start_date: new Date(),
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        mandatory: true,
        recurring: true,
        recurrence_interval_days: 365,
        auto_assign: true,
        reminder_schedule: [14, 7, 3, 1],
        enabled: true,
      },
      {
        id: "hipaa_compliance_training",
        name: "HIPAA Compliance Training",
        description: "Specialized training for staff handling patient data",
        target_roles: ["doctors", "nurses", "admin_staff"],
        module_ids: ["healthcare_data_protection"],
        start_date: new Date(),
        end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        mandatory: true,
        recurring: false,
        auto_assign: true,
        reminder_schedule: [10, 5, 2],
        enabled: true,
      },
    ];

    campaigns.forEach((campaign) => this.campaigns.set(campaign.id, campaign));
  }
}
