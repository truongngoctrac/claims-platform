from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

from app import db
from models.policy import HealthcareFacility, FacilityLevel

facilities_bp = Blueprint('facilities', __name__)

@facilities_bp.route('/', methods=['GET'])
@jwt_required()
def get_facilities():
    """Lấy danh sách cơ sở y tế"""
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        province_code = request.args.get('province')
        level = request.args.get('level')
        search = request.args.get('search', '').strip()
        
        query = HealthcareFacility.query.filter_by(is_active=True)
        
        if province_code:
            query = query.filter(HealthcareFacility.province_code == province_code)
        
        if level and level in FacilityLevel.ALL_LEVELS:
            query = query.filter(HealthcareFacility.level == level)
        
        if search:
            query = query.filter(
                or_(
                    HealthcareFacility.name.ilike(f'%{search}%'),
                    HealthcareFacility.code.ilike(f'%{search}%'),
                    HealthcareFacility.address.ilike(f'%{search}%')
                )
            )
        
        query = query.order_by(HealthcareFacility.level, HealthcareFacility.name)
        
        facilities_paginated = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'facilities': [facility.to_dict() for facility in facilities_paginated.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': facilities_paginated.total,
                'pages': facilities_paginated.pages,
                'has_next': facilities_paginated.has_next,
                'has_prev': facilities_paginated.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@facilities_bp.route('/<facility_code>', methods=['GET'])
@jwt_required()
def get_facility_details(facility_code):
    """Lấy chi tiết cơ sở y tế"""
    try:
        facility = HealthcareFacility.find_by_code(facility_code)
        
        if not facility:
            return jsonify({
                'message': 'Cơ sở y tế không tồn tại',
                'error': 'facility_not_found'
            }), 404
        
        return jsonify({
            'facility': facility.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@facilities_bp.route('/by-province/<province_code>', methods=['GET'])
@jwt_required()
def get_facilities_by_province(province_code):
    """Lấy danh sách cơ sở y tế theo tỉnh"""
    try:
        facilities = HealthcareFacility.find_by_province(province_code)
        
        return jsonify({
            'facilities': [facility.to_dict() for facility in facilities],
            'province_code': province_code,
            'total': len(facilities)
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500
