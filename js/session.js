import { supabase } from './supabaseClient.js';
import { getTodayDate, isGoalReachedToday, checkAndResetRecurringTasks } from './utils.js';
import { checkAndIncrementStreak } from './app.js';

const DEFAULT_CATEGORIES = ['École', 'Personnel'];

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

// Fonction utilitaire pour la requête dynamique de l'onglet
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