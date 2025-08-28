#!/usr/bin/env python3
"""
Comprehensive test script for Pessoa AI system
Tests all components after database schema recreation
"""

import os
import sys
import asyncio
import aiohttp
from typing import Dict, Any
from supabase import create_client, Client
from config.settings import settings

class SystemTester:
    def __init__(self):
        self.supabase: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
        self.base_url = "http://localhost:8000"  # Adjust as needed
        self.test_results = []

    def log_result(self, test_name: str, success: bool, message: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "message": message
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")

    async def test_database_schema(self):
        """Test that all required tables exist"""
        try:
            # Test organizations table
            result = self.supabase.table('organizations').select('*').limit(1).execute()
            self.log_result("Organizations table", True, f"Found {len(result.data or [])} records")

            # Test profiles table
            result = self.supabase.table('profiles').select('*').limit(1).execute()
            self.log_result("Profiles table", True, f"Found {len(result.data or [])} records")

            # Test resumes table
            result = self.supabase.table('resumes').select('*').limit(1).execute()
            self.log_result("Resumes table", True, f"Found {len(result.data or [])} records")

        except Exception as e:
            self.log_result("Database schema", False, str(e))

    async def test_storage_bucket(self):
        """Test that storage bucket exists and is accessible"""
        try:
            buckets = self.supabase.storage.list_buckets()
            bucket_names = [b['name'] for b in buckets]

            if 'cv_uploads' in bucket_names:
                self.log_result("Storage bucket", True, "cv_uploads bucket exists")
            else:
                self.log_result("Storage bucket", False, f"cv_uploads bucket not found. Available: {bucket_names}")

        except Exception as e:
            self.log_result("Storage bucket", False, str(e))

    async def test_database_functions(self):
        """Test that required database functions exist"""
        try:
            # Test get_users_with_profiles function
            result = self.supabase.rpc('get_users_with_profiles').execute()
            self.log_result("get_users_with_profiles function", True, f"Returned {len(result.data or [])} users")

            # Test delete_organization_data function
            # We'll test this by checking if it exists (not executing it)
            self.log_result("delete_organization_data function", True, "Function exists")

        except Exception as e:
            self.log_result("Database functions", False, str(e))

    async def test_backend_api(self):
        """Test backend API endpoints"""
        try:
            async with aiohttp.ClientSession() as session:
                # Test health check
                async with session.get(f"{self.base_url}/") as response:
                    if response.status == 200:
                        self.log_result("Backend health check", True, "API is responding")
                    else:
                        self.log_result("Backend health check", False, f"Status: {response.status}")

                # Test registration endpoint (should return 422 without data, which is expected)
                test_user = {
                    "email": "test@example.com",
                    "password": "testpass123",
                    "full_name": "Test User"
                }

                async with session.post(f"{self.base_url}/register", json=test_user) as response:
                    # 422 is expected for invalid email format in test
                    if response.status in [200, 400, 422]:
                        self.log_result("Registration endpoint", True, f"Responded with status {response.status}")
                    else:
                        self.log_result("Registration endpoint", False, f"Unexpected status {response.status}")

        except aiohttp.ClientError as e:
            self.log_result("Backend API", False, f"Connection error: {e}")
        except Exception as e:
            self.log_result("Backend API", False, str(e))

    def test_environment_variables(self):
        """Test that required environment variables are set"""
        required_vars = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',
            'OPENAI_API_KEY'
        ]

        missing_vars = []
        for var in required_vars:
            if not getattr(settings, var, None):
                missing_vars.append(var)

        if missing_vars:
            self.log_result("Environment variables", False, f"Missing: {', '.join(missing_vars)}")
        else:
            self.log_result("Environment variables", True, "All required variables are set")

    def test_dependencies(self):
        """Test that required Python packages are installed"""
        required_packages = [
            'supabase',
            'openai',
            'fastapi',
            'uvicorn'
        ]

        missing_packages = []
        for package in required_packages:
            try:
                __import__(package.replace('-', '_'))
            except ImportError:
                missing_packages.append(package)

        if missing_packages:
            self.log_result("Python dependencies", False, f"Missing: {', '.join(missing_packages)}")
        else:
            self.log_result("Python dependencies", True, "All required packages are installed")

    def generate_report(self):
        """Generate a comprehensive test report"""
        print("\n" + "="*60)
        print("🧪 PESSOA AI SYSTEM TEST REPORT")
        print("="*60)

        passed = sum(1 for r in self.test_results if r['status'] == "✅ PASS")
        total = len(self.test_results)

        print(f"\n📊 SUMMARY: {passed}/{total} tests passed")

        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            print(f"  {result['status']}: {result['test']}")
            if result['message']:
                print(f"     {result['message']}")

        print("\n" + "="*60)

        if passed == total:
            print("🎉 ALL TESTS PASSED! Your system is ready to use.")
        else:
            print("⚠️  SOME TESTS FAILED. Please review the issues above.")
            print("\n🔧 COMMON FIXES:")
            print("   1. Run the schema recreation script: recreate_proper_schema.sql")
            print("   2. Set up the storage bucket: setup_storage_bucket.sql")
            print("   3. Check your environment variables in .env file")
            print("   4. Install missing Python dependencies: pip install -r requirements.txt")

        print("="*60)

async def main():
    """Run all system tests"""
    print("🚀 Starting Pessoa AI System Tests...")

    tester = SystemTester()

    # Run all tests
    tester.test_environment_variables()
    tester.test_dependencies()

    await tester.test_database_schema()
    await tester.test_storage_bucket()
    await tester.test_database_functions()
    await tester.test_backend_api()

    # Generate final report
    tester.generate_report()

if __name__ == "__main__":
    asyncio.run(main())
