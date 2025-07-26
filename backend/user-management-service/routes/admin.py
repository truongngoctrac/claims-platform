from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, desc
from datetime import datetime, timedelta

from app import db
from models.user import User, UserProfile, UserSession, Role

admin_bp = Blueprint('admin', __name__)

def require_admin(f):
    """Decorator để yêu cầu quyền admin"""
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        requesting_user = User.query.get(current_user_id)
        
        if not requesting_user or requesting_user.role != 'admin':
            return jsonify({
                'message': 'Yêu cầu quyền admin',
                'error': 'admin_required'
            }), 403
        
        return f(*args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function

@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@require_admin
def admin_dashboard():
    """Thống kê tổng quan hệ thống"""
    try:
        # Thống kê người dùng
        total_users = User.query.count()
        active_users = User.query.filter_by(is_active=True).count()
        new_users_this_month = User.query.filter(
            User.created_at >= datetime.now().replace(day=1)
        ).count()
        
        # Thống kê theo vai trò
        role_stats = db.session.query(
            User.role,
            func.count(User.id).label('count')
        ).group_by(User.role).all()
        
        # Thống kê theo tỉnh thành
        province_stats = db.session.query(
            User.province_code,
            func.count(User.id).label('count')
        ).group_by(User.province_code).order_by(desc('count')).limit(10).all()
        
        # Thống kê phiên đăng nhập
        active_sessions = UserSession.query.filter(
            UserSession.expires_at > datetime.utcnow()
        ).count()
        
        # Người dùng đăng ký gần đây
        recent_users = User.query.order_by(desc(User.created_at)).limit(10).all()
        
        return jsonify({
            'statistics': {
                'total_users': total_users,
                'active_users': active_users,
                'inactive_users': total_users - active_users,
                'new_users_this_month': new_users_this_month,
                'active_sessions': active_sessions
            },
            'role_distribution': [
                {'role': role, 'count': count} for role, count in role_stats
            ],
            'province_distribution': [
                {'province_code': province, 'count': count} 
                for province, count in province_stats
            ],
            'recent_users': [user.to_dict() for user in recent_users]
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
@require_admin
def list_all_users():
    """Lấy danh sách tất cả người dùng với phân trang"""
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        role_filter = request.args.get('role')
        status_filter = request.args.get('status')  # active, inactive
        province_filter = request.args.get('province')
        search = request.args.get('search', '').strip()
        
        # Build query
        query = User.query
        
        if role_filter and Role.is_valid(role_filter):
            query = query.filter(User.role == role_filter)
        
        if status_filter == 'active':
            query = query.filter(User.is_active == True)
        elif status_filter == 'inactive':
            query = query.filter(User.is_active == False)
        
        if province_filter:
            query = query.filter(User.province_code == province_filter)
        
        if search:
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    User.full_name.ilike(f'%{search}%'),
                    User.cccd.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                    User.phone.ilike(f'%{search}%')
                )
            )
        
        # Order by creation date (newest first)
        query = query.order_by(desc(User.created_at))
        
        # Execute paginated query
        users_paginated = query.paginate(
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
            },
            'filters': {
                'role': role_filter,
                'status': status_filter,
                'province': province_filter,
                'search': search
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@admin_bp.route('/users/<user_id>', methods=['GET'])
@jwt_required()
@require_admin
def get_user_detail(user_id):
    """Lấy thông tin chi tiết người dùng"""
    try:
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
        
        # Get active sessions
        active_sessions = user.sessions.filter(
            UserSession.expires_at > datetime.utcnow()
        ).order_by(desc(UserSession.created_at)).all()
        
        user_data['active_sessions'] = [session.to_dict() for session in active_sessions]
        
        return jsonify({
            'user': user_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@admin_bp.route('/users/<user_id>/force-logout', methods=['POST'])
@jwt_required()
@require_admin
def force_logout_user(user_id):
    """Bắt buộc đăng xuất tất cả phiên của người dùng"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'message': 'Người dùng không tồn tại',
                'error': 'user_not_found'
            }), 404
        
        # Get all active sessions
        active_sessions = user.sessions.filter(
            UserSession.expires_at > datetime.utcnow()
        ).all()
        
        # Add all tokens to blacklist
        from app import redis_client
        for session in active_sessions:
            redis_client.sadd('blacklisted_tokens', session.token_hash)
        
        # Delete all sessions
        UserSession.query.filter_by(user_id=user.id).delete()
        db.session.commit()
        
        return jsonify({
            'message': f'Đã đăng xuất {len(active_sessions)} phiên đăng nhập của người dùng {user.full_name}',
            'revoked_sessions': len(active_sessions)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@admin_bp.route('/system/cleanup', methods=['POST'])
@jwt_required()
@require_admin
def system_cleanup():
    """Dọn dẹp hệ thống - xóa session hết hạn"""
    try:
        # Clean up expired sessions
        expired_count = UserSession.cleanup_expired()
        
        # Clean up expired blacklist tokens from Redis
        from app import redis_client
        try:
            # Remove blacklist entries older than 30 days
            # This is a simple cleanup - in production you might want more sophisticated logic
            redis_client.expire('blacklisted_tokens', timedelta(days=30))
        except Exception as redis_error:
            pass  # Redis cleanup is not critical
        
        return jsonify({
            'message': 'Dọn dẹp hệ thống thành công',
            'expired_sessions_removed': expired_count
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@admin_bp.route('/reports/user-activity', methods=['GET'])
@jwt_required()
@require_admin
def user_activity_report():
    """Báo cáo hoạt động người dùng"""
    try:
        days = int(request.args.get('days', 30))
        if days > 365:
            days = 365
        
        start_date = datetime.now() - timedelta(days=days)
        
        # New users in period
        new_users = User.query.filter(User.created_at >= start_date).count()
        
        # Active users (those with recent sessions)
        active_users = db.session.query(User.id).join(UserSession).filter(
            UserSession.created_at >= start_date
        ).distinct().count()
        
        # Daily registration stats
        daily_registrations = db.session.query(
            func.date(User.created_at).label('date'),
            func.count(User.id).label('count')
        ).filter(
            User.created_at >= start_date
        ).group_by(
            func.date(User.created_at)
        ).order_by('date').all()
        
        # Daily login stats
        daily_logins = db.session.query(
            func.date(UserSession.created_at).label('date'),
            func.count(UserSession.id).label('count')
        ).filter(
            UserSession.created_at >= start_date
        ).group_by(
            func.date(UserSession.created_at)
        ).order_by('date').all()
        
        return jsonify({
            'period': f'{days} ngày qua',
            'summary': {
                'new_users': new_users,
                'active_users': active_users
            },
            'daily_registrations': [
                {'date': str(date), 'count': count} 
                for date, count in daily_registrations
            ],
            'daily_logins': [
                {'date': str(date), 'count': count} 
                for date, count in daily_logins
            ]
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@admin_bp.route('/users/bulk-action', methods=['POST'])
@jwt_required()
@require_admin
def bulk_user_action():
    """Thực hiện hành động hàng loạt trên người dùng"""
    try:
        data = request.json
        action = data.get('action')  # activate, deactivate, delete
        user_ids = data.get('user_ids', [])
        
        if not action or not user_ids:
            return jsonify({
                'message': 'Thiếu thông tin bắt buộc',
                'error': 'missing_required_fields'
            }), 400
        
        if action not in ['activate', 'deactivate']:
            return jsonify({
                'message': 'Hành động không hợp lệ',
                'error': 'invalid_action'
            }), 400
        
        current_user_id = get_jwt_identity()
        
        # Prevent admin from affecting their own account
        if current_user_id in user_ids:
            return jsonify({
                'message': 'Không thể thực hiện hành động trên tài khoản của chính mình',
                'error': 'cannot_affect_self'
            }), 400
        
        # Get users
        users = User.query.filter(User.id.in_(user_ids)).all()
        
        if len(users) != len(user_ids):
            return jsonify({
                'message': 'Một số người dùng không tồn tại',
                'error': 'some_users_not_found'
            }), 400
        
        # Perform action
        affected_count = 0
        if action == 'activate':
            for user in users:
                if not user.is_active:
                    user.is_active = True
                    affected_count += 1
        elif action == 'deactivate':
            for user in users:
                if user.is_active:
                    user.is_active = False
                    affected_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Đã {action} {affected_count} người dùng thành công',
            'affected_count': affected_count,
            'total_requested': len(user_ids)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@admin_bp.route('/config', methods=['GET'])
@jwt_required()
@require_admin
def get_system_config():
    """Lấy cấu hình hệ thống"""
    try:
        return jsonify({
            'config': {
                'supported_roles': Role.ALL_ROLES,
                'jwt_access_token_expires': '24 hours',
                'jwt_refresh_token_expires': '30 days',
                'rate_limiting': {
                    'registration': '5 per minute',
                    'login': '10 per minute',
                    'forgot_password': '3 per hour',
                    'reset_password': '5 per hour'
                },
                'validation_rules': {
                    'password_min_length': 8,
                    'cccd_length': 12,
                    'min_age': 16,
                    'max_age': 150
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500
