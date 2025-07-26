from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, ValidationError
from datetime import date, datetime

from app import db
from models.policy import InsuranceCard, InsuranceCardType, CardStatus

cards_bp = Blueprint('insurance_cards', __name__)

@cards_bp.route('/', methods=['GET'])
@jwt_required()
def get_user_cards():
    """Lấy danh sách thẻ BHYT của người dùng"""
    try:
        user_id = get_jwt_identity()
        cards = InsuranceCard.find_by_user_id(user_id)
        
        return jsonify({
            'cards': [card.to_dict() for card in cards]
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@cards_bp.route('/<card_number>/validate', methods=['GET'])
@jwt_required()
def validate_card(card_number):
    """Xác thực thẻ BHYT"""
    try:
        card = InsuranceCard.find_by_card_number(card_number)
        
        if not card:
            return jsonify({
                'message': 'Thẻ BHYT không tồn tại',
                'error': 'card_not_found',
                'is_valid': False
            }), 404
        
        check_date = date.today()
        is_valid = card.is_valid(check_date)
        
        validation_result = {
            'card': card.to_dict(),
            'is_valid': is_valid,
            'validation_date': check_date.isoformat(),
            'validation_details': {
                'status_valid': card.status == 'active',
                'date_valid': card.valid_from <= check_date <= card.valid_to,
                'expires_in_days': (card.valid_to - check_date).days if card.valid_to >= check_date else 0
            }
        }
        
        if not is_valid:
            reasons = []
            if card.status != 'active':
                reasons.append(f'Trạng thái thẻ: {card.status}')
            if check_date < card.valid_from:
                reasons.append('Thẻ chưa có hiệu lực')
            if check_date > card.valid_to:
                reasons.append('Thẻ đã hết hạn')
            
            validation_result['invalid_reasons'] = reasons
        
        return jsonify(validation_result), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ thống',
            'error': str(e)
        }), 500

@cards_bp.route('/<card_number>', methods=['GET'])
@jwt_required()
def get_card_details(card_number):
    """Lấy chi tiết thẻ BHYT"""
    try:
        card = InsuranceCard.find_by_card_number(card_number)
        
        if not card:
            return jsonify({
                'message': 'Thẻ BHYT không tồn tại',
                'error': 'card_not_found'
            }), 404
        
        # Check if user has permission to view this card
        current_user_id = get_jwt_identity()
        if str(card.user_id) != current_user_id:
            # TODO: Check if user has admin/staff role
            return jsonify({
                'message': 'Không có quyền truy cập thẻ này',
                'error': 'access_denied'
            }), 403
        
        return jsonify({
            'card': card.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'message': 'Lỗi hệ th��ng',
            'error': str(e)
        }), 500
