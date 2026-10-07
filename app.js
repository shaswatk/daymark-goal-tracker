const goals = [
  { name: "Move my body for 30 minutes", category: "HEALTH", completed: true },
  { name: "Read for 20 minutes", category: "LEARNING", completed: true },
  { name: "Write a journal entry", category: "MINDFULNESS", completed: true },
  { name: "Reach out to someone I care about", category: "CONNECTION", completed: false },
  { name: "Plan tomorrow", category: "FOCUS", completed: false },
];

const weekData = [
  { day: "MON", value: 4 }, { day: "TUE", value: 3 }, { day: "WED", value: 3 },
  { day: "THU", value: 4 }, { day: "FRI", value: 5 }, { day: "SAT", value: 4 }, { day: "SUN", value: 4 },
];
const monthData = [
  { day: "W1", value: 19 }, { day: "W2", value: 22 }, { day: "W3", value: 24 }, { day: "W4", value: 27 },
];
const people = [
  { initials: "NP", name: "Nora Park", detail: "7 day streak", score: "31 / 35", rate: "89%", color: "#e6c6bb" },
  { initials: "AS", name: "Alex Smith", detail: "5 day streak", score: "27 / 35", rate: "77%", color: "#d9f25b" },
  { initials: "JM", name: "Jamie Moore", detail: "3 day streak", score: "25 / 35", rate: "71%", color: "#d6d2f7" },
  { initials: "RK", name: "Ravi Kumar", detail: "2 day streak", score: "21 / 35", rate: "60%", color: "#b6d9d0" },
];

const goalList = document.querySelector("#goal-list");
const template = document.querySelector("#goal-template");
const barChart = document.querySelector("#bar-chart");

function renderGoals() {
  goalList.innerHTML = "";
  goals.forEach((goal, index) => {
    const row = template.content.cloneNode(true);
    const input = row.querySelector("input");
    input.checked = goal.completed;
    input.addEventListener("change", () => { goals[index].completed = input.checked; updateProgress(); });
    row.querySelector(".goal-name").textContent = goal.name;
    row.querySelector(".goal-category").textContent = goal.category;
    goalList.appendChild(row);
  });
}
function updateProgress() {
  const completed = goals.filter((goal) => goal.completed).length;
  const percent = Math.round((completed / goals.length) * 100);
  document.querySelector("#completed-count").textContent = completed;
  document.querySelector("#percent-count").textContent = `${percent}%`;
  document.querySelector("#progress-ring").style.setProperty("--progress", `${percent}%`);
}
function renderChart(range = "week") {
  const data = range === "week" ? weekData : monthData;
  const max = range === "week" ? 5 : 35;
  barChart.innerHTML = "";
  data.forEach((item, index) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = `<div class="bar ${index === data.length - 1 ? "highlight" : ""}" style="height:${(item.value / max) * 100}%"><span class="bar-value">${item.value}</span></div><span class="bar-label">${item.day}</span>`;
    barChart.appendChild(col);
  });
  document.querySelector("#completion-rate").textContent = range === "week" ? "76%" : "78%";
  document.querySelector("#goals-total").textContent = range === "week" ? "27" : "109";
  document.querySelector("#rate-change").textContent = range === "week" ? "↑ 8% vs last week" : "↑ 5% vs last month";
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
document.querySelectorAll(".range-button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".range-button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active"); renderChart(button.dataset.range);
}));
document.querySelector("#add-goal").addEventListener("click", () => {
  const name = window.prompt("What would you like to do today?");
  if (name?.trim()) { goals.push({ name: name.trim(), category: "PERSONAL", completed: false }); renderGoals(); updateProgress(); }
});
renderGoals(); updateProgress(); renderChart(); renderLeaderboard();
