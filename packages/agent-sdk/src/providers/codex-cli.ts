import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { GenerateOptions, LanguageModel } from "../model.js";

const execFileAsync = promisify(execFile);

class CodexCli implements LanguageModel {
  async generate({ prompt, instructions }: GenerateOptions) {
    const execution = execFileAsync(
      "codex",
      [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "-",
      ],
      {
        timeout: 120 * 1000, // 20 seconds timeout
      },
    );

    // This is important to ensure that the child process doesn't hang if it expects input. Since we're not providing any input, we close the stdin stream.
    execution.child.stdin?.end(`${instructions}\n\n${prompt}`, "utf8");
    const { stderr, stdout } = await execution;

    if (stderr) {
      throw new Error(`Codex CLI error: ${stderr}`);
    }

    return stdout.trim();
  }
}

export function codexCli(): LanguageModel {
  return new CodexCli();
}
