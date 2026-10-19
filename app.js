const demoGoals = [
  { id: "demo-1", title: "Move my body for 30 minutes", category: "HEALTH", completed: true },
  { id: "demo-2", title: "Read for 20 minutes", category: "LEARNING", completed: true },
  { id: "demo-3", title: "Write a journal entry", category: "MINDFULNESS", completed: true },
  { id: "demo-4", title: "Reach out to someone I care about", category: "CONNECTION", completed: false },
  { id: "demo-5", title: "Plan tomorrow", category: "FOCUS", completed: false },
];

const config = window.DAYMARK_CONFIG ?? {};
const isConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
const db = isConfigured ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
const goalList = document.querySelector("#goal-list");
const goalTemplate = document.querySelector("#goal-template");
const barChart = document.querySelector("#bar-chart");
const authDialog = document.querySelector("#auth-dialog");
let goals = [];
let currentUser = null;
let activeCircle = null;
let selectedRange = "week";

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dayLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
}

function updateTodayCopy() {
  const now = new Date();
  document.querySelector("#today-label").textContent = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  }).toUpperCase();
}

function finishLoading() {
  document.body.classList.remove("is-loading");
  document.querySelector("#app-loader").hidden = true;
}

function showDemoDashboard() {
  currentUser = null;
  goals = [...demoGoals];
  document.querySelector("#demo-banner").hidden = false;
  document.querySelector("#profile-name").textContent = "Alex Smith";
  document.querySelector(".profile-avatar").textContent = "AS";
  document.querySelector("#profile-subtitle").textContent = "Demo workspace";
  renderGoals();
  updateProgress();
  renderDemoChart();
  renderStreak();
  renderLeaderboard();
  finishLoading();
}

function renderGoals() {
  goalList.innerHTML = "";
  goals.forEach((goal, index) => {
    const row = goalTemplate.content.cloneNode(true);
    const input = row.querySelector("input");
    input.checked = goal.completed;
    input.addEventListener("change", async () => {
      if (!currentUser) {
        input.checked = goal.completed;
        openAuthDialog();
        return;
      }
      await saveCheckin(goal, input.checked, input);
    });
    row.querySelector(".goal-name").textContent = goal.title;
    row.querySelector(".goal-category").textContent = goal.category;
    row.querySelector(".edit-goal").addEventListener("click", (event) => {
      event.preventDefault();
      editGoal(index);
    });
    row.querySelector(".delete-goal").addEventListener("click", (event) => {
      event.preventDefault();
      deleteGoal(index);
    });
    goalList.appendChild(row);
  });
}

function updateProgress() {
  const completed = goals.filter((goal) => goal.completed).length;
  const percent = goals.length ? Math.round((completed / goals.length) * 100) : 0;
  document.querySelector("#completed-count").textContent = completed;
  document.querySelector("#goal-total").textContent = goals.length;
  document.querySelector("#percent-count").textContent = `${percent}%`;
  document.querySelector("#progress-ring").style.setProperty("--progress", `${percent}%`);
  document.querySelector("#hero-subtitle").textContent = goals.length
    ? `${completed === goals.length ? "Beautiful work — every goal is done." : `${goals.length - completed} goal${goals.length - completed === 1 ? "" : "s"} left for today.`}`
    : "Add a daily goal to begin your practice.";
}

function renderChart(data, summary) {
  const max = Math.max(...data.map((item) => item.value), 1);
  barChart.innerHTML = "";
  data.forEach((item, index) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = `<div class="bar ${index === data.length - 1 ? "highlight" : ""}" style="height:${(item.value / max) * 100}%"><span class="bar-value">${item.value}</span></div><span class="bar-label">${item.day}</span>`;
    barChart.appendChild(col);
  });
  document.querySelector("#completion-rate").textContent = `${summary.rate}%`;
  document.querySelector("#goals-total").textContent = summary.completed;
  document.querySelector("#rate-change").textContent = `${summary.completed} of ${summary.planned} planned`;
  document.querySelector("#best-day").textContent = summary.bestDay;
}

function renderDemoChart() {
  const data = selectedRange === "week"
    ? [{ day: "MON", value: 4 }, { day: "TUE", value: 3 }, { day: "WED", value: 3 }, { day: "THU", value: 4 }, { day: "FRI", value: 5 }, { day: "SAT", value: 4 }, { day: "SUN", value: 4 }]
    : [{ day: "W1", value: 19 }, { day: "W2", value: 22 }, { day: "W3", value: 24 }, { day: "W4", value: 27 }];
  renderChart(data, { rate: selectedRange === "week" ? 76 : 78, completed: selectedRange === "week" ? 27 : 109, planned: selectedRange === "week" ? 35 : 140, bestDay: "Friday" });
}

function renderStreak(checkins = []) {
  const today = new Date();
  const completedByDay = new Map();
  checkins.filter((checkin) => checkin.completed).forEach((checkin) => {
    completedByDay.set(checkin.completed_on, (completedByDay.get(checkin.completed_on) || 0) + 1);
  });
  let streak = 0;
  if (goals.length) {
    for (let index = 0; index < 365; index += 1) {
      const date = localDate(addDays(today, -index));
      if (completedByDay.get(date) === goals.length) streak += 1;
      else break;
    }
  }
  document.querySelector("#streak-count").textContent = streak;
  document.querySelector("#streak-copy").textContent = streak
    ? `You’ve completed every goal for ${streak} day${streak === 1 ? "" : "s"} in a row.`
    : "Complete all your goals today to begin a streak.";

  const holder = document.querySelector("#mini-days");
  holder.innerHTML = "";
  for (let index = -6; index <= 0; index += 1) {
    const date = addDays(today, index);
    const label = dayLabel(date).slice(0, 1);
    const done = goals.length && completedByDay.get(localDate(date)) === goals.length;
    const span = document.createElement("span");
    span.textContent = label;
    if (done) span.className = "done";
    if (index === 0) span.classList.add("today-day");
    holder.appendChild(span);
  }
}

function renderLeaderboard(members = []) {
  const holder = document.querySelector("#leaderboard");
  holder.innerHTML = "";
  if (!members.length) {
    holder.innerHTML = `<div class="empty-circle"><strong>Start an accountability circle.</strong><span>Create one to get a private invite link, or join a friend with their code.</span></div>`;
    return;
  }
  members.sort((a, b) => b.rate - a.rate || b.completed - a.completed).forEach((person) => {
    const row = document.createElement("div");
    row.className = "leader-row";
    row.innerHTML = `<div class="person"><span class="person-avatar" style="background:${person.color}">${person.initials}</span><span>${person.name}<small>${person.goalCount} daily goal${person.goalCount === 1 ? "" : "s"}</small></span></div><span class="score">${person.completed} / ${person.planned}</span><span class="rate">${person.rate}%</span>`;
    holder.appendChild(row);
  });
}

async function saveCheckin(goal, completed, input) {
  goal.completed = completed;
  updateProgress();
  const { error } = await db.from("goal_checkins").upsert(
    { goal_id: goal.id, completed_on: localDate(), completed },
    { onConflict: "goal_id,completed_on" },
  );
  if (error) {
    goal.completed = !completed;
    input.checked = goal.completed;
    updateProgress();
    window.alert(`Couldn’t save that change: ${error.message}`);
    return;
  }
  await refreshDashboard();
}

async function editGoal(index) {
  const goal = goals[index];
  const title = window.prompt("Update this daily goal:", goal.title);
  if (!title?.trim() || title.trim() === goal.title) return;
  const { error } = await db.from("goals").update({ title: title.trim() }).eq("id", goal.id);
  if (error) return window.alert(`Couldn’t update the goal: ${error.message}`);
  goal.title = title.trim();
  renderGoals();
}

async function deleteGoal(index) {
  const goal = goals[index];
  if (!window.confirm(`Delete “${goal.title}”? Its completion history will also be removed.`)) return;
  const { error } = await db.from("goals").delete().eq("id", goal.id);
  if (error) return window.alert(`Couldn’t delete the goal: ${error.message}`);
  goals.splice(index, 1);
  renderGoals();
  updateProgress();
  await refreshDashboard();
}

async function loadGoals() {
  const today = localDate();
  const [{ data: savedGoals, error: goalsError }, { data: checkins, error: checkinsError }] = await Promise.all([
    db.from("goals").select("id,title,category").eq("is_active", true).order("created_at"),
    db.from("goal_checkins").select("goal_id,completed").eq("completed_on", today),
  ]);
  if (goalsError || checkinsError) return window.alert(`Couldn’t load your goals: ${(goalsError ?? checkinsError).message}`);
  const completeIds = new Set(checkins.filter((checkin) => checkin.completed).map((checkin) => checkin.goal_id));
  goals = savedGoals.map((goal) => ({ ...goal, completed: completeIds.has(goal.id) }));
  renderGoals();
  updateProgress();
}

async function loadProgressAndStreak() {
  const now = new Date();
  const start = addDays(now, selectedRange === "week" ? -6 : -27);
  const streakStart = addDays(now, -364);
  const { data: checkins, error } = await db.from("goal_checkins")
    .select("completed_on,completed")
    .gte("completed_on", localDate(streakStart))
    .lte("completed_on", localDate(now));
  if (error) return;
  const inRange = checkins.filter((checkin) => checkin.completed_on >= localDate(start));
  const completedByDay = new Map();
  inRange.filter((checkin) => checkin.completed).forEach((checkin) => {
    completedByDay.set(checkin.completed_on, (completedByDay.get(checkin.completed_on) || 0) + 1);
  });
  const data = selectedRange === "week"
    ? Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      return { day: dayLabel(day), value: completedByDay.get(localDate(day)) || 0 };
    })
    : Array.from({ length: 4 }, (_, index) => {
      const weekStart = addDays(start, index * 7);
      const weekEnd = localDate(addDays(weekStart, 6));
      const key = localDate(weekStart);
      const value = [...completedByDay.entries()].reduce((total, [date, count]) => total + (date >= key && date <= weekEnd ? count : 0), 0);
      return { day: `W${index + 1}`, value };
    });
  const completed = inRange.filter((checkin) => checkin.completed).length;
  const planned = goals.length * (selectedRange === "week" ? 7 : 28);
  const best = data.reduce((top, item) => item.value > top.value ? item : top, data[0]);
  renderChart(data, { completed, planned, rate: planned ? Math.round((completed / planned) * 100) : 0, bestDay: best.value ? best.day : "—" });
  renderStreak(checkins);
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

async function loadCircle() {
  const { data: memberships, error } = await db.from("circle_members")
    .select("circle_id,circles(id,name,invite_code)")
    .order("joined_at")
    .limit(1);
  if (error || !memberships?.length) {
    activeCircle = null;
    document.querySelector("#circle-title").innerHTML = "<span>Your circle</span><span>Completed</span><span>Rate</span>";
    renderLeaderboard();
    return;
  }
  activeCircle = memberships[0].circles;
  document.querySelector("#circle-title").innerHTML = `<span>${activeCircle.name}</span><span>Completed</span><span>Rate</span>`;
  const { data: members, error: membersError } = await db.from("circle_members")
    .select("user_id,profiles(display_name,avatar_color)")
    .eq("circle_id", activeCircle.id);
  if (membersError) return;
  const userIds = members.map((member) => member.user_id);
  const [{ data: sharedGoals }, { data: sharedCheckins }] = await Promise.all([
    db.from("goals").select("id,user_id").in("user_id", userIds).eq("is_active", true),
    db.from("goal_checkins").select("goal_id,completed").gte("completed_on", localDate(addDays(new Date(), -6))),
  ]);
  const goalsByUser = new Map(userIds.map((id) => [id, []]));
  (sharedGoals ?? []).forEach((goal) => goalsByUser.get(goal.user_id)?.push(goal.id));
  const ownerByGoal = new Map((sharedGoals ?? []).map((goal) => [goal.id, goal.user_id]));
  const completedByUser = new Map(userIds.map((id) => [id, 0]));
  (sharedCheckins ?? []).filter((checkin) => checkin.completed).forEach((checkin) => {
    const owner = ownerByGoal.get(checkin.goal_id);
    if (owner) completedByUser.set(owner, (completedByUser.get(owner) || 0) + 1);
  });
  renderLeaderboard(members.map((member) => {
    const goalCount = goalsByUser.get(member.user_id)?.length || 0;
    const completed = completedByUser.get(member.user_id) || 0;
    const planned = goalCount * 7;
    const profile = member.profiles || {};
    return { name: profile.display_name || "Daymark member", initials: initials(profile.display_name || "Daymark member"), color: profile.avatar_color || "#d9f25b", goalCount, completed, planned, rate: planned ? Math.round((completed / planned) * 100) : 0 };
  }));
}

async function refreshDashboard() {
  await loadGoals();
  await loadProgressAndStreak();
  await loadCircle();
}

async function createCircle() {
  if (!currentUser) return openAuthDialog();
  const name = window.prompt("Name your accountability circle:");
  if (!name?.trim()) return;
  const { error } = await db.from("circles").insert({ name: name.trim() });
  if (error) return window.alert(`Couldn’t create the circle: ${error.message}\n\nRun the Circle migration in Supabase first.`);
  await loadCircle();
  if (activeCircle) {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${activeCircle.invite_code}`;
    await navigator.clipboard?.writeText(inviteUrl);
    window.alert(`Circle created. Its invite link was copied:\n${inviteUrl}`);
  }
}

async function joinCircle(code = "") {
  if (!currentUser) return openAuthDialog();
  const inviteCode = code || window.prompt("Paste your circle invite code:");
  if (!inviteCode?.trim()) return;
  const { error } = await db.rpc("join_circle_by_code", { p_invite_code: inviteCode.trim().toLowerCase() });
  if (error) return window.alert(`Couldn’t join that circle: ${error.message}\n\nCheck the code or run the Circle migration in Supabase.`);
  window.history.replaceState({}, "", window.location.pathname);
  await loadCircle();
}

async function onSignedIn(user) {
  currentUser = user;
  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Daymark member";
  document.querySelector("#profile-name").textContent = name;
  document.querySelector(".profile-avatar").textContent = initials(name);
  document.querySelector("#profile-subtitle").textContent = "Personal workspace";
  document.querySelector("#demo-banner").hidden = true;
  await refreshDashboard();
  finishLoading();
  const inviteCode = new URLSearchParams(window.location.search).get("join");
  if (inviteCode) await joinCircle(inviteCode);
}

function openAuthDialog() {
  if (!isConfigured) return window.alert("Supabase has not been connected yet. Add the project URL and publishable key in config.js first.");
  authDialog.showModal();
}

document.querySelectorAll(".range-button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".range-button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  selectedRange = button.dataset.range;
  if (currentUser) loadProgressAndStreak();
  else renderDemoChart();
}));
document.querySelector("#add-goal").addEventListener("click", async () => {
  if (!currentUser) return openAuthDialog();
  const title = window.prompt("What would you like to do every day?");
  if (!title?.trim()) return;
  const { data, error } = await db.from("goals").insert({ title: title.trim() }).select("id,title,category").single();
  if (error) return window.alert(`Couldn’t add the goal: ${error.message}`);
  goals.push({ ...data, completed: false });
  renderGoals();
  updateProgress();
  await refreshDashboard();
});
document.querySelector("#create-circle").addEventListener("click", createCircle);
document.querySelector("#join-circle").addEventListener("click", () => joinCircle());
document.querySelector("#account-button").addEventListener("click", async () => {
  if (!currentUser) return openAuthDialog();
  if (!window.confirm("Log out of Daymark?")) return;
  const { error } = await db.auth.signOut();
  if (error) return window.alert(`Couldn’t log out: ${error.message}`);
  window.location.reload();
});
document.querySelector("#banner-sign-in").addEventListener("click", openAuthDialog);
document.querySelector("#close-auth").addEventListener("click", () => authDialog.close());
document.querySelector("#google-auth").addEventListener("click", async () => {
  const button = document.querySelector("#google-auth");
  button.disabled = true;
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}` },
  });
  button.disabled = false;
  if (error) document.querySelector("#auth-message").textContent = error.message;
});

async function initializeApp() {
  updateTodayCopy();
  if (!isConfigured) {
    showDemoDashboard();
    return;
  }

  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) await onSignedIn(session.user);
    else showDemoDashboard();
  } catch (error) {
    console.error("Could not restore the Daymark session.", error);
    showDemoDashboard();
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session && currentUser?.id !== session.user.id) onSignedIn(session.user);
    if (event === "SIGNED_OUT") showDemoDashboard();
  });
}

initializeApp();
