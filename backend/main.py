"""FastAPI entry point for career-readiness analysis."""

import os
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from backend.engine import ROLE_CATALOG, analyze_skill_gaps


DEMO_RATINGS = {
    "sql": 2,
    "spreadsheets": 4,
    "python": 1,
    "statistics": 2,
    "data-storytelling": 1,
}

HISTORY_SNAPSHOTS = [
    ("Jun", {"sql": 1, "spreadsheets": 2, "statistics": 1}),
    ("Jul", {"sql": 1, "spreadsheets": 3, "python": 1, "statistics": 1, "data-storytelling": 1}),
    ("Aug", {"sql": 2, "spreadsheets": 3, "python": 1, "statistics": 1, "data-storytelling": 1}),
    ("Sep", {"sql": 2, "spreadsheets": 4, "python": 1, "statistics": 2, "data-storytelling": 1}),
    ("Oct", DEMO_RATINGS),
]


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_role_id: str = Field(min_length=1, max_length=80)
    skill_ratings: Dict[str, StrictInt]


app = FastAPI(
    title="Skill Gap Analyzer API",
    description="Explainable career-readiness and skill-gap analysis.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/roles")
def list_roles() -> List[Dict[str, str]]:
    return [
        {"id": role["id"], "title": role["title"], "summary": role["summary"]}
        for role in ROLE_CATALOG
    ]


@app.get("/api/dashboard/demo")
def demo_dashboard(role_id: str = "data-analyst") -> Dict[str, Any]:
    role = next((item for item in ROLE_CATALOG if item["id"] == role_id), None)
    if role is None:
        raise HTTPException(status_code=404, detail="Unsupported target role")

    try:
        analysis = analyze_skill_gaps(role_id, DEMO_RATINGS)
        history = [
            {
                "label": label,
                "score": analyze_skill_gaps(role_id, snapshot)["readiness_score"],
            }
            for label, snapshot in HISTORY_SNAPSHOTS
        ]
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))

    return {
        "profile": {"name": "Alex Morgan", "program": "Computer Science", "is_demo": True},
        "role": {"id": role["id"], "title": role["title"], "summary": role["summary"]},
        "analysis": analysis,
        "history": history,
    }


@app.post("/api/analysis")
def create_analysis(request: AnalysisRequest) -> Dict[str, Any]:
    try:
        return analyze_skill_gaps(request.target_role_id, request.skill_ratings)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))