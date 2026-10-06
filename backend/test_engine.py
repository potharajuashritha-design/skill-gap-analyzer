import unittest

from pydantic import ValidationError

from backend.engine import analyze_skill_gaps
from backend.main import AnalysisRequest


class AnalyzeSkillGapsTests(unittest.TestCase):
    def test_readiness_is_weighted_and_complete_profile_is_ready(self):
        result = analyze_skill_gaps("data-analyst", {
            "sql": 5, "excel": 4, "python": 5, "statistics": 4, "storytelling": 3,
        })

        self.assertEqual(result["readiness_score"], 100)
        self.assertEqual(result["skills_met"], 5)
        self.assertEqual(result["priority_skills"], [])

    def test_missing_high_weight_skill_is_prioritized(self):
        result = analyze_skill_gaps("data-analyst", {"sql": 0, "excel": 3, "python": 3, "statistics": 3, "storytelling": 2})

        self.assertEqual(result["priority_skills"][0]["skill_id"], "sql")
        self.assertIn("querying reliable data", result["priority_skills"][0]["why"])

    def test_display_name_alias_matches_canonical_skill(self):
        result = analyze_skill_gaps("software-engineer", {"API design": 3})

        api_design = next(skill for skill in result["skill_results"] if skill["skill_id"] == "apis")
        self.assertEqual(api_design["current_level"], 3)
        self.assertEqual(api_design["status"], "met")

    def test_invalid_role_and_rating_are_rejected(self):
        with self.assertRaises(ValueError):
            analyze_skill_gaps("unknown", {})
        with self.assertRaises(ValueError):
            analyze_skill_gaps("data-analyst", {"sql": 6})

    def test_api_rejects_coercible_non_integer_ratings(self):
        for rating in (True, "2", 2.0):
            with self.subTest(rating=rating):
                with self.assertRaises(ValidationError):
                    AnalysisRequest(target_role_id="data-analyst", skill_ratings={"sql": rating})


if __name__ == "__main__":
    unittest.main()