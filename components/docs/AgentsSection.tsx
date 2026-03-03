import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  Table,
  BulletList,
  NumberedList,
  Callout,
} from "./DocSection";

export function AgentsSection() {
  return (
    <>
      <Heading>Agents</Heading>
      <Paragraph>
        ClawPort ships with a default agent registry at{" "}
        <InlineCode>lib/agents.json</InlineCode>. This is a working example
        showing a full team hierarchy. It works out of the box if your OpenClaw
        workspace has matching agent SOUL files.
      </Paragraph>

      <SubHeading>Using Your Own Agents</SubHeading>
      <Paragraph>
        To define your own agent team, create a file at:
      </Paragraph>
      <CodeBlock>{`$WORKSPACE_PATH/clawport/agents.json`}</CodeBlock>
      <Paragraph>
        ClawPort checks for this file on every request. If it exists, it
        replaces the bundled registry entirely. If it's missing or contains
        invalid JSON, the bundled default is used as a fallback.
      </Paragraph>

      <SubHeading>Agent Entry Format</SubHeading>
      <CodeBlock title="agents.json">
        {`[
  {
    "id": "my-agent",
    "name": "My Agent",
    "title": "What this agent does",
    "reportsTo": null,
    "directReports": [],
    "soulPath": "agents/my-agent/SOUL.md",
    "voiceId": null,
    "color": "#06b6d4",
    "emoji": "\u{1F916}",
    "tools": ["read", "write"],
    "memoryPath": null,
    "description": "One-liner about this agent."
  }
]`}
      </CodeBlock>

      <SubHeading>Field Reference</SubHeading>
      <Table
        headers={["Field", "Type", "Description"]}
        rows={[
          [
            <InlineCode key="id">id</InlineCode>,
            "string",
            'Unique slug for the agent (e.g., "vera")',
          ],
          [
            <InlineCode key="name">name</InlineCode>,
            "string",
            'Display name (e.g., "VERA")',
          ],
          [
            <InlineCode key="title">title</InlineCode>,
            "string",
            'Role title (e.g., "Chief Strategy Officer")',
          ],
          [
            <InlineCode key="rt">reportsTo</InlineCode>,
            "string | null",
            "Parent agent id for the org chart. null for the root.",
          ],
          [
            <InlineCode key="dr">directReports</InlineCode>,
            "string[]",
            "Array of child agent ids",
          ],
          [
            <InlineCode key="sp">soulPath</InlineCode>,
            "string | null",
            "Path to the agent's SOUL.md, relative to WORKSPACE_PATH",
          ],
          [
            <InlineCode key="vi">voiceId</InlineCode>,
            "string | null",
            "ElevenLabs voice ID (requires ELEVENLABS_API_KEY)",
          ],
          [
            <InlineCode key="co">color</InlineCode>,
            "string",
            "Hex color for the agent's node in the Org Map",
          ],
          [
            <InlineCode key="em">emoji</InlineCode>,
            "string",
            "Emoji shown as the agent's avatar",
          ],
          [
            <InlineCode key="to">tools</InlineCode>,
            "string[]",
            "List of tools this agent has access to",
          ],
          [
            <InlineCode key="mp">memoryPath</InlineCode>,
            "string | null",
            "Path to agent-specific memory (relative to WORKSPACE_PATH)",
          ],
          [
            <InlineCode key="de">description</InlineCode>,
            "string",
            "One-line description shown in the UI",
          ],
        ]}
      />

      <SubHeading>Hierarchy Rules</SubHeading>
      <BulletList
        items={[
          <>
            Exactly one agent should have{" "}
            <InlineCode>{"\"reportsTo\": null"}</InlineCode> -- this is your
            root/orchestrator node.
          </>,
          <>
            <InlineCode>directReports</InlineCode> should be consistent with{" "}
            <InlineCode>reportsTo</InlineCode>. If agent B reports to agent A,
            then A's directReports should include B's id.
          </>,
          "The Org Map uses these relationships to build the org chart automatically.",
        ]}
      />

      <SubHeading>Example: Minimal Two-Agent Setup</SubHeading>
      <CodeBlock title="agents.json">
        {`[
  {
    "id": "boss",
    "name": "Boss",
    "title": "Orchestrator",
    "reportsTo": null,
    "directReports": ["worker"],
    "soulPath": "SOUL.md",
    "voiceId": null,
    "color": "#f5c518",
    "emoji": "\u{1F451}",
    "tools": ["read", "write", "exec", "message"],
    "memoryPath": null,
    "description": "Top-level orchestrator."
  },
  {
    "id": "worker",
    "name": "Worker",
    "title": "Task Runner",
    "reportsTo": "boss",
    "directReports": [],
    "soulPath": "agents/worker/SOUL.md",
    "voiceId": null,
    "color": "#22c55e",
    "emoji": "\u{2699}\u{FE0F}",
    "tools": ["read", "write"],
    "memoryPath": null,
    "description": "Handles assigned tasks."
  }
]`}
      </CodeBlock>

      <SubHeading>Registry Resolution</SubHeading>
      <NumberedList
        items={[
          <>
            <InlineCode>loadRegistry()</InlineCode> checks{" "}
            <InlineCode>$WORKSPACE_PATH/clawport/agents.json</InlineCode> first
            (user override).
          </>,
          <>
            Falls back to bundled <InlineCode>lib/agents.json</InlineCode> if
            the workspace file is missing or has invalid JSON.
          </>,
          <>
            <InlineCode>lib/agents.ts</InlineCode> merges in SOUL.md content
            from each agent's <InlineCode>soulPath</InlineCode>.
          </>,
          "The result is the full agent list used by all pages.",
        ]}
      />

      <Callout type="tip">
        You can add a new agent without editing any source code -- just update
        your workspace <InlineCode>agents.json</InlineCode>. The agent will
        automatically appear in the Org Map, Chat, and Detail pages.
      </Callout>

      <SubHeading>Agent Display Overrides</SubHeading>
      <Paragraph>
        Each agent can have per-agent emoji and/or profile image overrides via
        the Settings page. These are stored in{" "}
        <InlineCode>ClawPortSettings.agentOverrides</InlineCode> keyed by agent ID.
        The <InlineCode>getAgentDisplay()</InlineCode> function resolves the
        effective visual for each agent, considering overrides.
      </Paragraph>
    </>
  );
}
