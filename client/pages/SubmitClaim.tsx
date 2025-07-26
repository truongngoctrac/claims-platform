import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload } from "lucide-react";

export function SubmitClaim() {
  return (
    <div className="min-h-screen bg-slate-50">

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Submit New Claim
            </h1>
            <p className="text-muted-foreground">
              File your insurance claim quickly and securely
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Claim Submission Form
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Claim Submission Coming Soon
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  The claim submission form will be implemented in the next
                  phase. This will include document upload, form validation, and
                  automatic case assignment features.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
