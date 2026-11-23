import { supabase } from './supabaseClient.js';
import { getTodayDate, isGoalReachedToday, checkAndResetRecurringTasks } from './utils.js';
import { checkAndIncrementStreak } from './app.js';
import { computeRankedMembers } from './groupRanking.js';

const DEFAULT_CATEGORIES = ['École', 'Personnel'];
const MAX_GROUP_MEMBERS = 10;
const MAX_HOME_GROUPS = 4;

const CATEGORY_PALETTE = [
    '#6366f1',
    '#34d399',
    '#fbbf24',
    '#7dd3fc',
    '#f472b6',
    '#c084fc',
];

function getCategoryBadgeInfo(category) {
    const raw = (category || 'École').trim();
    const lower = raw.toLowerCase();

    if (lower === 'school' || lower === 'école') {
        return { label: 'École', cssClass: 'school' };
    }
    if (lower === 'personal' || lower === 'perso' || lower === 'personnel') {
        return { label: 'Personnel', cssClass: 'perso' };
    }
    return { label: raw, cssClass: 'custom' };
}

function getOrderedCategories(customCategories, tasks = []) {
    const ordered = [];
    const addCategory = (cat) => {
        const label = getCategoryBadgeInfo(String(cat || '')).label;
        if (label && !ordered.some(c => c.toLowerCase() === label.toLowerCase())) {
            ordered.push(label);
        }
    };

    if (Array.isArray(customCategories)) {
        customCategories.forEach(addCategory);
    }
    tasks.forEach(task => addCategory(task.category));

    if (ordered.length === 0) {
        ordered.push(...DEFAULT_CATEGORIES);
    }

    return ordered;
}

function buildCategoryColorMap(orderedCategories) {
    const colorMap = new Map();
    orderedCategories.forEach((label, idx) => {
        colorMap.set(
            label.toLowerCase(),
            CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length]
        );
    });
    return colorMap;
}

function renderCategoryFilterChips(customCategories, activeFilter, tasks = []) {
    const filterBar = document.getElementById('category-filter-bar');
    if (!filterBar) return;

    const categories = getOrderedCategories(customCategories, tasks);

    const normalizedActive = (activeFilter || 'all').toLowerCase();
    const isFilterStillValid =
        normalizedActive === 'all' ||
        categories.some(c => c.toLowerCase() === normalizedActive);
    const effectiveActive = isFilterStillValid ? normalizedActive : 'all';

    filterBar.innerHTML = [
        `<button type="button" class="filter-chip ${effectiveActive === 'all' ? 'active' : ''}" data-filter="all">Toutes</button>`,
        ...categories.map(cat => {
            const isActive = effectiveActive === cat.toLowerCase();
            return `<button type="button" class="filter-chip ${isActive ? 'active' : ''}" data-filter="${cat}">${cat}</button>`;
        })
    ].join('');
}

function openJoinGroupModal() {
    const modal = document.getElementById('join-group-modal');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.style.display = 'flex';
    const input = document.getElementById('invite-code-input');
    setTimeout(() => input?.focus(), 20);
}

function closeJoinGroupModal() {
    const modal = document.getElementById('join-group-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.style.display = 'none';
    document.getElementById('join-group-form')?.reset();
}

function bindJoinGroupModal(userId) {
    const joinBtn = document.querySelector('.join-group-btn');
    if (joinBtn && !joinBtn.dataset.bound) {
        joinBtn.dataset.bound = 'true';
        joinBtn.addEventListener('click', openJoinGroupModal);
    }

    const modal = document.getElementById('join-group-modal');
    if (modal && !modal.dataset.bound) {
        modal.dataset.bound = 'true';

        document
            .getElementById('close-join-modal-btn')
            ?.addEventListener('click', closeJoinGroupModal);

        document
            .getElementById('cancel-join-modal-btn')
            ?.addEventListener('click', closeJoinGroupModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeJoinGroupModal();
            }
        });

        document
            .getElementById('join-group-form')
            ?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('invite-code-input');
                const code = input?.value.trim().toUpperCase();
                if (!code || !userId) return;

                try {
                    const { data: targetGroup, error: findError } = await supabase
                        .from('groups')
                        .select('id, name, invite_code')
                        .eq('invite_code', code)
                        .single();

                    if (findError || !targetGroup) {
                        alert("Code d'invitation introuvable.");
                        return;
                    }

                    const { count, error: countError } = await supabase
                        .from('group_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', targetGroup.id);

                    if (countError) throw countError;

                    if ((count ?? 0) >= MAX_GROUP_MEMBERS) {
                        alert(`Ce groupe a déjà atteint la limite de ${MAX_GROUP_MEMBERS} membres.`);
                        return;
                    }

                    const { error: insertError } = await supabase
                        .from('group_members')
                        .insert({
                            group_id: targetGroup.id,
                            user_id: userId,
                            role: 'member',
                        });

                    if (insertError) {
                        if (insertError.code === '23505') {
                            alert("Tu fais déjà partie de ce groupe.");
                        } else {
                            throw insertError;
                        }
                        return;
                    }

                    closeJoinGroupModal();
                    await loadHomeGroups(userId);
                } catch (err) {
                    console.error("Erreur pour rejoindre le groupe :", err.message || err);
                    alert("Impossible de rejoindre le groupe.");
                }
            });
    }
}

async function loadHomeGroups(userId) {
    bindJoinGroupModal(userId);

    const countBadge = document.getElementById('groups-count-badge');
    const container = document.getElementById('groups-container');
    if (!container) return;

    try {
        const { data: memberships, error: memError } = await supabase
            .from('group_members')
            .select('group_id, groups(id, name)')
            .eq('user_id', userId);

        if (memError) throw memError;

        const groupsList = (memberships || [])
            .map(row => row.groups)
            .filter(Boolean);

        if (countBadge) countBadge.textContent = groupsList.length;

        if (groupsList.length === 0) {
            container.innerHTML = `<div class="empty-groups-msg">Aucun groupe pour l'instant.</div>`;
            return;
        }

        const groupIds = groupsList.map(g => g.id);

        const { data: allMembers, error: membersError } = await supabase
            .from('group_members')
            .select('group_id, user_id, profiles(id, username, total_completed_tasks, current_streak)')
            .in('group_id', groupIds);

        if (membersError) throw membersError;

        const cardsData = groupsList.map(group => {
            const rawMembers = (allMembers || [])
                .filter(m => m.group_id === group.id)
                .map(m => {
                    const profile = m.profiles || {};
                    const displayName =
                        String(profile.username || '').trim() ||
                        `Membre ${String(m.user_id).slice(0, 5)}`;

                    return {
                        userId: m.user_id,
                        name: displayName,
                        completedTasks: Number(profile.total_completed_tasks ?? 0) || 0,
                        streak: Number(profile.current_streak ?? 0) || 0,
                        isCurrentUser: m.user_id === userId,
                    };
                });

            const ranked = computeRankedMembers(rawMembers);
            const currentMember = ranked.find(m => m.isCurrentUser);
            const memberCount = rawMembers.length;
            const isFull = memberCount >= MAX_GROUP_MEMBERS;

            return {
                id: group.id,
                name: group.name,
                rankIndex: currentMember ? currentMember.rankIndex : 99,
                rankLabel: currentMember ? currentMember.rankLabel : '-',
                memberCount,
                isFull,
            };
        });

        const visibleGroups = cardsData.slice(0, MAX_HOME_GROUPS);

        container.innerHTML = visibleGroups
            .map(grp => {
                const rankClass = grp.rankIndex === 0 ? 'rank-1' : '';
                const countText = grp.isFull
                    ? `${grp.memberCount} / ${MAX_GROUP_MEMBERS} membres, complet`
                    : `${grp.memberCount} / ${MAX_GROUP_MEMBERS} membres`;

                return `
                    <div class="group-item" data-group-id="${grp.id}">
                        <span class="group-rank-badge ${rankClass}">${grp.rankLabel}</span>
                        <div class="group-info">
                            <strong>${grp.name}</strong>
                            <small>${countText}</small>
                        </div>
                        <i class="fa-solid fa-chevron-right group-arrow"></i>
                    </div>
                `;
            })
            .join('');

        container.querySelectorAll('.group-item').forEach(item => {
            item.addEventListener('click', () => {
                const groupId = item.dataset.groupId;
                window.location.href = `groups.html?group=${encodeURIComponent(groupId)}`;
            });
        });
    } catch (err) {
        console.error("Erreur chargement groupes accueil :", err.message || err);
        container.innerHTML = `<div class="empty-groups-msg">Impossible de charger tes groupes.</div>`;
    }
}

export async function loadAccueilData(currentTab = 'today', categoryFilter = 'all') {
    const storedUser = localStorage.getItem('studyquest_user');
    if (!storedUser) {
        window.location.href = '../index.html';
        return;
    }
    const localUser = JSON.parse(storedUser);

    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) usernameDisplay.textContent = localUser.username;

    const today = getTodayDate();
    const todayDayOfWeek = new Date().getDay();

    try {
        await checkAndResetRecurringTasks(localUser.id);

        const [
            profileRes,
            todayCountRes,
            overdueCountRes,
            upcomingCountRes,
            flexibleCountRes,
            completedBadgeRes,
            allCompletedTasksRes,
            recurringTasksRes,
            tasksRes
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', localUser.id).single(),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').eq('due_date', today).eq('status', 'pending'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').lt('due_date', today).eq('status', 'pending'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').gt('due_date', today).eq('status', 'pending'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'flexible').eq('status', 'pending'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('status', 'completed'),
            supabase.from('tasks').select('*').eq('user_id', localUser.id).eq('status', 'completed'),
            supabase.from('tasks').select('*').eq('user_id', localUser.id).eq('task_type', 'recurring').eq('status', 'pending'),
            fetchTasksForTab(localUser.id, currentTab, today, todayDayOfWeek)
        ]);

        await loadHomeGroups(localUser.id);

        let profile = profileRes.data;
        let allCompletedTasks = allCompletedTasksRes.data;

        let { data: tasks } = tasksRes;
        tasks = tasks || [];

        const orderedCategories = getOrderedCategories(profile?.custom_categories, tasks);
        const categoryColorMap = buildCategoryColorMap(orderedCategories);

        renderCategoryFilterChips(profile?.custom_categories, categoryFilter, tasks);

        const recurringToday = (recurringTasksRes.data || []).filter(task => {
            if (task.recurrence_type === 'daily') return true;
            if (task.recurrence_type === 'weekly' && Array.isArray(task.recurrence_days)) {
                return task.recurrence_days.includes(todayDayOfWeek);
            }
            return false;
        });

        const upcomingRecurring = (recurringTasksRes.data || []).filter(task => {
            if (task.recurrence_type === 'weekly' && Array.isArray(task.recurrence_days)) {
                return task.recurrence_days.some(day => day !== todayDayOfWeek);
            }
            return false;
        });

        const tabSpans = document.querySelectorAll('.tasks-tabs .tab-btn span');
        if (tabSpans[0]) tabSpans[0].textContent = (todayCountRes.count || 0) + recurringToday.length;
        if (tabSpans[1]) tabSpans[1].textContent = overdueCountRes.count || 0;
        if (tabSpans[2]) tabSpans[2].textContent = (upcomingCountRes.count || 0) + upcomingRecurring.length;
        if (tabSpans[3]) tabSpans[3].textContent = flexibleCountRes.count || 0;
        if (tabSpans[4]) tabSpans[4].textContent = completedBadgeRes.count || 0;

        const completedCountToday = allCompletedTasks ? allCompletedTasks.filter(task => {
            if (!task.completed_at) return false;

            const taskDate = new Date(task.completed_at);
            const year = taskDate.getFullYear();
            const month = String(taskDate.getMonth() + 1).padStart(2, '0');
            const day = String(taskDate.getDate()).padStart(2, '0');
            const completedDateOnly = `${year}-${month}-${day}`;

            return completedDateOnly === today;
        }) : [];

        try {
            await checkAndIncrementStreak(localUser.id, completedCountToday.length);

            const { data: refreshedProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', localUser.id)
                .single();
            if (refreshedProfile) profile = refreshedProfile;
        } catch (streakError) {
            console.error("Erreur mineure (streak non bloquant) :", streakError);
        }

        if (profile) {
            const streakCount = document.getElementById('streak-count-display');
            if (streakCount) streakCount.textContent = profile.current_streak ?? 0;

            const freezes = document.getElementById('freezes-display');
            if (freezes) freezes.textContent = `${profile.freezes_count ?? 0}/2`;

            const recordStreak = document.getElementById('record-streak-stat');
            if (recordStreak) recordStreak.textContent = `${profile.longest_streak ?? 0} jours`;

            const currentStreak = document.getElementById('current-streak-stat');
            if (currentStreak) currentStreak.textContent = `${profile.current_streak ?? 0} jours`;

            const daysIntoCycle = (profile.current_streak ?? 0) % 7;
            const percentage = (daysIntoCycle / 7) * 100;

            const progressFill = document.getElementById('gel-progress-fill');
            const progressText = document.getElementById('gel-progress-text');
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressText) progressText.textContent = `${daysIntoCycle} / 7 jours`;
        }

        if (profile && profile.freeze_used_notification) {
            alert("Série sauvée ! Un gel a été utilisé automatiquement.");
            await supabase
                .from('profiles')
                .update({ freeze_used_notification: false })
                .eq('id', localUser.id);
        }

        if (profile && profile.freeze_earned_notification) {
            alert("Gel gagné ! Il protégera automatiquement votre série si vous ratez un jour.");
            await supabase
                .from('profiles')
                .update({ freeze_earned_notification: false })
                .eq('id', localUser.id);
        }

        const tasksProgress = document.getElementById('tasks-progress-display');
        if (tasksProgress) tasksProgress.textContent = `${completedCountToday.length}/2 tâches validées aujourd'hui`;

        const goalReached = isGoalReachedToday(completedCountToday.length);
        console.log("Objectif du jour atteint ?", goalReached);

        const totalTasksStat = document.getElementById('total-tasks-stat');
        if (totalTasksStat) {
            totalTasksStat.textContent = allCompletedTasks ? allCompletedTasks.length : 0;
        }

        const box1 = document.getElementById('mini-box-1');
        const box2 = document.getElementById('mini-box-2');

        if (box1) {
            if (completedCountToday.length >= 1) {
                box1.classList.add('checked');
                box1.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                box1.classList.remove('checked');
                box1.innerHTML = '';
            }
        }

        if (box2) {
            if (completedCountToday.length >= 2) {
                box2.classList.add('checked');
                box2.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                box2.classList.remove('checked');
                box2.innerHTML = '';
            }
        }

        const normalizedFilter = (categoryFilter || 'all').toLowerCase();
        if (normalizedFilter !== 'all') {
            tasks = tasks.filter(task => {
                const taskLabel = getCategoryBadgeInfo(task.category).label.toLowerCase();
                return taskLabel === normalizedFilter;
            });
        }

        const tasksContainer = document.getElementById('tasks-container');

        if (tasksContainer) {
            if (!tasks || tasks.length === 0) {
                let emptyMessage = "Vous n'avez pas de tâches aujourd'hui";
                if (currentTab === 'overdue') emptyMessage = "Aucune tâche en retard";
                if (currentTab === 'upcoming') emptyMessage = "Aucune tâche à venir";
                if (currentTab === 'flexible') emptyMessage = "Aucune tâche flexible";
                if (currentTab === 'completed') emptyMessage = "Aucune tâche complétée pour l'instant";

                if (normalizedFilter !== 'all') {
                    const activeLabel = getCategoryBadgeInfo(categoryFilter).label;
                    emptyMessage += ` dans la catégorie ${activeLabel}`;
                }

                tasksContainer.innerHTML = `<div class="empty-state-tasks">${emptyMessage}</div>`;
            } else {
                tasksContainer.innerHTML = tasks.map(task => {
                    const isCompleted = task.status === 'completed';

                    let recurrenceBadgeHtml = '';
                    if (task.task_type === 'recurring') {
                        if (task.recurrence_type === 'daily') {
                            recurrenceBadgeHtml = `<span class="task-date"><i class="fa-solid fa-rotate"></i> Quotidienne</span>`;
                        } else if (task.recurrence_type === 'weekly' && Array.isArray(task.recurrence_days)) {
                            const dayMap = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                            const daysStr = task.recurrence_days.map(d => dayMap[d]).join(', ');
                            recurrenceBadgeHtml = `<span class="task-date"><i class="fa-solid fa-rotate"></i> Hebdo - ${daysStr}</span>`;
                        }
                    }

                    const badge = getCategoryBadgeInfo(task.category);
                    const tagColor = categoryColorMap.get(badge.label.toLowerCase()) || CATEGORY_PALETTE[0];

                    return `
                        <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
                            <label class="task-check" style="cursor: pointer;">
                                <input type="checkbox" class="native-task-checkbox" ${isCompleted ? 'checked' : ''} style="cursor: pointer;">
                            </label>
                            <span class="task-name">${task.title}</span>
                            ${task.due_date ? `<span class="task-date"><i class="fa-regular fa-calendar"></i> ${task.due_date}</span>` : ''}
                            ${recurrenceBadgeHtml}
                            <span class="task-tag ${badge.cssClass}" style="color: ${tagColor}; border-color: ${tagColor}40; background-color: ${tagColor}18;">${badge.label}</span>
                            <div class="task-actions">
                                <i class="fa-solid fa-pen edit-task-btn"></i>
                                <i class="fa-solid fa-trash delete-task-btn"></i>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    } catch (err) {
        console.error("Erreur de chargement :", err.message);
    }
}

async function fetchTasksForTab(userId, currentTab, today, todayDayOfWeek) {
    let query = supabase.from('tasks').select('*').eq('user_id', userId);

    if (currentTab === 'today') {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .or(`and(task_type.eq.dated,due_date.eq.${today}),task_type.eq.recurring`);

        if (error) return { data: [], error };

        const filteredData = (data || []).filter(task => {
            if (task.task_type === 'dated') return true;
            if (task.task_type === 'recurring') {
                if (task.recurrence_type === 'daily') return true;
                if (task.recurrence_type === 'weekly' && Array.isArray(task.recurrence_days)) {
                    return task.recurrence_days.includes(todayDayOfWeek);
                }
            }
            return false;
        });

        return { data: filteredData, error: null };

    } else if (currentTab === 'overdue') {
        query = query.eq('task_type', 'dated').lt('due_date', today).eq('status', 'pending').order('due_date', { ascending: true });

    } else if (currentTab === 'upcoming') {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .or(`and(task_type.eq.dated,due_date.gt.${today}),and(task_type.eq.recurring,recurrence_type.eq.weekly)`);

        if (error) return { data: [], error };

        const filteredData = (data || []).filter(task => {
            if (task.task_type === 'dated') return true;
            if (task.task_type === 'recurring' && Array.isArray(task.recurrence_days)) {
                return task.recurrence_days.some(day => day !== todayDayOfWeek);
            }
            return false;
        });

        return { data: filteredData, error: null };

    } else if (currentTab === 'flexible') {
        query = query.eq('task_type', 'flexible').eq('status', 'pending');
    } else if (currentTab === 'completed') {
        query = query.eq('status', 'completed').order('completed_at', { ascending: false });
    }
    return query;
}