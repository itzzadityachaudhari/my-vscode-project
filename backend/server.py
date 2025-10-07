from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
import jwt
import hashlib
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security setup
SECRET_KEY = os.environ.get('SECRET_KEY', 'dealhunt-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

# Simple password hashing for MVP (in production, use proper bcrypt)
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="DealHunt API", description="E-commerce Offers Aggregator")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str

class Offer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    discount_percentage: int
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    store: str  # Amazon, Flipkart, etc.
    category: str
    product_image: str
    offer_link: str
    expiry_date: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OfferCreate(BaseModel):
    title: str
    description: str
    discount_percentage: int
    original_price: Optional[float] = None
    discounted_price: Optional[float] = None
    store: str
    category: str
    product_image: str
    offer_link: str
    expiry_date: Optional[datetime] = None

class SavedOffer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    offer_id: str
    saved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper functions
def verify_password(plain_password, hashed_password):
    # Simple SHA256 hashing for MVP (use bcrypt in production)
    return get_password_hash(plain_password) == hashed_password

def get_password_hash(password):
    # Simple SHA256 hashing for MVP (use bcrypt in production)
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Parse datetime strings back from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and key in ['created_at', 'expiry_date', 'saved_at']:
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except:
                    pass
    return item

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
        user = await db.users.find_one({"email": email})
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
        return User(**parse_from_mongo(user))
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "DealHunt API is running!", "version": "1.0.0"}

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this is the first user (make them admin)
    user_count = await db.users.count_documents({})
    is_admin = user_count == 0
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        full_name=user.full_name,
        is_admin=is_admin
    )
    
    user_dict = new_user.dict()
    user_dict['password'] = hashed_password
    user_dict = prepare_for_mongo(user_dict)
    
    await db.users.insert_one(user_dict)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user['password']):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Offers Routes
@api_router.get("/offers", response_model=List[Offer])
async def get_offers(
    store: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50
):
    query = {"is_active": True}
    
    if store:
        query["store"] = store
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    offers = await db.offers.find(query).limit(limit).to_list(length=None)
    return [Offer(**parse_from_mongo(offer)) for offer in offers]

@api_router.get("/offers/{offer_id}", response_model=Offer)
async def get_offer(offer_id: str):
    offer = await db.offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return Offer(**parse_from_mongo(offer))

@api_router.post("/offers", response_model=Offer)
async def create_offer(offer: OfferCreate, admin_user: User = Depends(get_admin_user)):
    new_offer = Offer(**offer.dict())
    offer_dict = prepare_for_mongo(new_offer.dict())
    await db.offers.insert_one(offer_dict)
    return new_offer

@api_router.put("/offers/{offer_id}", response_model=Offer)
async def update_offer(offer_id: str, offer_update: OfferCreate, admin_user: User = Depends(get_admin_user)):
    offer = await db.offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    updated_offer = Offer(id=offer_id, **offer_update.dict())
    offer_dict = prepare_for_mongo(updated_offer.dict())
    
    await db.offers.update_one({"id": offer_id}, {"$set": offer_dict})
    return updated_offer

@api_router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, admin_user: User = Depends(get_admin_user)):
    result = await db.offers.delete_one({"id": offer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"message": "Offer deleted successfully"}

# Saved Offers Routes
@api_router.post("/offers/{offer_id}/save")
async def save_offer(offer_id: str, current_user: User = Depends(get_current_user)):
    # Check if offer exists
    offer = await db.offers.find_one({"id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Check if already saved
    existing_saved = await db.saved_offers.find_one({"user_id": current_user.id, "offer_id": offer_id})
    if existing_saved:
        raise HTTPException(status_code=400, detail="Offer already saved")
    
    saved_offer = SavedOffer(user_id=current_user.id, offer_id=offer_id)
    saved_dict = prepare_for_mongo(saved_offer.dict())
    await db.saved_offers.insert_one(saved_dict)
    
    return {"message": "Offer saved successfully"}

@api_router.delete("/offers/{offer_id}/save")
async def unsave_offer(offer_id: str, current_user: User = Depends(get_current_user)):
    result = await db.saved_offers.delete_one({"user_id": current_user.id, "offer_id": offer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved offer not found")
    return {"message": "Offer unsaved successfully"}

@api_router.get("/users/saved-offers", response_model=List[Offer])
async def get_saved_offers(current_user: User = Depends(get_current_user)):
    saved_offers = await db.saved_offers.find({"user_id": current_user.id}).to_list(length=None)
    offer_ids = [saved['offer_id'] for saved in saved_offers]
    
    if not offer_ids:
        return []
    
    offers = await db.offers.find({"id": {"$in": offer_ids}}).to_list(length=None)
    return [Offer(**parse_from_mongo(offer)) for offer in offers]

# Categories Route
@api_router.get("/categories")
async def get_categories():
    categories = ["Electronics", "Fashion", "Home & Kitchen", "Sports & Fitness", "Books", "Beauty", "Groceries", "Mobile"]
    stores = ["Amazon", "Flipkart", "Myntra", "Ajio", "Meesho"]
    return {"categories": categories, "stores": stores}

# Stats for admin
@api_router.get("/admin/stats")
async def get_admin_stats(admin_user: User = Depends(get_admin_user)):
    total_offers = await db.offers.count_documents({})
    active_offers = await db.offers.count_documents({"is_active": True})
    total_users = await db.users.count_documents({})
    total_saved = await db.saved_offers.count_documents({})
    
    return {
        "total_offers": total_offers,
        "active_offers": active_offers,
        "total_users": total_users,
        "total_saved": total_saved
    }

# Seed data endpoint
@api_router.post("/admin/seed-data")
async def seed_sample_data(admin_user: User = Depends(get_admin_user)):
    # Check if data already exists
    existing_offers = await db.offers.count_documents({})
    if existing_offers > 0:
        return {"message": "Data already exists"}
    
    sample_offers = [
        {
            "title": "iPhone 15 Pro Max",
            "description": "Latest iPhone with advanced camera system and A17 Pro chip",
            "discount_percentage": 12,
            "original_price": 159900,
            "discounted_price": 140712,
            "store": "Amazon",
            "category": "Electronics",
            "product_image": "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400",
            "offer_link": "https://amazon.in/iphone-15-pro-max",
            "expiry_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "title": "Nike Air Max Sneakers",
            "description": "Comfortable and stylish sneakers for everyday wear",
            "discount_percentage": 35,
            "original_price": 8995,
            "discounted_price": 5847,
            "store": "Flipkart",
            "category": "Fashion",
            "product_image": "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400",
            "offer_link": "https://flipkart.com/nike-air-max",
            "expiry_date": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "title": "Denim Jackets Collection",
            "description": "Trendy denim jackets for men and women",
            "discount_percentage": 40,
            "original_price": 2999,
            "discounted_price": 1799,
            "store": "Myntra",
            "category": "Fashion",
            "product_image": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
            "offer_link": "https://myntra.com/denim-jackets",
            "expiry_date": (datetime.now(timezone.utc) + timedelta(days=20)).isoformat(),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "title": "Samsung 4K Smart TV 55\"",
            "description": "Crystal UHD 4K Smart TV with HDR support",
            "discount_percentage": 25,
            "original_price": 45990,
            "discounted_price": 34493,
            "store": "Amazon",
            "category": "Electronics",
            "product_image": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400",
            "offer_link": "https://amazon.in/samsung-4k-tv",
            "expiry_date": (datetime.now(timezone.utc) + timedelta(days=25)).isoformat(),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "title": "Boat Headphones Wireless",
            "description": "Premium wireless headphones with active noise cancellation",
            "discount_percentage": 50,
            "original_price": 4999,
            "discounted_price": 2499,
            "store": "Flipkart",
            "category": "Electronics",
            "product_image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
            "offer_link": "https://flipkart.com/boat-headphones",
            "expiry_date": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "title": "Kitchen Appliances Combo",
            "description": "Complete kitchen appliances set including mixer, toaster, kettle",
            "discount_percentage": 30,
            "original_price": 15999,
            "discounted_price": 11199,
            "store": "Meesho",
            "category": "Home & Kitchen",
            "product_image": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400",
            "offer_link": "https://meesho.com/kitchen-combo",
            "expiry_date": (datetime.now(timezone.utc) + timedelta(days=18)).isoformat(),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Add IDs to each offer
    for offer in sample_offers:
        offer['id'] = str(uuid.uuid4())
    
    await db.offers.insert_many(sample_offers)
    return {"message": f"Seeded {len(sample_offers)} sample offers"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()