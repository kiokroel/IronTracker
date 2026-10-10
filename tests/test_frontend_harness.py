from __future__ import annotations

import json
from pathlib import Path


def test_plugin_json_validity() -> None:
    """Verify plugin.json exists, is valid JSON, and lists correct metadata."""
    plugin_path = Path(".agents/plugins/irontracker-plugin/plugin.json")
    assert plugin_path.is_file(), "plugin.json must exist"

    data = json.loads(plugin_path.read_text(encoding="utf-8"))
    assert data["name"] == "irontracker-plugin"
    assert "iron-frontend" in data["description"]
    assert data["version"] == "1.1.0"


def test_iron_frontend_agent_json_structure() -> None:
    """Verify iron-frontend agent.json exists and adheres to harness standards."""
    agent_path = Path(".agents/plugins/irontracker-plugin/agents/iron-frontend/agent.json")
    assert agent_path.is_file(), "iron-frontend agent.json must exist"

    data = json.loads(agent_path.read_text(encoding="utf-8"))
    assert data["name"] == "iron-frontend"
    assert "description" in data and len(data["description"]) > 20
    assert data["hidden"] is False

    custom_agent = data["config"]["customAgent"]
    tool_names = custom_agent["toolNames"]
    expected_tools = {
        "view_file",
        "write_to_file",
        "replace_file_content",
        "run_command",
        "manage_task",
    }
    assert expected_tools.issubset(set(tool_names)), f"Missing required tools in {tool_names}"

    system_sections = custom_agent["systemPromptSections"]
    assert len(system_sections) >= 1
    content = system_sections[0]["content"]
    assert "React 18+" in content
    assert "TypeScript" in content
    assert "Tailwind CSS" in content
    assert "Zustand" in content
    assert "Vite" in content
    assert "Recharts" in content


def test_frontend_developer_skill_file() -> None:
    """Verify frontend-developer skill exists and contains standard guidance."""
    skill_path = Path(".agents/plugins/irontracker-plugin/skills/frontend-developer/SKILL.md")
    assert skill_path.is_file(), "frontend-developer SKILL.md must exist"

    content = skill_path.read_text(encoding="utf-8")
    assert "name: frontend-developer" in content
    assert "React 18+" in content
    assert "Discriminated Unions" in content
    assert "Zustand" in content
    assert "calculateOneRepMax" in content
    assert "Multi-Stage" in content


def test_agents_guidelines_updated() -> None:
    """Verify AGENTS.md includes iron-frontend and frontend-developer entries."""
    agents_md = Path("AGENTS.md").read_text(encoding="utf-8")
    assert "iron-frontend" in agents_md
    assert "frontend-developer" in agents_md
    assert "Разработчик [Backend/Frontend]" in agents_md


def test_orchestrator_skill_updated() -> None:
    """Verify iron-orchestrator skill includes iron-frontend in team roster."""
    orch_path = Path(".agents/plugins/irontracker-plugin/skills/iron-orchestrator/SKILL.md")
    content = orch_path.read_text(encoding="utf-8")
    assert "`iron-frontend`" in content
    assert "Lead Frontend Engineer" in content
    assert "Вариант Б: Задача фронтенда (`iron-frontend`)" in content
