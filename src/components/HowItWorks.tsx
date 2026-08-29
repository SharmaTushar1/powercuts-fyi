import { Link } from 'react-router-dom';
import './HowItWorks.css';

const steps = [
  {
    n: '1',
    title: 'Report',
    body: "Drop your location (detected automatically, or a pincode) and say if it's a planned or unexpected cut. Takes under 10 seconds.",
  },
  {
    n: '2',
    title: 'Confirm',
    body: 'Anyone nearby can say still out or power back. The area status follows recent consensus, not a single click.',
  },
  {
    n: '3',
    title: 'Track',
    body: 'The report gets a shareable permalink with a live timer, so you can send it instead of explaining it.',
  },
];

export function HowItWorks() {
  return (
    <section className="how-section container-pad" id="how">
      <div className="section-label">05 — HOW IT WORKS</div>
      <div className="how-heading">Report, confirm, resolve — on a patchy connection</div>

      <div className="how-steps">
        {steps.map((s) => (
          <div className="how-step" key={s.n}>
            <div className="how-step-number mono">{s.n}</div>
            <div className="how-step-title">{s.title}</div>
            <div className="how-step-body">{s.body}</div>
          </div>
        ))}
      </div>

      <Link to="/report" className="btn btn-primary how-cta">
        Report a cut →
      </Link>
    </section>
  );
}
