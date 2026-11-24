# Knee Rebuild

A phone web app for a 12-week knee strengthening plan. It shows the day's session, demonstrates each exercise with a diagram, written cues and a YouTube link, and logs sets, reps, weight, pain and quick notes. Logs save on the phone first and sync to Supabase when you're signed in.

Open it in Safari on an iPhone: **https://lyhjeremy.github.io/knee-rebuild/**

## Screens

- **Today**: the scheduled session (Home A, Home B, Home C or a gym day), each exercise in order with a done/partial/skipped status. You can swap the session for a day, page back to fill in a missed day, and log easy indoor cycling on any day.
- **Exercise**: an animated diagram that moves at the exercise's tempo (tap to pause), the key positions below it, human demos where available (see below), step-by-step cues, a demo link (YouTube search by default, or your own link), and the log: a row per set with a stepper, a kg field for gym lifts, a tick, and a hold timer for timed exercises. Ticking a set starts the rest timer (60 s at home, 90 s at the gym by default). Pain 0 to 10 and the note chips are optional.
- **History**: this week's sessions done, average pain and cycling minutes; the last 8 weeks as a table; per-exercise charts (top set weight for gym lifts, longest hold for timed work, total reps otherwise) and every log.
- **Plan**: current week and phase, this week's schedule, the six milestones before running returns, the phases and the rules.
- **Sync, backup and timer** (from Plan): Supabase sign-in, rest times, JSON backup export and import, reset.

A "Ready to progress" tag appears when the last two attempts at an exercise were clean: every prescribed set done at the top of the target, pain 3 or lower, and no note such as "Form broke down" or "Knee discomfort".

## Exercise media

- **Animated diagrams** for every exercise, drawn by the app itself, so they work offline. Three holds (plank, single-leg balance, quad stretch) show one still position.
- **3D-figure GIFs** for 15 exercises from [ExerciseDB](https://exercisedb.dev/)'s free API. They load from ExerciseDB's server when you're online and aren't stored in this repo, since ExerciseDB doesn't publish reuse terms for them. Where the GIF shows a variant (machine abduction, barbell glute bridge, lying quad stretch), a note under it says so.
- **Photos of real people** for 5 exercises, copied from [wger](https://wger.de/) under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), credited under each photo and listed in `js/media.js`. Nothing else in wger matched the plan as real photos with a named author and no AI flag.

## Put it on the iPhone home screen

1. Open the link above in Safari.
2. Tap Share, then **Add to Home Screen**.

It then opens full screen and works offline. The home-screen app and Safari keep separate storage, so sign in to sync inside the one you use (or both).

## Set up sync (about 5 minutes, free)

1. Create a free project at [supabase.com](https://supabase.com). Singapore is the nearest region to Hong Kong.
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It creates four tables (`log_entries`, `day_sessions`, `milestones`, `settings`) with row-level security, so each signed-in user can only read and write their own rows.
3. Open **Authentication → Emails → Magic Link** and add `{{ .Token }}` to the email body, for example `Your Knee Rebuild code: {{ .Token }}`. The app signs in with this code, which works the same in Safari and in the home-screen app.
4. Open **Authentication → URL Configuration**. Set the Site URL to `https://lyhjeremy.github.io/knee-rebuild/` and add the same address under Redirect URLs.
5. Open **Project Settings → API Keys** and copy the Project URL and the publishable key (the older `anon` key also works).
6. In the app, go to **Plan → Sync, backup and timer**, paste both, tap **Save**, enter your email and type in the code from the email.
7. Once you've signed in on every device you use, turn off **Allow new users to sign up** under **Authentication → Sign In / Providers**, so nobody else can create an account in your project.

Notes:

- Supabase's built-in email sender allows only a few emails per hour on the free plan. Ask for one code and wait for it.
- Free projects pause after 7 days without any requests. Daily use keeps it awake; if it does pause, restore it from the Supabase dashboard.
- The publishable key is meant to be public. Your data is protected by sign-in and row-level security, not by hiding the key.

### How sync works

Every change is saved on the device straight away and queued. When you're online and signed in, the app pulls newer rows from Supabase and then pushes the queue, a couple of seconds after each change and whenever the app comes back to the foreground. Each row carries the device's timestamp; when two devices edit the same exercise on the same day, the later edit wins, and a database trigger stops an older offline edit from overwriting a newer one.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `css/app.css` | Page shell and styles (light and dark) |
| `js/data.js` | The plan: exercises, cues, sessions, schedule, phases, milestones, rules |
| `js/store.js` | Local state, plan logic, progression check, weekly summary |
| `js/sync.js` | Supabase auth and sync over REST, no SDK |
| `js/figures.js` | The stick-figure diagrams and their animation, built from a small skeleton with two-bone IK |
| `js/media.js`, `photos/` | GIF links and credited photos |
| `js/timer.js`, `js/charts.js` | Hold, rest and block timer; History charts |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen install |
| `supabase/schema.sql` | Tables, row-level security and the newest-wins trigger |
| `tests/` | Node tests for the plan logic and a fake-Supabase sync test |

## Run locally

No build step and no dependencies.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
node --test tests/            # Node 20 or later
```

To change the plan, edit `js/data.js`. Logs are keyed by exercise id, so keep the ids when you rename an exercise.

This is a planning tool, not medical advice. Review the plan with a physiotherapist.

## License

[MIT](LICENSE) © 2026 Jeremy Lee
