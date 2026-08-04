import { promisify } from "node:util";
import { exec as execCallback } from "node:child_process";
import type { Tool } from "./agent.js";

const exec = promisify(execCallback);

export const weatherTool: Tool = {
  name: "fetchWeather",
  description: "Tool that returns weather data of given input string",
  async executor(city: string) {
    const result = await fetch(
      `https://wttr.in/${city.toLowerCase()}?format=%C+%t`,
    ).then((res) => res.text());

    return JSON.stringify({ city, weather: result });
  },
};

export const cliAccessTool: Tool = {
  name: "cliAccess",
  description:
    "Access to CLI commands using PowerShell. So make sure to add command that complies with Windows Powershell to avoid misformatting",
  async executor(command: string) {
    const { stderr, stdout } = await exec(command, { shell: "powershell.exe" }); // Set shell as powershell.exe as cmd.exe adds quotes (") at the start and end of file
    if (stderr) {
      return `Something went wrong. Reason -> ${stderr}`;
    }

    return stdout;
  },
};
