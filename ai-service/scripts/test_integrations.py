"""
Integration Test Suite for Mongez AI Service

This script tests all runtime integrations end-to-end:
1. NestJS endpoints
2. Tool functions
3. Full pipeline

Run with: python scripts/test_integrations.py

Priority 1: Fix Runtime Integrations
"""
import asyncio
import sys
import os
import json
from typing import Any, Dict
from datetime import datetime
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.config import get_settings
from app.clients.nestjs_client import NestJSClient
from app.clients.llm_client import LLMClient
from app.agents.tools.read_tools import (
    search_tasks,
    search_users,
    search_approvals,
    search_workflows,
    search_meetings,
    search_calendar,
    search_decisions,
    search_analytics,
    get_task_dependencies,
    get_blocker_chain,
    get_workflow_graph,
    get_org_graph,
)


class IntegrationTestRunner:
    """Run integration tests and report results."""

    def __init__(self):
        self.settings = get_settings()
        self.passed = []
        self.failed = []
        self.warnings = []
        self.results = {}

        # Test space ID (adjust as needed)
        self.test_space_id = os.getenv("TEST_SPACE_ID", "test-space-001")

    def log_pass(self, test_name: str, details: str = ""):
        """Record a passed test."""
        self.passed.append({"name": test_name, "details": details, "time": datetime.now().isoformat()})
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   {details}")

    def log_fail(self, test_name: str, error: str):
        """Record a failed test."""
        self.failed.append({"name": test_name, "error": error, "time": datetime.now().isoformat()})
        print(f"❌ FAIL: {test_name}")
        print(f"   Error: {error}")

    def log_warn(self, test_name: str, warning: str):
        """Record a warning."""
        self.warnings.append({"name": test_name, "warning": warning, "time": datetime.now().isoformat()})
        print(f"⚠️  WARN: {test_name}")
        print(f"   {warning}")

    async def test_nestjs_connection(self):
        """Test 1: Basic NestJS connectivity."""
        test_name = "NestJS Connection"
        try:
            client = NestJSClient(self.settings)
            # Try a simple request
            await client.get_schema()
            self.log_pass(test_name, "Connected to NestJS successfully")
            await client.close()
            return True
        except Exception as e:
            self.log_fail(test_name, str(e))
            return False

    async def test_endpoint_tasks(self):
        """Test 2: GET /internal/ai/tasks/{spaceId}"""
        test_name = "Endpoint: GET /internal/ai/tasks/{spaceId}"
        try:
            client = NestJSClient(self.settings)
            tasks = await client.get_tasks(self.test_space_id)
            if isinstance(tasks, list):
                self.log_pass(test_name, f"Returned {len(tasks)} tasks")
            else:
                self.log_fail(test_name, f"Expected list, got {type(tasks)}")
            await client.close()
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_endpoint_calendar(self):
        """Test 3: GET /internal/ai/calendar/{spaceId}"""
        test_name = "Endpoint: GET /internal/ai/calendar/{spaceId}"
        try:
            client = NestJSClient(self.settings)
            events = await client.get_calendar(self.test_space_id)
            if isinstance(events, list):
                self.log_pass(test_name, f"Returned {len(events)} events")
            else:
                self.log_fail(test_name, f"Expected list, got {type(events)}")
            await client.close()
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_endpoint_dependencies(self):
        """Test 4: GET /internal/ai/graph/dependencies/{spaceId}"""
        test_name = "Endpoint: GET /internal/ai/graph/dependencies/{spaceId}"
        try:
            client = NestJSClient(self.settings)
            deps = await client.get_task_dependencies(self.test_space_id)
            if isinstance(deps, list):
                self.log_pass(test_name, f"Returned {len(deps)} dependencies")
            else:
                self.log_fail(test_name, f"Expected list, got {type(deps)}")
            await client.close()
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_endpoint_blockers(self):
        """Test 5: GET /internal/ai/graph/blockers/{spaceId}"""
        test_name = "Endpoint: GET /internal/ai/graph/blockers/{spaceId}"
        try:
            client = NestJSClient(self.settings)
            blockers = await client.get_blocker_chain(self.test_space_id)
            if isinstance(blockers, list):
                self.log_pass(test_name, f"Returned {len(blockers)} blocker chains")
            else:
                self.log_fail(test_name, f"Expected list, got {type(blockers)}")
            await client.close()
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_endpoint_workflows(self):
        """Test 6: GET /internal/ai/graph/workflows/{spaceId}"""
        test_name = "Endpoint: GET /internal/ai/graph/workflows/{spaceId}"
        try:
            client = NestJSClient(self.settings)
            workflows = await client.get_workflow_graph(self.test_space_id)
            if isinstance(workflows, dict):
                self.log_pass(test_name, f"Returned workflow graph with keys: {list(workflows.keys())}")
            else:
                self.log_fail(test_name, f"Expected dict, got {type(workflows)}")
            await client.close()
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_endpoint_org(self):
        """Test 7: GET /internal/ai/graph/org/{spaceId}"""
        test_name = "Endpoint: GET /internal/ai/graph/org/{spaceId}"
        try:
            client = NestJSClient(self.settings)
            org = await client.get_org_graph(self.test_space_id)
            if isinstance(org, dict):
                self.log_pass(test_name, f"Returned org graph with keys: {list(org.keys())}")
            else:
                self.log_fail(test_name, f"Expected dict, got {type(org)}")
            await client.close()
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_endpoint_decisions(self):
        """Test 8: GET /internal/ai/graph/decisions/{spaceId}"""
        test_name = "Endpoint: GET /internal/ai/graph/decisions/{spaceId}"
        try:
            client = NestJSClient(self.settings)
            decisions = await client.get_decisions(self.test_space_id)
            if isinstance(decisions, list):
                self.log_pass(test_name, f"Returned {len(decisions)} decisions")
            else:
                self.log_fail(test_name, f"Expected list, got {type(decisions)}")
            await client.close()
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_search_tasks(self):
        """Test 9: Tool function search_tasks()"""
        test_name = "Tool: search_tasks()"
        try:
            result = await search_tasks(query="test", space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, list):
                self.log_pass(test_name, f"Returned {len(parsed)} tasks")
            elif "error" in parsed:
                self.log_fail(test_name, parsed.get("error", "Unknown error"))
            else:
                self.log_warn(test_name, f"Unexpected format: {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_search_users(self):
        """Test 10: Tool function search_users()"""
        test_name = "Tool: search_users()"
        try:
            result = await search_users(space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, dict):
                if "error" in parsed:
                    self.log_fail(test_name, parsed.get("error", "Unknown error"))
                else:
                    self.log_pass(test_name, f"Returned {len(parsed)} users")
            else:
                self.log_fail(test_name, f"Expected dict, got {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_search_approvals(self):
        """Test 11: Tool function search_approvals()"""
        test_name = "Tool: search_approvals()"
        try:
            result = await search_approvals(space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, dict):
                if "error" in parsed:
                    self.log_fail(test_name, parsed.get("error", "Unknown error"))
                else:
                    self.log_pass(test_name, f"Returned approvals data")
            else:
                self.log_fail(test_name, f"Expected dict, got {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_search_workflows(self):
        """Test 12: Tool function search_workflows()"""
        test_name = "Tool: search_workflows()"
        try:
            result = await search_workflows(space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, list):
                self.log_pass(test_name, f"Returned {len(parsed)} workflows")
            elif "error" in parsed:
                self.log_fail(test_name, parsed.get("error", "Unknown error"))
            else:
                self.log_warn(test_name, f"Unexpected format: {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_search_calendar(self):
        """Test 13: Tool function search_calendar()"""
        test_name = "Tool: search_calendar()"
        try:
            result = await search_calendar(space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, list):
                self.log_pass(test_name, f"Returned {len(parsed)} events")
            elif "error" in parsed:
                self.log_fail(test_name, parsed.get("error", "Unknown error"))
            else:
                self.log_warn(test_name, f"Unexpected format: {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_search_analytics(self):
        """Test 14: Tool function search_analytics()"""
        test_name = "Tool: search_analytics()"
        try:
            result = await search_analytics(space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, dict):
                if "error" in parsed:
                    self.log_fail(test_name, parsed.get("error", "Unknown error"))
                else:
                    self.log_pass(test_name, f"Returned analytics: {parsed.get('total_tasks', 0)} tasks")
            else:
                self.log_fail(test_name, f"Expected dict, got {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_get_blocker_chain(self):
        """Test 15: Tool function get_blocker_chain()"""
        test_name = "Tool: get_blocker_chain()"
        try:
            result = await get_blocker_chain(space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, list):
                self.log_pass(test_name, f"Returned {len(parsed)} blocker chains")
            elif "error" in parsed:
                self.log_fail(test_name, parsed.get("error", "Unknown error"))
            else:
                self.log_warn(test_name, f"Unexpected format: {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    async def test_tool_get_org_graph(self):
        """Test 16: Tool function get_org_graph()"""
        test_name = "Tool: get_org_graph()"
        try:
            result = await get_org_graph(space_id=self.test_space_id)
            parsed = json.loads(result)
            if isinstance(parsed, dict):
                if "error" in parsed:
                    self.log_fail(test_name, parsed.get("error", "Unknown error"))
                else:
                    self.log_pass(test_name, f"Returned org graph")
            else:
                self.log_fail(test_name, f"Expected dict, got {type(parsed)}")
        except Exception as e:
            self.log_fail(test_name, str(e))

    def print_summary(self):
        """Print test summary."""
        total = len(self.passed) + len(self.failed)
        passed = len(self.passed)
        failed = len(self.failed)
        warnings = len(self.warnings)

        print("\n" + "=" * 60)
        print("INTEGRATION TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"✅ Passed:    {passed}")
        print(f"❌ Failed:    {failed}")
        print(f"⚠️  Warnings:  {warnings}")
        print("=" * 60)

        if self.failed:
            print("\n❌ FAILED TESTS:")
            for fail in self.failed:
                print(f"  • {fail['name']}")
                print(f"    {fail['error'][:100]}...")

        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warn in self.warnings:
                print(f"  • {warn['name']}")
                print(f"    {warn['warning'][:100]}...")

        # Save results to file
        results_file = project_root / "test_results.json"
        with open(results_file, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "total": total,
                "passed": passed,
                "failed": failed,
                "warnings": warnings,
                "passed_tests": self.passed,
                "failed_tests": self.failed,
                "warnings_list": self.warnings,
            }, f, indent=2)
        print(f"\n📄 Results saved to: {results_file}")

        return failed == 0

    async def run_all_tests(self):
        """Run all integration tests."""
        print("\n" + "=" * 60)
        print("MONGEZ AI INTEGRATION TEST SUITE")
        print(f"Testing Space ID: {self.test_space_id}")
        print(f"NestJS URL: {self.settings.nestjs_base_url}")
        print("=" * 60 + "\n")

        # NestJS endpoint tests
        print("🔡 TESTING NESTJS ENDPOINTS")
        print("-" * 60)
        await self.test_nestjs_connection()
        await self.test_endpoint_tasks()
        await self.test_endpoint_calendar()
        await self.test_endpoint_dependencies()
        await self.test_endpoint_blockers()
        await self.test_endpoint_workflows()
        await self.test_endpoint_org()
        await self.test_endpoint_decisions()

        # Tool function tests
        print("\n🔧 TESTING TOOL FUNCTIONS")
        print("-" * 60)
        await self.test_tool_search_tasks()
        await self.test_tool_search_users()
        await self.test_tool_search_approvals()
        await self.test_tool_search_workflows()
        await self.test_tool_search_calendar()
        await self.test_tool_search_analytics()
        await self.test_tool_get_blocker_chain()
        await self.test_tool_get_org_graph()

        return self.print_summary()


async def main():
    """Run integration tests."""
    runner = IntegrationTestRunner()
    success = await runner.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
