import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Bell,
  FileText,
  Upload,
  Eye,
  EyeOff,
  Save,
  Edit,
  Trash2,
  Download,
  History,
  Lock,
  Key,
  Users,
  Building,
  Calendar,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Globe,
  Camera,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthenticatedRequest } from "@/contexts/AuthContext";
import { UserRole } from "@shared/auth";

interface ProfileData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
    nationalId?: string;
    passport?: string;
    occupation?: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  businessInfo?: {
    companyName: string;
    registrationNumber: string;
    taxId: string;
    industry: string;
    employeeCount: number;
    website?: string;
  };
  preferences: {
    language: "en" | "vi";
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
      marketing: boolean;
    };
    privacy: {
      profileVisibility: "public" | "private" | "limited";
      dataSharing: boolean;
    };
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string;
    sessionTimeout: number;
  };
  documents: Array<{
    id: string;
    name: string;
    type: string;
    uploadDate: string;
    status: "verified" | "pending" | "rejected";
  }>;
  familyMembers?: Array<{
    id: string;
    name: string;
    relationship: string;
    dateOfBirth: string;
    coverage: boolean;
  }>;
  authorizedReps?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
  }>;
}

export function Profile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [documentUpload, setDocumentUpload] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const isCustomer = user?.role === UserRole.CUSTOMER;
  const isBusiness =
    user?.role === UserRole.CUSTOMER && profileData?.businessInfo;

  useEffect(() => {
    fetchProfileData();
    fetchAuditLogs();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await makeAuthenticatedRequest("/api/auth/profile");
      const data = await response.json();

      if (data.success) {
        // Initialize profile data with defaults
        setProfileData({
          personalInfo: {
            firstName: data.user.firstName || "",
            lastName: data.user.lastName || "",
            email: data.user.email || "",
            phone: data.user.phoneNumber || "",
            dateOfBirth: "",
            nationalId: "",
            passport: "",
            occupation: "",
            address: {
              street: "",
              city: "",
              state: "",
              zipCode: "",
              country: "Vietnam",
            },
          },
          businessInfo: isBusiness
            ? {
                companyName: "",
                registrationNumber: "",
                taxId: "",
                industry: "",
                employeeCount: 0,
                website: "",
              }
            : undefined,
          preferences: {
            language: "en",
            notifications: {
              email: true,
              sms: false,
              push: true,
              marketing: false,
            },
            privacy: {
              profileVisibility: "private",
              dataSharing: false,
            },
          },
          security: {
            twoFactorEnabled: false,
            lastPasswordChange: "2024-01-01",
            sessionTimeout: 30,
          },
          documents: [],
          familyMembers: isCustomer && !isBusiness ? [] : undefined,
          authorizedReps: isBusiness ? [] : undefined,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      // Mock audit logs for now
      setAuditLogs([
        {
          id: "1",
          action: "Profile Updated",
          field: "Phone Number",
          oldValue: "+84 123 456 789",
          newValue: "+84 987 654 321",
          timestamp: "2024-01-15T10:30:00Z",
          ipAddress: "192.168.1.1",
        },
        {
          id: "2",
          action: "Password Changed",
          field: "Password",
          oldValue: "••••••••",
          newValue: "••••••••",
          timestamp: "2024-01-10T14:15:00Z",
          ipAddress: "192.168.1.1",
        },
      ]);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    }
  };

  const handleSave = async (section: string) => {
    try {
      setSaving(true);
      // Mock API call to save profile data
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setEditMode((prev) => ({ ...prev, [section]: false }));

      // Add to audit log
      const newLog = {
        id: Date.now().toString(),
        action: "Profile Updated",
        field: section,
        oldValue: "Previous Value",
        newValue: "New Value",
        timestamp: new Date().toISOString(),
        ipAddress: "192.168.1.1",
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Passwords don't match");
      return;
    }

    try {
      setSaving(true);
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setPasswordDialog(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Error changing password:", error);
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    try {
      const dataStr = JSON.stringify(profileData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `profile-data-${user?.email}-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Profile Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your account information and preferences
            </p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button variant="outline" onClick={() => setShowAuditLogs(true)}>
              <History className="w-4 h-4 mr-2" />
              Audit Log
            </Button>
            <Button variant="outline" onClick={exportData}>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Profile Picture and Basic Info */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-12 h-12 text-primary" />
                </div>
                <Button
                  size="sm"
                  className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">
                  {profileData?.personalInfo.firstName}{" "}
                  {profileData?.personalInfo.lastName}
                </h2>
                <p className="text-muted-foreground">
                  {profileData?.personalInfo.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">
                    {user?.role === UserRole.CUSTOMER
                      ? isBusiness
                        ? "Business Client"
                        : "Individual Customer"
                      : user?.role?.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">
                    <Globe className="w-3 h-3 mr-1" />
                    {profileData?.preferences.language === "vi"
                      ? "Tiếng Việt"
                      : "English"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            {isBusiness && <TabsTrigger value="business">Business</TabsTrigger>}
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditMode((prev) => ({
                      ...prev,
                      personal: !prev.personal,
                    }))
                  }
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {editMode.personal ? "Cancel" : "Edit"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData?.personalInfo.firstName}
                      disabled={!editMode.personal}
                      onChange={(e) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                personalInfo: {
                                  ...prev.personalInfo,
                                  firstName: e.target.value,
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData?.personalInfo.lastName}
                      disabled={!editMode.personal}
                      onChange={(e) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                personalInfo: {
                                  ...prev.personalInfo,
                                  lastName: e.target.value,
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData?.personalInfo.email}
                      disabled={!editMode.personal}
                      onChange={(e) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                personalInfo: {
                                  ...prev.personalInfo,
                                  email: e.target.value,
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData?.personalInfo.phone}
                      disabled={!editMode.personal}
                      onChange={(e) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                personalInfo: {
                                  ...prev.personalInfo,
                                  phone: e.target.value,
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                  {isCustomer && (
                    <>
                      <div>
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={profileData?.personalInfo.dateOfBirth}
                          disabled={!editMode.personal}
                          onChange={(e) =>
                            setProfileData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    personalInfo: {
                                      ...prev.personalInfo,
                                      dateOfBirth: e.target.value,
                                    },
                                  }
                                : null,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="nationalId">National ID</Label>
                        <Input
                          id="nationalId"
                          value={profileData?.personalInfo.nationalId}
                          disabled={!editMode.personal}
                          onChange={(e) =>
                            setProfileData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    personalInfo: {
                                      ...prev.personalInfo,
                                      nationalId: e.target.value,
                                    },
                                  }
                                : null,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="passport">Passport Number</Label>
                        <Input
                          id="passport"
                          value={profileData?.personalInfo.passport}
                          disabled={!editMode.personal}
                          onChange={(e) =>
                            setProfileData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    personalInfo: {
                                      ...prev.personalInfo,
                                      passport: e.target.value,
                                    },
                                  }
                                : null,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="occupation">Occupation</Label>
                        <Input
                          id="occupation"
                          value={profileData?.personalInfo.occupation}
                          disabled={!editMode.personal}
                          onChange={(e) =>
                            setProfileData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    personalInfo: {
                                      ...prev.personalInfo,
                                      occupation: e.target.value,
                                    },
                                  }
                                : null,
                            )
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Address Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        value={profileData?.personalInfo.address.street}
                        disabled={!editMode.personal}
                        onChange={(e) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  personalInfo: {
                                    ...prev.personalInfo,
                                    address: {
                                      ...prev.personalInfo.address,
                                      street: e.target.value,
                                    },
                                  },
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={profileData?.personalInfo.address.city}
                        disabled={!editMode.personal}
                        onChange={(e) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  personalInfo: {
                                    ...prev.personalInfo,
                                    address: {
                                      ...prev.personalInfo.address,
                                      city: e.target.value,
                                    },
                                  },
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        value={profileData?.personalInfo.address.state}
                        disabled={!editMode.personal}
                        onChange={(e) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  personalInfo: {
                                    ...prev.personalInfo,
                                    address: {
                                      ...prev.personalInfo.address,
                                      state: e.target.value,
                                    },
                                  },
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">Postal Code</Label>
                      <Input
                        id="zipCode"
                        value={profileData?.personalInfo.address.zipCode}
                        disabled={!editMode.personal}
                        onChange={(e) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  personalInfo: {
                                    ...prev.personalInfo,
                                    address: {
                                      ...prev.personalInfo.address,
                                      zipCode: e.target.value,
                                    },
                                  },
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={profileData?.personalInfo.address.country}
                        disabled={!editMode.personal}
                        onValueChange={(value) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  personalInfo: {
                                    ...prev.personalInfo,
                                    address: {
                                      ...prev.personalInfo.address,
                                      country: value,
                                    },
                                  },
                                }
                              : null,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Vietnam">Vietnam</SelectItem>
                          <SelectItem value="Thailand">Thailand</SelectItem>
                          <SelectItem value="Singapore">Singapore</SelectItem>
                          <SelectItem value="Malaysia">Malaysia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {editMode.personal && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setEditMode((prev) => ({ ...prev, personal: false }))
                      }
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleSave("personal")}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Family Members (Individual Customers Only) */}
            {isCustomer && !isBusiness && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Family Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {profileData?.familyMembers?.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.relationship}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={member.coverage ? "default" : "secondary"}
                          >
                            {member.coverage ? "Covered" : "Not Covered"}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full">
                      <Users className="w-4 h-4 mr-2" />
                      Add Family Member
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Business Information Tab */}
          {isBusiness && (
            <TabsContent value="business" className="space-y-6 mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Business Information
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditMode((prev) => ({
                        ...prev,
                        business: !prev.business,
                      }))
                    }
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {editMode.business ? "Cancel" : "Edit"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={profileData?.businessInfo?.companyName}
                        disabled={!editMode.business}
                      />
                    </div>
                    <div>
                      <Label htmlFor="registrationNumber">
                        Registration Number
                      </Label>
                      <Input
                        id="registrationNumber"
                        value={profileData?.businessInfo?.registrationNumber}
                        disabled={!editMode.business}
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxId">Tax ID</Label>
                      <Input
                        id="taxId"
                        value={profileData?.businessInfo?.taxId}
                        disabled={!editMode.business}
                      />
                    </div>
                    <div>
                      <Label htmlFor="industry">Industry</Label>
                      <Select
                        value={profileData?.businessInfo?.industry}
                        disabled={!editMode.business}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technology">Technology</SelectItem>
                          <SelectItem value="manufacturing">
                            Manufacturing
                          </SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="healthcare">Healthcare</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="employeeCount">Employee Count</Label>
                      <Input
                        id="employeeCount"
                        type="number"
                        value={profileData?.businessInfo?.employeeCount}
                        disabled={!editMode.business}
                      />
                    </div>
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={profileData?.businessInfo?.website}
                        disabled={!editMode.business}
                      />
                    </div>
                  </div>

                  {editMode.business && (
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setEditMode((prev) => ({ ...prev, business: false }))
                        }
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleSave("business")}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Authorized Representatives */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Authorized Representatives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {profileData?.authorizedReps?.map((rep) => (
                      <div
                        key={rep.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{rep.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {rep.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {rep.role}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full">
                      <Users className="w-4 h-4 mr-2" />
                      Add Representative
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="emailNotifications">
                        Email Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive updates via email
                      </p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={profileData?.preferences.notifications.email}
                      onCheckedChange={(checked) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                preferences: {
                                  ...prev.preferences,
                                  notifications: {
                                    ...prev.preferences.notifications,
                                    email: checked,
                                  },
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="smsNotifications">
                        SMS Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive important alerts via SMS
                      </p>
                    </div>
                    <Switch
                      id="smsNotifications"
                      checked={profileData?.preferences.notifications.sms}
                      onCheckedChange={(checked) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                preferences: {
                                  ...prev.preferences,
                                  notifications: {
                                    ...prev.preferences.notifications,
                                    sms: checked,
                                  },
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="pushNotifications">
                        Push Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive app notifications
                      </p>
                    </div>
                    <Switch
                      id="pushNotifications"
                      checked={profileData?.preferences.notifications.push}
                      onCheckedChange={(checked) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                preferences: {
                                  ...prev.preferences,
                                  notifications: {
                                    ...prev.preferences.notifications,
                                    push: checked,
                                  },
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="marketingNotifications">
                        Marketing Communications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive product updates and offers
                      </p>
                    </div>
                    <Switch
                      id="marketingNotifications"
                      checked={profileData?.preferences.notifications.marketing}
                      onCheckedChange={(checked) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                preferences: {
                                  ...prev.preferences,
                                  notifications: {
                                    ...prev.preferences.notifications,
                                    marketing: checked,
                                  },
                                },
                              }
                            : null,
                        )
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-lg font-semibold mb-4">
                    Language & Localization
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="language">Preferred Language</Label>
                      <Select
                        value={profileData?.preferences.language}
                        onValueChange={(value: "en" | "vi") =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  preferences: {
                                    ...prev.preferences,
                                    language: value,
                                  },
                                }
                              : null,
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="vi">Tiếng Việt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-lg font-semibold mb-4">
                    Privacy Settings
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="profileVisibility">
                        Profile Visibility
                      </Label>
                      <Select
                        value={
                          profileData?.preferences.privacy.profileVisibility
                        }
                        onValueChange={(
                          value: "public" | "private" | "limited",
                        ) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  preferences: {
                                    ...prev.preferences,
                                    privacy: {
                                      ...prev.preferences.privacy,
                                      profileVisibility: value,
                                    },
                                  },
                                }
                              : null,
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="limited">Limited</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="dataSharing">
                          Data Sharing for Analytics
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Help improve our services
                        </p>
                      </div>
                      <Switch
                        id="dataSharing"
                        checked={profileData?.preferences.privacy.dataSharing}
                        onCheckedChange={(checked) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  preferences: {
                                    ...prev.preferences,
                                    privacy: {
                                      ...prev.preferences.privacy,
                                      dataSharing: checked,
                                    },
                                  },
                                }
                              : null,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => handleSave("preferences")}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Password</h4>
                      <p className="text-sm text-muted-foreground">
                        Last changed:{" "}
                        {new Date(
                          profileData?.security.lastPasswordChange || "",
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <Dialog
                      open={passwordDialog}
                      onOpenChange={setPasswordDialog}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Key className="w-4 h-4 mr-2" />
                          Change Password
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Change Password</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="currentPassword">
                              Current Password
                            </Label>
                            <Input
                              id="currentPassword"
                              type="password"
                              value={passwordForm.currentPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({
                                  ...prev,
                                  currentPassword: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                              id="newPassword"
                              type="password"
                              value={passwordForm.newPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({
                                  ...prev,
                                  newPassword: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="confirmPassword">
                              Confirm New Password
                            </Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={passwordForm.confirmPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({
                                  ...prev,
                                  confirmPassword: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setPasswordDialog(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handlePasswordChange}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              Update Password
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Two-Factor Authentication</h4>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          profileData?.security.twoFactorEnabled
                            ? "default"
                            : "secondary"
                        }
                      >
                        {profileData?.security.twoFactorEnabled
                          ? "Enabled"
                          : "Disabled"}
                      </Badge>
                      <Button variant="outline" size="sm">
                        {profileData?.security.twoFactorEnabled
                          ? "Disable"
                          : "Enable"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Session Timeout</h4>
                      <p className="text-sm text-muted-foreground">
                        Automatically log out after inactivity
                      </p>
                    </div>
                    <Select
                      value={profileData?.security.sessionTimeout.toString()}
                      onValueChange={(value) =>
                        setProfileData((prev) =>
                          prev
                            ? {
                                ...prev,
                                security: {
                                  ...prev.security,
                                  sessionTimeout: parseInt(value),
                                },
                              }
                            : null,
                        )
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    We recommend enabling two-factor authentication and using a
                    strong, unique password to keep your account secure.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documents & Verification
                </CardTitle>
                <Button onClick={() => setDocumentUpload(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profileData?.documents.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        No Documents Uploaded
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Upload your identification documents for account
                        verification
                      </p>
                      <Button onClick={() => setDocumentUpload(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload First Document
                      </Button>
                    </div>
                  ) : (
                    profileData?.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {doc.type} • Uploaded{" "}
                              {new Date(doc.uploadDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              doc.status === "verified"
                                ? "default"
                                : doc.status === "pending"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {doc.status === "verified" && (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            {doc.status}
                          </Badge>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Audit Log Dialog */}
        <Dialog open={showAuditLogs} onOpenChange={setShowAuditLogs}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Profile Activity Log
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-4 border rounded-lg"
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Field: {log.field}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      IP: {log.ipAddress}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
