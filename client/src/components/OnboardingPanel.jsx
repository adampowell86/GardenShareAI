import React, { useMemo } from "react";

const hints = {
  "add-have": "List at least one item you can share.",
  "add-need": "Capture what you want from neighbors.",
  "review-suggestions": "Open the Suggestions tab to see smart matches.",
  "start-trade": "Send or respond to a trade to test the flow.",
  "connect-social": "Link a social provider for quicker sign-in during tests.",
};

export default function OnboardingPanel({ onboarding }) {
  const steps = onboarding?.steps || [];
  const next = useMemo(() => steps.find((s) => !s.done), [steps]);

  if (!onboarding) return null;

  const progressValue = Math.min(100, onboarding.progress || 0);

  return (
    <div className="card onboarding-card">
      <div className="onboarding-top">
        <div>
          <div className="pill pill-ghost">
            {onboarding.completed ? "User test ready" : "User-testing prep"}
          </div>
          <h3 style={{ margin: "8px 0" }}>First-time guide</h3>
          <p className="muted" style={{ margin: 0 }}>
            Follow this checklist before inviting testers.
          </p>
        </div>
        <div className="progress-shell" aria-label="Onboarding progress">
          <div className="progress-meter">
            <div className="progress-fill" style={{ width: `${progressValue}%` }} />
          </div>
          <span className="progress-label">{progressValue}%</span>
        </div>
      </div>

      <ul className="list-plain onboarding-steps">
        {steps.map((step) => (
          <li key={step.key} className={step.done ? "done" : ""}>
            <span className="step-bullet">{step.done ? "*" : ""}</span>
            <div>
              <div className="step-title">{step.label}</div>
              {!step.done && hints[step.key] && (
                <div className="muted" style={{ fontSize: 13 }}>{hints[step.key]}</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {next && (
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Next up: {next.label}
        </div>
      )}
    </div>
  );
}
