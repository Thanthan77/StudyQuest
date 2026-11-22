import { supabase } from "./supabaseClient.js";
import { getTodayDate, checkAndResetRecurringTasks } from "./utils.js";

const CATEGORY_PALETTE = [
  "#6366f1",
  "#34d399",
  "#fbbf24",
  "#7dd3fc",
  "#f472b6",
  "#c084fc",
];

document.addEventListener("DOMContentLoaded", () => {
  loadStatistiquesData();
  initBadgesModalEvents();
});

function getStatForBadgeCategory(category, stats = {}) {
  switch (category) {
    case "tasks":
      return Number(stats.totalCompleted) || 0;
    case "gel":
      return Number(stats.freezesUsed) || 0;
    case "streak":
      return Math.max(
        Number(stats.currentStreak) || 0,
        Number(stats.bestStreak) || 0,
      );
    case "group":
      return Number(stats.groupsCount) || 0;
    default:
      return 0;
  }
}

export async function unlockEarnedBadges({
  userId,
  catalogBadges = [],
  unlockedUserBadges = [],
  stats = {},
}) {
  const unlockedIds = new Set(
    (unlockedUserBadges || []).map((ub) => ub.badge_id ?? ub.id),
  );

  const newlyUnlocked = [];

  for (const badge of catalogBadges) {
    if (!badge?.id || unlockedIds.has(badge.id)) continue;

    const target = Number(badge.target_value) || 0;
    const current = getStatForBadgeCategory(badge.category, stats);

    if (target > 0 && current >= target) {
      unlockedIds.add(badge.id);
      newlyUnlocked.push({
        user_id: userId,
        badge_id: badge.id,
        unlocked_at: new Date().toISOString(),
      });
    }
  }

  if (userId && newlyUnlocked.length > 0) {
    const { error } = await supabase
      .from("user_badges")
      .upsert(newlyUnlocked, {
        onConflict: "user_id,badge_id",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error("Erreur lors du déblocage des badges :", error.message);
    }
  }

  return { unlockedIds, newlyUnlocked };
}

export async function loadStatistiquesData() {
  const storedUser = localStorage.getItem("studyquest_user");
  if (!storedUser) {
    window.location.href = "../index.html";
    return;
  }

  const localUser = JSON.parse(storedUser);
  const today = getTodayDate();

  try {
    await checkAndResetRecurringTasks(localUser.id);

    // Lectures parallèles pour limiter la latence
    const [profileRes, allTasksRes, allBadgesRes, userBadgesRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", localUser.id).single(),
        supabase.from("tasks").select("*").eq("user_id", localUser.id),
        supabase.from("badges").select("*"),
        supabase.from("user_badges").select("*").eq("user_id", localUser.id),
      ]);

    if (profileRes.error) throw profileRes.error;
    if (allTasksRes.error) throw allTasksRes.error;

    const profile = profileRes.data || {};
    const tasks = allTasksRes.data || [];
    const catalogBadges = allBadgesRes.data || [];
    const unlockedUserBadges = userBadgesRes.data || [];

    // Date d'inscription dans l'en-tête
    renderMemberSince(profile.created_at || localUser.created_at);

    // Vue d'ensemble (tâches créées, complétées, manquées, en cours)
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const overdueTasks = tasks.filter(
      (t) =>
        t.status === "pending" &&
        t.task_type === "dated" &&
        t.due_date &&
        t.due_date < today,
    );
    const activeTasks = tasks.filter((t) => t.status === "pending");

    const totalCreated = Math.max(
      profile.total_tasks_created ?? 0,
      tasks.length,
    );
    const totalCompleted = completedTasks.length;
    const totalOverdue = overdueTasks.length;
    const totalActive = activeTasks.length;

    const completionRate =
      totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;

    setText("completion-rate-display", `${completionRate}%`);
    setText(
      "completion-fraction-display",
      `${totalCompleted} ${totalCompleted > 1 ? "tâches" : "tâche"} sur ${totalCreated}`,
    );

    const completedPct =
      totalCreated > 0 ? (totalCompleted / totalCreated) * 100 : 0;
    const overduePct = totalCreated > 0 ? (totalOverdue / totalCreated) * 100 : 0;
    const activePct =
      totalCreated > 0 ? Math.max(0, 100 - completedPct - overduePct) : 0;

    setWidth("bar-completed", completedPct);
    setWidth("bar-overdue", overduePct);
    setWidth("bar-pending", activePct);

    setText("stat-total-created", totalCreated);
    setText("stat-total-completed", totalCompleted);
    setText("stat-total-overdue", totalOverdue);
    setText("stat-total-active", totalActive);

    // Séries & gels
    const currentStreak = profile.current_streak ?? 0;
    const bestStreak = profile.longest_streak ?? 0;
    const freezesCount = profile.freezes_count ?? 0;
    const freezesUsed = profile.total_freezes_used ?? 0;

    setText("current-streak-big", currentStreak);
    setText(
      "best-streak-value",
      `${bestStreak} ${bestStreak > 1 ? "jours" : "jour"}`,
    );
    setText(
      "best-streak-date",
      bestStreak > 0 ? "Meilleure série enregistrée" : "Aucun record encore",
    );
    setText("freezes-reserve-value", `${freezesCount} / 2`);
    setText("freezes-used-count", freezesUsed);

    const recordTarget = Math.max(bestStreak, currentStreak, 1);
    const recordPct = Math.min(
      100,
      Math.round((currentStreak / recordTarget) * 100),
    );
    setText("record-progress-label", `${currentStreak} / ${bestStreak} jours`);
    setWidth("record-progress-fill", recordPct);

    renderFreezeIcons(freezesUsed);

    // Répartition par catégories (toutes catégories, limitée à 6 affichées)
    renderCategoryBreakdown(tasks, profile.custom_categories, 6);

    // Badges (limité à 4 badges dans la grille + préparation popup complète)
    await evaluateAndRenderBadges({
      userId: localUser.id,
      catalogBadges,
      unlockedUserBadges,
      stats: {
        totalCreated,
        totalCompleted,
        currentStreak,
        bestStreak,
        freezesUsed,
        groupsCount: profile.groups_count ?? 0,
      },
    });
  } catch (err) {
    console.error("Erreur de chargement des statistiques :", err.message);
  }
}

function formatCategoryLabel(category) {
  const raw = String(category || "École").trim();
  const lower = raw.toLowerCase();
  if (lower === "school" || lower === "école") return "École";
  if (lower === "personal" || lower === "perso" || lower === "personnel") {
    return "Personnel";
  }
  return raw;
}

function renderCategoryBreakdown(tasks, customCategories, maxVisible = 6) {
  const totalCategorized = tasks.length;
  setText(
    "category-total-badge",
    `${totalCategorized} ${totalCategorized > 1 ? "tâches" : "tâche"}`,
  );

  // Liste ordonnée des catégories connues (custom_categories + catégories présentes dans tasks)
  const orderedCategories = [];
  const addCategory = (cat) => {
    const label = formatCategoryLabel(cat);
    if (
      label &&
      !orderedCategories.some((c) => c.toLowerCase() === label.toLowerCase())
    ) {
      orderedCategories.push(label);
    }
  };

  if (Array.isArray(customCategories)) {
    customCategories.forEach(addCategory);
  }
  tasks.forEach((t) => addCategory(t.category));

  if (orderedCategories.length === 0) {
    orderedCategories.push("École", "Personnel");
  }

  // Couleur fixe associée à chaque catégorie selon son ordre
  const colorMap = new Map();
  orderedCategories.forEach((label, idx) => {
    colorMap.set(
      label.toLowerCase(),
      CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
    );
  });

  // Comptage des tâches par catégorie
  const countsMap = new Map(
    orderedCategories.map((c) => [c.toLowerCase(), 0]),
  );
  tasks.forEach((t) => {
    const key = formatCategoryLabel(t.category).toLowerCase();
    countsMap.set(key, (countsMap.get(key) || 0) + 1);
  });

  // Tri par nombre de tâches décroissant puis limitation à maxVisible catégories
  const breakdown = orderedCategories
    .map((label) => {
      const count = countsMap.get(label.toLowerCase()) || 0;
      const pct =
        totalCategorized > 0 ? Math.round((count / totalCategorized) * 100) : 0;
      const color = colorMap.get(label.toLowerCase()) || CATEGORY_PALETTE[0];
      return { label, count, pct, color };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, maxVisible);

  const breakdownContainer = document.getElementById("category-breakdown-list");
  if (!breakdownContainer) return;

  if (totalCategorized === 0) {
    breakdownContainer.innerHTML = `<div class="empty-state-tasks">Aucune tâche enregistrée pour le moment.</div>`;
    return;
  }

  breakdownContainer.innerHTML = breakdown
    .map(
      (item) => `
        <div class="category-stat-row">
          <div class="category-stat-header">
            <span class="category-stat-name">${item.label}</span>
            <span class="category-stat-meta">${item.count} ${item.count > 1 ? "tâches" : "tâche"} (${item.pct}%)</span>
          </div>
          <div class="category-stat-bar-track">
            <div class="category-stat-bar-fill" style="width: ${item.pct}%; background-color: ${item.color};"></div>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderMemberSince(dateString) {
  const el = document.getElementById("member-since-date");
  if (!el) return;

  if (!dateString) {
    el.textContent = "récemment";
    return;
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    el.textContent = dateString;
    return;
  }

  el.textContent = parsed.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderFreezeIcons(freezesUsed) {
  const container = document.getElementById("freeze-flakes-icons");
  if (!container) return;

  const iconsToShow = Math.max(2, Math.min(5, freezesUsed || 2));
  let html = "";
  for (let i = 0; i < iconsToShow; i++) {
    const isUsed = i < freezesUsed;
    html += `<i class="fa-regular fa-snowflake" style="color: ${isUsed ? "#7dd3fc" : "#52525b"};"></i>`;
  }
  container.innerHTML = html;
}

function selectTopFourBadges(catalogBadges, unlockedIds) {
  const unlocked = catalogBadges.filter((b) => unlockedIds.has(b.id));
  const locked = catalogBadges.filter((b) => !unlockedIds.has(b.id));
  return [...unlocked, ...locked].slice(0, 4);
}

function getBadgeProgressText(badge, stats = {}) {
  const target = Number(badge.target_value) || 1;
  const totalCompleted = Number(stats.totalCompleted) || 0;
  const freezesUsed = Number(stats.freezesUsed) || 0;
  const bestStreak = Math.max(
    Number(stats.currentStreak) || 0,
    Number(stats.bestStreak) || 0,
  );
  const groupsCount = Number(stats.groupsCount) || 0;

  switch (badge.category) {
    case "tasks": {
      const current = Math.min(totalCompleted, target);
      const unit = target > 1 ? "tâches complétées" : "tâche complétée";
      return `${current} / ${target} ${unit}`;
    }
    case "gel": {
      const current = Math.min(freezesUsed, target);
      const unit = target > 1 ? "gels utilisés" : "gel utilisé";
      return `${current} / ${target} ${unit}`;
    }
    case "streak": {
      const current = Math.min(bestStreak, target);
      const unit = target > 1 ? "jours" : "jour";
      return `${current} / ${target} ${unit}`;
    }
    case "group": {
      const current = Math.min(groupsCount, target);
      const unit = target > 1 ? "groupes" : "groupe";
      return `${current} / ${target} ${unit}`;
    }
    default:
      return badge.requirement_label || "Verrouillé";
  }
}

function renderBadgeTile(badge, isUnlocked, stats = {}, showProgress = false) {
  const title = badge.name || badge.title || "Badge";
  const description = badge.description || "";
  const iconClass = isUnlocked ? "fa-solid fa-award" : "fa-solid fa-lock";
  const iconBoxClass = isUnlocked ? "gold" : "locked-box";
  const statusText = isUnlocked
    ? "Débloqué"
    : showProgress
      ? getBadgeProgressText(badge, stats)
      : badge.requirement_label || "Verrouillé";

  return `
        <div class="badge-tile ${isUnlocked ? "unlocked" : "locked"}" title="${description || title}">
            <div class="badge-icon-box ${iconBoxClass}">
                <i class="${iconClass}"></i>
            </div>
            <div class="badge-title">${title}</div>
            ${description ? `<div class="badge-desc">${description}</div>` : ""}
            <div class="badge-status ${isUnlocked ? "unlocked-text" : ""}">
                ${statusText}
            </div>
        </div>
    `;
}

async function evaluateAndRenderBadges({
  userId,
  catalogBadges,
  unlockedUserBadges,
  stats,
}) {
  const container = document.getElementById("badges-container");
  const counterBadge = document.getElementById("badges-progress-badge");
  const allBadgesList = document.getElementById("all-badges-modal-list");

  const { unlockedIds, newlyUnlocked } = await unlockEarnedBadges({
    userId,
    catalogBadges,
    unlockedUserBadges,
    stats,
  });

  if (newlyUnlocked.length > 0) {
    console.log(
      "Nouveaux badges débloqués :",
      newlyUnlocked.map((b) => b.name || b.id).join(", "),
    );
  }

  if (catalogBadges.length > 0) {
    if (counterBadge) {
      counterBadge.textContent = `${unlockedIds.size} / ${catalogBadges.length}`;
    }

    // Toujours limiter la grille principale à 4 badges
    const visibleBadges = selectTopFourBadges(catalogBadges, unlockedIds);
    if (container) {
      container.innerHTML = visibleBadges
        .map((badge) => renderBadgeTile(badge, unlockedIds.has(badge.id), stats, false))
        .join("");
    }

    // Remplit aussi la liste du popup avec la progression des badges non débloqués
    if (allBadgesList) {
      allBadgesList.innerHTML = catalogBadges
        .map((badge) => renderBadgeTile(badge, unlockedIds.has(badge.id), stats, true))
        .join("");
    }
  } else {
    if (counterBadge) counterBadge.textContent = `${unlockedIds.size} / 10`;

    const freezePct = Math.min(100, Math.round((stats.freezesUsed / 5) * 100));
    const streak30Pct = Math.min(
      100,
      Math.round((Math.max(stats.currentStreak, stats.bestStreak) / 30) * 100),
    );

    setText("badge-freeze-label", `${stats.freezesUsed} / 5 gels utilisés`);
    setText(
      "badge-streak30-label",
      `${Math.max(stats.currentStreak, stats.bestStreak)} / 30 jours`,
    );

    const freezeBar = document.querySelector("#badge-freeze-label")
      ?.nextElementSibling?.firstElementChild;
    const streakBar = document.querySelector("#badge-streak30-label")
      ?.nextElementSibling?.firstElementChild;
    if (freezeBar) freezeBar.style.width = `${freezePct}%`;
    if (streakBar) streakBar.style.width = `${streak30Pct}%`;

    // Garantit au maximum 4 tuiles dans #badges-container même sans catalogue
    if (container && container.children.length > 4) {
      Array.from(container.children)
        .slice(4)
        .forEach((el) => el.remove());
    }
  }
}

function initBadgesModalEvents() {
  const openBtn = document.getElementById("open-all-badges-btn");
  const closeBtn = document.getElementById("close-all-badges-btn");
  const modal = document.getElementById("all-badges-modal");

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      modal.style.display = "flex";
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}