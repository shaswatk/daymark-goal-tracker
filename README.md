# Daymark prototype

A lightweight, browser-only daily-goal tracker.

Open `index.html` in a browser, or run:

```sh
cd /Users/rental/daily-goals
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

It demonstrates the core product:

- Mark daily goals complete
- See weekly and monthly progress
- View a shared accountability leaderboard

To make it multi-user in production, add authentication plus a database (for example, Supabase or Firebase). Each daily check-in should be stored as a record keyed by `user_id`, `goal_id`, and date.
