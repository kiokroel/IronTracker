from __future__ import annotations

import json
import re
from pathlib import Path


def _strip_json_comments(text: str) -> str:
    """Remove single-line and multi-line comments from JSON string."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    text = re.sub(r"//.*", "", text)
    return text


def test_package_json_structure() -> None:
    """Verify frontend/package.json exists, contains required dependencies and scripts."""
    pkg_path = Path("frontend/package.json")
    assert pkg_path.is_file(), "frontend/package.json must exist"

    data = json.loads(pkg_path.read_text(encoding="utf-8"))
    assert data["name"] == "iron-frontend"

    # Required scripts
    scripts = data.get("scripts", {})
    assert "dev" in scripts
    assert "build" in scripts
    assert "lint" in scripts
    assert "preview" in scripts

    # Required dependencies
    deps = data.get("dependencies", {})
    required_deps = [
        "react",
        "react-dom",
        "react-router-dom",
        "zustand",
        "axios",
        "lucide-react",
        "clsx",
        "tailwind-merge",
    ]
    for dep in required_deps:
        assert dep in deps, f"Missing dependency: {dep}"

    # Required devDependencies
    dev_deps = data.get("devDependencies", {})
    required_dev_deps = [
        "@types/react",
        "@types/react-dom",
        "@vitejs/plugin-react",
        "autoprefixer",
        "postcss",
        "tailwindcss",
        "typescript",
        "vite",
    ]
    for dev_dep in required_dev_deps:
        assert dev_dep in dev_deps, f"Missing devDependency: {dev_dep}"


def test_tsconfig_strictness() -> None:
    """Verify tsconfig.json has strict typing, noImplicitAny, and path alias @/*."""
    tsconfig_path = Path("frontend/tsconfig.json")
    assert tsconfig_path.is_file(), "frontend/tsconfig.json must exist"

    cleaned_json = _strip_json_comments(tsconfig_path.read_text(encoding="utf-8"))
    data = json.loads(cleaned_json)
    options = data.get("compilerOptions", {})

    assert options.get("strict") is True, "strict mode must be enabled"
    assert options.get("noImplicitAny") is True, "noImplicitAny must be enabled"
    assert "@/*" in options.get("paths", {}), "path alias @/* must be configured"

    node_cfg_path = Path("frontend/tsconfig.node.json")
    assert node_cfg_path.is_file(), "frontend/tsconfig.node.json must exist"


def test_vite_and_tailwind_configs() -> None:
    """Verify vite.config.ts, tailwind.config.js, postcss.config.js and index.html exist."""
    vite_cfg = Path("frontend/vite.config.ts").read_text(encoding="utf-8")
    assert "@vitejs/plugin-react" in vite_cfg
    assert "resolve" in vite_cfg
    assert "'@'" in vite_cfg or '"@"' in vite_cfg

    tailwind_cfg = Path("frontend/tailwind.config.js").read_text(encoding="utf-8")
    assert "iron" in tailwind_cfg or "zinc" in tailwind_cfg
    assert "darkMode" in tailwind_cfg

    postcss_cfg = Path("frontend/postcss.config.js").read_text(encoding="utf-8")
    assert "tailwindcss" in postcss_cfg
    assert "autoprefixer" in postcss_cfg

    index_html = Path("frontend/index.html").read_text(encoding="utf-8")
    assert "IronTracker" in index_html
    assert 'class="dark"' in index_html or "dark" in index_html
    assert "viewport" in index_html


def test_src_modular_structure() -> None:
    """Verify frontend/src/ has all required directories and entry files."""
    src = Path("frontend/src")
    assert src.is_dir()

    expected_dirs = ["types", "api", "store", "components/ui", "layouts", "pages", "utils"]
    for dir_name in expected_dirs:
        assert (src / dir_name).is_dir(), f"Missing directory: {dir_name}"

    assert (src / "App.tsx").is_file(), "App.tsx must exist"
    assert (src / "main.tsx").is_file(), "main.tsx must exist"
    assert (src / "index.css").is_file(), "index.css must exist"


def test_types_contracts() -> None:
    """Verify TypeScript types mirror Pydantic models with Discriminated Unions."""
    auth_ts = Path("frontend/src/types/auth.ts").read_text(encoding="utf-8")
    assert "interface User" in auth_ts
    assert "interface LoginRequest" in auth_ts
    assert "interface RegisterRequest" in auth_ts
    assert "interface TokenResponse" in auth_ts

    workout_ts = Path("frontend/src/types/workout.ts").read_text(encoding="utf-8")
    assert "exercise_type" in workout_ts
    assert "BenchPressMetrics" in workout_ts
    assert "SquatMetrics" in workout_ts
    assert "DeadliftMetrics" in workout_ts
    assert "WorkoutMetrics =" in workout_ts
    assert "interface Workout" in workout_ts
    assert "interface WorkoutCreate" in workout_ts

    leaderboard_ts = Path("frontend/src/types/leaderboard.ts").read_text(encoding="utf-8")
    assert "interface LeaderboardEntry" in leaderboard_ts
    assert "interface LeaderboardResponse" in leaderboard_ts
    assert "interface UserRankResponse" in leaderboard_ts


def test_api_client_and_services() -> None:
    """Verify api/client.ts uses Bearer JWT interceptor and services exist."""
    client_ts = Path("frontend/src/api/client.ts").read_text(encoding="utf-8")
    assert "apiClient" in client_ts
    assert "Authorization" in client_ts
    assert "Bearer" in client_ts
    assert "useAuthStore" in client_ts
    assert "401" in client_ts

    auth_api = Path("frontend/src/api/auth.ts").read_text(encoding="utf-8")
    assert "/users/login" in auth_api
    assert "/users/register" in auth_api
    assert "/users/me" in auth_api

    workouts_api = Path("frontend/src/api/workouts.ts").read_text(encoding="utf-8")
    assert "/workouts" in workouts_api

    leaderboard_api = Path("frontend/src/api/leaderboard.ts").read_text(encoding="utf-8")
    assert "/leaderboard" in leaderboard_api


def test_auth_store() -> None:
    """Verify store/useAuthStore.ts has localStorage persist and required methods."""
    store_ts = Path("frontend/src/store/useAuthStore.ts").read_text(encoding="utf-8")
    assert "useAuthStore" in store_ts
    assert "persist" in store_ts
    assert "localStorage" in store_ts
    assert "login" in store_ts
    assert "register" in store_ts
    assert "logout" in store_ts
    assert "setUser" in store_ts
    assert "setToken" in store_ts


def test_ui_components() -> None:
    """Verify components/ui/ contains Button, Input, Card, Badge, Loader, Modal."""
    ui_dir = Path("frontend/src/components/ui")
    expected_components = [
        "Button.tsx",
        "Input.tsx",
        "Card.tsx",
        "Badge.tsx",
        "Loader.tsx",
        "Modal.tsx",
    ]
    for comp in expected_components:
        assert (ui_dir / comp).is_file(), f"Missing UI component: {comp}"


def test_layouts_and_pages() -> None:
    """Verify layouts and pages exist."""
    layouts_dir = Path("frontend/src/layouts")
    for layout in ["MainLayout.tsx", "Navbar.tsx", "Sidebar.tsx", "ProtectedRoute.tsx"]:
        assert (layouts_dir / layout).is_file(), f"Missing layout: {layout}"

    pages_dir = Path("frontend/src/pages")
    expected_pages = [
        "LoginPage.tsx",
        "RegisterPage.tsx",
        "DashboardPage.tsx",
        "WorkoutsPage.tsx",
        "LeaderboardPage.tsx",
        "NotFoundPage.tsx",
    ]
    for page in expected_pages:
        assert (pages_dir / page).is_file(), f"Missing page: {page}"


def test_frontend_production_build_exists() -> None:
    """Verify production build artifacts are present in frontend/dist."""
    dist = Path("frontend/dist")
    assert dist.is_dir(), "frontend/dist must exist"
    assert (dist / "index.html").is_file(), "frontend/dist/index.html must exist"
