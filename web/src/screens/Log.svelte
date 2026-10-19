<main>
  <div class="head">$ git log --oneline</div>
  <h1>log</h1>
  <div class="card">
    <span class="dot"></span>
    <div>
      <b>coming in v0.2</b>
      <p>One trunk, a dot for each branch each day, folded days and branch filters. Your commits are saved now and show here then.</p>
    </div>
  </div>
</main>

<style>
  main { padding: calc(14px + env(safe-area-inset-top)) 20px 120px; }
  .head { font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin-top: 6px; }
  h1 { font-family: var(--font-display); font-weight: 300; font-size: 40px; letter-spacing: -.03em; margin-bottom: 16px; }
  .card { display: grid; grid-template-columns: 16px 1fr; gap: 14px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--edge); border-radius: 22px; padding: 18px; font-family: var(--font-mono); }
  .dot { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 2px var(--ok); margin-top: 2px; }
  b { font-weight: 500; font-size: 14px; }
  p { color: var(--muted); font-size: 12px; line-height: 1.55; margin-top: 6px; }
</style>
