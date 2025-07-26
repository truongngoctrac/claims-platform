from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import redis
import json
import os
from typing import Optional
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BHYT API Gateway",
    description="API Gateway cho hệ thống Bảo hiểm Y tế Việt Nam",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Service URLs
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:5001")
POLICY_SERVICE_URL = os.getenv("POLICY_SERVICE_URL", "http://policy-service:5002")
CLAIMS_SERVICE_URL = os.getenv("CLAIMS_SERVICE_URL", "http://claims-service:5003")

# Redis connection
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))

# Rate limiting storage
rate_limit_storage = {}

class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    async def is_allowed(self, client_id: str) -> bool:
        now = datetime.now().timestamp()
        window_start = now - self.window_seconds
        
        if client_id not in rate_limit_storage:
            rate_limit_storage[client_id] = []
        
        # Clean old requests
        rate_limit_storage[client_id] = [
            req_time for req_time in rate_limit_storage[client_id] 
            if req_time > window_start
        ]
        
        # Check limit
        if len(rate_limit_storage[client_id]) >= self.max_requests:
            return False
        
        # Add current request
        rate_limit_storage[client_id].append(now)
        return True

rate_limiter = RateLimiter()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token with user service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{USER_SERVICE_URL}/auth/verify",
                headers={"Authorization": f"Bearer {credentials.credentials}"}
            )
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed"
        )

async def rate_limit_check(client_ip: str):
    """Rate limiting middleware"""
    if not await rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests"
        )

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "BHYT API Gateway",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Comprehensive health check"""
    services_status = {}
    
    # Check user service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{USER_SERVICE_URL}/health")
            services_status["user_service"] = response.status_code == 200
    except:
        services_status["user_service"] = False
    
    # Check policy service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{POLICY_SERVICE_URL}/health")
            services_status["policy_service"] = response.status_code == 200
    except:
        services_status["policy_service"] = False
    
    # Check claims service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{CLAIMS_SERVICE_URL}/health")
            services_status["claims_service"] = response.status_code == 200
    except:
        services_status["claims_service"] = False
    
    # Check Redis
    try:
        redis_client.ping()
        services_status["redis"] = True
    except:
        services_status["redis"] = False
    
    all_healthy = all(services_status.values())
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": services_status,
        "timestamp": datetime.now().isoformat()
    }

# User Management Routes
@app.post("/api/v1/auth/register")
async def register_user(request_data: dict):
    """Đăng ký người dùng mới"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{USER_SERVICE_URL}/auth/register",
            json=request_data
        )
        return response.json()

@app.post("/api/v1/auth/login")
async def login_user(request_data: dict):
    """Đăng nhập người dùng"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{USER_SERVICE_URL}/auth/login",
            json=request_data
        )
        return response.json()

@app.get("/api/v1/users/profile")
async def get_user_profile(user_data: dict = Depends(verify_token)):
    """Lấy thông tin profile người dùng"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{USER_SERVICE_URL}/users/{user_data['user_id']}/profile",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

# Policy Management Routes
@app.get("/api/v1/policies")
async def get_policies(user_data: dict = Depends(verify_token)):
    """Lấy danh sách chính sách BHYT"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{POLICY_SERVICE_URL}/policies",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

@app.get("/api/v1/policies/{policy_id}")
async def get_policy_detail(policy_id: str, user_data: dict = Depends(verify_token)):
    """Lấy chi tiết chính sách BHYT"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{POLICY_SERVICE_URL}/policies/{policy_id}",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

@app.post("/api/v1/policies/validate")
async def validate_policy(request_data: dict, user_data: dict = Depends(verify_token)):
    """Xác thực chính sách BHYT"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{POLICY_SERVICE_URL}/policies/validate",
            json=request_data,
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

# Claims Management Routes
@app.post("/api/v1/claims")
async def create_claim(request_data: dict, user_data: dict = Depends(verify_token)):
    """Tạo yêu cầu bồi thường mới"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{CLAIMS_SERVICE_URL}/claims",
            json=request_data,
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

@app.get("/api/v1/claims")
async def get_claims(user_data: dict = Depends(verify_token)):
    """Lấy danh sách yêu cầu bồi thường"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{CLAIMS_SERVICE_URL}/claims",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

@app.get("/api/v1/claims/{claim_id}")
async def get_claim_detail(claim_id: str, user_data: dict = Depends(verify_token)):
    """Lấy chi tiết yêu cầu bồi thường"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{CLAIMS_SERVICE_URL}/claims/{claim_id}",
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

@app.put("/api/v1/claims/{claim_id}/status")
async def update_claim_status(claim_id: str, request_data: dict, user_data: dict = Depends(verify_token)):
    """Cập nhật trạng thái yêu cầu bồi thường"""
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{CLAIMS_SERVICE_URL}/claims/{claim_id}/status",
            json=request_data,
            headers={"Authorization": f"Bearer {user_data['token']}"}
        )
        return response.json()

# Circuit breaker pattern for service resilience
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
    
    async def call(self, func, *args, **kwargs):
        if self.state == "open":
            if self._should_attempt_reset():
                self.state = "half-open"
            else:
                raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _should_attempt_reset(self):
        return (
            self.last_failure_time and 
            (datetime.now().timestamp() - self.last_failure_time) >= self.recovery_timeout
        )
    
    def _on_success(self):
        self.failure_count = 0
        self.state = "closed"
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now().timestamp()
        if self.failure_count >= self.failure_threshold:
            self.state = "open"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
