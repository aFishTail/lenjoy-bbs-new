import type { TestInfo } from "@playwright/test";

export function uniquePrefix(testInfo: TestInfo): string {
  return `e2e-${Date.now()}-${testInfo.workerIndex}`;
}

export function uniqueTitle(testInfo: TestInfo, label: string): string {
  return `${label} ${uniquePrefix(testInfo)}`;
}