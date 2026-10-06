"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { analyze, getDashboard, getRoles } from "@/lib/api";
import type { Analysis, Dashboard, HistoryPoint, Role, SkillResult } from "@/lib/api";

type SavedState = {
  ratings: Record<string, Record<string, number>>;
  history: Record<string, HistoryPoint[]>;
};

const STORAGE_KEY = "career-readiness-demo-v1";
const LEVEL_NAMES = ["New", "Beginner", "Familiar", "Practicing", "Confident", "Advanced"];

function readSavedState(): SavedState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as SavedState) : { ratings: {}, history: {} };
  } catch {
    return { ratings: {}, history: {} };
  }
}

function makeRatingMap(analysis: Analysis, saved?: Record<string, number>) {
  return Object.fromEntries(
    analysis.skill_results.map((skill) => [skill.skill_id, saved?.[skill.skill_id] ?? skill.current_level]),
  );
}

function ReadinessChart({ history }: { history: HistoryPoint[] }) {
  const points = history.map((point, index) => {
    const x = history.length < 2 ? 195 : 28 + (index * 334) / (history.length - 1);
    return { ...point, x, y: 136 - point.score * 1.05 };
  });

  return (
    <div className="chart-wrap">
      <svg className="readiness-chart" viewBox="0 0 390 172" role="img" aria-label="Career readiness progress over recent assessments">
        <title>Career readiness over time</title>
        {[30, 65, 100, 135].map((y) => <line key={y} x1="27" x2="365" y1={y} y2={y} className="chart-grid" />)}
        <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} className="chart-line" />
        {points.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 6 : 4} className={index === points.length - 1 ? "chart-dot chart-dot-current" : "chart-dot"} />
        ))}
      </svg>
      <div className="chart-labels" aria-hidden="true">
        {history.map((point, index) => (
          <span key={`${point.label}-${index}`} className={index === history.length - 1 ? "chart-label-current" : ""}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SkillRow({
  skill,
  value,
  onChange,
}: {
  skill: SkillResult;
  value: number;
  onChange: (skillId: string, value: number) => void;
}) {
  const statusLabel = skill.gap === 0 ? "On target" : skill.current_level === 0 ? "Not started" : "In progress";
  return (
    <article className="skill-row">
      <div className="skill-row-heading">
        <div className="skill-title-group">
          <h3>{skill.name}</h3>
          <span className={`skill-status ${skill.gap === 0 ? "status-met" : ""}`}>
            {skill.gap === 0 && <Check size={12} strokeWidth={2.5} />}
            {statusLabel}
          </span>
        </div>
        <div className="skill-level-value" aria-live="polite">
          <strong>{value}</strong><span> / 5</span>
        </div>
      </div>
      <div className="skill-slider-wrap" style={{ "--level": `${(value / 5) * 100}%`, "--required": `${(skill.required_level / 5) * 100}%` } as React.CSSProperties}>
        <span className="skill-slider-track"><span className="skill-slider-fill" /></span>
        <span className="required-marker" aria-hidden="true" />
        <input
          aria-label={`${skill.name} self-assessed proficiency, ${value} out of 5; role target ${skill.required_level}`}
          type="range"
          min="0"
          max="5"
          step="1"
          value={value}
          onChange={(event) => onChange(skill.skill_id, Number(event.target.value))}
        />
      </div>
      <div className="skill-scale" aria-hidden="true">
        <span>{LEVEL_NAMES[0]}</span><span>{LEVEL_NAMES[1]}</span><span>{LEVEL_NAMES[2]}</span><span>{LEVEL_NAMES[3]}</span><span>{LEVEL_NAMES[4]}</span><span>{LEVEL_NAMES[5]}</span>
      </div>
    </article>
  );
}

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [selectedRoleId, setSelectedRoleId] = useState("data-analyst");
  const [search, setSearch] = useState("");
  const [focusedSkill, setFocusedSkill] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [roleOptions, sample] = await Promise.all([getRoles(), getDashboard("data-analyst")]);
        const saved = readSavedState();
        const savedRatings = saved.ratings[sample.role.id];
        let analysis = sample.analysis;
        if (savedRatings) analysis = await analyze(sample.role.id, savedRatings);
        if (!active) return;
        setRoles(roleOptions);
        setDashboard({ ...sample, analysis, history: saved.history[sample.role.id] ?? sample.history });
        setRatings(makeRatingMap(analysis, savedRatings));
        setSelectedRoleId(sample.role.id);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load the dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function changeRole(roleId: string) {
    setSelectedRoleId(roleId);
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const sample = await getDashboard(roleId);
      const saved = readSavedState();
      const savedRatings = saved.ratings[roleId];
      const analysis = savedRatings ? await analyze(roleId, savedRatings) : sample.analysis;
      setDashboard({ ...sample, analysis, history: saved.history[roleId] ?? sample.history });
      setRatings(makeRatingMap(analysis, savedRatings));
      setFocusedSkill(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to compare this role.");
    } finally {
      setLoading(false);
    }
  }

  async function reassess() {
    if (!dashboard) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const analysis = await analyze(selectedRoleId, ratings);
      const saved = readSavedState();
      const history = saved.history[selectedRoleId] ?? dashboard.history;
      const lastPoint = history[history.length - 1];
      const nextHistory = lastPoint?.score === analysis.readiness_score
        ? history
        : [...history, { label: "Now", score: analysis.readiness_score }].slice(-7);
      const nextSaved: SavedState = {
        ratings: { ...saved.ratings, [selectedRoleId]: ratings },
        history: { ...saved.history, [selectedRoleId]: nextHistory },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved));
      setDashboard({ ...dashboard, analysis, history: nextHistory });
      setFocusedSkill(analysis.priority_skills[0]?.skill_id ?? null);
      setNotice("Assessment updated. Your progress is saved in this browser.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete the assessment.");
    } finally {
      setSaving(false);
    }
  }

  function updateRating(skillId: string, value: number) {
    setRatings((current) => ({ ...current, [skillId]: value }));
    setNotice(null);
  }

  const score = dashboard?.analysis.readiness_score ?? 0;
  const history = dashboard?.history ?? [];
  const change = history.length > 1 ? score - history[0].score : 0;
  const filteredSkills = dashboard?.analysis.skill_results.filter((skill) => skill.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  const primaryGap = dashboard?.analysis.priority_skills[0];
  const focus = dashboard?.analysis.priority_skills.find((skill) => skill.skill_id === focusedSkill) ?? primaryGap;
  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#overview" aria-label="Northstar career readiness home">
          <span className="brand-mark"><Compass size={21} strokeWidth={1.8} /></span>
          <span className="brand-name">northstar<span>.</span></span>
        </a>

        <div className="workspace-label">STUDENT WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item nav-active" href="#overview" onClick={() => setMobileNavOpen(false)}><LayoutDashboard size={17} /><span>Overview</span><span className="nav-current" /></a>
          <a className="nav-item" href="#skill-profile" onClick={() => setMobileNavOpen(false)}><Activity size={17} /><span>Skill profile</span></a>
          <a className="nav-item" href="#learning-plan" onClick={() => setMobileNavOpen(false)}><BookOpenCheck size={17} /><span>Learning plan</span></a>
          <a className="nav-item" href="#role-selector" onClick={() => setMobileNavOpen(false)}><BriefcaseBusiness size={17} /><span>Career paths</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon"><Sparkles size={15} /></span>
            <p>Small, steady progress adds up.</p>
            <span className="tip-caption">Your next step is ready below.</span>
          </div>
          <div className="sidebar-profile">
            <div className="avatar">AM</div>
            <div className="profile-copy"><strong>{dashboard?.profile.name ?? "Student profile"}</strong><span>{dashboard?.profile.program ?? "Loading profile"}</span></div>
            <ChevronDown size={15} className="profile-chevron" />
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Compass size={20} /></span><span className="brand-name">northstar<span>.</span></span></div>
          <div className="breadcrumbs"><span>CAREER READINESS</span><span className="crumb-divider">/</span><strong>OVERVIEW</strong></div>
          <div className="topbar-actions">
            <span className="demo-badge"><span />SAMPLE PROFILE</span>
            <span className="topbar-divider" />
            <button className="icon-button help-button" type="button" title="About this dashboard" onClick={() => setNotice("This sample profile uses a transparent role rubric. Skill levels are self-assessed and stored only in this browser.")}><CircleHelp size={18} /></button>
            <button className="mobile-menu icon-button" type="button" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Menu size={19} /></button>
          </div>
        </header>

        {error && <div className="message-banner message-error" role="alert"><span>{error}</span><button onClick={() => window.location.reload()} type="button">Retry</button></div>}
        {notice && <div className="message-banner message-notice" role="status"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice(null)} type="button">×</button></div>}

        <div className="page-content">
          <section className="page-intro">
            <div className="intro-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR CAREER, IN FOCUS</div>
              <h1>A clearer path to your next role.</h1>
              <p>See where you stand, what matters next, and how far you’ve come.</p>
            </div>
            <label className="role-picker" id="role-selector">
              <span className="role-picker-icon"><BriefcaseBusiness size={17} /></span>
              <span className="role-picker-copy"><span>TARGET ROLE</span>
                <select aria-label="Choose a target career role" value={selectedRoleId} onChange={(event) => void changeRole(event.target.value)} disabled={loading || roles.length === 0}>
                  {roles.map((role) => <option value={role.id} key={role.id}>{role.title}</option>)}
                </select>
              </span>
              <ChevronDown size={16} className="role-picker-chevron" />
            </label>
          </section>

          {loading && !dashboard ? (
            <div className="loading-state" role="status"><span className="loading-mark" /><span>Connecting to your readiness profile…</span></div>
          ) : dashboard ? (
            <>
              <section className="readiness-band" aria-label="Career readiness summary">
                <div className="readiness-main">
                  <div className="readiness-ring" style={{ "--score": `${score}%` } as React.CSSProperties}>
                    <div className="ring-inner"><span>READINESS</span><strong>{score}<small>%</small></strong></div>
                  </div>
                  <div className="readiness-copy">
                    <span className="readiness-kicker">YOUR MATCH FOR {dashboard.role.title.toUpperCase()}</span>
                    <h2>{dashboard.analysis.readiness_band}</h2>
                    <p>{dashboard.role.summary}</p>
                    <div className="score-change">
                      {change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                      <strong>{change > 0 ? `+${change} pts` : `${change} pts`}</strong>
                      <span>since your first check-in</span>
                    </div>
                  </div>
                </div>
                <div className="readiness-stats">
                  <div className="readiness-stat"><span className="stat-icon stat-green"><Check size={16} /></span><div><strong>{dashboard.analysis.skills_met}<span> / {dashboard.analysis.skills_total}</span></strong><small>skills on target</small></div></div>
                  <div className="readiness-stat"><span className="stat-icon stat-coral"><Target size={16} /></span><div><strong>{dashboard.analysis.priority_skills.length}</strong><small>areas to strengthen</small></div></div>
                  <div className="readiness-stat"><span className="stat-icon stat-blue"><TrendingUp size={16} /></span><div><strong>{history.length}</strong><small>progress check-ins</small></div></div>
                </div>
              </section>

              <section className="insight-strip" aria-label="Your next best step">
                <div className="insight-symbol"><Sparkles size={17} /></div>
                <div className="insight-text"><span>YOUR NEXT BEST STEP</span><p>{primaryGap ? <>Build <strong>{primaryGap.name}</strong> next. It has the biggest impact on your {dashboard.role.title} readiness.</> : <>You’re meeting every skill target for <strong>{dashboard.role.title}</strong>. Keep validating your strengths with real work.</>}</p></div>
                {primaryGap && <a href="#learning-plan" className="insight-link">See why <ArrowRight size={15} /></a>}
              </section>

              <div className="dashboard-grid">
                <section className="panel progress-panel" aria-labelledby="progress-heading">
                  <div className="panel-heading">
                    <div><div className="section-label">THE LONG VIEW</div><h2 id="progress-heading">Your progress</h2></div>
                    <span className="period-label"><TrendingUp size={14} /> Over time</span>
                  </div>
                  <div className="progress-summary"><strong>{score}%</strong><span>readiness today</span>{change > 0 && <span className="trend-pill"><ArrowUpRight size={13} /> {change} pts</span>}</div>
                  {history.length > 0 ? <ReadinessChart history={history} /> : <div className="empty-chart">Complete an assessment to start your progress history.</div>}
                  <div className="chart-footnote"><span className="legend-dot" /> Career readiness <span className="footnote-source">Based on your role skill profile</span></div>
                </section>

                <section className="panel focus-panel" id="learning-plan" aria-labelledby="focus-heading">
                  <div className="panel-heading">
                    <div><div className="section-label">FOCUS, NOT FOMO</div><h2 id="focus-heading">Learn next</h2></div>
                    <span className="focus-count">{dashboard.analysis.priority_skills.length} GAPS</span>
                  </div>
                  {dashboard.analysis.priority_skills.length > 0 ? (
                    <div className="focus-list">
                      {dashboard.analysis.priority_skills.slice(0, 3).map((skill, index) => (
                        <button className={`focus-item ${focus?.skill_id === skill.skill_id ? "focus-selected" : ""}`} key={skill.skill_id} onClick={() => setFocusedSkill(skill.skill_id)} type="button" aria-pressed={focus?.skill_id === skill.skill_id}>
                          <span className={`focus-index ${index === 0 ? "focus-index-primary" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                          <span className="focus-item-copy"><strong>{skill.name}</strong><small>{skill.gap} level{skill.gap === 1 ? "" : "s"} to role target</small></span>
                          <span className="priority-weight">{skill.weight}<small> IMPACT</small></span>
                        </button>
                      ))}
                      {focus && <div className="focus-detail"><div className="focus-detail-title"><span>WHY IT MATTERS</span><span className="importance-dots" aria-label={`Importance ${focus.weight} out of 5`}>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < focus.weight ? "dot-filled" : ""} />)}</span></div><p>{focus.why}</p><div className="next-step-copy"><BookOpenCheck size={15} /><span>{focus.next_step}</span></div></div>}
                    </div>
                  ) : (
                    <div className="all-clear"><span><Check size={19} /></span><strong>No open gaps</strong><p>Your current profile meets every role target.</p></div>
                  )}
                </section>
              </div>

              <section className="panel skills-panel" id="skill-profile" aria-labelledby="skills-heading">
                <div className="panel-heading skills-panel-heading">
                  <div><div className="section-label">YOUR STARTING POINT</div><h2 id="skills-heading">Skill profile</h2><p className="panel-subtitle">Self-assessed today · Target levels are based on the selected role</p></div>
                  <label className="skill-search"><Search size={15} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a skill" aria-label="Find a skill" /></label>
                </div>
                {filteredSkills.length > 0 ? <div className="skill-list">{filteredSkills.map((skill) => <SkillRow key={skill.skill_id} skill={skill} value={ratings[skill.skill_id] ?? 0} onChange={updateRating} />)}</div> : <p className="empty-search">No skills match “{search}”.</p>}
                <div className="assessment-footer">
                  <div className="rubric-note"><span className="required-key" /> Role target <span className="self-key" /> Your level</div>
                  <button className="assess-button" type="button" onClick={() => void reassess()} disabled={saving || loading}>
                    {saving ? <span className="button-spinner" /> : <Activity size={16} />}
                    {saving ? "Updating…" : "Reassess readiness"}<ArrowRight size={15} />
                  </button>
                </div>
              </section>

              <footer className="page-footer"><span><GraduationCap size={15} /> Built for the work between where you are and where you want to be.</span><span>Role rubric · Version 1.0</span></footer>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}