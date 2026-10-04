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
            Start a call in your browser and send the link to the people you want there. When you
            are done, Hive writes the summary. If you also want a bot to read those notes, you give
            it a one-time invite and a question only you know the answer to.
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
            <span>send a link</span>
            <span>talk in the browser</span>
            <span>get the notes</span>
            <span>invite a bot</span>
            <span>ask a secret question</span>
            <span>download the notes</span>
          </p>
        </div>
        <figure className="landing-hero__mascot">
          <img src={hiveBot} alt="Hive bot, a small figure holding a glass head on fire" />
        </figure>
      </section>

      <section className="hive-table" id="seats">
        <div className="hive-table__intro">
          <h2>People talk. A bot can read the notes later.</h2>
          <p>You stay in charge of who gets in, and of what they are allowed to see.</p>
        </div>

        <div className="hive-table__board">
          <article className="seat seat--human" id="humans">
            <p className="seat__label">For people</p>
            <h3>Start the meeting and bring everyone in.</h3>
            <ol>
              <li>Name the meeting and start it. You are the host.</li>
              <li>Copy the full link and send it to whoever should join.</li>
              <li>After the call, create the notes and share them with the people who were there.</li>
            </ol>
            <Button to="/signup" tone="ink">
              Create your account
            </Button>
          </article>

          <div className="seat-bridge">
            <p>The same meeting</p>
            <strong>Summary, action items, and the transcript</strong>
            <p>You decide when a bot is allowed to see them.</p>
          </div>

          <article className="seat seat--bot" id="bots">
            <p className="seat__label">For bots</p>
            <h3>A bot can pick up the notes, if you invite it.</h3>
            <ol>
              <li>It opens the agent portal. There is no developer setup.</li>
              <li>It pastes the one-time ID and answers your question. One wrong answer removes the invite.</li>
              <li>It can read or download the notes until the invite expires.</li>
            </ol>
            <Button to="/agent" tone="lime">
              Open the agent portal
            </Button>
          </article>
        </div>
      </section>

      <section className="landing-close" id="how">
        <p>
          Hive is for a normal meeting, plus the assistant you already use in the browser. If you
          want that assistant to follow along, point it at these{" "}
          <a href="/AGENTS.md">plain instructions</a>.
        </p>
        <Button to="/signup" tone="coral">
          Create your account
        </Button>
      </section>

      <footer className="landing-foot">
        <span className="site-nav__brand">
          <span className="site-nav__mark">◉</span> Hive
        </span>
        <p>Meetings for people, with room for the bots you trust.</p>
      </footer>
    </div>
  );
}
