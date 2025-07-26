from app import db
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import func
import uuid
import bcrypt
from datetime import datetime

class User(db.Model):
    """Model người dùng cho hệ thống BHYT Việt Nam"""
    __tablename__ = 'users'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cccd = db.Column(db.String(12), unique=True, nullable=False, index=True)  # Căn cước công dân
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(15), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    gender = db.Column(db.String(10), nullable=False)  # Nam, Nữ, Khác
    address = db.Column(db.Text, nullable=False)
    province_code = db.Column(db.String(2), nullable=False, index=True)  # Mã tỉnh/thành phố
    district_code = db.Column(db.String(3), nullable=False)  # Mã quận/huyện
    ward_code = db.Column(db.String(5), nullable=False)  # Mã phường/xã
    role = db.Column(db.String(20), default='user', nullable=False, index=True)  # user, admin, staff, doctor
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    email_verified = db.Column(db.Boolean, default=False, nullable=False)
    phone_verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship với profile
    profile = db.relationship('UserProfile', backref='user', uselist=False, cascade='all, delete-orphan')
    sessions = db.relationship('UserSession', backref='user', cascade='all, delete-orphan')
    
    def __init__(self, **kwargs):
        # Validate gender
        if 'gender' in kwargs and kwargs['gender'] not in ['Nam', 'Nữ', 'Khác']:
            raise ValueError("Giới tính phải là 'Nam', 'Nữ', hoặc 'Khác'")
        
        # Validate role
        if 'role' in kwargs and kwargs['role'] not in ['user', 'admin', 'staff', 'doctor']:
            raise ValueError("Vai trò không hợp lệ")
        
        # Validate CCCD (12 digits)
        if 'cccd' in kwargs:
            cccd = kwargs['cccd']
            if not cccd.isdigit() or len(cccd) != 12:
                raise ValueError("CCCD phải có 12 chữ số")
        
        super(User, self).__init__(**kwargs)
    
    def set_password(self, password):
        """Hash và lưu mật khẩu"""
        if len(password) < 8:
            raise ValueError("Mật khẩu phải có ít nhất 8 ký tự")
        
        # Hash password with bcrypt
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password):
        """Kiểm tra mật khẩu"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self, include_sensitive=False):
        """Chuyển đổi user thành dict"""
        data = {
            'id': str(self.id),
            'cccd': self.cccd,
            'email': self.email,
            'phone': self.phone,
            'full_name': self.full_name,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'gender': self.gender,
            'address': self.address,
            'province_code': self.province_code,
            'district_code': self.district_code,
            'ward_code': self.ward_code,
            'role': self.role,
            'is_active': self.is_active,
            'email_verified': self.email_verified,
            'phone_verified': self.phone_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_sensitive:
            data['password_hash'] = self.password_hash
        
        return data
    
    @classmethod
    def find_by_cccd(cls, cccd):
        """Tìm user theo CCCD"""
        return cls.query.filter_by(cccd=cccd).first()
    
    @classmethod
    def find_by_email(cls, email):
        """Tìm user theo email"""
        return cls.query.filter_by(email=email).first()
    
    @classmethod
    def find_by_phone(cls, phone):
        """Tìm user theo số điện thoại"""
        return cls.query.filter_by(phone=phone).first()
    
    def __repr__(self):
        return f'<User {self.full_name} ({self.cccd})>'

class UserProfile(db.Model):
    """Model profile bổ sung cho user"""
    __tablename__ = 'user_profiles'
    
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), primary_key=True)
    occupation = db.Column(db.String(255))  # Nghề nghiệp
    emergency_contact_name = db.Column(db.String(255))  # Tên người liên hệ khẩn cấp
    emergency_contact_phone = db.Column(db.String(15))  # SĐT người liên hệ khẩn cấp
    medical_conditions = db.Column(ARRAY(db.Text))  # Bệnh lý hiện tại
    allergies = db.Column(ARRAY(db.Text))  # Dị ứng
    preferred_language = db.Column(db.String(5), default='vi')  # vi, en
    avatar_url = db.Column(db.Text)  # URL ảnh đại diện
    last_login = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def to_dict(self):
        """Chuyển đổi profile thành dict"""
        return {
            'user_id': str(self.user_id),
            'occupation': self.occupation,
            'emergency_contact_name': self.emergency_contact_name,
            'emergency_contact_phone': self.emergency_contact_phone,
            'medical_conditions': self.medical_conditions or [],
            'allergies': self.allergies or [],
            'preferred_language': self.preferred_language,
            'avatar_url': self.avatar_url,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class UserSession(db.Model):
    """Model phiên đăng nhập"""
    __tablename__ = 'user_sessions'
    
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False, index=True)
    token_hash = db.Column(db.String(255), nullable=False)  # Hash của JWT token
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    device_info = db.Column(db.JSON)  # Thông tin thiết bị
    ip_address = db.Column(db.String(45))  # Hỗ trợ IPv6
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        """Chuyển đổi session thành dict"""
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'device_info': self.device_info,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def cleanup_expired(cls):
        """Xóa các session đã hết hạn"""
        expired_sessions = cls.query.filter(cls.expires_at < datetime.utcnow()).all()
        for session in expired_sessions:
            db.session.delete(session)
        db.session.commit()
        return len(expired_sessions)

class Role:
    """Constants cho các role"""
    USER = 'user'
    ADMIN = 'admin' 
    STAFF = 'staff'
    DOCTOR = 'doctor'
    
    ALL_ROLES = [USER, ADMIN, STAFF, DOCTOR]
    
    @classmethod
    def is_valid(cls, role):
        return role in cls.ALL_ROLES

class Gender:
    """Constants cho giới tính"""
    MALE = 'Nam'
    FEMALE = 'Nữ'
    OTHER = 'Khác'
    
    ALL_GENDERS = [MALE, FEMALE, OTHER]
    
    @classmethod
    def is_valid(cls, gender):
        return gender in cls.ALL_GENDERS
