const demoGoals = [
  { id: "demo-1", title: "Move my body for 30 minutes", category: "HEALTH", completed: true },
  { id: "demo-2", title: "Read for 20 minutes", category: "LEARNING", completed: true },
  { id: "demo-3", title: "Write a journal entry", category: "MINDFULNESS", completed: true },
  { id: "demo-4", title: "Reach out to someone I care about", category: "CONNECTION", completed: false },
  { id: "demo-5", title: "Plan tomorrow", category: "FOCUS", completed: false },
];
const weekData = [{ day: "MON", value: 4 }, { day: "TUE", value: 3 }, { day: "WED", value: 3 }, { day: "THU", value: 4 }, { day: "FRI", value: 5 }, { day: "SAT", value: 4 }, { day: "SUN", value: 4 }];
const monthData = [{ day: "W1", value: 19 }, { day: "W2", value: 22 }, { day: "W3", value: 24 }, { day: "W4", value: 27 }];
const people = [
  { initials: "NP", name: "Nora Park", detail: "7 day streak", score: "31 / 35", rate: "89%", color: "#e6c6bb" },
  { initials: "AS", name: "Alex Smith", detail: "5 day streak", score: "27 / 35", rate: "77%", color: "#d9f25b" },
  { initials: "JM", name: "Jamie Moore", detail: "3 day streak", score: "25 / 35", rate: "71%", color: "#d6d2f7" },
  { initials: "RK", name: "Ravi Kumar", detail: "2 day streak", score: "21 / 35", rate: "60%", color: "#b6d9d0" },
];

const config = window.DAYMARK_CONFIG ?? {};
const isConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
const db = isConfigured ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
const today = new Date().toISOString().slice(0, 10);
const goalList = document.querySelector("#goal-list");
const template = document.querySelector("#goal-template");
const barChart = document.querySelector("#bar-chart");
const authDialog = document.querySelector("#auth-dialog");
let goals = [...demoGoals];
let currentUser = null;
let signUpMode = true;
let selectedRange = "week";

function renderGoals() {
  goalList.innerHTML = "";
  goals.forEach((goal, index) => {
    const row = template.content.cloneNode(true);
    const input = row.querySelector("input");
    input.checked = goal.completed;
    input.addEventListener("change", async () => {
      if (!currentUser) {
        input.checked = goal.completed;
        openAuthDialog();
        return;
      }
      goal.completed = input.checked;
      updateProgress();
      const { error } = await db.from("goal_checkins").upsert(
        { goal_id: goal.id, completed_on: today, completed: goal.completed },
        { onConflict: "goal_id,completed_on" },
      );
      if (error) {
        goal.completed = !input.checked;
        input.checked = goal.completed;
        updateProgress();
        showAuthMessage(`Couldn’t save that change: ${error.message}`);
      }
    });
    row.querySelector(".goal-name").textContent = goal.title;
    row.querySelector(".goal-category").textContent = goal.category;
    goalList.appendChild(row);
  });
}

function updateProgress() {
  const completed = goals.filter((goal) => goal.completed).length;
  const percent = goals.length ? Math.round((completed / goals.length) * 100) : 0;
  document.querySelector("#completed-count").textContent = completed;
  document.querySelector("#percent-count").textContent = `${percent}%`;
  document.querySelector("#progress-ring").style.setProperty("--progress", `${percent}%`);
}

function renderChart(range = "week", data = range === "week" ? weekData : monthData, summary = null) {
  const max = Math.max(...data.map((item) => item.value), 1);
  barChart.innerHTML = "";
  data.forEach((item, index) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = `<div class="bar ${index === data.length - 1 ? "highlight" : ""}" style="height:${(item.value / max) * 100}%"><span class="bar-value">${item.value}</span></div><span class="bar-label">${item.day}</span>`;
    barChart.appendChild(col);
  });
  if (summary) {
    document.querySelector("#completion-rate").textContent = `${summary.rate}%`;
    document.querySelector("#goals-total").textContent = summary.completed;
    document.querySelector("#rate-change").textContent = `${summary.completed} of ${summary.planned} planned`;
    document.querySelector("#best-day").textContent = summary.bestDay;
  } else {
    document.querySelector("#completion-rate").textContent = range === "week" ? "76%" : "78%";
    document.querySelector("#goals-total").textContent = range === "week" ? "27" : "109";
    document.querySelector("#rate-change").textContent = range === "week" ? "↑ 8% vs last week" : "↑ 5% vs last month";
  }
}

function renderLeaderboard() {
  const holder = document.querySelector("#leaderboard");
  people.forEach((person) => {
    const row = document.createElement("div");
    row.className = "leader-row";
    row.innerHTML = `<div class="person"><span class="person-avatar" style="background:${person.color}">${person.initials}</span><span>${person.name}<small>${person.detail}</small></span></div><span class="score">${person.score}</span><span class="rate">${person.rate}</span>`;
    holder.appendChild(row);
  });
}

async function loadGoals() {
  const [{ data: savedGoals, error: goalsError }, { data: checkins, error: checkinsError }] = await Promise.all([
    db.from("goals").select("id,title,category").eq("is_active", true).order("created_at"),
    db.from("goal_checkins").select("goal_id,completed").eq("completed_on", today),
  ]);
  if (goalsError || checkinsError) {
    showAuthMessage(`Couldn’t load your goals: ${(goalsError ?? checkinsError).message}`);
    return;
  }
  const completeIds = new Set(checkins.filter((checkin) => checkin.completed).map((checkin) => checkin.goal_id));
  goals = savedGoals.map((goal) => ({ ...goal, completed: completeIds.has(goal.id) }));
  renderGoals();
  updateProgress();
  await loadProgress();
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

async function loadProgress() {
  const now = new Date();
  const start = new Date(now);
  const labels = [];
  const keys = [];
  if (selectedRange === "week") {
    start.setDate(now.getDate() - 6);
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      keys.push(isoDate(day));
      labels.push(day.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase());
    }
  } else {
    start.setDate(now.getDate() - 27);
    for (let index = 0; index < 4; index += 1) {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + (index * 7));
      keys.push(isoDate(weekStart));
      labels.push(`W${index + 1}`);
    }
  }
  const { data: checkins, error } = await db.from("goal_checkins")
    .select("completed_on,completed")
    .gte("completed_on", isoDate(start))
    .lte("completed_on", today);
  if (error) return;
  const completedByDay = new Map();
  checkins.filter((checkin) => checkin.completed).forEach((checkin) => {
    completedByDay.set(checkin.completed_on, (completedByDay.get(checkin.completed_on) || 0) + 1);
  });
  const data = selectedRange === "week"
    ? keys.map((key, index) => ({ day: labels[index], value: completedByDay.get(key) || 0 }))
    : keys.map((key, index) => {
      const weekEnd = new Date(`${key}T00:00:00`);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const value = [...completedByDay.entries()].reduce((total, [date, count]) => total + (date >= key && date <= isoDate(weekEnd) ? count : 0), 0);
      return { day: labels[index], value };
    });
  const completed = checkins.filter((checkin) => checkin.completed).length;
  const periodDays = selectedRange === "week" ? 7 : 28;
  const planned = goals.length * periodDays;
  const best = data.reduce((top, item) => item.value > top.value ? item : top, data[0]);
  renderChart(selectedRange, data, {
    completed,
    planned,
    rate: planned ? Math.round((completed / planned) * 100) : 0,
    bestDay: best.value ? best.day : "—",
  });
}

async function onSignedIn(user) {
  currentUser = user;
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  document.querySelector("#profile-name").textContent = profile?.display_name || user.email.split("@")[0];
  document.querySelector("#profile-subtitle").textContent = "Personal workspace";
  document.querySelector("#demo-banner").hidden = true;
  await loadGoals();
}

function openAuthDialog() {
  if (!isConfigured) {
    window.alert("Supabase has not been connected yet. Add the project URL and publishable key in config.js first.");
    return;
  }
  authDialog.showModal();
}

function showAuthMessage(message) {
  document.querySelector("#auth-message").textContent = message;
}

function setAuthMode(isSignUp) {
  signUpMode = isSignUp;
  document.querySelector("#auth-submit").textContent = signUpMode ? "Create account" : "Sign in";
  document.querySelector("#toggle-auth-mode").textContent = signUpMode ? "Already have an account? Sign in" : "Need an account? Create one";
  document.querySelector("#auth-name").closest("label").hidden = !signUpMode;
  showAuthMessage("");
}

document.querySelectorAll(".range-button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".range-button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  selectedRange = button.dataset.range;
  if (currentUser) loadProgress();
  else renderChart(selectedRange);
}));
document.querySelector("#add-goal").addEventListener("click", async () => {
  if (!currentUser) return openAuthDialog();
  const title = window.prompt("What would you like to do every day?");
  if (!title?.trim()) return;
  const { data, error } = await db.from("goals").insert({ title: title.trim() }).select("id,title,category").single();
  if (error) return showAuthMessage(`Couldn’t add the goal: ${error.message}`);
  goals.push({ ...data, completed: false });
  renderGoals();
  updateProgress();
});
document.querySelector("#account-button").addEventListener("click", openAuthDialog);
document.querySelector("#banner-sign-in").addEventListener("click", openAuthDialog);
document.querySelector("#close-auth").addEventListener("click", () => authDialog.close());
document.querySelector("#toggle-auth-mode").addEventListener("click", () => setAuthMode(!signUpMode));
document.querySelector("#google-auth").addEventListener("click", async () => {
  const button = document.querySelector("#google-auth");
  button.disabled = true;
  showAuthMessage("");
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
  });
  button.disabled = false;
  if (error) showAuthMessage(error.message);
});
document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  const displayName = document.querySelector("#auth-name").value.trim();
  const button = document.querySelector("#auth-submit");
  button.disabled = true;
  showAuthMessage("");
  const result = signUpMode
    ? await db.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })
    : await db.auth.signInWithPassword({ email, password });
  button.disabled = false;
  if (result.error) return showAuthMessage(result.error.message);
  if (!result.data.session) return showAuthMessage("Check your email to confirm your account, then sign in.");
  authDialog.close();
});

renderGoals();
updateProgress();
renderChart();
renderLeaderboard();
if (isConfigured) {
  db.auth.getSession().then(({ data: { session } }) => session && onSignedIn(session.user));
  db.auth.onAuthStateChange((_event, session) => session && onSignedIn(session.user));
}
