#!/usr/bin/env node
import { createCli } from "./cli.js";
import { AppError } from "./errors.js";

try {
  await createCli().parseAsync(process.argv);
} catch (error) {
  if (error instanceof AppError) {
    console.error(error.message);
    process.exitCode = error.exitCode;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
