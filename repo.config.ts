import { defineConfig } from "@workerstack/repo"

export default defineConfig({
	packs: ["agents", "docs"],
	link: { push: "allow" },
	agents: { hosts: ["claude", "codex", "antigravity", "grok", "cursor"] },
	workflow: "main",
})
