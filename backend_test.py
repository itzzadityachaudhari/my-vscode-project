import requests
import sys
import json
from datetime import datetime

class DealHuntAPITester:
    def __init__(self, base_url="https://dealhunt.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_user_registration(self):
        """Test user registration"""
        test_user_data = {
            "email": f"testuser_{datetime.now().strftime('%H%M%S')}@dealhunt.com",
            "password": "TestPass123!",
            "full_name": "Test User"
        }
        
        success, response = self.run_test(
            "User Registration", 
            "POST", 
            "auth/register", 
            200, 
            test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True, test_user_data
        return False, {}

    def test_admin_registration(self):
        """Test admin user registration (first user becomes admin)"""
        admin_data = {
            "email": "admin@dealhunt.com",
            "password": "admin123",
            "full_name": "Admin User"
        }
        
        success, response = self.run_test(
            "Admin Registration", 
            "POST", 
            "auth/register", 
            200, 
            admin_data
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            return True, admin_data
        return False, {}

    def test_user_login(self, user_data):
        """Test user login"""
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        success, response = self.run_test(
            "User Login", 
            "POST", 
            "auth/login", 
            200, 
            login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_admin_login(self):
        """Test admin login"""
        admin_login = {
            "email": "admin@dealhunt.com",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "Admin Login", 
            "POST", 
            "auth/login", 
            200, 
            admin_login
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            return True
        return False

    def test_get_current_user(self):
        """Test get current user endpoint"""
        if not self.token:
            self.log_test("Get Current User", False, "No token available")
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        return self.run_test("Get Current User", "GET", "auth/me", 200, headers=headers)

    def test_get_offers(self):
        """Test get offers endpoint"""
        return self.run_test("Get Offers", "GET", "offers", 200)

    def test_get_offers_with_filters(self):
        """Test get offers with filters"""
        # Test store filter
        success1, _ = self.run_test("Get Offers - Store Filter", "GET", "offers?store=Amazon", 200)
        
        # Test category filter
        success2, _ = self.run_test("Get Offers - Category Filter", "GET", "offers?category=Electronics", 200)
        
        # Test search filter
        success3, _ = self.run_test("Get Offers - Search Filter", "GET", "offers?search=iPhone", 200)
        
        return success1 and success2 and success3

    def test_get_categories(self):
        """Test get categories endpoint"""
        return self.run_test("Get Categories", "GET", "categories", 200)

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        if not self.admin_token:
            self.log_test("Admin Stats", False, "No admin token available")
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Admin Stats", "GET", "admin/stats", 200, headers=headers)

    def test_seed_data(self):
        """Test seed sample data endpoint"""
        if not self.admin_token:
            self.log_test("Seed Data", False, "No admin token available")
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Seed Sample Data", "POST", "admin/seed-data", 200, headers=headers)

    def test_create_offer(self):
        """Test create offer endpoint"""
        if not self.admin_token:
            self.log_test("Create Offer", False, "No admin token available")
            return False, None
        
        offer_data = {
            "title": "Test Product Offer",
            "description": "This is a test offer for API testing",
            "discount_percentage": 25,
            "original_price": 1000.0,
            "discounted_price": 750.0,
            "store": "Amazon",
            "category": "Electronics",
            "product_image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
            "offer_link": "https://amazon.com/test-product"
        }
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Create Offer", 
            "POST", 
            "offers", 
            200, 
            offer_data, 
            headers=headers
        )
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_get_single_offer(self, offer_id):
        """Test get single offer endpoint"""
        if not offer_id:
            self.log_test("Get Single Offer", False, "No offer ID available")
            return False
        
        return self.run_test("Get Single Offer", "GET", f"offers/{offer_id}", 200)

    def test_update_offer(self, offer_id):
        """Test update offer endpoint"""
        if not self.admin_token or not offer_id:
            self.log_test("Update Offer", False, "No admin token or offer ID available")
            return False
        
        update_data = {
            "title": "Updated Test Product Offer",
            "description": "This is an updated test offer",
            "discount_percentage": 30,
            "original_price": 1000.0,
            "discounted_price": 700.0,
            "store": "Amazon",
            "category": "Electronics",
            "product_image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
            "offer_link": "https://amazon.com/test-product-updated"
        }
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test(
            "Update Offer", 
            "PUT", 
            f"offers/{offer_id}", 
            200, 
            update_data, 
            headers=headers
        )

    def test_save_offer(self, offer_id):
        """Test save offer endpoint"""
        if not self.token or not offer_id:
            self.log_test("Save Offer", False, "No token or offer ID available")
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        return self.run_test("Save Offer", "POST", f"offers/{offer_id}/save", 200, headers=headers)

    def test_get_saved_offers(self):
        """Test get saved offers endpoint"""
        if not self.token:
            self.log_test("Get Saved Offers", False, "No token available")
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        return self.run_test("Get Saved Offers", "GET", "users/saved-offers", 200, headers=headers)

    def test_unsave_offer(self, offer_id):
        """Test unsave offer endpoint"""
        if not self.token or not offer_id:
            self.log_test("Unsave Offer", False, "No token or offer ID available")
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        return self.run_test("Unsave Offer", "DELETE", f"offers/{offer_id}/save", 200, headers=headers)

    def test_delete_offer(self, offer_id):
        """Test delete offer endpoint"""
        if not self.admin_token or not offer_id:
            self.log_test("Delete Offer", False, "No admin token or offer ID available")
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        return self.run_test("Delete Offer", "DELETE", f"offers/{offer_id}", 200, headers=headers)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting DealHunt API Tests...")
        print(f"   Base URL: {self.base_url}")
        print("=" * 60)

        # Test basic endpoints
        self.test_root_endpoint()
        self.test_get_categories()
        
        # Test authentication flow
        success, user_data = self.test_user_registration()
        if success:
            self.test_get_current_user()
        
        # Test admin functionality
        admin_success = self.test_admin_login()
        if admin_success:
            self.test_admin_stats()
            self.test_seed_data()
        
        # Test offers functionality
        self.test_get_offers()
        self.test_get_offers_with_filters()
        
        # Test offer CRUD operations
        offer_created, offer_id = self.test_create_offer()
        if offer_created:
            self.test_get_single_offer(offer_id)
            self.test_update_offer(offer_id)
            
            # Test save/unsave functionality
            if self.token:
                save_success, _ = self.test_save_offer(offer_id)
                if save_success:
                    self.test_get_saved_offers()
                    self.test_unsave_offer(offer_id)
            
            # Clean up - delete test offer
            self.test_delete_offer(offer_id)

        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            print("\nFailed tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['details']}")
            return 1

def main():
    tester = DealHuntAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())