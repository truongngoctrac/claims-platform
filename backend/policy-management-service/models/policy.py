from app import db
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import func
import uuid
from datetime import datetime, date

class InsuranceCardType(db.Model):
    """Model loại thẻ BHYT"""
    __tablename__ = 'insurance_card_types'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = db.Column(db.String(10), unique=True, nullable=False, index=True)  # TE1, TE2, TE3, TE4, TE5, TE6
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    coverage_percentage = db.Column(db.Numeric(5, 2), nullable=False)  # % được chi trả
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    insurance_cards = db.relationship('InsuranceCard', backref='card_type', lazy='dynamic')
    coverage_policies = db.relationship('CoveragePolicy', backref='card_type', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'coverage_percentage': float(self.coverage_percentage),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def find_by_code(cls, code):
        return cls.query.filter_by(code=code).first()

class InsuranceCard(db.Model):
    """Model thẻ BHYT"""
    __tablename__ = 'insurance_cards'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), nullable=False, index=True)  # Reference to users table
    card_number = db.Column(db.String(15), unique=True, nullable=False, index=True)  # Số thẻ BHYT (15 ký tự)
    card_type_id = db.Column(UUID(as_uuid=True), db.ForeignKey('insurance_card_types.id'), nullable=False)
    issued_date = db.Column(db.Date, nullable=False)
    valid_from = db.Column(db.Date, nullable=False)
    valid_to = db.Column(db.Date, nullable=False)
    issuing_province_code = db.Column(db.String(2), nullable=False)
    registration_place = db.Column(db.String(255), nullable=False)  # Nơi đăng ký KCB ban đầu
    status = db.Column(db.String(20), default='active', nullable=False, index=True)  # active, suspended, expired, cancelled
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __init__(self, **kwargs):
        # Validate status
        valid_statuses = ['active', 'suspended', 'expired', 'cancelled']
        if 'status' in kwargs and kwargs['status'] not in valid_statuses:
            raise ValueError(f"Trạng thái không hợp lệ. Phải là một trong: {valid_statuses}")
        
        # Validate card number format (Vietnamese BHYT card format)
        if 'card_number' in kwargs:
            card_number = kwargs['card_number']
            if len(card_number) != 15:
                raise ValueError("Số thẻ BHYT phải có 15 ký tự")
        
        super(InsuranceCard, self).__init__(**kwargs)
    
    def is_valid(self, check_date=None):
        """Kiểm tra thẻ có còn hiệu lực không"""
        if check_date is None:
            check_date = date.today()
        
        return (
            self.status == 'active' and
            self.valid_from <= check_date <= self.valid_to
        )
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'card_number': self.card_number,
            'card_type_id': str(self.card_type_id),
            'card_type': self.card_type.to_dict() if self.card_type else None,
            'issued_date': self.issued_date.isoformat() if self.issued_date else None,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_to': self.valid_to.isoformat() if self.valid_to else None,
            'issuing_province_code': self.issuing_province_code,
            'registration_place': self.registration_place,
            'status': self.status,
            'is_valid': self.is_valid(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def find_by_card_number(cls, card_number):
        return cls.query.filter_by(card_number=card_number).first()
    
    @classmethod
    def find_by_user_id(cls, user_id):
        return cls.query.filter_by(user_id=user_id).all()

class HealthcareFacility(db.Model):
    """Model cơ sở khám chữa bệnh"""
    __tablename__ = 'healthcare_facilities'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = db.Column(db.String(10), unique=True, nullable=False, index=True)  # Mã cơ sở KCB
    name = db.Column(db.String(255), nullable=False)
    level = db.Column(db.String(20), nullable=False, index=True)  # central, provincial, district, commune
    type = db.Column(db.String(50), nullable=False)  # Bệnh viện, phòng khám, trạm y tế
    address = db.Column(db.Text, nullable=False)
    province_code = db.Column(db.String(2), nullable=False, index=True)
    district_code = db.Column(db.String(3), nullable=False)
    ward_code = db.Column(db.String(5), nullable=False)
    phone = db.Column(db.String(15))
    email = db.Column(db.String(255))
    director_name = db.Column(db.String(255))
    bed_count = db.Column(db.Integer, default=0)
    specialties = db.Column(ARRAY(db.Text))  # Các chuyên khoa
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __init__(self, **kwargs):
        # Validate level
        valid_levels = ['central', 'provincial', 'district', 'commune']
        if 'level' in kwargs and kwargs['level'] not in valid_levels:
            raise ValueError(f"Cấp cơ sở không hợp lệ. Phải là một trong: {valid_levels}")
        
        super(HealthcareFacility, self).__init__(**kwargs)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'code': self.code,
            'name': self.name,
            'level': self.level,
            'type': self.type,
            'address': self.address,
            'province_code': self.province_code,
            'district_code': self.district_code,
            'ward_code': self.ward_code,
            'phone': self.phone,
            'email': self.email,
            'director_name': self.director_name,
            'bed_count': self.bed_count,
            'specialties': self.specialties or [],
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def find_by_code(cls, code):
        return cls.query.filter_by(code=code).first()
    
    @classmethod
    def find_by_province(cls, province_code):
        return cls.query.filter_by(province_code=province_code, is_active=True).all()

class CoveragePolicy(db.Model):
    """Model chính sách chi trả"""
    __tablename__ = 'coverage_policies'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(255), nullable=False)
    policy_type = db.Column(db.String(50), nullable=False, index=True)  # inpatient, outpatient, emergency, preventive
    card_type_id = db.Column(UUID(as_uuid=True), db.ForeignKey('insurance_card_types.id'), nullable=False)
    facility_level = db.Column(db.String(20), nullable=False)
    coverage_percentage = db.Column(db.Numeric(5, 2), nullable=False)
    max_amount = db.Column(db.Numeric(15, 2))  # Mức tối đa
    deductible = db.Column(db.Numeric(15, 2), default=0)  # Mức tự chi trả
    conditions = db.Column(db.JSON)  # Điều kiện áp dụng
    effective_from = db.Column(db.Date, nullable=False)
    effective_to = db.Column(db.Date)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __init__(self, **kwargs):
        # Validate policy type
        valid_types = ['inpatient', 'outpatient', 'emergency', 'preventive']
        if 'policy_type' in kwargs and kwargs['policy_type'] not in valid_types:
            raise ValueError(f"Loại chính sách không hợp lệ. Phải là một trong: {valid_types}")
        
        # Validate facility level
        valid_levels = ['central', 'provincial', 'district', 'commune']
        if 'facility_level' in kwargs and kwargs['facility_level'] not in valid_levels:
            raise ValueError(f"Cấp cơ sở không hợp lệ. Phải là một trong: {valid_levels}")
        
        super(CoveragePolicy, self).__init__(**kwargs)
    
    def is_applicable(self, check_date=None):
        """Kiểm tra chính sách có áp dụng không"""
        if check_date is None:
            check_date = date.today()
        
        if not self.is_active:
            return False
        
        if check_date < self.effective_from:
            return False
        
        if self.effective_to and check_date > self.effective_to:
            return False
        
        return True
    
    def calculate_coverage(self, total_amount):
        """Tính toán số tiền được chi trả"""
        if not self.is_applicable():
            return 0
        
        # Apply deductible
        covered_amount = max(0, total_amount - float(self.deductible or 0))
        
        # Apply coverage percentage
        covered_amount = covered_amount * (float(self.coverage_percentage) / 100)
        
        # Apply maximum limit
        if self.max_amount:
            covered_amount = min(covered_amount, float(self.max_amount))
        
        return round(covered_amount, 2)
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'policy_type': self.policy_type,
            'card_type_id': str(self.card_type_id),
            'card_type': self.card_type.to_dict() if self.card_type else None,
            'facility_level': self.facility_level,
            'coverage_percentage': float(self.coverage_percentage),
            'max_amount': float(self.max_amount) if self.max_amount else None,
            'deductible': float(self.deductible) if self.deductible else 0,
            'conditions': self.conditions,
            'effective_from': self.effective_from.isoformat() if self.effective_from else None,
            'effective_to': self.effective_to.isoformat() if self.effective_to else None,
            'is_active': self.is_active,
            'is_applicable': self.is_applicable(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def find_applicable_policies(cls, card_type_id, policy_type, facility_level, check_date=None):
        """Tìm các chính sách áp dụng được"""
        if check_date is None:
            check_date = date.today()
        
        query = cls.query.filter_by(
            card_type_id=card_type_id,
            policy_type=policy_type,
            facility_level=facility_level,
            is_active=True
        ).filter(
            cls.effective_from <= check_date
        )
        
        # Check effective_to (NULL means no end date)
        query = query.filter(
            db.or_(cls.effective_to.is_(None), cls.effective_to >= check_date)
        )
        
        return query.all()

# Constants
class CardStatus:
    ACTIVE = 'active'
    SUSPENDED = 'suspended'
    EXPIRED = 'expired'
    CANCELLED = 'cancelled'
    
    ALL_STATUSES = [ACTIVE, SUSPENDED, EXPIRED, CANCELLED]

class FacilityLevel:
    CENTRAL = 'central'
    PROVINCIAL = 'provincial'
    DISTRICT = 'district'
    COMMUNE = 'commune'
    
    ALL_LEVELS = [CENTRAL, PROVINCIAL, DISTRICT, COMMUNE]

class PolicyType:
    INPATIENT = 'inpatient'
    OUTPATIENT = 'outpatient'
    EMERGENCY = 'emergency'
    PREVENTIVE = 'preventive'
    
    ALL_TYPES = [INPATIENT, OUTPATIENT, EMERGENCY, PREVENTIVE]
