import crypto from "crypto";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  repository?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  lastModified: Date;
}

export interface VulnerabilityDatabase {
  databaseId: string;
  source: "npm" | "github" | "cve" | "snyk" | "custom";
  lastUpdated: Date;
  version: string;
  vulnerabilities: Map<string, PackageVulnerability>;
}

export interface PackageVulnerability {
  id: string;
  packageName: string;
  affectedVersions: string[];
  vulnerableVersionRange: string;
  patchedVersions: string[];
  severity: "low" | "medium" | "high" | "critical";
  cvssScore?: number;
  cvssVector?: string;
  cveId?: string;
  title: string;
  description: string;
  publishedDate: Date;
  lastModified: Date;
  references: string[];
  recommendation: string;
  exploitAvailable: boolean;
  inTheWild: boolean;
}

export interface LicenseInfo {
  license: string;
  classification: "permissive" | "copyleft" | "proprietary" | "unknown";
  riskLevel: "low" | "medium" | "high" | "critical";
  compatibleWith: string[];
  incompatibleWith: string[];
  requirements: string[];
  restrictions: string[];
}

export interface DependencyTree {
  packageName: string;
  version: string;
  depth: number;
  parent?: string;
  children: DependencyTree[];
  isDirectDependency: boolean;
  isDevelopmentDependency: boolean;
  vulnerabilities: PackageVulnerability[];
  licenses: string[];
  riskScore: number;
}

export interface ScanConfiguration {
  scanId: string;
  projectPath: string;
  includeDevDependencies: boolean;
  maxDepth: number;
  onlyDirectDependencies: boolean;
  severityThreshold: "low" | "medium" | "high" | "critical";
  includeLicenseCheck: boolean;
  excludePackages: string[];
  customVulnerabilityDb?: string;
}

export interface DependencyScanResult {
  scanId: string;
  projectPath: string;
  scanTime: Date;
  packagesScanned: number;
  vulnerabilitiesFound: number;
  licenseIssues: number;
  riskScore: number;
  packageTree: DependencyTree[];
  vulnerabilities: PackageVulnerability[];
  licenseViolations: LicenseViolation[];
  recommendations: string[];
  summary: DependencySummary;
}

export interface LicenseViolation {
  packageName: string;
  version: string;
  license: string;
  violationType: "incompatible" | "missing" | "restricted";
  description: string;
  recommendation: string;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface DependencySummary {
  totalPackages: number;
  directDependencies: number;
  transitiveDependencies: number;
  vulnerablePackages: number;
  outdatedPackages: number;
  licenseViolations: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  mediumVulnerabilities: number;
  lowVulnerabilities: number;
}

export interface UpdateRecommendation {
  packageName: string;
  currentVersion: string;
  recommendedVersion: string;
  updateType: "patch" | "minor" | "major";
  fixes: string[];
  breakingChanges?: string[];
  confidence: "low" | "medium" | "high";
}

export class DependencySecurityMonitor extends EventEmitter {
  private vulnerabilityDatabases: Map<string, VulnerabilityDatabase>;
  private licenseDatabase: Map<string, LicenseInfo>;
  private scanHistory: Map<string, DependencyScanResult>;
  private packageCache: Map<string, PackageInfo>;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.vulnerabilityDatabases = new Map();
    this.licenseDatabase = new Map();
    this.scanHistory = new Map();
    this.packageCache = new Map();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadVulnerabilityDatabases();
      await this.loadLicenseDatabase();
      this.startPeriodicUpdates();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async loadVulnerabilityDatabases(): Promise<void> {
    // Load NPM Advisory Database
    const npmDb: VulnerabilityDatabase = {
      databaseId: "npm_advisory",
      source: "npm",
      lastUpdated: new Date(),
      version: "1.0.0",
      vulnerabilities: new Map(),
    };

    // Sample vulnerabilities - in production, this would be loaded from actual databases
    const sampleVulns: PackageVulnerability[] = [
      {
        id: "npm-1002",
        packageName: "lodash",
        affectedVersions: ["<4.17.19"],
        vulnerableVersionRange: "<4.17.19",
        patchedVersions: [">=4.17.19"],
        severity: "high",
        cvssScore: 7.4,
        cvssVector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:H",
        cveId: "CVE-2020-8203",
        title: "Prototype Pollution in lodash",
        description:
          "lodash prior to 4.17.19 is vulnerable to prototype pollution",
        publishedDate: new Date("2020-07-15"),
        lastModified: new Date("2020-07-15"),
        references: [
          "https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-8203",
        ],
        recommendation: "Update to lodash version 4.17.19 or later",
        exploitAvailable: true,
        inTheWild: false,
      },
      {
        id: "npm-1003",
        packageName: "express",
        affectedVersions: ["<4.17.1"],
        vulnerableVersionRange: "<4.17.1",
        patchedVersions: [">=4.17.1"],
        severity: "medium",
        cvssScore: 5.3,
        title: "Information Disclosure in Express",
        description: "Express before 4.17.1 may reveal server information",
        publishedDate: new Date("2019-05-30"),
        lastModified: new Date("2019-05-30"),
        references: ["https://expressjs.com/en/changelog/4x.html"],
        recommendation: "Update to express version 4.17.1 or later",
        exploitAvailable: false,
        inTheWild: false,
      },
      {
        id: "npm-1004",
        packageName: "jsonwebtoken",
        affectedVersions: ["<8.5.1"],
        vulnerableVersionRange: "<8.5.1",
        patchedVersions: [">=8.5.1"],
        severity: "critical",
        cvssScore: 9.8,
        cveId: "CVE-2022-23529",
        title: "Improper Signature Verification in jsonwebtoken",
        description:
          "jsonwebtoken prior to 8.5.1 allows attackers to bypass signature verification",
        publishedDate: new Date("2022-12-22"),
        lastModified: new Date("2022-12-22"),
        references: [
          "https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2022-23529",
        ],
        recommendation:
          "Immediately update to jsonwebtoken version 8.5.1 or later",
        exploitAvailable: true,
        inTheWild: true,
      },
    ];

    for (const vuln of sampleVulns) {
      npmDb.vulnerabilities.set(vuln.id, vuln);
    }

    this.vulnerabilityDatabases.set(npmDb.databaseId, npmDb);
  }

  private async loadLicenseDatabase(): Promise<void> {
    const licenses: LicenseInfo[] = [
      {
        license: "MIT",
        classification: "permissive",
        riskLevel: "low",
        compatibleWith: ["Apache-2.0", "BSD-3-Clause", "ISC"],
        incompatibleWith: ["GPL-3.0"],
        requirements: ["Include copyright notice"],
        restrictions: ["No warranty disclaimer required"],
      },
      {
        license: "Apache-2.0",
        classification: "permissive",
        riskLevel: "low",
        compatibleWith: ["MIT", "BSD-3-Clause"],
        incompatibleWith: ["GPL-2.0"],
        requirements: ["Include copyright notice", "Include license text"],
        restrictions: ["Patent grant included"],
      },
      {
        license: "GPL-3.0",
        classification: "copyleft",
        riskLevel: "high",
        compatibleWith: ["LGPL-3.0"],
        incompatibleWith: ["MIT", "Apache-2.0", "BSD-3-Clause"],
        requirements: [
          "Source code must be made available",
          "Include license text",
        ],
        restrictions: ["Derivative works must use GPL-3.0"],
      },
      {
        license: "UNLICENSED",
        classification: "proprietary",
        riskLevel: "critical",
        compatibleWith: [],
        incompatibleWith: ["*"],
        requirements: ["Explicit permission required"],
        restrictions: ["Cannot be redistributed"],
      },
    ];

    for (const license of licenses) {
      this.licenseDatabase.set(license.license, license);
    }
  }

  async scanProject(config: ScanConfiguration): Promise<string> {
    const scanTime = new Date();

    try {
      this.emit("scanStarted", {
        scanId: config.scanId,
        projectPath: config.projectPath,
      });

      // Read package.json files
      const packageFiles = await this.findPackageFiles(config.projectPath);
      const packageTree: DependencyTree[] = [];
      const allVulnerabilities: PackageVulnerability[] = [];
      const licenseViolations: LicenseViolation[] = [];

      for (const packageFile of packageFiles) {
        const tree = await this.analyzeDependencyTree(packageFile, config);
        packageTree.push(...tree);

        // Collect vulnerabilities and license issues
        this.collectVulnerabilities(tree, allVulnerabilities);
        this.collectLicenseViolations(tree, licenseViolations, config);
      }

      const summary = this.generateSummary(
        packageTree,
        allVulnerabilities,
        licenseViolations,
      );
      const riskScore = this.calculateRiskScore(summary, allVulnerabilities);
      const recommendations = this.generateRecommendations(
        packageTree,
        allVulnerabilities,
      );

      const result: DependencyScanResult = {
        scanId: config.scanId,
        projectPath: config.projectPath,
        scanTime,
        packagesScanned: summary.totalPackages,
        vulnerabilitiesFound: allVulnerabilities.length,
        licenseIssues: licenseViolations.length,
        riskScore,
        packageTree,
        vulnerabilities: allVulnerabilities,
        licenseViolations,
        recommendations,
        summary,
      };

      this.scanHistory.set(config.scanId, result);
      this.emit("scanCompleted", { scanId: config.scanId, result });

      return config.scanId;
    } catch (error) {
      this.emit("scanError", { scanId: config.scanId, error });
      throw error;
    }
  }

  private async findPackageFiles(projectPath: string): Promise<string[]> {
    const packageFiles: string[] = [];

    const findInDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && entry !== "node_modules") {
          findInDirectory(fullPath);
        } else if (entry === "package.json") {
          packageFiles.push(fullPath);
        }
      }
    };

    findInDirectory(projectPath);
    return packageFiles;
  }

  private async analyzeDependencyTree(
    packageJsonPath: string,
    config: ScanConfiguration,
  ): Promise<DependencyTree[]> {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const packageInfo: PackageInfo = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      repository: packageJson.repository?.url,
      license: packageJson.license,
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      lastModified: fs.statSync(packageJsonPath).mtime,
    };

    const tree: DependencyTree[] = [];

    // Analyze direct dependencies
    for (const [depName, depVersion] of Object.entries(
      packageInfo.dependencies || {},
    )) {
      if (config.excludePackages.includes(depName)) continue;

      const depTree = await this.buildDependencyNode(
        depName,
        depVersion,
        0,
        packageInfo.name,
        true,
        false,
        config,
      );
      tree.push(depTree);
    }

    // Analyze dev dependencies if requested
    if (config.includeDevDependencies) {
      for (const [depName, depVersion] of Object.entries(
        packageInfo.devDependencies || {},
      )) {
        if (config.excludePackages.includes(depName)) continue;

        const depTree = await this.buildDependencyNode(
          depName,
          depVersion,
          0,
          packageInfo.name,
          false,
          true,
          config,
        );
        tree.push(depTree);
      }
    }

    return tree;
  }

  private async buildDependencyNode(
    packageName: string,
    version: string,
    depth: number,
    parent: string,
    isDirectDependency: boolean,
    isDevelopmentDependency: boolean,
    config: ScanConfiguration,
  ): Promise<DependencyTree> {
    const vulnerabilities = this.findVulnerabilities(packageName, version);
    const licenses = await this.getPackageLicenses(packageName, version);
    const riskScore = this.calculatePackageRiskScore(vulnerabilities, licenses);

    const node: DependencyTree = {
      packageName,
      version,
      depth,
      parent: parent !== packageName ? parent : undefined,
      children: [],
      isDirectDependency,
      isDevelopmentDependency,
      vulnerabilities,
      licenses,
      riskScore,
    };

    // Recursively build child nodes if within depth limit
    if (depth < config.maxDepth && !config.onlyDirectDependencies) {
      // In a real implementation, this would fetch actual dependency information
      // For now, we'll simulate some common transitive dependencies
      const transitiveDeps = this.getTransitiveDependencies(packageName);

      for (const [childName, childVersion] of Object.entries(transitiveDeps)) {
        if (config.excludePackages.includes(childName)) continue;

        const childNode = await this.buildDependencyNode(
          childName,
          childVersion,
          depth + 1,
          packageName,
          false,
          isDevelopmentDependency,
          config,
        );
        node.children.push(childNode);
      }
    }

    return node;
  }

  private getTransitiveDependencies(
    packageName: string,
  ): Record<string, string> {
    // Simplified simulation of transitive dependencies
    const commonTransitiveDeps: Record<string, Record<string, string>> = {
      express: {
        "body-parser": "^1.19.0",
        "cookie-parser": "^1.4.5",
        debug: "^2.6.9",
      },
      react: {
        "prop-types": "^15.7.2",
        "object-assign": "^4.1.1",
      },
      lodash: {
        // lodash typically has no dependencies
      },
    };

    return commonTransitiveDeps[packageName] || {};
  }

  private findVulnerabilities(
    packageName: string,
    version: string,
  ): PackageVulnerability[] {
    const vulnerabilities: PackageVulnerability[] = [];

    for (const db of this.vulnerabilityDatabases.values()) {
      for (const vuln of db.vulnerabilities.values()) {
        if (
          vuln.packageName === packageName &&
          this.isVersionVulnerable(version, vuln.vulnerableVersionRange)
        ) {
          vulnerabilities.push(vuln);
        }
      }
    }

    return vulnerabilities;
  }

  private isVersionVulnerable(
    version: string,
    vulnerableRange: string,
  ): boolean {
    // Simplified version range checking
    // In production, use a proper semver library
    const cleanVersion = version.replace(/[^0-9.]/g, "");
    const versionParts = cleanVersion.split(".").map(Number);

    if (vulnerableRange.startsWith("<")) {
      const rangeVersion = vulnerableRange.substring(1).replace(/[^0-9.]/g, "");
      const rangeParts = rangeVersion.split(".").map(Number);

      for (
        let i = 0;
        i < Math.max(versionParts.length, rangeParts.length);
        i++
      ) {
        const v = versionParts[i] || 0;
        const r = rangeParts[i] || 0;

        if (v < r) return true;
        if (v > r) return false;
      }
    }

    return false;
  }

  private async getPackageLicenses(
    packageName: string,
    version: string,
  ): Promise<string[]> {
    // In a real implementation, this would fetch license info from npm registry
    // For now, return common licenses based on package name
    const commonLicenses: Record<string, string> = {
      lodash: "MIT",
      express: "MIT",
      react: "MIT",
      jsonwebtoken: "MIT",
      bcryptjs: "MIT",
      debug: "MIT",
    };

    return [commonLicenses[packageName] || "Unknown"];
  }

  private calculatePackageRiskScore(
    vulnerabilities: PackageVulnerability[],
    licenses: string[],
  ): number {
    let score = 0;

    // Score based on vulnerabilities
    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case "critical":
          score += 25;
          break;
        case "high":
          score += 15;
          break;
        case "medium":
          score += 10;
          break;
        case "low":
          score += 5;
          break;
      }

      if (vuln.exploitAvailable) score += 10;
      if (vuln.inTheWild) score += 15;
    }

    // Score based on licenses
    for (const license of licenses) {
      const licenseInfo = this.licenseDatabase.get(license);
      if (licenseInfo) {
        switch (licenseInfo.riskLevel) {
          case "critical":
            score += 20;
            break;
          case "high":
            score += 15;
            break;
          case "medium":
            score += 10;
            break;
          case "low":
            score += 0;
            break;
        }
      } else {
        score += 10; // Unknown license
      }
    }

    return Math.min(score, 100);
  }

  private collectVulnerabilities(
    tree: DependencyTree[],
    allVulnerabilities: PackageVulnerability[],
  ): void {
    for (const node of tree) {
      allVulnerabilities.push(...node.vulnerabilities);
      this.collectVulnerabilities(node.children, allVulnerabilities);
    }
  }

  private collectLicenseViolations(
    tree: DependencyTree[],
    violations: LicenseViolation[],
    config: ScanConfiguration,
  ): void {
    if (!config.includeLicenseCheck) return;

    for (const node of tree) {
      for (const license of node.licenses) {
        const licenseInfo = this.licenseDatabase.get(license);

        if (!licenseInfo) {
          violations.push({
            packageName: node.packageName,
            version: node.version,
            license,
            violationType: "missing",
            description: `Unknown license: ${license}`,
            recommendation:
              "Verify license compatibility and add to approved licenses list",
            riskLevel: "medium",
          });
        } else if (
          licenseInfo.riskLevel === "critical" ||
          licenseInfo.riskLevel === "high"
        ) {
          violations.push({
            packageName: node.packageName,
            version: node.version,
            license,
            violationType: "restricted",
            description: `High-risk license: ${license} (${licenseInfo.classification})`,
            recommendation: `Consider replacing package or obtaining legal approval for ${license} license`,
            riskLevel: licenseInfo.riskLevel,
          });
        }
      }

      this.collectLicenseViolations(node.children, violations, config);
    }
  }

  private generateSummary(
    packageTree: DependencyTree[],
    vulnerabilities: PackageVulnerability[],
    licenseViolations: LicenseViolation[],
  ): DependencySummary {
    const allPackages = this.flattenPackageTree(packageTree);
    const directDeps = allPackages.filter((p) => p.isDirectDependency).length;
    const transitiveDeps = allPackages.filter(
      (p) => !p.isDirectDependency,
    ).length;
    const vulnerablePackages = new Set(
      vulnerabilities.map((v) => v.packageName),
    ).size;

    return {
      totalPackages: allPackages.length,
      directDependencies: directDeps,
      transitiveDependencies: transitiveDeps,
      vulnerablePackages,
      outdatedPackages: 0, // Would require registry lookups
      licenseViolations: licenseViolations.length,
      criticalVulnerabilities: vulnerabilities.filter(
        (v) => v.severity === "critical",
      ).length,
      highVulnerabilities: vulnerabilities.filter((v) => v.severity === "high")
        .length,
      mediumVulnerabilities: vulnerabilities.filter(
        (v) => v.severity === "medium",
      ).length,
      lowVulnerabilities: vulnerabilities.filter((v) => v.severity === "low")
        .length,
    };
  }

  private flattenPackageTree(tree: DependencyTree[]): DependencyTree[] {
    const packages: DependencyTree[] = [];

    for (const node of tree) {
      packages.push(node);
      packages.push(...this.flattenPackageTree(node.children));
    }

    return packages;
  }

  private calculateRiskScore(
    summary: DependencySummary,
    vulnerabilities: PackageVulnerability[],
  ): number {
    let score = 0;

    // Base score from vulnerability count and severity
    score += summary.criticalVulnerabilities * 25;
    score += summary.highVulnerabilities * 15;
    score += summary.mediumVulnerabilities * 10;
    score += summary.lowVulnerabilities * 5;

    // Additional factors
    if (summary.vulnerablePackages > summary.totalPackages * 0.1) {
      score += 10; // More than 10% of packages have vulnerabilities
    }

    if (summary.licenseViolations > 0) {
      score += summary.licenseViolations * 5;
    }

    // Check for exploitable vulnerabilities
    const exploitableVulns = vulnerabilities.filter(
      (v) => v.exploitAvailable || v.inTheWild,
    );
    score += exploitableVulns.length * 20;

    return Math.min(score, 100);
  }

  private generateRecommendations(
    packageTree: DependencyTree[],
    vulnerabilities: PackageVulnerability[],
  ): string[] {
    const recommendations: string[] = [];

    if (vulnerabilities.length === 0) {
      recommendations.push(
        "No security vulnerabilities detected. Continue monitoring for new vulnerabilities.",
      );
    } else {
      const criticalVulns = vulnerabilities.filter(
        (v) => v.severity === "critical",
      );
      if (criticalVulns.length > 0) {
        recommendations.push(
          `URGENT: Address ${criticalVulns.length} critical vulnerabilities immediately`,
        );
      }

      const highVulns = vulnerabilities.filter((v) => v.severity === "high");
      if (highVulns.length > 0) {
        recommendations.push(
          `High Priority: Address ${highVulns.length} high-severity vulnerabilities`,
        );
      }

      // Package-specific recommendations
      const vulnByPackage = new Map<string, PackageVulnerability[]>();
      vulnerabilities.forEach((v) => {
        if (!vulnByPackage.has(v.packageName)) {
          vulnByPackage.set(v.packageName, []);
        }
        vulnByPackage.get(v.packageName)!.push(v);
      });

      vulnByPackage.forEach((vulns, packageName) => {
        const latestVuln = vulns.sort(
          (a, b) => b.publishedDate.getTime() - a.publishedDate.getTime(),
        )[0];
        if (latestVuln.patchedVersions.length > 0) {
          recommendations.push(
            `Update ${packageName} to version ${latestVuln.patchedVersions[0]} or later`,
          );
        }
      });
    }

    recommendations.push(
      "Set up automated dependency monitoring for continuous security updates",
    );
    recommendations.push(
      "Implement dependency pinning and regular security audits",
    );

    return recommendations;
  }

  async generateUpdateRecommendations(
    scanId: string,
  ): Promise<UpdateRecommendation[]> {
    const result = this.scanHistory.get(scanId);
    if (!result) {
      throw new Error(`Scan result not found: ${scanId}`);
    }

    const recommendations: UpdateRecommendation[] = [];
    const packageVulns = new Map<string, PackageVulnerability[]>();

    // Group vulnerabilities by package
    result.vulnerabilities.forEach((vuln) => {
      if (!packageVulns.has(vuln.packageName)) {
        packageVulns.set(vuln.packageName, []);
      }
      packageVulns.get(vuln.packageName)!.push(vuln);
    });

    // Generate update recommendations
    packageVulns.forEach((vulns, packageName) => {
      const currentPackage = this.findPackageInTree(
        result.packageTree,
        packageName,
      );
      if (!currentPackage) return;

      const fixes = vulns.map((v) => v.title);
      const patchedVersions = vulns.flatMap((v) => v.patchedVersions);

      if (patchedVersions.length > 0) {
        const recommendedVersion = patchedVersions[0]; // Use first patched version
        const updateType = this.determineUpdateType(
          currentPackage.version,
          recommendedVersion,
        );

        recommendations.push({
          packageName,
          currentVersion: currentPackage.version,
          recommendedVersion,
          updateType,
          fixes,
          confidence: vulns.every((v) => v.exploitAvailable)
            ? "high"
            : "medium",
        });
      }
    });

    return recommendations;
  }

  private findPackageInTree(
    tree: DependencyTree[],
    packageName: string,
  ): DependencyTree | null {
    for (const node of tree) {
      if (node.packageName === packageName) {
        return node;
      }
      const found = this.findPackageInTree(node.children, packageName);
      if (found) return found;
    }
    return null;
  }

  private determineUpdateType(
    currentVersion: string,
    recommendedVersion: string,
  ): "patch" | "minor" | "major" {
    // Simplified semver comparison
    const current = currentVersion
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map(Number);
    const recommended = recommendedVersion
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map(Number);

    if (current[0] !== recommended[0]) return "major";
    if (current[1] !== recommended[1]) return "minor";
    return "patch";
  }

  private startPeriodicUpdates(): void {
    // Update vulnerability databases daily
    setInterval(
      () => {
        this.updateVulnerabilityDatabases();
      },
      24 * 60 * 60 * 1000,
    );
  }

  private async updateVulnerabilityDatabases(): Promise<void> {
    try {
      // In production, this would fetch updates from various security advisories
      this.emit("databaseUpdateStarted");

      // Simulate database update
      for (const db of this.vulnerabilityDatabases.values()) {
        db.lastUpdated = new Date();
      }

      this.emit("databaseUpdateCompleted");
    } catch (error) {
      this.emit("databaseUpdateError", error);
    }
  }

  getScanResult(scanId: string): DependencyScanResult | undefined {
    return this.scanHistory.get(scanId);
  }

  getAllScanResults(): DependencyScanResult[] {
    return Array.from(this.scanHistory.values());
  }

  getVulnerabilityDatabases(): VulnerabilityDatabase[] {
    return Array.from(this.vulnerabilityDatabases.values());
  }

  getLicenseInfo(license: string): LicenseInfo | undefined {
    return this.licenseDatabase.get(license);
  }

  async generateComplianceReport(scanId: string): Promise<string> {
    const result = this.scanHistory.get(scanId);
    if (!result) {
      throw new Error(`Scan result not found: ${scanId}`);
    }

    let report = `# Dependency Security Compliance Report\n\n`;
    report += `**Scan ID:** ${scanId}\n`;
    report += `**Project:** ${result.projectPath}\n`;
    report += `**Scan Date:** ${result.scanTime.toISOString()}\n`;
    report += `**Risk Score:** ${result.riskScore}/100\n\n`;

    report += `## Executive Summary\n`;
    report += `- Total Dependencies: ${result.summary.totalPackages}\n`;
    report += `- Vulnerable Packages: ${result.summary.vulnerablePackages}\n`;
    report += `- Critical Vulnerabilities: ${result.summary.criticalVulnerabilities}\n`;
    report += `- License Violations: ${result.summary.licenseViolations}\n\n`;

    if (result.vulnerabilities.length > 0) {
      report += `## Security Vulnerabilities\n\n`;
      for (const vuln of result.vulnerabilities.slice(0, 10)) {
        // Top 10
        report += `### ${vuln.title} (${vuln.severity.toUpperCase()})\n`;
        report += `**Package:** ${vuln.packageName}\n`;
        report += `**CVE:** ${vuln.cveId || "N/A"}\n`;
        report += `**CVSS Score:** ${vuln.cvssScore || "N/A"}\n`;
        report += `**Recommendation:** ${vuln.recommendation}\n\n`;
      }
    }

    if (result.licenseViolations.length > 0) {
      report += `## License Compliance Issues\n\n`;
      for (const violation of result.licenseViolations) {
        report += `### ${violation.packageName}\n`;
        report += `**License:** ${violation.license}\n`;
        report += `**Issue:** ${violation.description}\n`;
        report += `**Recommendation:** ${violation.recommendation}\n\n`;
      }
    }

    return report;
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default DependencySecurityMonitor;
