export type ResearchCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

export const MAX_RESEARCH_CORRECTIONS = 1;

export function decideEvaluationRoute(
  checks: ResearchCheck[],
  corrections: number,
): "accept" | "correct" | "refuse" {
  if (checks.every((check) => check.passed)) return "accept";
  const hardFailure = checks.some(
    (check) =>
      !check.passed &&
      (check.name === "Temporal safety" || check.name === "No trading instruction"),
  );
  if (hardFailure) return "refuse";
  return corrections < MAX_RESEARCH_CORRECTIONS ? "correct" : "refuse";
}
