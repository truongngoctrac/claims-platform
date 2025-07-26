-- Migration script for initial BHYT database setup
-- Run this after init.sql to create additional tables and data

-- Chèn dữ liệu mẫu cho development
\c bhyt_policies;

-- Thêm dữ liệu mẫu cho chính sách chi trả
INSERT INTO coverage_policies (
    name, policy_type, card_type_id, facility_level, 
    coverage_percentage, max_amount, deductible, 
    effective_from, conditions
) VALUES 
-- Chính sách ngoại trú cho thẻ TE1
(
    'Chính sách ngoại trú - Tuyến trung ương', 
    'outpatient', 
    (SELECT id FROM insurance_card_types WHERE code = 'TE1'), 
    'central', 
    100.00, 
    50000000, 
    0, 
    '2024-01-01',
    '{"max_visits_per_year": 52, "requires_referral": false}'
),
-- Chính sách nội trú cho thẻ TE1
(
    'Chính sách nội trú - Tuyến trung ương', 
    'inpatient', 
    (SELECT id FROM insurance_card_types WHERE code = 'TE1'), 
    'central', 
    100.00, 
    200000000, 
    0, 
    '2024-01-01',
    '{"max_days_per_year": 365, "requires_authorization": false}'
),
-- Chính sách cấp cứu cho thẻ TE1
(
    'Chính sách cấp cứu - Tuyến trung ương', 
    'emergency', 
    (SELECT id FROM insurance_card_types WHERE code = 'TE1'), 
    'central', 
    100.00, 
    100000000, 
    0, 
    '2024-01-01',
    '{"24_hour_coverage": true}'
),
-- Chính sách ngoại trú cho thẻ TE2 tại tuyến tỉnh
(
    'Chính sách ngoại trú - Tuyến tỉnh', 
    'outpatient', 
    (SELECT id FROM insurance_card_types WHERE code = 'TE2'), 
    'provincial', 
    100.00, 
    30000000, 
    0, 
    '2024-01-01',
    '{"max_visits_per_year": 52, "requires_referral": false}'
),
-- Chính sách ngoại trú cho thẻ TE2 tại tuyến huyện (trái tuyến)
(
    'Chính sách ngoại trú - Trái tuyến huyện', 
    'outpatient', 
    (SELECT id FROM insurance_card_types WHERE code = 'TE2'), 
    'district', 
    80.00, 
    20000000, 
    50000, 
    '2024-01-01',
    '{"requires_referral": true, "copay_percentage": 20}'
);

-- Chèn dữ liệu mẫu cho thẻ BHYT
INSERT INTO insurance_cards (
    user_id, card_number, card_type_id, issued_date, 
    valid_from, valid_to, issuing_province_code, registration_place
) VALUES 
-- Thẻ mẫu cho test (user_id sẽ được tạo sau khi có user service)
(
    '550e8400-e29b-41d4-a716-446655440000', -- UUID mẫu
    'TE101234567890A', 
    (SELECT id FROM insurance_card_types WHERE code = 'TE1'), 
    '2024-01-01', 
    '2024-01-01', 
    '2024-12-31', 
    '01', 
    'Bệnh viện Bạch Mai'
),
(
    '550e8400-e29b-41d4-a716-446655440001', -- UUID mẫu khác
    'TE202345678901B', 
    (SELECT id FROM insurance_card_types WHERE code = 'TE2'), 
    '2024-01-01', 
    '2024-01-01', 
    '2024-12-31', 
    '79', 
    'Bệnh viện Chợ Rẫy'
);

-- Tạo index bổ sung cho hiệu suất
CREATE INDEX IF NOT EXISTS idx_coverage_policies_card_type_policy_type ON coverage_policies(card_type_id, policy_type);
CREATE INDEX IF NOT EXISTS idx_coverage_policies_effective_dates ON coverage_policies(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_insurance_cards_dates ON insurance_cards(valid_from, valid_to);

-- Chuyển sang database claims và tạo dữ liệu mẫu
\c bhyt_claims;

-- Thêm sample claim data (sẽ được tạo thông qua API)
-- Tạo index bổ sung cho claims
CREATE INDEX IF NOT EXISTS idx_claims_user_dates ON claims(user_id, admission_date);
CREATE INDEX IF NOT EXISTS idx_claims_facility_dates ON claims(facility_id, admission_date);
CREATE INDEX IF NOT EXISTS idx_claims_submitted_at ON claims(submitted_at);

-- Tạo view cho báo cáo
CREATE OR REPLACE VIEW claim_summary_view AS
SELECT 
    c.id,
    c.claim_number,
    c.user_id,
    c.visit_type,
    c.status,
    c.total_amount,
    c.covered_amount,
    c.patient_payment,
    c.admission_date,
    c.discharge_date,
    c.submitted_at,
    COUNT(csd.id) as service_count,
    COUNT(cm.id) as medication_count,
    COUNT(cd.id) as document_count
FROM claims c
LEFT JOIN claim_service_details csd ON c.id = csd.claim_id
LEFT JOIN claim_medications cm ON c.id = cm.claim_id
LEFT JOIN claim_documents cd ON c.id = cd.claim_id
GROUP BY c.id;

-- Tạo stored procedure cho cập nhật trạng thái claim
CREATE OR REPLACE FUNCTION update_claim_status(
    p_claim_id UUID,
    p_new_status VARCHAR(20),
    p_changed_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status VARCHAR(20);
    v_claim_exists BOOLEAN;
BEGIN
    -- Check if claim exists and get current status
    SELECT status INTO v_old_status 
    FROM claims 
    WHERE id = p_claim_id;
    
    GET DIAGNOSTICS v_claim_exists = FOUND;
    
    IF NOT v_claim_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Update claim status
    UPDATE claims 
    SET 
        status = p_new_status,
        updated_at = CURRENT_TIMESTAMP,
        reviewed_at = CASE 
            WHEN p_new_status IN ('approved', 'rejected') THEN CURRENT_TIMESTAMP 
            ELSE reviewed_at 
        END,
        reviewer_id = CASE 
            WHEN p_new_status IN ('approved', 'rejected') THEN p_changed_by 
            ELSE reviewer_id 
        END,
        payment_date = CASE 
            WHEN p_new_status = 'paid' THEN CURRENT_TIMESTAMP 
            ELSE payment_date 
        END
    WHERE id = p_claim_id;
    
    -- Insert status history
    INSERT INTO claim_status_history (
        claim_id, old_status, new_status, changed_by, reason
    ) VALUES (
        p_claim_id, v_old_status, p_new_status, p_changed_by, p_reason
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger để tự động tính toán patient_payment
CREATE OR REPLACE FUNCTION calculate_patient_payment()
RETURNS TRIGGER AS $$
BEGIN
    NEW.patient_payment = NEW.total_amount - NEW.covered_amount;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_patient_payment
    BEFORE INSERT OR UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION calculate_patient_payment();

-- Tạo function để cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_claims(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete claims older than specified days that are in final status
    DELETE FROM claims 
    WHERE 
        created_at < CURRENT_DATE - INTERVAL '%s days' 
        AND status IN ('paid', 'rejected')
        AND created_at < CURRENT_DATE - INTERVAL '7 years'; -- Legal retention period
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Tạo các constraint bổ sung
ALTER TABLE claims ADD CONSTRAINT check_admission_discharge_dates 
    CHECK (discharge_date IS NULL OR discharge_date >= admission_date);

ALTER TABLE claims ADD CONSTRAINT check_positive_amounts 
    CHECK (total_amount >= 0 AND covered_amount >= 0 AND patient_payment >= 0);

ALTER TABLE claims ADD CONSTRAINT check_covered_not_exceed_total 
    CHECK (covered_amount <= total_amount);

ALTER TABLE claim_service_details ADD CONSTRAINT check_positive_service_amounts 
    CHECK (quantity > 0 AND unit_price >= 0 AND total_price >= 0 AND covered_amount >= 0);

ALTER TABLE claim_medications ADD CONSTRAINT check_positive_medication_amounts 
    CHECK (quantity > 0 AND unit_price >= 0 AND total_price >= 0 AND covered_amount >= 0);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bhyt_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bhyt_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bhyt_user;

-- Create backup schema for data archival
CREATE SCHEMA IF NOT EXISTS archive;
GRANT USAGE ON SCHEMA archive TO bhyt_user;

-- Logging setup
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    log_level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_logs_service_level ON system_logs(service_name, log_level);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);

-- Performance monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    service_name VARCHAR(50) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_performance_metrics_name_service ON performance_metrics(metric_name, service_name);
CREATE INDEX idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);

COMMIT;
