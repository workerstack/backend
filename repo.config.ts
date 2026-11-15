import { defineConfig } from "@workerstack/repo"

export default defineConfig({
	packs: ["agents", "docs"],
	agents: { hosts: ["claude", "codex", "antigravity", "grok", "cursor"] },
	workflow: "main",
})
