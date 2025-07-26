-- Khởi tạo cơ sở dữ liệu cho hệ thống BHYT Việt Nam

-- Tạo các database cho từng service
CREATE DATABASE IF NOT EXISTS bhyt_users;
CREATE DATABASE IF NOT EXISTS bhyt_policies;
CREATE DATABASE IF NOT EXISTS bhyt_claims;

-- Tạo user và phân quyền
GRANT ALL PRIVILEGES ON DATABASE bhyt_users TO bhyt_user;
GRANT ALL PRIVILEGES ON DATABASE bhyt_policies TO bhyt_user;
GRANT ALL PRIVILEGES ON DATABASE bhyt_claims TO bhyt_user;

-- Sử dụng database users
\c bhyt_users;

-- Bảng người dùng
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cccd VARCHAR(12) UNIQUE NOT NULL, -- Căn cước công dân
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) CHECK (gender IN ('Nam', 'Nữ', 'Khác')),
    address TEXT NOT NULL,
    province_code VARCHAR(2) NOT NULL, -- Mã tỉnh/thành phố
    district_code VARCHAR(3) NOT NULL, -- Mã quận/huyện
    ward_code VARCHAR(5) NOT NULL, -- Mã phường/xã
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'staff', 'doctor')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng profile bổ sung
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    occupation VARCHAR(255),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(15),
    medical_conditions TEXT[], -- Bệnh lý hiện tại
    allergies TEXT[], -- Dị ứng
    preferred_language VARCHAR(5) DEFAULT 'vi',
    avatar_url TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng phiên đăng nhập
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    device_info JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tạo index
CREATE INDEX idx_users_cccd ON users(cccd);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_province ON users(province_code);
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- Chuyển sang database policies
\c bhyt_policies;

-- Bảng loại thẻ BHYT
CREATE TABLE IF NOT EXISTS insurance_card_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- TE1, TE2, TE3, TE4, TE5, TE6
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coverage_percentage DECIMAL(5,2) NOT NULL, -- % được chi trả
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng thẻ BHYT
CREATE TABLE IF NOT EXISTS insurance_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Reference to users table (cross-database)
    card_number VARCHAR(15) UNIQUE NOT NULL, -- Số thẻ BHYT (15 ký tự)
    card_type_id UUID NOT NULL REFERENCES insurance_card_types(id),
    issued_date DATE NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    issuing_province_code VARCHAR(2) NOT NULL,
    registration_place VARCHAR(255) NOT NULL, -- Nơi đăng ký KCB ban đầu
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng cơ sở khám chữa bệnh
CREATE TABLE IF NOT EXISTS healthcare_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- Mã cơ sở KCB
    name VARCHAR(255) NOT NULL,
    level VARCHAR(20) NOT NULL CHECK (level IN ('central', 'provincial', 'district', 'commune')),
    type VARCHAR(50) NOT NULL, -- Bệnh viện, phòng khám, trạm y tế
    address TEXT NOT NULL,
    province_code VARCHAR(2) NOT NULL,
    district_code VARCHAR(3) NOT NULL,
    ward_code VARCHAR(5) NOT NULL,
    phone VARCHAR(15),
    email VARCHAR(255),
    director_name VARCHAR(255),
    bed_count INTEGER DEFAULT 0,
    specialties TEXT[], -- Các chuyên khoa
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng chính sách chi trả
CREATE TABLE IF NOT EXISTS coverage_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    policy_type VARCHAR(50) NOT NULL, -- inpatient, outpatient, emergency, preventive
    card_type_id UUID NOT NULL REFERENCES insurance_card_types(id),
    facility_level VARCHAR(20) NOT NULL,
    coverage_percentage DECIMAL(5,2) NOT NULL,
    max_amount DECIMAL(15,2), -- Mức tối đa
    deductible DECIMAL(15,2) DEFAULT 0, -- Mức tự chi trả
    conditions JSONB, -- Điều kiện áp dụng
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tạo index cho policies
CREATE INDEX idx_insurance_cards_user_id ON insurance_cards(user_id);
CREATE INDEX idx_insurance_cards_number ON insurance_cards(card_number);
CREATE INDEX idx_insurance_cards_status ON insurance_cards(status);
CREATE INDEX idx_facilities_code ON healthcare_facilities(code);
CREATE INDEX idx_facilities_province ON healthcare_facilities(province_code);
CREATE INDEX idx_coverage_policies_type ON coverage_policies(policy_type);

-- Chuyển sang database claims
\c bhyt_claims;

-- Bảng yêu cầu bồi thường
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number VARCHAR(20) UNIQUE NOT NULL, -- Số hồ sơ
    user_id UUID NOT NULL, -- Reference to users table
    insurance_card_id UUID NOT NULL, -- Reference to insurance_cards table
    facility_id UUID NOT NULL, -- Reference to healthcare_facilities table
    visit_type VARCHAR(20) NOT NULL CHECK (visit_type IN ('inpatient', 'outpatient', 'emergency')),
    admission_date DATE NOT NULL,
    discharge_date DATE,
    primary_diagnosis_code VARCHAR(10) NOT NULL, -- Mã ICD-10
    primary_diagnosis_name VARCHAR(255) NOT NULL,
    secondary_diagnoses JSONB, -- Các chẩn đoán phụ
    total_amount DECIMAL(15,2) NOT NULL, -- Tổng chi phí
    covered_amount DECIMAL(15,2) NOT NULL, -- Số tiền được chi trả
    patient_payment DECIMAL(15,2) NOT NULL, -- Số tiền bệnh nhân phải trả
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'approved', 'rejected', 'paid')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id UUID, -- Reference to users table (staff who reviewed)
    review_notes TEXT,
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng chi tiết dịch vụ y tế
CREATE TABLE IF NOT EXISTS claim_service_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    service_code VARCHAR(20) NOT NULL, -- Mã dịch vụ kỹ thuật
    service_name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50) NOT NULL, -- examination, treatment, medication, test
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    covered_amount DECIMAL(15,2) NOT NULL,
    coverage_percentage DECIMAL(5,2) NOT NULL,
    service_date DATE NOT NULL,
    doctor_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng thuốc trong đơn
CREATE TABLE IF NOT EXISTS claim_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    medication_code VARCHAR(20) NOT NULL, -- Mã thuốc
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100), -- Liều lượng
    quantity INTEGER NOT NULL,
    unit VARCHAR(20) NOT NULL, -- Đơn vị tính
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    covered_amount DECIMAL(15,2) NOT NULL,
    coverage_percentage DECIMAL(5,2) NOT NULL,
    prescribed_date DATE NOT NULL,
    doctor_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng tài liệu đính kèm
CREATE TABLE IF NOT EXISTS claim_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- medical_record, prescription, invoice, test_result
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID NOT NULL, -- Reference to users table
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lịch sử thay đổi trạng thái
CREATE TABLE IF NOT EXISTS claim_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID NOT NULL, -- Reference to users table
    reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tạo index cho claims
CREATE INDEX idx_claims_user_id ON claims(user_id);
CREATE INDEX idx_claims_card_id ON claims(insurance_card_id);
CREATE INDEX idx_claims_facility_id ON claims(facility_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_number ON claims(claim_number);
CREATE INDEX idx_claims_dates ON claims(admission_date, discharge_date);
CREATE INDEX idx_service_details_claim_id ON claim_service_details(claim_id);
CREATE INDEX idx_medications_claim_id ON claim_medications(claim_id);
CREATE INDEX idx_documents_claim_id ON claim_documents(claim_id);
CREATE INDEX idx_status_history_claim_id ON claim_status_history(claim_id);

-- Chèn dữ liệu mẫu
\c bhyt_policies;

-- Dữ liệu mẫu cho loại thẻ BHYT
INSERT INTO insurance_card_types (code, name, description, coverage_percentage) VALUES
('TE1', 'Thẻ tuyến trung ương', 'Dành cho người có hộ khẩu tại Hà Nội, TP.HCM', 100.00),
('TE2', 'Thẻ tuyến tỉnh', 'Dành cho người có hộ khẩu tại các tỉnh thành', 100.00),
('TE3', 'Thẻ tuyến huyện', 'Dành cho người có hộ khẩu tại các huyện', 100.00),
('TE4', 'Thẻ tuyến xã', 'Dành cho người c�� hộ khẩu tại các xã', 100.00),
('TE5', 'Thẻ người nghèo', 'Dành cho hộ nghèo và cận nghèo', 100.00),
('TE6', 'Thẻ trẻ em dưới 6 tuổi', 'Dành cho trẻ em dưới 6 tuổi', 100.00);

-- Dữ liệu mẫu cho cơ sở y tế
INSERT INTO healthcare_facilities (code, name, level, type, address, province_code, district_code, ward_code, phone) VALUES
('01001', 'Bệnh viện Bạch Mai', 'central', 'Bệnh viện đa khoa', '78 Giải Phóng, Đống Đa, Hà Nội', '01', '001', '00101', '0243-8692345'),
('01002', 'Bệnh viện Việt Đức', 'central', 'Bệnh viện đa khoa', '40 Tràng Thi, Hoàn Kiếm, Hà Nội', '01', '002', '00201', '0243-8253531'),
('79001', 'Bệnh viện Chợ Rẫy', 'central', 'Bệnh viện đa khoa', '201B Nguyễn Chí Thanh, Quận 5, TP.HCM', '79', '001', '79101', '0283-8554137'),
('79002', 'Bệnh viện Đại học Y dược TP.HCM', 'provincial', 'Bệnh viện đa khoa', '215 Hồng Bàng, Quận 5, TP.HCM', '79', '002', '79201', '0283-9230175');

-- Trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Áp dụng trigger cho các bảng
\c bhyt_users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

\c bhyt_policies;
CREATE TRIGGER update_insurance_cards_updated_at BEFORE UPDATE ON insurance_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_healthcare_facilities_updated_at BEFORE UPDATE ON healthcare_facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coverage_policies_updated_at BEFORE UPDATE ON coverage_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

\c bhyt_claims;
CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
