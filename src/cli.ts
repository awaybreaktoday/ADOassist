import { Command } from "commander";

export function createCli(): Command {
  const program = new Command();

  program
    .name("ado-assist")
    .description("Draft and post AI-assisted Azure DevOps PR review comments")
    .version("0.1.0");

  program.command("review").argument("<pr-url>").action(() => {
    throw new Error("review command is not implemented yet");
  });

  program.command("post").argument("<review-file>").action(() => {
    throw new Error("post command is not implemented yet");
  });

  return program;
}
