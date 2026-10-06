export type Role = {
  id: string;
  title: string;
  summary: string;
};

export type SkillResult = {
  skill_id: string;
  name: string;
  current_level: number;
  required_level: number;
  gap: number;
  weight: number;
  priority_score: number;
  status: "met" | "developing" | "missing";
  why: string;
  next_step: string;
};

export type Analysis = {
  target_role_id: string;
  readiness_score: number;
  readiness_band: string;
  skills_met: number;
  skills_total: number;
  skill_results: SkillResult[];
  priority_skills: SkillResult[];
};

export type HistoryPoint = {
  label: string;
  score: number;
};

export type Dashboard = {
  profile: { name: string; program: string; is_demo: boolean };
  role: Role;
  analysis: Analysis;
  history: HistoryPoint[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new Error("The analysis service is not reachable. Start the Python API and try again.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `The analysis service returned ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export const getRoles = () => request<Role[]>("/api/roles");

export const getDashboard = (roleId: string) =>
  request<Dashboard>(`/api/dashboard/demo?role_id=${encodeURIComponent(roleId)}`);

export const analyze = (targetRoleId: string, skillRatings: Record<string, number>) =>
  request<Analysis>("/api/analysis", {
    method: "POST",
    body: JSON.stringify({ target_role_id: targetRoleId, skill_ratings: skillRatings }),
  });