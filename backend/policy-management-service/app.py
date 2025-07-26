from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import redis
import os
from datetime import timedelta

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

def create_app(config_name=None):
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL', 
        'postgresql://bhyt_user:bhyt_password@localhost:5432/bhyt_policies'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-jwt-secret')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    app.config['JWT_BLACKLIST_ENABLED'] = True
    app.config['JWT_BLACKLIST_TOKEN_CHECKS'] = ['access']
    
    # Redis configuration
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/2')
    redis_client = redis.from_url(redis_url)
    
    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, origins=["*"])  # Configure properly for production
    limiter.init_app(app)
    limiter.storage_uri = redis_url
    
    # JWT token blacklist
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload['jti']
        try:
            return redis_client.sismember('blacklisted_tokens', jti)
        except:
            return False
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return {
            'message': 'Token đã bị thu hồi',
            'error': 'token_revoked'
        }, 401
    
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {
            'message': 'Token đã hết hạn',
            'error': 'token_expired'
        }, 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {
            'message': 'Token không hợp lệ',
            'error': 'invalid_token'
        }, 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return {
            'message': 'Không tìm thấy token xác thực',
            'error': 'authorization_required'
        }, 401
    
    # Register blueprints
    from .routes.policies import policies_bp
    from .routes.insurance_cards import cards_bp
    from .routes.facilities import facilities_bp
    from .routes.validation import validation_bp
    
    app.register_blueprint(policies_bp, url_prefix='/policies')
    app.register_blueprint(cards_bp, url_prefix='/insurance-cards')
    app.register_blueprint(facilities_bp, url_prefix='/facilities')
    app.register_blueprint(validation_bp, url_prefix='/validate')
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        try:
            # Check database connection
            db.session.execute('SELECT 1')
            db_status = 'healthy'
        except Exception as e:
            db_status = f'unhealthy: {str(e)}'
        
        try:
            # Check Redis connection
            redis_client.ping()
            redis_status = 'healthy'
        except Exception as e:
            redis_status = f'unhealthy: {str(e)}'
        
        return {
            'status': 'healthy' if db_status == 'healthy' and redis_status == 'healthy' else 'unhealthy',
            'database': db_status,
            'redis': redis_status,
            'service': 'policy-management-service',
            'version': '1.0.0'
        }
    
    @app.route('/')
    def index():
        return {
            'message': 'Policy Management Service cho hệ thống BHYT',
            'version': '1.0.0',
            'endpoints': {
                'policies': '/policies',
                'insurance_cards': '/insurance-cards',
                'facilities': '/facilities',
                'validation': '/validate',
                'health': '/health'
            }
        }
    
    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        return {
            'message': 'Endpoint không tồn tại',
            'error': 'not_found'
        }, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return {
            'message': 'Lỗi hệ thống',
            'error': 'internal_server_error'
        }, 500
    
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return {
            'message': 'Quá nhiều yêu cầu, vui lòng thử lại sau',
            'error': 'rate_limit_exceeded'
        }, 429
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5002, debug=True)
