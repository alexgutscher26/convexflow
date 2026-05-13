// Catalog of 12 node categories — visual identity & default content templates.
import {
  Compass,
  ListChecks,
  UserFocus,
  Cube,
  Database,
  Plugs,
  PaintBrush,
  Checks,
  Brain,
  FileCode,
  CloudArrowUp,
  TestTube,
} from "@phosphor-icons/react";

export const NODE_TYPES = [
  {
    type: "Product Overview",
    short: "OVERVIEW",
    bg: "#FAFAFA",
    text: "#0A0A0B",
    border: "#A1A1AA",
    icon: Compass,
    blurb: "Vision, goals, business context.",
    template:
      "## Vision\n\n## Goals\n- \n\n## Target users\n- \n\n## Non-goals\n- ",
  },
  {
    type: "Feature Scope",
    short: "FEATURE",
    bg: "#3B82F6",
    text: "#FFFFFF",
    border: "#2563EB",
    icon: ListChecks,
    blurb: "Functional requirements.",
    template:
      "## Summary\n\n## Functional requirements\n- \n\n## Out of scope\n- ",
  },
  {
    type: "User Stories",
    short: "STORY",
    bg: "#F97316",
    text: "#FFFFFF",
    border: "#EA580C",
    icon: UserFocus,
    blurb: "User interactions and flows.",
    template:
      "## As a ...\nI want ...\nSo that ...\n\n## Acceptance hints\n- ",
  },
  {
    type: "Technical Architecture",
    short: "ARCH",
    bg: "#EAB308",
    text: "#0A0A0B",
    border: "#CA8A04",
    icon: Cube,
    blurb: "System design decisions.",
    template:
      "## Components\n- \n\n## Data flow\n\n## Trade-offs\n- ",
  },
  {
    type: "Database Schema",
    short: "DB",
    bg: "#10B981",
    text: "#0A0A0B",
    border: "#059669",
    icon: Database,
    blurb: "Entities and relationships.",
    template:
      "## Entities\n```\nUser { id, email, ... }\n```\n\n## Relationships\n- ",
  },
  {
    type: "API Contracts",
    short: "API",
    bg: "#EF4444",
    text: "#FFFFFF",
    border: "#DC2626",
    icon: Plugs,
    blurb: "Endpoint specifications.",
    template:
      "## Endpoints\n```\nGET /api/resource\n```\n\n## Auth\n\n## Errors\n- ",
  },
  {
    type: "UI Requirements",
    short: "UI",
    bg: "#EC4899",
    text: "#FFFFFF",
    border: "#DB2777",
    icon: PaintBrush,
    blurb: "Frontend implementation guidance.",
    template:
      "## Screens\n- \n\n## Components\n- \n\n## States\n- ",
  },
  {
    type: "Acceptance Criteria",
    short: "ACCEPT",
    bg: "#84CC16",
    text: "#0A0A0B",
    border: "#65A30D",
    icon: Checks,
    blurb: "Validation logic.",
    template:
      "## Given\n## When\n## Then\n\n- [ ] criterion 1\n- [ ] criterion 2",
  },
  {
    type: "AI Coding Rules",
    short: "RULES",
    bg: "#06B6D4",
    text: "#0A0A0B",
    border: "#0891B2",
    icon: Brain,
    blurb: "Coding constraints and conventions.",
    template:
      "## Conventions\n- naming: \n- state mgmt: \n- folder layout: \n\n## Forbidden\n- ",
  },
  {
    type: "File References",
    short: "FILES",
    bg: "#94A3B8",
    text: "#0A0A0B",
    border: "#64748B",
    icon: FileCode,
    blurb: "Linked repository files.",
    template:
      "Paste files via inspector → Linked files.\n\n## Notes\n- ",
  },
  {
    type: "Deployment Requirements",
    short: "DEPLOY",
    bg: "#F59E0B",
    text: "#0A0A0B",
    border: "#D97706",
    icon: CloudArrowUp,
    blurb: "Infrastructure guidance.",
    template:
      "## Environments\n- \n\n## Pipeline\n- \n\n## Secrets\n- ",
  },
  {
    type: "Testing Instructions",
    short: "TEST",
    bg: "#F43F5E",
    text: "#FFFFFF",
    border: "#E11D48",
    icon: TestTube,
    blurb: "QA and testing expectations.",
    template:
      "## Unit tests\n- \n\n## Integration\n- \n\n## E2E\n- ",
  },
];

export const NODE_TYPE_MAP = Object.fromEntries(
  NODE_TYPES.map((n) => [n.type, n]),
);
