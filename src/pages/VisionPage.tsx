import { Link } from 'react-router-dom';
import './InfoPage.css';

export function VisionPage() {
  return (
    <div className="info-page container-pad">
      <div className="section-label">OUR VISION</div>
      <h1>Why we built this</h1>
      <p>
        Power cuts in India are a shared, daily experience — but a strangely private one. When your
        power goes out, the first thing you do is check your phone to ask a group chat "is it just
        my house?" There's rarely a good answer, and even less a way to know if the whole street,
        the whole locality, or the whole city is affected.
      </p>
      <p>
        powercuts.fyi exists to make that information collective instead of anecdotal. No signup, no
        app download, no calling a DISCOM helpline that never picks up — just a fast way to say "it's
        out here" and see if anyone nearby agrees.
      </p>
      <p>
        It's intentionally simple. There's no ML outage prediction, no integration with utility
        company APIs (yet), no guarantee of accuracy. It's crowdsourced, which means it's only as good
        as the people reporting — but that's still better than nothing, which is what most of us have
        today.
      </p>
      <Link to="/" className="btn btn-secondary">
        ← back home
      </Link>
    </div>
  );
}
