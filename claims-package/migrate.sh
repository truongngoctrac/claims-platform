#!/bin/bash

# Claims Module Migration Script
# Tự động copy và cấu hình Claims module vào repo đích

set -e

echo "🚀 Bắt đầu migration Claims module..."

# Kiểm tra parameters
if [ $# -eq 0 ]; then
    echo "❌ Lỗi: Vui lòng cung cấp đường dẫn đến repo đích"
    echo "Sử dụng: ./migrate.sh /path/to/target/repo"
    exit 1
fi

TARGET_REPO=$1
CLAIMS_DIR="$TARGET_REPO/src/modules/claims"

# Kiểm tra repo đích
if [ ! -d "$TARGET_REPO" ]; then
    echo "❌ Lỗi: Thư mục đích không tồn tại: $TARGET_REPO"
    exit 1
fi

echo "📁 Tạo cấu trúc thư mục Claims..."
mkdir -p "$CLAIMS_DIR"
mkdir -p "$CLAIMS_DIR/components"
mkdir -p "$CLAIMS_DIR/pages"
mkdir -p "$CLAIMS_DIR/hooks"
mkdir -p "$CLAIMS_DIR/contexts"
mkdir -p "$CLAIMS_DIR/lib"
mkdir -p "$CLAIMS_DIR/services"
mkdir -p "$CLAIMS_DIR/types"
mkdir -p "$CLAIMS_DIR/styles"
mkdir -p "$CLAIMS_DIR/assets"

echo "📋 Copy các file Claims..."

# Frontend files
echo "  📱 Frontend components..."
cp -r frontend/* "$CLAIMS_DIR/"

# Backend files
echo "  🖥️  Backend services..."
cp -r backend/* "$CLAIMS_DIR/services/"

# Shared types
echo "  🔗 Shared types..."
cp -r shared/* "$CLAIMS_DIR/types/"

# AI/ML modules
echo "  🤖 AI/ML services..."
cp -r ai-ml/* "$CLAIMS_DIR/services/ai-ml/"

# Configuration files
echo "  ⚙️  Configuration..."
cp package.json "$CLAIMS_DIR/"
cp README.md "$CLAIMS_DIR/"

# Styles and assets
echo "  🎨 Styles và assets..."
cp -r assets/* "$CLAIMS_DIR/assets/" 2>/dev/null || true

echo "🔧 Cập nhật package.json của repo đích..."

# Update target repo's package.json với dependencies
if [ -f "$TARGET_REPO/package.json" ]; then
    echo "  📦 Thêm dependencies..."
    
    # Create backup
    cp "$TARGET_REPO/package.json" "$TARGET_REPO/package.json.backup"
    
    # Merge dependencies (simplified - in production, use proper JSON merge)
    echo "  ⚠️  Vui lòng tự thêm dependencies từ claims-package/package.json vào package.json chính"
fi

echo "📄 Tạo integration guide..."
cat > "$CLAIMS_DIR/INTEGRATION.md" << 'EOF'
# Claims Module Integration Guide

## 1. Cài đặt Dependencies


npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog
npm install @radix-ui/react-avatar @radix-ui/react-button
npm install @tanstack/react-query lucide-react
npm install tailwindcss-animate class-variance-authority
npm install express mongoose socket.io
```

## 2. Cấu hình Routing

Trong file App.tsx hoặc routes chính:

```typescript
import { ClaimsRoutes } from './modules/claims';

function App() {
  return (
    <Router>
      <Routes>
        {/* Existing routes */}
        <Route path="/claims/*" element={<ClaimsRoutes />} />
      </Routes>
    </Router>
  );
}
```

## 3. Backend Integration

Trong file server chính:

```typescript
import { claimsRoutes } from './modules/claims/services';

app.use('/api/claims', claimsRoutes);
```

## 4. Database Setup

```javascript
// MongoDB schemas sẽ được tự động tạo khi import ClaimModel
```

## 5. Environment Variables

Thêm vào .env:

```
MONGODB_URI=your_mongodb_connection
REDIS_URL=your_redis_connection
OPENAI_API_KEY=your_openai_key
VNPAY_MERCHANT_ID=your_vnpay_id
```

## 6. TailwindCSS Configuration

Cập nhật tailwind.config.js:

```javascript
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/modules/claims/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-orange': {
          500: '#ff6b35',
        },
        'brand-blue': {
          500: '#2e86ab',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```
EOF

echo "✅ Migration hoàn thành!"
echo ""
echo "📋 Các bước tiếp theo:"
echo "1. 📦 Cài đặt dependencies: cd $TARGET_REPO && npm install"
echo "2. ⚙️  Cấu hình routing theo hướng dẫn trong INTEGRATION.md"
echo "3. 🔧 Cập nhật tailwind.config.js"
echo "4. 🗄️  Thiết lập database connections"
echo "5. 🧪 Test integration"
echo ""
echo "📖 Đọc $CLAIMS_DIR/README.md để biết thêm chi tiết"
echo "🔗 Integration guide: $CLAIMS_DIR/INTEGRATION.md"
