from app import db
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import func
import uuid
from datetime import datetime, date

class Claim(db.Model):
    """Model yêu cầu bồi thường BHYT"""
    __tablename__ = 'claims'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_number = db.Column(db.String(20), unique=True, nullable=False, index=True)  # Số hồ sơ
    user_id = db.Column(UUID(as_uuid=True), nullable=False, index=True)  # Reference to users table
    insurance_card_id = db.Column(UUID(as_uuid=True), nullable=False, index=True)  # Reference to insurance_cards table
    facility_id = db.Column(UUID(as_uuid=True), nullable=False, index=True)  # Reference to healthcare_facilities table
    visit_type = db.Column(db.String(20), nullable=False, index=True)  # inpatient, outpatient, emergency
    admission_date = db.Column(db.Date, nullable=False)
    discharge_date = db.Column(db.Date)
    primary_diagnosis_code = db.Column(db.String(10), nullable=False)  # Mã ICD-10
    primary_diagnosis_name = db.Column(db.String(255), nullable=False)
    secondary_diagnoses = db.Column(db.JSON)  # Các chẩn đoán phụ
    total_amount = db.Column(db.Numeric(15, 2), nullable=False)  # Tổng chi phí
    covered_amount = db.Column(db.Numeric(15, 2), nullable=False)  # Số tiền được chi trả
    patient_payment = db.Column(db.Numeric(15, 2), nullable=False)  # Số tiền bệnh nhân phải trả
    status = db.Column(db.String(20), default='submitted', nullable=False, index=True)
    submitted_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    reviewed_at = db.Column(db.DateTime(timezone=True))
    reviewer_id = db.Column(UUID(as_uuid=True))  # Reference to users table (staff who reviewed)
    review_notes = db.Column(db.Text)
    payment_date = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    service_details = db.relationship('ClaimServiceDetail', backref='claim', cascade='all, delete-orphan')
    medications = db.relationship('ClaimMedication', backref='claim', cascade='all, delete-orphan')
    documents = db.relationship('ClaimDocument', backref='claim', cascade='all, delete-orphan')
    status_history = db.relationship('ClaimStatusHistory', backref='claim', cascade='all, delete-orphan')
    
    def __init__(self, **kwargs):
        # Validate visit type
        valid_visit_types = ['inpatient', 'outpatient', 'emergency']
        if 'visit_type' in kwargs and kwargs['visit_type'] not in valid_visit_types:
            raise ValueError(f"Loại khám không hợp lệ. Phải là một trong: {valid_visit_types}")
        
        # Validate status
        valid_statuses = ['submitted', 'reviewing', 'approved', 'rejected', 'paid']
        if 'status' in kwargs and kwargs['status'] not in valid_statuses:
            raise ValueError(f"Trạng thái không hợp lệ. Phải là một trong: {valid_statuses}")
        
        # Generate claim number if not provided
        if 'claim_number' not in kwargs:
            kwargs['claim_number'] = self._generate_claim_number()
        
        super(Claim, self).__init__(**kwargs)
    
    def _generate_claim_number(self):
        """Tạo số hồ sơ tự động"""
        from datetime import datetime
        now = datetime.now()
        prefix = f"BHYT{now.year}{now.month:02d}"
        
        # Get the latest claim number for this month
        latest_claim = Claim.query.filter(
            Claim.claim_number.like(f"{prefix}%")
        ).order_by(Claim.claim_number.desc()).first()
        
        if latest_claim:
            last_number = int(latest_claim.claim_number[-6:])
            new_number = last_number + 1
        else:
            new_number = 1
        
        return f"{prefix}{new_number:06d}"
    
    def to_dict(self, include_details=False):
        data = {
            'id': str(self.id),
            'claim_number': self.claim_number,
            'user_id': str(self.user_id),
            'insurance_card_id': str(self.insurance_card_id),
            'facility_id': str(self.facility_id),
            'visit_type': self.visit_type,
            'admission_date': self.admission_date.isoformat() if self.admission_date else None,
            'discharge_date': self.discharge_date.isoformat() if self.discharge_date else None,
            'primary_diagnosis_code': self.primary_diagnosis_code,
            'primary_diagnosis_name': self.primary_diagnosis_name,
            'secondary_diagnoses': self.secondary_diagnoses or [],
            'total_amount': float(self.total_amount),
            'covered_amount': float(self.covered_amount),
            'patient_payment': float(self.patient_payment),
            'status': self.status,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'reviewer_id': str(self.reviewer_id) if self.reviewer_id else None,
            'review_notes': self.review_notes,
            'payment_date': self.payment_date.isoformat() if self.payment_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_details:
            data['service_details'] = [detail.to_dict() for detail in self.service_details]
            data['medications'] = [med.to_dict() for med in self.medications]
            data['documents'] = [doc.to_dict() for doc in self.documents]
            data['status_history'] = [history.to_dict() for history in self.status_history]
        
        return data
    
    @classmethod
    def find_by_claim_number(cls, claim_number):
        return cls.query.filter_by(claim_number=claim_number).first()
    
    @classmethod
    def find_by_user_id(cls, user_id):
        return cls.query.filter_by(user_id=user_id).order_by(cls.created_at.desc()).all()

class ClaimServiceDetail(db.Model):
    """Model chi tiết dịch vụ y tế trong claim"""
    __tablename__ = 'claim_service_details'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = db.Column(UUID(as_uuid=True), db.ForeignKey('claims.id'), nullable=False)
    service_code = db.Column(db.String(20), nullable=False)  # Mã dịch vụ kỹ thuật
    service_name = db.Column(db.String(255), nullable=False)
    service_type = db.Column(db.String(50), nullable=False)  # examination, treatment, medication, test
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(15, 2), nullable=False)
    total_price = db.Column(db.Numeric(15, 2), nullable=False)
    covered_amount = db.Column(db.Numeric(15, 2), nullable=False)
    coverage_percentage = db.Column(db.Numeric(5, 2), nullable=False)
    service_date = db.Column(db.Date, nullable=False)
    doctor_name = db.Column(db.String(255))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'claim_id': str(self.claim_id),
            'service_code': self.service_code,
            'service_name': self.service_name,
            'service_type': self.service_type,
            'quantity': self.quantity,
            'unit_price': float(self.unit_price),
            'total_price': float(self.total_price),
            'covered_amount': float(self.covered_amount),
            'coverage_percentage': float(self.coverage_percentage),
            'service_date': self.service_date.isoformat() if self.service_date else None,
            'doctor_name': self.doctor_name,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ClaimMedication(db.Model):
    """Model thuốc trong claim"""
    __tablename__ = 'claim_medications'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = db.Column(UUID(as_uuid=True), db.ForeignKey('claims.id'), nullable=False)
    medication_code = db.Column(db.String(20), nullable=False)  # Mã thuốc
    medication_name = db.Column(db.String(255), nullable=False)
    dosage = db.Column(db.String(100))  # Liều lượng
    quantity = db.Column(db.Integer, nullable=False)
    unit = db.Column(db.String(20), nullable=False)  # Đơn vị tính
    unit_price = db.Column(db.Numeric(15, 2), nullable=False)
    total_price = db.Column(db.Numeric(15, 2), nullable=False)
    covered_amount = db.Column(db.Numeric(15, 2), nullable=False)
    coverage_percentage = db.Column(db.Numeric(5, 2), nullable=False)
    prescribed_date = db.Column(db.Date, nullable=False)
    doctor_name = db.Column(db.String(255))
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'claim_id': str(self.claim_id),
            'medication_code': self.medication_code,
            'medication_name': self.medication_name,
            'dosage': self.dosage,
            'quantity': self.quantity,
            'unit': self.unit,
            'unit_price': float(self.unit_price),
            'total_price': float(self.total_price),
            'covered_amount': float(self.covered_amount),
            'coverage_percentage': float(self.coverage_percentage),
            'prescribed_date': self.prescribed_date.isoformat() if self.prescribed_date else None,
            'doctor_name': self.doctor_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ClaimDocument(db.Model):
    """Model tài liệu đính kèm claim"""
    __tablename__ = 'claim_documents'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = db.Column(UUID(as_uuid=True), db.ForeignKey('claims.id'), nullable=False)
    document_type = db.Column(db.String(50), nullable=False)  # medical_record, prescription, invoice, test_result
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.Text, nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    uploaded_by = db.Column(UUID(as_uuid=True), nullable=False)  # Reference to users table
    uploaded_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'claim_id': str(self.claim_id),
            'document_type': self.document_type,
            'file_name': self.file_name,
            'file_path': self.file_path,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'uploaded_by': str(self.uploaded_by),
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }

class ClaimStatusHistory(db.Model):
    """Model lịch sử thay đổi trạng thái claim"""
    __tablename__ = 'claim_status_history'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = db.Column(UUID(as_uuid=True), db.ForeignKey('claims.id'), nullable=False)
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20), nullable=False)
    changed_by = db.Column(UUID(as_uuid=True), nullable=False)  # Reference to users table
    reason = db.Column(db.Text)
    changed_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'claim_id': str(self.claim_id),
            'old_status': self.old_status,
            'new_status': self.new_status,
            'changed_by': str(self.changed_by),
            'reason': self.reason,
            'changed_at': self.changed_at.isoformat() if self.changed_at else None
        }

# Constants
class ClaimStatus:
    SUBMITTED = 'submitted'
    REVIEWING = 'reviewing'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    PAID = 'paid'
    
    ALL_STATUSES = [SUBMITTED, REVIEWING, APPROVED, REJECTED, PAID]

class VisitType:
    INPATIENT = 'inpatient'
    OUTPATIENT = 'outpatient'
    EMERGENCY = 'emergency'
    
    ALL_TYPES = [INPATIENT, OUTPATIENT, EMERGENCY]

class ServiceType:
    EXAMINATION = 'examination'
    TREATMENT = 'treatment'
    MEDICATION = 'medication'
    TEST = 'test'
    
    ALL_TYPES = [EXAMINATION, TREATMENT, MEDICATION, TEST]

class DocumentType:
    MEDICAL_RECORD = 'medical_record'
    PRESCRIPTION = 'prescription'
    INVOICE = 'invoice'
    TEST_RESULT = 'test_result'
    
    ALL_TYPES = [MEDICAL_RECORD, PRESCRIPTION, INVOICE, TEST_RESULT]
