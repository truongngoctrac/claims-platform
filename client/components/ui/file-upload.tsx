import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  X,
  FileText,
  Image,
  AlertTriangle,
  CheckCircle,
  Camera,
  Eye,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
  disabled?: boolean;
}

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: "uploading" | "success" | "error";
  preview?: string;
  error?: string;
}

export function FileUpload({
  onFilesChange,
  maxFiles = 10,
  maxSize = 10,
  acceptedTypes = [".pdf", ".jpg", ".jpeg", ".png"],
  className,
  disabled = false,
}: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File quá lớn. Kích thước tối đa ${maxSize}MB`;
    }

    // Check file type
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      return `Định dạng file không được hỗ trợ. Chỉ chấp nhận: ${acceptedTypes.join(", ")}`;
    }

    return null;
  };

  const createFilePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const simulateUpload = (fileId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, progress: 100, status: "success" } : f,
            ),
          );
          resolve();
        } else {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, progress } : f)),
          );
        }
      }, 200);

      // Simulate occasional error
      if (Math.random() < 0.1) {
        setTimeout(() => {
          clearInterval(interval);
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, status: "error", error: "Lỗi tải file" }
                : f,
            ),
          );
          reject(new Error("Upload failed"));
        }, 1000);
      }
    });
  };

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (disabled) return;

      setError("");
      const fileArray = Array.from(files);

      // Check total file limit
      if (uploadedFiles.length + fileArray.length > maxFiles) {
        setError(`Chỉ được upload tối đa ${maxFiles} files`);
        return;
      }

      const newFiles: UploadedFile[] = [];

      for (const file of fileArray) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        const id = Math.random().toString(36).substr(2, 9);
        const preview = await createFilePreview(file);

        const uploadedFile: UploadedFile = {
          file,
          id,
          progress: 0,
          status: "uploading",
          preview,
        };

        newFiles.push(uploadedFile);
      }

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // Simulate upload for each file
      newFiles.forEach((uploadedFile) => {
        simulateUpload(uploadedFile.id);
      });

      // Update parent component
      const allFiles = [...uploadedFiles.map((f) => f.file), ...newFiles.map((f) => f.file)];
      onFilesChange(allFiles);
    },
    [uploadedFiles, maxFiles, maxSize, acceptedTypes, onFilesChange, disabled],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    const remainingFiles = uploadedFiles
      .filter((f) => f.id !== id)
      .map((f) => f.file);
    onFilesChange(remainingFiles);
  };

  const retryUpload = (id: string) => {
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, status: "uploading", progress: 0, error: undefined }
          : f,
      ),
    );
    simulateUpload(id);
  };

  const openCamera = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // This would open camera in a real implementation
      alert("Tính năng camera sẽ được implement trong phiên bản tiếp theo");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          Kéo thả file vào đây hoặc click để chọn
        </h3>
        <p className="text-muted-foreground mb-4">
          Hỗ trợ: {acceptedTypes.join(", ")} (tối đa {maxSize}MB mỗi file)
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Upload className="w-4 h-4 mr-2" />
            Chọn file
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={openCamera}
            disabled={disabled}
            className="sm:ml-2"
          >
            <Camera className="w-4 h-4 mr-2" />
            Chụp ảnh
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold">Files đã tải lên ({uploadedFiles.length}/{maxFiles})</h4>
          
          <div className="space-y-2">
            {uploadedFiles.map((uploadedFile) => (
              <div
                key={uploadedFile.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
              >
                {/* File Icon/Preview */}
                <div className="flex-shrink-0">
                  {uploadedFile.preview ? (
                    <img
                      src={uploadedFile.preview}
                      alt="Preview"
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {uploadedFile.file.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>

                  {/* Progress Bar */}
                  {uploadedFile.status === "uploading" && (
                    <div className="mt-2">
                      <Progress value={uploadedFile.progress} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round(uploadedFile.progress)}%
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {uploadedFile.status === "error" && uploadedFile.error && (
                    <div className="text-xs text-destructive mt-1">
                      {uploadedFile.error}
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      uploadedFile.status === "success"
                        ? "default"
                        : uploadedFile.status === "error"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {uploadedFile.status === "success" && (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    )}
                    {uploadedFile.status === "error" && (
                      <AlertTriangle className="w-3 h-3 mr-1" />
                    )}
                    {uploadedFile.status === "uploading"
                      ? "Đang tải..."
                      : uploadedFile.status === "success"
                      ? "Thành công"
                      : "Lỗi"}
                  </Badge>

                  {/* Action Buttons */}
                  <div className="flex gap-1">
                    {uploadedFile.status === "success" && (
                      <>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}

                    {uploadedFile.status === "error" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryUpload(uploadedFile.id)}
                      >
                        Thử lại
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadedFile.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Guidelines */}
      <div className="text-sm text-muted-foreground">
        <p className="font-medium mb-2">Hướng dẫn upload tài liệu:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Hóa đơn viện phí (bắt buộc)</li>
          <li>Đơn thuốc và kết quả xét nghiệm</li>
          <li>Giấy ra viện (đối với nội trú)</li>
          <li>Bản sao CMND/CCCD và thẻ BHYT</li>
          <li>File phải rõ nét, đầy đủ thông tin</li>
        </ul>
      </div>
    </div>
  );
}
