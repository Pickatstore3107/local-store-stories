import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

export const CONSENT_VERSION = readFileSync("src/lib/consent.ts", "utf8").match(
  /CONSENT_VERSION = "([^"]+)"/,
)![1];

export function startRulesEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: "demo-local-store-stories",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
}
