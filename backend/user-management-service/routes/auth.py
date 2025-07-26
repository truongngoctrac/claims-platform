from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, 
    get_jwt, get_jwt_identity, current_user
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from marshmallow import Schema, fields, ValidationError, validates, validates_schema
from email_validator import validate_email, EmailNotValidError
import phonenumbers
from datetime import datetime, timedelta
import hashlib
import redis
import os

from app import db, limiter
from models.user import User, UserProfile, UserSession, Role, Gender

auth_bp = Blueprint('auth', __name__)

# Redis client for blacklist
redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/1'))

class RegistrationSchema(Schema):
    """Schema validation cho đăng ký"""
    cccd = fields.Str(required=True, validate=lambda x: len(x) == 12 and x.isdigit())
    email = fields.Email(required=True)
    phone = fields.Str(required=True)
    password = fields.Str(required=True, validate=lambda x: len(x) >= 8)
    confirm_password = fields.Str(required=True)
    full_name = fields.Str(required=True, validate=lambda x: len(x.strip()) >= 2)
    date_of_birth = fields.Date(required=True)
    gender = fields.Str(required=True, validate=lambda x: x in Gender.ALL_GENDERS)
    address = fields.Str(required=True, validate=lambda x: len(x.strip()) >= 10)
    province_code = fields.Str(required=True, validate=lambda x: len(x) == 2 and x.isdigit())
    district_code = fields.Str(required=True, validate=lambda x: len(x) == 3 and x.isdigit())
    ward_code = fields.Str(required=True, validate=lambda x: len(x) == 5 and x.isdigit())
    
    @validates('phone')
    def validate_phone(self, value):
        """Validate Vietnamese phone number"""
        try:
            # Parse with Vietnam country code
            phone_number = phonenumbers.parse(value, 'VN')
            if not phonenumbers.is_valid_number(phone_number):
                raise ValidationError('Số điện thoại không hợp lệ')
        except phonenumbers.NumberParseException:
            raise ValidationError('Số đi���n thoại không hợp lệ')
    
    @validates('date_of_birth')
    def validate_age(self, value):
        """Validate age (must be at least 16 years old)"""
        today = datetime.now().date()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 16:
            raise ValidationError('Người dùng phải đủ 16 tuổi')
        if age > 150:
            raise ValidationError('Tuổi không hợp lệ')
    
    @validates_schema
    def validate_passwords(self, data, **kwargs):
        """Validate password confirmation"""
        if data.get('password') != data.get('confirm_password'):
            raise ValidationError('Mật khẩu xác nhận không khớp', 'confirm_password')

class LoginSchema(Schema):
    """Schema validation cho đăng nhập"""
    identifier = fields.Str(required=True)  # CCCD, email, hoặc phone
    password = fields.Str(required=True)
    remember_me = fields.Bool(missing=False)

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register():
    """Đăng ký người dùng mới"""
    try:
        # Validate input
        schema = RegistrationSchema()
        data = schema.load(request.json)
        
        # Check if user already exists
        if User.find_by_cccd(data['cccd']):
            return jsonify({
                'message': 'CCCD đã được đăng ký',
                'error': 'cccd_exists'
            }), 400
        
        if User.find_by_email(data['email']):
            return jsonify({
                'message': 'Email đã được đăng ký',
                'error': 'email_exists'
            }), 400
        
        if User.find_by_phone(data['phone']):
            return jsonify({
                'message': 'Số điện thoại đã được đăng ký',
                'error': 'phone_exists'
            }), 400
        
        # Create new user
        user = User(
            cccd=data['cccd'],
            email=data['email'],
            phone=data['phone'],
            full_name=data['full_name'],
            date_of_birth=data['date_of_birth'],
            gender=data['gender'],
            address=data['address'],
            province_code=data['province_code'],
            district_code=data['district_code'],
            ward_code=data['ward_code']
        )
        
        user.set_password(data['password'])
        
        # Create user profile
        profile = UserProfile(user=user)
        
        db.session.add(user)
        db.session.add(profile)
        db.session.commit()
        
        return jsonify({
            'message': 'Đăng ký thành công',
            'user': user.to_dict()
        }), 201
        
    except ValidationError as e:
        return jsonify({
            'message': 'Dữ liệu không hợp lệ',
            'errors': e.messages
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Đăng nhập người dùng"""
    try:
        # Validate input
        schema = LoginSchema()
        data = schema.load(request.json)
        
        identifier = data['identifier']
        password = data['password']
        remember_me = data['remember_me']
        
        # Find user by CCCD, email, or phone
        user = None
        if identifier.isdigit() and len(identifier) == 12:
            user = User.find_by_cccd(identifier)
        elif '@' in identifier:
            user = User.find_by_email(identifier)
        else:
            user = User.find_by_phone(identifier)
        
        if not user or not user.check_password(password):
            return jsonify({
                'message': 'Thông tin đăng nhập không chính xác',
                'error': 'invalid_credentials'
            }), 401
        
        if not user.is_active:
            return jsonify({
                'message': 'Tài khoản đã bị khóa',
                'error': 'account_disabled'
            }), 401
        
        # Create tokens
        expires_delta = timedelta(days=30) if remember_me else timedelta(hours=24)
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=expires_delta
        )
        refresh_token = create_refresh_token(identity=str(user.id))
        
        # Create session record
        session = UserSession(
            user_id=user.id,
            token_hash=hashlib.sha256(access_token.encode()).hexdigest(),
            expires_at=datetime.utcnow() + expires_delta,
            device_info=request.headers.get('User-Agent'),
            ip_address=request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
        )
        
        # Update last login
        if user.profile:
            user.profile.last_login = datetime.utcnow()
        
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            'message': 'Đăng nhập thành công',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }), 200
        
    except ValidationError as e:
        return jsonify({
            'message': 'Dữ liệu không hợp lệ',
            'errors': e.messages
        }), 400
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Đăng xuất người dùng"""
    try:
        jti = get_jwt()['jti']
        
        # Add token to blacklist in Redis
        redis_client.sadd('blacklisted_tokens', jti)
        
        # Set expiration for the blacklist entry
        redis_client.expire('blacklisted_tokens', timedelta(days=30))
        
        return jsonify({
            'message': 'Đăng xuất thành công'
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Làm mới access token"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active:
            return jsonify({
                'message': 'Người dùng không tồn tại hoặc đã bị khóa',
                'error': 'user_not_found'
            }), 401
        
        new_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            'access_token': new_token
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@auth_bp.route('/verify', methods=['POST'])
@jwt_required()
def verify_token():
    """Xác minh token (dùng cho API Gateway)"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active:
            return jsonify({
                'message': 'Token không hợp lệ',
                'error': 'invalid_token'
            }), 401
        
        return jsonify({
            'user_id': current_user_id,
            'role': user.role,
            'token': request.headers.get('Authorization', '').replace('Bearer ', ''),
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi xác minh token',
            'error': str(e)
        }), 401

@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per hour")
def forgot_password():
    """Quên mật khẩu - gửi OTP"""
    try:
        data = request.json
        identifier = data.get('identifier')  # email hoặc phone
        
        if not identifier:
            return jsonify({
                'message': 'Vui lòng nhập email hoặc số điện thoại',
                'error': 'missing_identifier'
            }), 400
        
        # Find user
        user = None
        if '@' in identifier:
            user = User.find_by_email(identifier)
        else:
            user = User.find_by_phone(identifier)
        
        if not user:
            # Don't reveal if user exists or not for security
            return jsonify({
                'message': 'Nếu thông tin chính xác, OTP sẽ được gửi đến bạn',
            }), 200
        
        # Generate OTP and save to Redis
        import random
        otp = str(random.randint(100000, 999999))
        otp_key = f"password_reset_otp:{user.id}"
        
        redis_client.setex(otp_key, 300, otp)  # 5 minutes expiration
        
        # TODO: Send OTP via SMS/Email
        # For now, just return success (in production, integrate with SMS/email service)
        
        return jsonify({
            'message': 'OTP đã được gửi',
            'temp_token': create_access_token(
                identity=str(user.id),
                expires_delta=timedelta(minutes=10),
                additional_claims={'purpose': 'password_reset'}
            )
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("5 per hour")
def reset_password():
    """Đặt lại mật khẩu với OTP"""
    try:
        data = request.json
        otp = data.get('otp')
        new_password = data.get('new_password')
        temp_token = data.get('temp_token')
        
        if not all([otp, new_password, temp_token]):
            return jsonify({
                'message': 'Thiếu thông tin bắt buộc',
                'error': 'missing_required_fields'
            }), 400
        
        if len(new_password) < 8:
            return jsonify({
                'message': 'Mật khẩu phải có ít nhất 8 ký tự',
                'error': 'weak_password'
            }), 400
        
        # Verify temp token
        from flask_jwt_extended import decode_token
        try:
            decoded_token = decode_token(temp_token)
            user_id = decoded_token['sub']
            purpose = decoded_token.get('purpose')
            
            if purpose != 'password_reset':
                raise Exception("Invalid token purpose")
                
        except Exception:
            return jsonify({
                'message': 'Token không hợp lệ',
                'error': 'invalid_token'
            }), 401
        
        # Verify OTP
        otp_key = f"password_reset_otp:{user_id}"
        stored_otp = redis_client.get(otp_key)
        
        if not stored_otp or stored_otp.decode() != otp:
            return jsonify({
                'message': 'OTP không chính xác hoặc đã hết hạn',
                'error': 'invalid_otp'
            }), 400
        
        # Update password
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        user.set_password(new_password)
        db.session.commit()
        
        # Clean up OTP
        redis_client.delete(otp_key)
        
        # Revoke all existing sessions
        UserSession.query.filter_by(user_id=user.id).delete()
        db.session.commit()
        
        return jsonify({
            'message': 'Đặt lại mật khẩu thành công'
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Đổi mật khẩu (khi đã đăng nhập)"""
    try:
        data = request.json
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not all([current_password, new_password]):
            return jsonify({
                'message': 'Thiếu thông tin bắt buộc',
                'error': 'missing_required_fields'
            }), 400
        
        if len(new_password) < 8:
            return jsonify({
                'message': 'Mật khẩu mới phải có ít nhất 8 ký tự',
                'error': 'weak_password'
            }), 400
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user.check_password(current_password):
            return jsonify({
                'message': 'Mật kh���u hiện tại không chính xác',
                'error': 'wrong_current_password'
            }), 400
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({
            'message': 'Đổi mật khẩu thành công'
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500
