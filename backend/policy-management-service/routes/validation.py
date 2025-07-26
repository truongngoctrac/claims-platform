from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import Schema, fields, ValidationError
from datetime import date

from app import db
from models.policy import InsuranceCard, HealthcareFacility, CoveragePolicy, InsuranceCardType

validation_bp = Blueprint('validation', __name__)

class PolicyValidationSchema(Schema):
    """Schema cho validation chính sách"""
    card_number = fields.Str(required=True, validate=lambda x: len(x) == 15)
    facility_code = fields.Str(required=True)
    policy_type = fields.Str(required=True)
    total_amount = fields.Float(required=True, validate=lambda x: x > 0)
    service_date = fields.Date(required=True)

@validation_bp.route('/policy', methods=['POST'])
@jwt_required()
def validate_policy():
    """Xác thực chính sách và tính toán chi trả"""
    try:
        # Validate input
        schema = PolicyValidationSchema()
        data = schema.load(request.json)
        
        card_number = data['card_number']
        facility_code = data['facility_code']
        policy_type = data['policy_type']
        total_amount = data['total_amount']
        service_date = data['service_date']
        
        # Validate insurance card
        card = InsuranceCard.find_by_card_number(card_number)
        if not card:
            return jsonify({
                'is_valid': False,
                'message': 'Thẻ BHYT không tồn tại',
                'error': 'card_not_found'
            }), 400
        
        if not card.is_valid(service_date):
            return jsonify({
                'is_valid': False,
                'message': 'Thẻ BHYT không có hiệu lực',
                'error': 'card_invalid',
                'card_details': card.to_dict()
            }), 400
        
        # Validate healthcare facility
        facility = HealthcareFacility.find_by_code(facility_code)
        if not facility or not facility.is_active:
            return jsonify({
                'is_valid': False,
                'message': 'Cơ sở y tế không tồn tại hoặc không hoạt động',
                'error': 'facility_invalid'
            }), 400
        
        # Find applicable coverage policies
        policies = CoveragePolicy.find_applicable_policies(
            card.card_type_id,
            policy_type,
            facility.level,
            service_date
        )
        
        if not policies:
            return jsonify({
                'is_valid': False,
                'message': 'Không có chính sách chi trả áp dụng',
                'error': 'no_applicable_policy',
                'details': {
                    'card_type': card.card_type.to_dict() if card.card_type else None,
                    'facility_level': facility.level,
                    'policy_type': policy_type
                }
            }), 400
        
        # Calculate coverage for each applicable policy
        coverage_calculations = []
        for policy in policies:
            covered_amount = policy.calculate_coverage(total_amount)
            patient_payment = total_amount - covered_amount
            
            coverage_calculations.append({
                'policy': policy.to_dict(),
                'covered_amount': covered_amount,
                'patient_payment': patient_payment,
                'coverage_percentage': float(policy.coverage_percentage)
            })
        
        # Select the best policy (highest coverage)
        best_policy = max(coverage_calculations, key=lambda x: x['covered_amount'])
        
        return jsonify({
            'is_valid': True,
            'message': 'Xác thực thành công',
            'validation_details': {
                'card': card.to_dict(),
                'facility': facility.to_dict(),
                'service_date': service_date.isoformat(),
                'policy_type': policy_type,
                'total_amount': total_amount
            },
            'coverage_calculation': {
                'best_policy': best_policy,
                'all_applicable_policies': coverage_calculations,
                'summary': {
                    'total_amount': total_amount,
                    'covered_amount': best_policy['covered_amount'],
                    'patient_payment': best_policy['patient_payment'],
                    'coverage_percentage': best_policy['coverage_percentage']
                }
            }
        }), 200
        
    except ValidationError as e:
        return jsonify({
            'is_valid': False,
            'message': 'Dữ liệu không hợp lệ',
            'errors': e.messages
        }), 400
    except Exception as e:
        return jsonify({
            'is_valid': False,
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@validation_bp.route('/eligibility', methods=['POST'])
@jwt_required()
def check_eligibility():
    """Kiểm tra điều kiện hưởng BHYT"""
    try:
        data = request.json
        card_number = data.get('card_number')
        
        if not card_number:
            return jsonify({
                'message': 'Thiếu số thẻ BHYT',
                'error': 'missing_card_number'
            }), 400
        
        # Find insurance card
        card = InsuranceCard.find_by_card_number(card_number)
        if not card:
            return jsonify({
                'is_eligible': False,
                'message': 'Thẻ BHYT không tồn tại',
                'error': 'card_not_found'
            }), 404
        
        check_date = date.today()
        is_valid = card.is_valid(check_date)
        
        eligibility_result = {
            'is_eligible': is_valid,
            'card_details': card.to_dict(),
            'check_date': check_date.isoformat()
        }
        
        if is_valid:
            # Get available policy types for this card
            available_policies = CoveragePolicy.query.filter_by(
                card_type_id=card.card_type_id,
                is_active=True
            ).filter(
                CoveragePolicy.effective_from <= check_date
            ).filter(
                db.or_(
                    CoveragePolicy.effective_to.is_(None),
                    CoveragePolicy.effective_to >= check_date
                )
            ).all()
            
            eligibility_result.update({
                'message': 'Thẻ hợp lệ và có quyền hưởng BHYT',
                'available_benefits': {
                    'policy_types': list(set([p.policy_type for p in available_policies])),
                    'facility_levels': list(set([p.facility_level for p in available_policies])),
                    'total_policies': len(available_policies)
                }
            })
        else:
            reasons = []
            if card.status != 'active':
                reasons.append(f'Trạng thái thẻ: {card.status}')
            if check_date < card.valid_from:
                reasons.append('Thẻ chưa có hiệu lực')
            if check_date > card.valid_to:
                reasons.append('Thẻ đã hết hạn')
            
            eligibility_result.update({
                'message': 'Thẻ không hợp lệ hoặc hết hạn',
                'reasons': reasons
            })
        
        return jsonify(eligibility_result), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500
