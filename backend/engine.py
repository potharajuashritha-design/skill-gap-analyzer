"""Explainable skill-gap analysis for supported career roles."""

from typing import Any, Dict, List, Mapping


ROLE_CATALOG = [
    {
        "id": "data-analyst",
        "title": "Data Analyst",
        "summary": "Turn raw data into clear decisions through analysis and communication.",
        "requirements": [
            {"skill_id": "sql", "name": "SQL", "required_level": 4, "weight": 5, "why": "Most analyst roles depend on querying reliable data from relational sources.", "next_step": "Write joins, window functions, and a short query for a real dataset."},
            {"skill_id": "spreadsheets", "name": "Spreadsheets", "required_level": 3, "weight": 3, "why": "Spreadsheets remain a common tool for quick analysis and stakeholder handoffs.", "next_step": "Build a pivot-table report with documented assumptions."},
            {"skill_id": "python", "name": "Python", "required_level": 3, "weight": 4, "why": "Python helps automate repeatable analysis and work with larger datasets.", "next_step": "Clean and explore a public dataset with pandas."},
            {"skill_id": "statistics", "name": "Statistics", "required_level": 3, "weight": 4, "why": "Sound statistical reasoning prevents misleading conclusions from noisy data.", "next_step": "Explain a confidence interval and test one hypothesis with data."},
            {"skill_id": "data-storytelling", "name": "Data storytelling", "required_level": 2, "weight": 3, "why": "Analysis is useful when people can understand the finding and act on it.", "next_step": "Present one chart with a finding, evidence, and a decision."},
        ],
    },
    {
        "id": "software-engineer",
        "title": "Software Engineer",
        "summary": "Design, build, and verify software that solves practical problems.",
        "requirements": [
            {"skill_id": "python", "name": "Python", "required_level": 4, "weight": 5, "why": "Strong programming fundamentals support implementation and debugging work.", "next_step": "Build a small typed service and document its design decisions."},
            {"skill_id": "git", "name": "Git", "required_level": 3, "weight": 3, "why": "Version control is essential for collaborating safely on shared code.", "next_step": "Practice a feature branch, reviewable commits, and a merge conflict."},
            {"skill_id": "apis", "name": "API design", "required_level": 3, "weight": 4, "why": "Most software products rely on stable interfaces between components.", "next_step": "Design and test a REST endpoint with input validation."},
            {"skill_id": "databases", "name": "Databases", "required_level": 3, "weight": 3, "why": "Applications need reliable data models, queries, and persistence.", "next_step": "Model a relational feature and add constraints and indexes."},
            {"skill_id": "testing", "name": "Testing", "required_level": 3, "weight": 4, "why": "Tests catch regressions and make changes safer to review and ship.", "next_step": "Add unit and integration tests for a feature's edge cases."},
        ],
    },
    {
        "id": "product-designer",
        "title": "Product Designer",
        "summary": "Shape useful digital experiences through research, interaction, and iteration.",
        "requirements": [
            {"skill_id": "user-research", "name": "User research", "required_level": 4, "weight": 5, "why": "Research grounds design choices in real user needs and constraints.", "next_step": "Run three structured interviews and synthesize recurring needs."},
            {"skill_id": "interaction-design", "name": "Interaction design", "required_level": 4, "weight": 5, "why": "Clear interaction patterns make complex workflows understandable.", "next_step": "Prototype one end-to-end workflow and test it with a user."},
            {"skill_id": "visual-design", "name": "Visual design", "required_level": 3, "weight": 3, "why": "Visual hierarchy helps people scan, understand, and trust an interface.", "next_step": "Create a responsive screen with a consistent type and spacing system."},
            {"skill_id": "prototyping", "name": "Prototyping", "required_level": 3, "weight": 4, "why": "Prototypes make ideas testable before expensive implementation begins.", "next_step": "Prototype a high-risk interaction and observe a usability session."},
            {"skill_id": "accessibility", "name": "Accessibility", "required_level": 3, "weight": 4, "why": "Accessible products work for more people and meet essential quality standards.", "next_step": "Audit keyboard access, contrast, and screen-reader labels on a flow."},
        ],
    },
]

SKILL_ALIASES = {
    "excel": "spreadsheets",
    "spreadsheet": "spreadsheets",
    "data storytelling": "data-storytelling",
    "storytelling": "data-storytelling",
    "api": "apis",
    "api design": "apis",
    "rest apis": "apis",
    "user research": "user-research",
    "ux research": "user-research",
    "interaction design": "interaction-design",
    "visual design": "visual-design",
}


def _normalize_skill(value: str) -> str:
    normalized = " ".join(value.strip().lower().replace("_", " ").split())
    return SKILL_ALIASES.get(normalized, normalized.replace(" ", "-"))


def analyze_skill_gaps(target_role_id: str, skill_ratings: Mapping[str, int]) -> Dict[str, Any]:
    """Return weighted readiness and ranked, explainable skill gaps."""
    role = next((item for item in ROLE_CATALOG if item["id"] == target_role_id), None)
    if role is None:
        raise ValueError("Unsupported target role")

    normalized_ratings: Dict[str, int] = {}
    for skill, rating in skill_ratings.items():
        if isinstance(rating, bool) or not isinstance(rating, int) or not 0 <= rating <= 5:
            raise ValueError("Skill ratings must be whole numbers from 0 to 5")
        normalized_ratings[_normalize_skill(skill)] = rating

    skill_results: List[Dict[str, Any]] = []
    total_weight = 0
    earned_weight = 0.0
    for requirement in role["requirements"]:
        skill_id = requirement["skill_id"]
        required = requirement["required_level"]
        current = normalized_ratings.get(skill_id, 0)
        gap = max(required - current, 0)
        weight = requirement["weight"]
        earned_weight += min(current / required, 1.0) * weight
        total_weight += weight
        skill_results.append({
            "skill_id": skill_id,
            "name": requirement["name"],
            "current_level": current,
            "required_level": required,
            "gap": gap,
            "weight": weight,
            "priority_score": round((gap / required) * weight, 2),
            "status": "met" if gap == 0 else ("developing" if current > 0 else "missing"),
            "why": requirement["why"],
            "next_step": requirement["next_step"],
        })

    score = round((earned_weight / total_weight) * 100) if total_weight else 0
    readiness_band = "Strong match" if score >= 80 else "Building momentum" if score >= 55 else "Early foundations"
    priority_order = sorted(skill_results, key=lambda item: (-item["priority_score"], item["name"]))
    return {
        "target_role_id": role["id"],
        "readiness_score": score,
        "readiness_band": readiness_band,
        "skills_met": sum(item["status"] == "met" for item in skill_results),
        "skills_total": len(skill_results),
        "skill_results": skill_results,
        "priority_skills": [item for item in priority_order if item["gap"] > 0],
    }