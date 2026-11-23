import { supabase } from "./supabaseClient.js";
import { computeRankedMembers } from "./groupRanking.js";

const MAX_GROUP_MEMBERS = 10;

const MEMBER_PALETTE = [
  "#d97706",
  "#e11d48",
  "#6366f1",
  "#16a34a",
  "#0284c7",
  "#9333ea",
  "#ea580c",
  "#0d9488",
  "#db2777",
  "#4f46e5",
];

let currentUser = null;
let userGroups = [];
let activeGroupId = null;

document.addEventListener("DOMContentLoaded", () => {
  initGroupsPage();
  initModalsAndActions();
});

function resolveCurrentUser() {
  const storedUser = localStorage.getItem("studyquest_user");
  if (!storedUser) return null;

  try {
    const parsed = JSON.parse(storedUser);
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function getRequestedGroupIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawId = params.get("group");
  return rawId ? String(rawId) : null;
}

async function initGroupsPage() {
  const user = resolveCurrentUser();
  if (!user?.id) {
    window.location.href = "../index.html";
    return;
  }

  currentUser = user;
  await loadUserGroups();
}

function getMemberAvatarColor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return MEMBER_PALETTE[Math.abs(hash) % MEMBER_PALETTE.length];
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (len) =>
    Array.from(
      { length: len },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  return `${block(3)}-${block(3)}`;
}

async function loadUserGroups() {
  try {
    const { data: memberships, error: memError } = await supabase
      .from("group_members")
      .select("group_id, role, groups(id, name, invite_code, created_by, created_at)")
      .eq("user_id", currentUser.id);

    if (memError) throw memError;

    const roleByGroupId = new Map(
      (memberships || []).map((row) => [row.group_id, row.role]),
    );

    const groupsList = (memberships || [])
      .map((row) => row.groups)
      .filter(Boolean);

    if (groupsList.length === 0) {
      userGroups = [];
      activeGroupId = null;
      renderTabs();
      renderEmptyState(
        "Tu ne fais encore partie d'aucun groupe. Crée ou rejoins-en un !",
      );
      return;
    }

    const groupIds = groupsList.map((g) => g.id);

    // Sélection explicite sans la colonne "pin"
    const { data: allMembers, error: membersError } = await supabase
      .from("group_members")
      .select(
        "group_id, user_id, role, profiles(id, username, total_completed_tasks, current_streak)",
      )
      .in("group_id", groupIds);

    if (membersError) throw membersError;

    userGroups = groupsList.map((group) => {
      const rawMembers = (allMembers || [])
        .filter((m) => m.group_id === group.id)
        .map((m) => {
          const profile = m.profiles || {};
          const displayName =
            String(profile.username || "").trim() ||
            `Membre ${String(m.user_id).slice(0, 5)}`;
          const completedTasks =
            Number(profile.total_completed_tasks ?? 0) || 0;
          const streak = Number(profile.current_streak ?? 0) || 0;

          return {
            userId: m.user_id,
            role: m.role,
            name: displayName,
            initial: displayName.charAt(0).toUpperCase() || "?",
            completedTasks,
            streak,
            isCurrentUser: m.user_id === currentUser.id,
          };
        });

      const rankedMembers = computeRankedMembers(rawMembers);
      const currentUserMember = rankedMembers.find((m) => m.isCurrentUser);

      return {
        ...group,
        currentUserRole: roleByGroupId.get(group.id) || "member",
        members: rankedMembers,
        userRankLabel: currentUserMember ? currentUserMember.rankLabel : "-",
      };
    });

    const requestedGroupId = getRequestedGroupIdFromUrl();
    const matchedRequestedGroup = requestedGroupId
      ? userGroups.find((g) => String(g.id) === requestedGroupId)
      : null;

    if (matchedRequestedGroup) {
      activeGroupId = matchedRequestedGroup.id;
    } else if (!activeGroupId || !userGroups.some((g) => g.id === activeGroupId)) {
      activeGroupId = userGroups[0].id;
    }

    renderTabs();
    renderActiveGroup();
  } catch (err) {
    console.error("Erreur lors du chargement des groupes :", err.message || err);
    renderEmptyState("Impossible de charger tes groupes pour le moment.");
  }
}

function updateGroupActionButtons(group) {
  const leaveBtn = document.getElementById("leave-group-btn");
  const deleteBtn = document.getElementById("delete-group-btn");

  if (!group) {
    if (leaveBtn) leaveBtn.style.display = "none";
    if (deleteBtn) deleteBtn.style.display = "none";
    return;
  }

  const isAdmin =
    group.currentUserRole === "admin" || group.created_by === currentUser?.id;

  if (leaveBtn) {
    leaveBtn.style.display = isAdmin ? "none" : "inline-flex";
  }
  if (deleteBtn) {
    deleteBtn.style.display = isAdmin ? "inline-flex" : "none";
  }
}

function renderTabs() {
  const container = document.getElementById("groups-tabs-container");
  if (!container) return;

  if (userGroups.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = userGroups
    .map((group) => {
      const activeClass = group.id === activeGroupId ? "active" : "";
      return `
        <button
          type="button"
          class="group-tab-btn ${activeClass}"
          data-group-id="${group.id}"
          role="tab"
          aria-selected="${group.id === activeGroupId}"
        >
          <span>${group.name}</span>
          <span class="group-tab-rank">${group.userRankLabel}</span>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll(".group-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeGroupId = btn.dataset.groupId;
      renderTabs();
      renderActiveGroup();
    });
  });
}

function getRankBadgeClass(rankIndex) {
  if (rankIndex === 0) return "rank-1";
  if (rankIndex === 1) return "rank-2";
  if (rankIndex === 2) return "rank-3";
  return "";
}

function renderActiveGroup() {
  const group = userGroups.find((g) => g.id === activeGroupId);
  if (!group) {
    renderEmptyState("Aucun groupe sélectionné.");
    return;
  }

  setText("active-group-name", group.name);
  setText(
    "active-group-members-count",
    `${group.members.length} / ${MAX_GROUP_MEMBERS} membres`,
  );
  setText("active-invite-code", group.invite_code);
  updateGroupActionButtons(group);

  const membersContainer = document.getElementById("group-members-container");
  if (!membersContainer) return;

  if (group.members.length === 0) {
    membersContainer.innerHTML = `<div class="empty-groups-state">Aucun membre dans ce groupe.</div>`;
    return;
  }

  membersContainer.innerHTML = group.members
    .map((member) => {
      const rankClass = getRankBadgeClass(member.rankIndex);
      const currentClass = member.isCurrentUser ? "is-current-user" : "";
      const labelName = member.isCurrentUser
        ? `${member.name} (toi)`
        : member.name;
      const tasksLabel = `${member.completedTasks} ${member.completedTasks > 1 ? "tâches validées" : "tâche validée"}`;
      const avatarBg = getMemberAvatarColor(member.userId);

      return `
        <div class="member-row ${currentClass}">
          <div class="member-left">
            <span class="rank-badge ${rankClass}">${member.rankLabel}</span>
            <span class="member-avatar" style="background-color: ${avatarBg};">${member.initial}</span>
            <div class="member-info">
              <span class="member-name">${labelName}</span>
              <span class="member-tasks">${tasksLabel}</span>
            </div>
          </div>
          <div class="member-streak">
            <i class="fa-solid fa-fire"></i>
            <span>${member.streak}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderEmptyState(message) {
  setText("active-group-name", "Mes groupes");
  setText("active-group-members-count", `0 / ${MAX_GROUP_MEMBERS} membres`);
  setText("active-invite-code", "------");
  updateGroupActionButtons(null);

  const membersContainer = document.getElementById("group-members-container");
  if (membersContainer) {
    membersContainer.innerHTML = `<div class="empty-groups-state">${message}</div>`;
  }
}

async function handleCreateGroup(e) {
  e.preventDefault();
  const input = document.getElementById("group-name-input");
  const name = input?.value.trim();
  if (!name || !currentUser?.id) return;

  try {
    const inviteCode = generateInviteCode();

    const { data: createdGroup, error: createError } = await supabase
      .from("groups")
      .insert({
        name,
        invite_code: inviteCode,
        created_by: currentUser.id,
      })
      .select()
      .single();

    if (createError) throw createError;

    const { error: memberError } = await supabase
      .from("group_members")
      .insert({
        group_id: createdGroup.id,
        user_id: currentUser.id,
        role: "admin",
      });

    if (memberError) throw memberError;

    activeGroupId = createdGroup.id;
    closeModal("create-group-modal", "create-group-form");
    await loadUserGroups();
  } catch (err) {
    console.error("Erreur lors de la création du groupe :", err.message || err);
    alert("Impossible de créer le groupe.");
  }
}

async function handleJoinGroup(e) {
  e.preventDefault();
  const input = document.getElementById("invite-code-input");
  const code = input?.value.trim().toUpperCase();
  if (!code || !currentUser?.id) return;

  try {
    const { data: targetGroup, error: findError } = await supabase
      .from("groups")
      .select("id, name, invite_code")
      .eq("invite_code", code)
      .single();

    if (findError || !targetGroup) {
      alert("Code d'invitation introuvable.");
      return;
    }

    const { count, error: countError } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", targetGroup.id);

    if (countError) throw countError;

    if ((count ?? 0) >= MAX_GROUP_MEMBERS) {
      alert(`Ce groupe a déjà atteint la limite de ${MAX_GROUP_MEMBERS} membres.`);
      return;
    }

    const { error: insertError } = await supabase
      .from("group_members")
      .insert({
        group_id: targetGroup.id,
        user_id: currentUser.id,
        role: "member",
      });

    if (insertError) {
      if (insertError.code === "23505") {
        alert("Tu fais déjà partie de ce groupe.");
      } else {
        throw insertError;
      }
      return;
    }

    activeGroupId = targetGroup.id;
    closeModal("join-group-modal", "join-group-form");
    await loadUserGroups();
  } catch (err) {
    console.error("Erreur pour rejoindre le groupe :", err.message || err);
    alert("Impossible de rejoindre le groupe.");
  }
}

async function handleLeaveGroup() {
  const group = userGroups.find((g) => g.id === activeGroupId);
  if (!group || !currentUser?.id) return;

  const isAdmin =
    group.currentUserRole === "admin" || group.created_by === currentUser.id;
  if (isAdmin) {
    alert("En tant qu'administrateur, tu peux supprimer le groupe.");
    return;
  }

  const ok = confirm(`Veux-tu vraiment quitter le groupe "${group.name}" ?`);
  if (!ok) return;

  try {
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", currentUser.id);

    if (error) throw error;

    activeGroupId = null;
    await loadUserGroups();
  } catch (err) {
    console.error("Erreur en quittant le groupe :", err.message || err);
    alert("Impossible de quitter le groupe.");
  }
}

async function handleDeleteGroup() {
  const group = userGroups.find((g) => g.id === activeGroupId);
  if (!group || !currentUser?.id) return;

  const isAdmin =
    group.currentUserRole === "admin" || group.created_by === currentUser.id;
  if (!isAdmin) {
    alert("Seul l'administrateur peut supprimer ce groupe.");
    return;
  }

  const ok = confirm(
    `Supprimer définitivement le groupe "${group.name}" ? Cette action est irréversible.`,
  );
  if (!ok) return;

  try {
    const { error: membersDelError } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", group.id);

    if (membersDelError) throw membersDelError;

    const { error: groupDelError } = await supabase
      .from("groups")
      .delete()
      .eq("id", group.id);

    if (groupDelError) throw groupDelError;

    activeGroupId = null;
    await loadUserGroups();
  } catch (err) {
    console.error("Erreur lors de la suppression du groupe :", err.message || err);
    alert("Impossible de supprimer le groupe.");
  }
}

function openModal(modalId, focusInputId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("is-open");
  modal.style.display = "flex";

  if (focusInputId) {
    const input = document.getElementById(focusInputId);
    setTimeout(() => input?.focus(), 20);
  }
}

function closeModal(modalId, formId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.style.display = "none";

  if (formId) {
    document.getElementById(formId)?.reset();
  }
}

function initModalsAndActions() {
  document
    .getElementById("open-join-group-btn")
    ?.addEventListener("click", () => openModal("join-group-modal", "invite-code-input"));

  document
    .getElementById("close-join-modal-btn")
    ?.addEventListener("click", () => closeModal("join-group-modal", "join-group-form"));

  document
    .getElementById("cancel-join-modal-btn")
    ?.addEventListener("click", () => closeModal("join-group-modal", "join-group-form"));

  document
    .getElementById("open-create-group-btn")
    ?.addEventListener("click", () => openModal("create-group-modal", "group-name-input"));

  document
    .getElementById("close-create-modal-btn")
    ?.addEventListener("click", () => closeModal("create-group-modal", "create-group-form"));

  document
    .getElementById("cancel-create-modal-btn")
    ?.addEventListener("click", () => closeModal("create-group-modal", "create-group-form"));

  ["join-group-modal", "create-group-modal"].forEach((id) => {
    const modal = document.getElementById(id);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(
          id,
          id === "join-group-modal" ? "join-group-form" : "create-group-form",
        );
      }
    });
  });

  document
    .getElementById("join-group-form")
    ?.addEventListener("submit", handleJoinGroup);

  document
    .getElementById("create-group-form")
    ?.addEventListener("submit", handleCreateGroup);

  document
    .getElementById("leave-group-btn")
    ?.addEventListener("click", handleLeaveGroup);

  document
    .getElementById("delete-group-btn")
    ?.addEventListener("click", handleDeleteGroup);

  document
    .getElementById("copy-invite-code-btn")
    ?.addEventListener("click", async () => {
      const codeEl = document.getElementById("active-invite-code");
      const code = codeEl?.textContent?.trim();
      if (!code || code === "------") return;

      try {
        await navigator.clipboard.writeText(code);
        const btn = document.getElementById("copy-invite-code-btn");
        if (!btn) return;
        const previous = btn.textContent;
        btn.textContent = "Copié !";
        setTimeout(() => {
          btn.textContent = previous;
        }, 1500);
      } catch (err) {
        console.error("Erreur lors de la copie du code :", err.message || err);
      }
    });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("studyquest_user");
    window.location.href = "../index.html";
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}