from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, ValidationError
from datetime import date

from app import db
from models.policy import CoveragePolicy, InsuranceCardType, PolicyType, FacilityLevel

policies_bp = Blueprint('policies', __name__)

@policies_bp.route('/', methods=['GET'])
@jwt_required()
def get_coverage_policies():
    """Lấy danh sách chính sách chi trả"""
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        policy_type = request.args.get('policy_type')
        facility_level = request.args.get('facility_level')
        card_type_code = request.args.get('card_type')
        
        query = CoveragePolicy.query
        
        if policy_type and policy_type in PolicyType.ALL_TYPES:
            query = query.filter(CoveragePolicy.policy_type == policy_type)
        
        if facility_level and facility_level in FacilityLevel.ALL_LEVELS:
            query = query.filter(CoveragePolicy.facility_level == facility_level)
        
        if card_type_code:
            card_type = InsuranceCardType.find_by_code(card_type_code)
            if card_type:
                query = query.filter(CoveragePolicy.card_type_id == card_type.id)
        
        query = query.filter(CoveragePolicy.is_active == True)
        query = query.order_by(CoveragePolicy.created_at.desc())
        
        policies_paginated = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'policies': [policy.to_dict() for policy in policies_paginated.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': policies_paginated.total,
                'pages': policies_paginated.pages,
                'has_next': policies_paginated.has_next,
                'has_prev': policies_paginated.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@policies_bp.route('/calculate-coverage', methods=['POST'])
@jwt_required()
def calculate_coverage():
    """Tính toán mức chi trả"""
    try:
        data = request.json
        card_type_code = data.get('card_type_code')
        policy_type = data.get('policy_type')
        facility_level = data.get('facility_level')
        total_amount = float(data.get('total_amount', 0))
        
        if not all([card_type_code, policy_type, facility_level]):
            return jsonify({
                'message': 'Thiếu thông tin bắt buộc',
                'error': 'missing_required_fields'
            }), 400
        
        # Find card type
        card_type = InsuranceCardType.find_by_code(card_type_code)
        if not card_type:
            return jsonify({
                'message': 'Loại thẻ không tồn tại',
                'error': 'card_type_not_found'
            }), 404
        
        # Find applicable policies
        policies = CoveragePolicy.find_applicable_policies(
            card_type.id, policy_type, facility_level
        )
        
        if not policies:
            return jsonify({
                'message': 'Không tìm thấy chính sách áp dụng',
                'error': 'no_applicable_policy'
            }), 404
        
        # Calculate coverage for each policy
        coverage_results = []
        for policy in policies:
            covered_amount = policy.calculate_coverage(total_amount)
            patient_payment = total_amount - covered_amount
            
            coverage_results.append({
                'policy': policy.to_dict(),
                'total_amount': total_amount,
                'covered_amount': covered_amount,
                'patient_payment': patient_payment,
                'coverage_percentage': float(policy.coverage_percentage)
            })
        
        # Return the best coverage (highest covered amount)
        best_coverage = max(coverage_results, key=lambda x: x['covered_amount'])
        
        return jsonify({
            'coverage': best_coverage,
            'all_applicable_policies': coverage_results
        }), 200
        
    except ValueError as e:
        return jsonify({
            'message': 'Số tiền không hợp lệ',
            'error': 'invalid_amount'
        }), 400
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@policies_bp.route('/card-types', methods=['GET'])
@jwt_required()
def get_card_types():
    """Lấy danh sách loại thẻ BHYT"""
    try:
        card_types = InsuranceCardType.query.all()
        return jsonify({
            'card_types': [card_type.to_dict() for card_type in card_types]
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500
