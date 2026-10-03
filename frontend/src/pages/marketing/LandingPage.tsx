import { Button } from "../../components/ui/Button";
import { SiteNav } from "../../components/layout/SiteNav";
import hiveBot from "../../assets/hive-bot.png";
import "./LandingPage.css";

export function LandingPage() {
  return (
    <div className="landing">
      <SiteNav />

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <p className="landing-kicker">Hive</p>
          <h1>
            Meetings for
            <span> humans </span>
            and the
            <em> bots </em>
            they trust.
          </h1>
          <p className="landing-lede">
            People join with a link and talk. You hand a bot a one-time ID. It answers your secret
            question, then reads the summary and transcript as markdown — and the invite expires.
          </p>
          <div className="landing-hero__cta">
            <Button to="/signup" tone="coral">
              Start a meeting
            </Button>
            <Button to="/agent" tone="ghost">
              Agent portal
            </Button>
          </div>
          <p className="landing-ribbon" aria-hidden>
            <span>share link</span>
            <span>live room</span>
            <span>summary</span>
            <span>one-time bot ID</span>
            <span>secret question</span>
            <span>markdown notes</span>
          </p>
        </div>
        <figure className="landing-hero__mascot">
          <img src={hiveBot} alt="Hive bot: a small figure holding a glass head on fire" />
        </figure>
      </section>

      <section className="hive-table" id="seats">
        <div className="hive-table__intro">
          <h2>Two seats. One memory.</h2>
          <p>The room is for people. The notes are what a bot is allowed to take.</p>
        </div>

        <div className="hive-table__board">
          <article className="seat seat--human" id="humans">
            <p className="seat__label">For humans</p>
            <h3>Show up and run the meeting.</h3>
            <ol>
              <li>Create a room. You own it.</li>
              <li>Send one link. Camera and mic in the browser.</li>
              <li>End the call, summarize, then share notes with the people who joined.</li>
            </ol>
            <Button to="/signup" tone="ink">
              Create a room
            </Button>
          </article>

          <div className="seat-bridge">
            <p>Same meeting</p>
            <strong>Summary, actions, transcript</strong>
            <p>Humans decide when a bot may see it.</p>
          </div>

          <article className="seat seat--bot" id="bots">
            <p className="seat__label">For bots</p>
            <h3>Arrive, prove it, leave with notes.</h3>
            <ol>
              <li>Open the agent portal. No developer API required.</li>
              <li>Paste the one-time ID. Answer the secret — one wrong try deletes the invite.</li>
              <li>Read or download the meeting as markdown before the account expires.</li>
            </ol>
            <Button to="/agent" tone="lime">
              Open the agent portal
            </Button>
          </article>
        </div>
      </section>

      <section className="landing-close" id="how">
        <p>
          Built for the way work actually happens now: a person in the call, and a Dot, Grok, or
          other browser agent that can follow <a href="/AGENTS.md">plain instructions</a>.
        </p>
        <Button to="/signup" tone="coral">
          Claim the human seat
        </Button>
      </section>

      <footer className="landing-foot">
        <span className="site-nav__brand">
          <span className="site-nav__mark">◉</span> Hive
        </span>
        <p>Meetings for humans and bots.</p>
      </footer>
    </div>
  );
}
