from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, ValidationError, validates
from sqlalchemy import or_

from app import db
from models.user import User, UserProfile, Role

users_bp = Blueprint('users', __name__)

class ProfileUpdateSchema(Schema):
    """Schema cho cập nhật profile"""
    full_name = fields.Str(validate=lambda x: len(x.strip()) >= 2)
    phone = fields.Str()
    address = fields.Str(validate=lambda x: len(x.strip()) >= 10)
    province_code = fields.Str(validate=lambda x: len(x) == 2 and x.isdigit())
    district_code = fields.Str(validate=lambda x: len(x) == 3 and x.isdigit())
    ward_code = fields.Str(validate=lambda x: len(x) == 5 and x.isdigit())
    occupation = fields.Str()
    emergency_contact_name = fields.Str()
    emergency_contact_phone = fields.Str()
    medical_conditions = fields.List(fields.Str())
    allergies = fields.List(fields.Str())
    preferred_language = fields.Str(validate=lambda x: x in ['vi', 'en'])

@users_bp.route('/<user_id>/profile', methods=['GET'])
@jwt_required()
def get_user_profile(user_id):
    """Lấy thông tin profile người dùng"""
    try:
        current_user_id = get_jwt_identity()
        
        # Check permission - user can only access their own profile or admin can access any
        requesting_user = User.query.get(current_user_id)
        if str(current_user_id) != user_id and requesting_user.role not in ['admin', 'staff']:
            return jsonify({
                'message': 'Không có quyền truy cập',
                'error': 'access_denied'
            }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        # Get user data with profile
        user_data = user.to_dict()
        if user.profile:
            user_data['profile'] = user.profile.to_dict()
        else:
            user_data['profile'] = {}
        
        return jsonify({
            'user': user_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@users_bp.route('/<user_id>/profile', methods=['PUT'])
@jwt_required()
def update_user_profile(user_id):
    """Cập nhật thông tin profile người dùng"""
    try:
        current_user_id = get_jwt_identity()
        
        # Check permission - user can only update their own profile
        if str(current_user_id) != user_id:
            requesting_user = User.query.get(current_user_id)
            if requesting_user.role not in ['admin']:
                return jsonify({
                    'message': 'Không có quyền truy cập',
                    'error': 'access_denied'
                }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        # Validate input
        schema = ProfileUpdateSchema()
        data = schema.load(request.json, partial=True)
        
        # Check if phone number is already taken (if being updated)
        if 'phone' in data and data['phone'] != user.phone:
            existing_user = User.find_by_phone(data['phone'])
            if existing_user and existing_user.id != user.id:
                return jsonify({
                    'message': 'Số điện thoại đã được sử dụng',
                    'error': 'phone_exists'
                }), 400
        
        # Update user basic info
        user_fields = ['full_name', 'phone', 'address', 'province_code', 'district_code', 'ward_code']
        for field in user_fields:
            if field in data:
                setattr(user, field, data[field])
        
        # Update or create profile
        if not user.profile:
            user.profile = UserProfile(user_id=user.id)
        
        profile_fields = ['occupation', 'emergency_contact_name', 'emergency_contact_phone', 
                         'medical_conditions', 'allergies', 'preferred_language']
        for field in profile_fields:
            if field in data:
                setattr(user.profile, field, data[field])
        
        db.session.commit()
        
        # Return updated data
        user_data = user.to_dict()
        user_data['profile'] = user.profile.to_dict()
        
        return jsonify({
            'message': 'Cập nhật thông tin thành công',
            'user': user_data
        }), 200
        
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

@users_bp.route('/search', methods=['GET'])
@jwt_required()
def search_users():
    """Tìm kiếm người dùng (chỉ admin/staff)"""
    try:
        current_user_id = get_jwt_identity()
        requesting_user = User.query.get(current_user_id)
        
        if requesting_user.role not in ['admin', 'staff']:
            return jsonify({
                'message': 'Không có quyền truy cập',
                'error': 'access_denied'
            }), 403
        
        # Get query parameters
        query = request.args.get('q', '').strip()
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        role_filter = request.args.get('role')
        province_filter = request.args.get('province')
        
        if not query and not role_filter and not province_filter:
            return jsonify({
                'message': 'Vui lòng nhập từ khóa tìm kiếm hoặc bộ lọc',
                'error': 'missing_search_criteria'
            }), 400
        
        # Build query
        users_query = User.query
        
        if query:
            users_query = users_query.filter(
                or_(
                    User.full_name.ilike(f'%{query}%'),
                    User.cccd.ilike(f'%{query}%'),
                    User.email.ilike(f'%{query}%'),
                    User.phone.ilike(f'%{query}%')
                )
            )
        
        if role_filter and Role.is_valid(role_filter):
            users_query = users_query.filter(User.role == role_filter)
        
        if province_filter:
            users_query = users_query.filter(User.province_code == province_filter)
        
        # Execute paginated query
        users_paginated = users_query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'users': [user.to_dict() for user in users_paginated.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': users_paginated.total,
                'pages': users_paginated.pages,
                'has_next': users_paginated.has_next,
                'has_prev': users_paginated.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@users_bp.route('/<user_id>/activate', methods=['POST'])
@jwt_required()
def activate_user(user_id):
    """Kích hoạt tài khoản người dùng (chỉ admin)"""
    try:
        current_user_id = get_jwt_identity()
        requesting_user = User.query.get(current_user_id)
        
        if requesting_user.role != 'admin':
            return jsonify({
                'message': 'Không có quyền truy cập',
                'error': 'access_denied'
            }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        user.is_active = True
        db.session.commit()
        
        return jsonify({
            'message': 'Kích hoạt tài khoản thành công',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@users_bp.route('/<user_id>/deactivate', methods=['POST'])
@jwt_required()
def deactivate_user(user_id):
    """Vô hiệu hóa tài khoản người dùng (chỉ admin)"""
    try:
        current_user_id = get_jwt_identity()
        requesting_user = User.query.get(current_user_id)
        
        if requesting_user.role != 'admin':
            return jsonify({
                'message': 'Không có quyền truy cập',
                'error': 'access_denied'
            }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        # Prevent admin from deactivating themselves
        if str(user.id) == current_user_id:
            return jsonify({
                'message': 'Không thể vô hiệu hóa tài khoản của chính mình',
                'error': 'cannot_deactivate_self'
            }), 400
        
        user.is_active = False
        db.session.commit()
        
        return jsonify({
            'message': 'Vô hiệu hóa tài khoản thành công',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@users_bp.route('/<user_id>/role', methods=['PUT'])
@jwt_required()
def update_user_role(user_id):
    """Cập nhật vai trò người dùng (chỉ admin)"""
    try:
        current_user_id = get_jwt_identity()
        requesting_user = User.query.get(current_user_id)
        
        if requesting_user.role != 'admin':
            return jsonify({
                'message': 'Không có quyền truy cập',
                'error': 'access_denied'
            }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        data = request.json
        new_role = data.get('role')
        
        if not new_role or not Role.is_valid(new_role):
            return jsonify({
                'message': 'Vai trò không hợp lệ',
                'error': 'invalid_role'
            }), 400
        
        # Prevent admin from changing their own role
        if str(user.id) == current_user_id:
            return jsonify({
                'message': 'Không thể thay đổi vai trò của chính mình',
                'error': 'cannot_change_own_role'
            }), 400
        
        old_role = user.role
        user.role = new_role
        db.session.commit()
        
        return jsonify({
            'message': f'Cập nhật vai trò từ {old_role} thành {new_role} thành công',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@users_bp.route('/<user_id>/sessions', methods=['GET'])
@jwt_required()
def get_user_sessions(user_id):
    """Lấy danh sách phiên đăng nhập của người dùng"""
    try:
        current_user_id = get_jwt_identity()
        
        # Check permission
        if str(current_user_id) != user_id:
            requesting_user = User.query.get(current_user_id)
            if requesting_user.role not in ['admin']:
                return jsonify({
                    'message': 'Không có quyền truy cập',
                    'error': 'access_denied'
                }), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        # Get active sessions
        from datetime import datetime
        sessions = user.sessions.filter(
            UserSession.expires_at > datetime.utcnow()
        ).order_by(UserSession.created_at.desc()).all()
        
        return jsonify({
            'sessions': [session.to_dict() for session in sessions]
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@users_bp.route('/<user_id>/sessions/<session_id>', methods=['DELETE'])
@jwt_required()
def revoke_user_session(user_id, session_id):
    """Thu hồi phiên đăng nhập cụ thể"""
    try:
        current_user_id = get_jwt_identity()
        
        # Check permission
        if str(current_user_id) != user_id:
            requesting_user = User.query.get(current_user_id)
            if requesting_user.role not in ['admin']:
                return jsonify({
                    'message': 'Không có quyền truy cập',
                    'error': 'access_denied'
                }), 403
        
        session = UserSession.query.filter_by(
            id=session_id,
            user_id=user_id
        ).first()
        
        if not session:
            return jsonify({
                'message': 'Phiên đăng nhập không tồn tại',
                'error': 'session_not_found'
            }), 404
        
        # Add token to blacklist and delete session
        from app import redis_client
        redis_client.sadd('blacklisted_tokens', session.token_hash)
        
        db.session.delete(session)
        db.session.commit()
        
        return jsonify({
            'message': 'Thu hồi phiên đăng nhập thành công'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@users_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Lấy thông tin người dùng hiện tại"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        # Get user data with profile
        user_data = user.to_dict()
        if user.profile:
            user_data['profile'] = user.profile.to_dict()
        else:
            user_data['profile'] = {}
        
        return jsonify({
            'user': user_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500
