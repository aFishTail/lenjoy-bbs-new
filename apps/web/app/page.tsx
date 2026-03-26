export default function HomePage() {
  return (
    <main className="container">
      <h1>Lenjoy BBS</h1>
      <p>Web app is running.</p>
      <ul>
        <li>
          API health: <code>/api/v1/health</code>
        </li>
        <li>
          API docs: <code>/swagger-ui.html</code>
        </li>
      </ul>
    </main>
  );
}
