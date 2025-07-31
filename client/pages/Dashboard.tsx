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
              <p className="text-muted-foreground vietnamese-text">{t('dashboard.loading')}</p>
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

    const statusTexts: { [key: string]: string } = {
      pending: t('status.pending'),
      "in-review": t('status.in_review'),
      approved: t('status.approved'),
      "requires-info": t('status.requires_info'),
      rejected: t('status.rejected'),
    };

    return (
      <Badge className={`${variants[status]} border-0 vietnamese-text`}>
        {statusTexts[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: { [key: string]: string } = {
      high: "bg-red-100 text-red-800 border-red-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      low: "bg-green-100 text-green-800 border-green-200",
    };

    const priorityTexts: { [key: string]: string } = {
      high: t('priority.high'),
      medium: t('priority.medium'),
      low: t('priority.low'),
    };

    return (
      <Badge variant="outline" className={`${variants[priority]} vietnamese-text`}>
        {priorityTexts[priority] || priority}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 vietnamese-text">
              {t('dashboard.title')}
            </h1>
            <p className="text-muted-foreground vietnamese-text">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button variant="outline" className="vietnamese-text">
              <Filter className="w-4 h-4 mr-2" />
              {t('dashboard.filter')}
            </Button>
            <Button className="vietnamese-text">
              <Plus className="w-4 h-4 mr-2" />
              {t('dashboard.new_claim')}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium vietnamese-text">
                {t('dashboard.total_claims')}
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2,847</div>
              <p className="text-xs text-muted-foreground vietnamese-text">
                <span className="text-green-600">+12%</span> {t('dashboard.from_last_month')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium vietnamese-text">
                {t('dashboard.pending_review')}
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">147</div>
              <p className="text-xs text-muted-foreground vietnamese-text">
                <span className="text-orange-600">+8</span> {t('dashboard.since_yesterday')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium vietnamese-text">
                {t('dashboard.processed_today')}
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground vietnamese-text">
                <span className="text-green-600">+23%</span> {t('dashboard.vs_yesterday')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium vietnamese-text">
                {t('dashboard.avg_processing_time')}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold vietnamese-text">2.3 {t('dashboard.days')}</div>
              <p className="text-xs text-muted-foreground vietnamese-text">
                <span className="text-green-600">-0.5</span> {t('dashboard.improvement')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="vietnamese-text">{t('dashboard.processing_performance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2 vietnamese-text">
                    <span>Bảo hiểm ô tô</span>
                    <span>85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2 vietnamese-text">
                    <span>Bảo hiểm nhà ở</span>
                    <span>92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2 vietnamese-text">
                    <span>{t('dashboard.health_insurance')}</span>
                    <span>78%</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2 vietnamese-text">
                    <span>Bảo hiểm nhân thọ</span>
                    <span>96%</span>
                  </div>
                  <Progress value={96} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="vietnamese-text">{t('dashboard.team_performance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Nguyễn Thị Minh</p>
                      <p className="text-xs text-muted-foreground vietnamese-text">24 {t('dashboard.claims_count')}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="vietnamese-text">{t('dashboard.top_performer')}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Trần Văn Hoàng</p>
                      <p className="text-xs text-muted-foreground vietnamese-text">21 {t('dashboard.claims_count')}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="vietnamese-text">{t('dashboard.excellent')}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Lê Thị Hà</p>
                      <p className="text-xs text-muted-foreground vietnamese-text">18 {t('dashboard.claims_count')}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="vietnamese-text">{t('dashboard.good')}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="vietnamese-text">{t('dashboard.recent_claims')}</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    placeholder={t('dashboard.search_placeholder')}
                    className="pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm vietnamese-text"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all" className="vietnamese-text">{t('dashboard.all_claims')}</TabsTrigger>
                <TabsTrigger value="pending" className="vietnamese-text">{t('dashboard.pending')}</TabsTrigger>
                <TabsTrigger value="in-review" className="vietnamese-text">{t('dashboard.in_review')}</TabsTrigger>
                <TabsTrigger value="approved" className="vietnamese-text">{t('dashboard.approved')}</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.claim_id')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.customer')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.type')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.amount')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.status')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.priority')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.assignee')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.days_open')}
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-sm text-muted-foreground vietnamese-text">
                          {t('dashboard.actions')}
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
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium vietnamese-text ${
                                claim.daysOpen > 5
                                  ? "bg-red-100 text-red-800"
                                  : claim.daysOpen > 3
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {claim.daysOpen} {t('dashboard.days')}
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
                <div className="text-center py-8 text-muted-foreground vietnamese-text">
                  Đang hiển thị các yêu cầu chờ xử lý...
                </div>
              </TabsContent>
              <TabsContent value="in-review">
                <div className="text-center py-8 text-muted-foreground vietnamese-text">
                  Đang hiển thị các yêu cầu đang xem xét...
                </div>
              </TabsContent>
              <TabsContent value="approved">
                <div className="text-center py-8 text-muted-foreground vietnamese-text">
                  Đang hiển thị các yêu cầu đã duyệt...
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
