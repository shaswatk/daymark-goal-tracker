# Daymark prototype

A daily-goal tracker with a browser-only demo mode and optional Supabase-backed
accounts and persistence.

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

## Turn on real data

1. Create a Supabase project.
2. In its SQL Editor, run [`supabase-schema.sql`](supabase-schema.sql).
3. In **Authentication → URL Configuration**, add:
   - Site URL: `https://shaswatk.github.io/daymark-goal-tracker/`
   - Redirect URL: `https://shaswatk.github.io/daymark-goal-tracker/`
4. Copy the **Project URL** and **Publishable key** from Project Settings → API
   into `config.js`.
5. Commit and push `config.js`:

```sh
git add config.js supabase-schema.sql README.md index.html app.js styles.css
git commit -m "Add Supabase persistence"
git push
```

The publishable key may be in `config.js`; security comes from the Row Level
Security rules in the schema. Do not add a secret/service-role key to the site.

Users can create their own recurring goals and mark them daily. Each check-in is
stored as one row per goal and date. The current Circle UI stays a demo until
an invitation flow and member-visibility preferences are added.
