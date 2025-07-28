import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  Filter,
  Search,
  Plus,
  Eye,
  MoreHorizontal,
  UserPlus,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthenticatedRequest } from "@/contexts/AuthContext";
import { UserRole } from "@shared/auth";
import { useTranslation } from "@/lib/i18n";

export function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [claims, setClaims] = useState<any[]>([]);
  const [executives, setExecutives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [assignmentData, setAssignmentData] = useState({
    assignedTo: "",
    priority: "medium",
    notes: "",
    deadline: "",
  });
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch claims and executives in parallel
      const [claimsResponse, executivesResponse] = await Promise.all([
        makeAuthenticatedRequest("/api/claims"),
        makeAuthenticatedRequest("/api/users/claim-executives"),
      ]);

      const [claimsData, executivesData] = await Promise.all([
        claimsResponse.json(),
        executivesResponse.json(),
      ]);

      if (claimsData.success) {
        setClaims(claimsData.claims);
      }

      if (executivesData.success) {
        setExecutives(executivesData.users);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfAssign = async (claimId: string) => {
    try {
      const response = await makeAuthenticatedRequest(
        `/api/claims/${claimId}/self-assign`,
        {
          method: "POST",
          body: JSON.stringify({
            priority: "medium",
            notes: "Self-assigned for processing",
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        // Refresh claims data
        fetchData();
      } else {
        console.error("Self-assignment failed:", data.message);
      }
    } catch (error) {
      console.error("Error self-assigning claim:", error);
    }
  };

  const handleAssignClaim = async () => {
    if (!selectedClaim || !assignmentData.assignedTo) return;

    try {
      setAssignmentLoading(true);
      setAssignmentError("");

      const response = await makeAuthenticatedRequest("/api/claims/assign", {
        method: "POST",
        body: JSON.stringify({
          claimId: selectedClaim.id,
          ...assignmentData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAssignDialogOpen(false);
        setSelectedClaim(null);
        setAssignmentData({
          assignedTo: "",
          priority: "medium",
          notes: "",
          deadline: "",
        });
        // Refresh claims data
        fetchData();
      } else {
        setAssignmentError(data.message || "Assignment failed");
      }
    } catch (error) {
      setAssignmentError("An error occurred during assignment");
      console.error("Error assigning claim:", error);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const openAssignDialog = (claim: any) => {
    setSelectedClaim(claim);
    setAssignDialogOpen(true);
    setAssignmentError("");
  };

  const canAssign = user && ["admin", "claims_manager"].includes(user.role);
  const canSelfAssign = user && user.role === "claim_executive";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: string } = {
      pending: "bg-yellow-100 text-yellow-800",
      "in-review": "bg-blue-100 text-blue-800",
      approved: "bg-green-100 text-green-800",
      "requires-info": "bg-orange-100 text-orange-800",
      rejected: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={`${variants[status]} border-0`}>
        {status.replace("-", " ")}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: { [key: string]: string } = {
      high: "bg-red-100 text-red-800 border-red-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      low: "bg-green-100 text-green-800 border-green-200",
    };

    return (
      <Badge variant="outline" className={variants[priority]}>
        {priority}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Claims Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage all claims processing activities
            </p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Claim
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Claims
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2,847</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+12%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Review
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">147</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-orange-600">+8</span> since yesterday
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Processed Today
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">+23%</span> vs. yesterday
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Processing Time
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.3 days</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">-0.5</span> improvement
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Processing Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Auto Insurance Claims</span>
                    <span>85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Home Insurance Claims</span>
                    <span>92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Health Insurance Claims</span>
                    <span>78%</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Life Insurance Claims</span>
                    <span>96%</span>
                  </div>
                  <Progress value={96} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Sarah Wilson</p>
                      <p className="text-xs text-muted-foreground">24 claims</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Top Performer</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-claim-teal-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-claim-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Mike Johnson</p>
                      <p className="text-xs text-muted-foreground">21 claims</p>
                    </div>
                  </div>
                  <Badge variant="outline">Excellent</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Lisa Brown</p>
                      <p className="text-xs text-muted-foreground">18 claims</p>
                    </div>
                  </div>
                  <Badge variant="outline">Good</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>Recent Claims</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    placeholder="Search claims..."
                    className="pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Claims</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="in-review">In Review</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Claim ID
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Customer
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Type
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Amount
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Status
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Priority
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Assignee
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Days Open
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map((claim) => (
                        <tr
                          key={claim.id}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="py-4 px-2">
                            <span className="font-medium text-primary">
                              {claim.id}
                            </span>
                          </td>
                          <td className="py-4 px-2">{claim.customer}</td>
                          <td className="py-4 px-2 text-sm text-muted-foreground">
                            {claim.type}
                          </td>
                          <td className="py-4 px-2 font-medium">
                            {claim.amount}
                          </td>
                          <td className="py-4 px-2">
                            {getStatusBadge(claim.status)}
                          </td>
                          <td className="py-4 px-2">
                            {getPriorityBadge(claim.priority)}
                          </td>
                          <td className="py-4 px-2 text-sm">
                            {claim.assignee}
                          </td>
                          <td className="py-4 px-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                claim.daysOpen > 5
                                  ? "bg-red-100 text-red-800"
                                  : claim.daysOpen > 3
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {claim.daysOpen} days
                            </span>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="pending">
                <div className="text-center py-8 text-muted-foreground">
                  Showing pending claims only...
                </div>
              </TabsContent>
              <TabsContent value="in-review">
                <div className="text-center py-8 text-muted-foreground">
                  Showing claims in review...
                </div>
              </TabsContent>
              <TabsContent value="approved">
                <div className="text-center py-8 text-muted-foreground">
                  Showing approved claims...
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
