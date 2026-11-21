import { supabase } from './supabaseClient.js';
import { getTodayDate, getActiveUserId } from './utils.js';

const FALLBACK_CATEGORIES = ['École', 'Personnel'];

function formatCategoryLabel(category) {
    if (!category || category === 'school') return 'École';
    if (category === 'personal' || category === 'perso') return 'Personnel';
    return String(category).trim();
}

function normalizeCategoriesList(rawCategories) {
    if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
        return [...FALLBACK_CATEGORIES];
    }

    const uniqueList = [];
    rawCategories.forEach(cat => {
        const label = formatCategoryLabel(cat);
        if (label && !uniqueList.some(existing => existing.toLowerCase() === label.toLowerCase())) {
            uniqueList.push(label);
        }
    });

    return uniqueList.length > 0 ? uniqueList : [...FALLBACK_CATEGORIES];
}

function showCategoryPopup(message, isError = false) {
    let toast = document.getElementById('category-toast-popup');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'category-toast-popup';
        toast.className = 'category-toast';
        document.body.appendChild(toast);
    }

    toast.classList.toggle('is-error', isError);
    const iconClass = isError ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';

    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${message}</span>
    `;

    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
    }, 3000);
}

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

export function initTasksModule(onDataChangeCallback) {
    const modal = document.getElementById('task-modal');
    const openModalBtn = document.querySelector('.add-task-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const tasksContainer = document.getElementById('tasks-container');

    const modalTitle = modal ? modal.querySelector('h2') : null;
    const submitBtn = addTaskForm ? addTaskForm.querySelector('.btn-primary') : null;
    const titleInput = document.getElementById('task-title-input');
    const dateInput = document.getElementById('task-date-input');
    const dateContainer = document.getElementById('date-container');
    const recurrenceContainer = document.getElementById('recurrence-container');
    const weeklyDaysContainer = document.getElementById('weekly-days-container');

    const categorySelect = document.getElementById('task-category-select');
    const categoriesTagsList = document.getElementById('categories-tags-list');
    const newCategoryInput = document.getElementById('new-category-input');
    const addCategoryBtn = document.getElementById('add-category-btn');

    let editingTaskId = null;
    let selectedTaskType = 'dated';
    let selectedCategory = 'École';
    let availableCategories = [...FALLBACK_CATEGORIES];
    let isUpdating = false;
    let selectedRecurrenceType = 'daily'; // 'daily' ou 'weekly'

    function renderCategoriesTags() {
        if (!categoriesTagsList) return;

        categoriesTagsList.innerHTML = availableCategories
            .map(cat => `
                <span class="category-pill">
                    <span>${cat}</span>
                    <button
                        type="button"
                        class="remove-category-btn"
                        data-category="${cat}"
                        title="Supprimer ${cat}"
                        aria-label="Supprimer ${cat}"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </span>
            `)
            .join('');
    }

    function renderCategoryDropdown(activeCategory = null) {
        if (!categorySelect) return;

        const list = [...availableCategories];
        const normalizedActive = activeCategory ? formatCategoryLabel(activeCategory) : '';

        if (
            normalizedActive &&
            !list.some(c => c.toLowerCase() === normalizedActive.toLowerCase())
        ) {
            list.push(normalizedActive);
        }

        categorySelect.innerHTML = list
            .map(cat => `<option value="${cat}">${cat}</option>`)
            .join('');

        const matchedOption = Array.from(categorySelect.options).find(
            opt => opt.value.toLowerCase() === normalizedActive.toLowerCase()
        );

        if (matchedOption) {
            categorySelect.value = matchedOption.value;
            selectedCategory = matchedOption.value;
        } else {
            categorySelect.value = list[0] || '';
            selectedCategory = categorySelect.value;
        }

        renderCategoriesTags();
    }

    async function loadUserCategories(preferredCategory = null) {
        const userId = getActiveUserId();
        if (!userId) {
            availableCategories = [...FALLBACK_CATEGORIES];
            renderCategoryDropdown(preferredCategory || selectedCategory);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('custom_categories')
                .eq('id', userId)
                .single();

            if (error) throw error;

            availableCategories = normalizeCategoriesList(data?.custom_categories);
        } catch (err) {
            console.error("Erreur lors du chargement de custom_categories :", err.message);
            availableCategories = [...FALLBACK_CATEGORIES];
        }

        renderCategoryDropdown(preferredCategory || selectedCategory);
    }

    loadUserCategories('École');

    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            selectedCategory = categorySelect.value;
        });
    }

    // Ajout d'une nouvelle catégorie dans profiles.custom_categories
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', async () => {
            // On appelle le callback pour recharger les données avant d'ajouter la catégorie
            if (typeof onDataChangeCallback === 'function') {
                onDataChangeCallback();
            }
            const rawName = newCategoryInput ? newCategoryInput.value.trim() : '';
            if (!rawName) {
                showCategoryPopup("Entre un nom de catégorie avant d'ajouter.", true);
                if (newCategoryInput) newCategoryInput.focus();
                return;
            }

            const cleanName = formatCategoryLabel(rawName);
            const userId = getActiveUserId();
            if (!userId) {
                showCategoryPopup("Utilisateur non connecté. Veuillez vous reconnecter.", true);
                return;
            }

            const alreadyExists = availableCategories.some(
                c => c.toLowerCase() === cleanName.toLowerCase()
            );

            if (alreadyExists) {
                const existingLabel = availableCategories.find(
                    c => c.toLowerCase() === cleanName.toLowerCase()
                );
                renderCategoryDropdown(existingLabel);
                if (newCategoryInput) newCategoryInput.value = '';
                showCategoryPopup(`La catégorie « ${existingLabel} » existe déjà.`);
                return;
            }

            const updatedCategories = [...availableCategories, cleanName];

            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ custom_categories: updatedCategories })
                    .eq('id', userId);

                if (error) throw error;

                availableCategories = updatedCategories;
                renderCategoryDropdown(cleanName);
                if (newCategoryInput) newCategoryInput.value = '';
                showCategoryPopup(`La catégorie « ${cleanName} » a été ajoutée.`);
            } catch (err) {
                console.error("Erreur lors de l'ajout de la catégorie :", err.message);
                showCategoryPopup("Erreur lors de l'ajout : " + err.message, true);
            }
        });
    }

    // Suppression d'une catégorie via sa croix
    if (categoriesTagsList) {
        categoriesTagsList.addEventListener('click', async (e) => {
            // On appelle le callback pour recharger les données avant de supprimer la catégorie
            if (typeof onDataChangeCallback === 'function') { 
                onDataChangeCallback();
            }
            const removeBtn = e.target.closest('.remove-category-btn');
            if (!removeBtn) return;

            const catToRemove = removeBtn.getAttribute('data-category');
            if (!catToRemove) return;

            if (availableCategories.length <= 1) {
                showCategoryPopup("Il faut garder au moins une catégorie.", true);
                return;
            }

            const userId = getActiveUserId();
            if (!userId) {
                showCategoryPopup("Utilisateur non connecté. Veuillez vous reconnecter.", true);
                return;
            }

            const updatedCategories = availableCategories.filter(
                c => c.toLowerCase() !== catToRemove.toLowerCase()
            );

            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ custom_categories: updatedCategories })
                    .eq('id', userId);

                if (error) throw error;

                availableCategories = updatedCategories;
                const nextSelected =
                    selectedCategory.toLowerCase() === catToRemove.toLowerCase()
                        ? availableCategories[0]
                        : selectedCategory;

                renderCategoryDropdown(nextSelected);
                showCategoryPopup(`La catégorie « ${catToRemove} » a été supprimée.`);
            } catch (err) {
                console.error("Erreur lors de la suppression de la catégorie :", err.message);
                showCategoryPopup("Erreur lors de la suppression : " + err.message, true);
            }
        });
    }

    // Gestion de l'ouverture du modal pour ajouter une nouvelle tâche
    if (openModalBtn) {
        openModalBtn.addEventListener('click', async () => {
            editingTaskId = null;
            if (modalTitle) modalTitle.textContent = "Nouvelle tâche";
            if (submitBtn) submitBtn.textContent = "Ajouter la tâche";
            if (addTaskForm) addTaskForm.reset();
            if (dateInput) dateInput.value = getTodayDate();
            await loadUserCategories('École');
            resetFormUI('dated', selectedCategory || 'École', 'daily', []);
            if (modal) modal.style.display = 'flex';
        });
    }

    function closeModal() {
        if (modal) {
            modal.style.display = 'none';
            if (addTaskForm) addTaskForm.reset();
            editingTaskId = null;
        }
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    // Fonction pour réinitialiser ou charger l'UI de la modale
    function resetFormUI(type, category, recType = 'daily', recDays = []) {
        selectedTaskType = type;
        selectedCategory = formatCategoryLabel(category || 'École');
        selectedRecurrenceType = recType;

        document.querySelectorAll('.toggle-btn').forEach(b => {
            const when = b.getAttribute('data-when');
            let targetWhen = 'specific';
            if (type === 'flexible') targetWhen = 'flexible';
            if (type === 'recurring') targetWhen = 'recurring';
            b.classList.toggle('active', when === targetWhen);
        });

        if (dateContainer) {
            dateContainer.style.display = (type === 'dated') ? 'block' : 'none';
        }
        if (recurrenceContainer) {
            recurrenceContainer.style.display = (type === 'recurring') ? 'block' : 'none';
        }

        document.querySelectorAll('.rec-btn').forEach(b => {
            const rec = b.getAttribute('data-rec');
            b.classList.toggle('active', rec === recType);
        });

        if (weeklyDaysContainer) {
            weeklyDaysContainer.style.display = (recType === 'weekly' && type === 'recurring') ? 'block' : 'none';
        }

        document.querySelectorAll('input[name="rec-day"]').forEach(cb => {
            cb.checked = recDays.includes(parseInt(cb.value));
        });

        renderCategoryDropdown(selectedCategory);
    }

    // Gestion du clic sur les types principaux
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const when = btn.getAttribute('data-when');

            if (when === 'specific') selectedTaskType = 'dated';
            else if (when === 'flexible') selectedTaskType = 'flexible';
            else if (when === 'recurring') selectedTaskType = 'recurring';

            if (dateContainer) dateContainer.style.display = (selectedTaskType === 'dated') ? 'block' : 'none';
            if (recurrenceContainer) recurrenceContainer.style.display = (selectedTaskType === 'recurring') ? 'block' : 'none';
            if (weeklyDaysContainer) {
                weeklyDaysContainer.style.display = (selectedRecurrenceType === 'weekly' && selectedTaskType === 'recurring') ? 'block' : 'none';
            }
        });
    });

    // Gestion du clic sur la sous-fréquence (daily / weekly)
    document.querySelectorAll('.rec-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRecurrenceType = btn.getAttribute('data-rec');

            if (weeklyDaysContainer) {
                weeklyDaysContainer.style.display = (selectedRecurrenceType === 'weekly') ? 'block' : 'none';
            }
        });
    });

    // Soumission du formulaire pour ajouter ou modifier une tâche
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userId = getActiveUserId();
            if (!userId) {
                alert("Utilisateur non connecté. Veuillez vous reconnecter.");
                return;
            }

            const taskTitle = titleInput ? titleInput.value.trim() : '';
            const dueDate = selectedTaskType === 'dated' && dateInput ? dateInput.value : null;
            const chosenCategory = categorySelect ? categorySelect.value : selectedCategory;

            let recurrenceTypeVal = null;
            let recurrenceDaysVal = null;

            if (selectedTaskType === 'recurring') {
                recurrenceTypeVal = selectedRecurrenceType;
                if (selectedRecurrenceType === 'weekly') {
                    const checkedDays = document.querySelectorAll('input[name="rec-day"]:checked');
                    recurrenceDaysVal = Array.from(checkedDays).map(cb => parseInt(cb.value));
                }
            }

            try {
                if (editingTaskId) {
                    const { error } = await supabase.from('tasks').update({
                        title: taskTitle,
                        task_type: selectedTaskType,
                        due_date: dueDate || null,
                        category: chosenCategory,
                        recurrence_type: recurrenceTypeVal,
                        recurrence_days: recurrenceDaysVal
                    }).eq('id', editingTaskId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('tasks').insert([{
                        user_id: userId,
                        title: taskTitle,
                        task_type: selectedTaskType,
                        due_date: dueDate || null,
                        status: 'pending',
                        category: chosenCategory,
                        recurrence_type: recurrenceTypeVal,
                        recurrence_days: recurrenceDaysVal
                    }]);
                    if (error) throw error;

                    const { error: rpcError } = await supabase.rpc('increment_tasks_created', {
                        p_user_id: userId
                    });
                    if (rpcError) {
                        console.error("Erreur lors de l'incrémentation de total_tasks_created :", rpcError.message);
                    }
                }

                closeModal();

                let targetTab = 'today';
                if (selectedTaskType === 'flexible') {
                    targetTab = 'flexible';
                } else if (selectedTaskType === 'recurring') {
                    targetTab = 'today';
                } else if (dueDate && dueDate > getTodayDate()) {
                    targetTab = 'upcoming';
                }

                if (typeof onDataChangeCallback === 'function') {
                    onDataChangeCallback(targetTab);
                }
            } catch (err) {
                console.error("Erreur lors de l'enregistrement de la tâche :", err.message);
                alert("Erreur : " + err.message);
            }
        });
    }

    // Action sur les tâches (compléter, supprimer, modifier)
    if (tasksContainer) {
        tasksContainer.addEventListener('click', async (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;

            const taskId = taskItem.getAttribute('data-id');

            // Case à cocher (Compléter / Décocher)
            const checkbox = e.target.closest('.native-task-checkbox');
            if (checkbox) {
                if (isUpdating) return;
                isUpdating = true;

                const isCompleted = checkbox.checked;
                const newStatus = isCompleted ? 'completed' : 'pending';
                taskItem.classList.toggle('completed', isCompleted);

                try {
                    const completedAtValue = isCompleted ? new Date().toISOString() : null;

                    const { error: taskError } = await supabase
                        .from('tasks')
                        .update({
                            status: newStatus,
                            completed_at: completedAtValue
                        })
                        .eq('id', taskId);

                    if (taskError) throw taskError;

                    const userId = getActiveUserId();
                    if (userId) {
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('total_completed_tasks')
                            .eq('id', userId)
                            .single();

                        if (profileData) {
                            const currentTotal = profileData.total_completed_tasks || 0;
                            const newTotal = isCompleted ? currentTotal + 1 : Math.max(0, currentTotal - 1);

                            await supabase
                                .from('profiles')
                                .update({ total_completed_tasks: newTotal })
                                .eq('id', userId);
                        }
                    }

                    if (typeof onDataChangeCallback === 'function') {
                        onDataChangeCallback();
                    }
                } catch (err) {
                    console.error("Erreur lors de la mise à jour du statut :", err.message);
                    checkbox.checked = !isCompleted;
                    taskItem.classList.toggle('completed', !isCompleted);
                } finally {
                    setTimeout(() => { isUpdating = false; }, 300);
                }
            }

            // Supprimer
            if (e.target.closest('.delete-task-btn')) {
                if (confirm("Supprimer cette tâche ?")) {
                    try {
                        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
                        if (error) throw error;

                        const userId = getActiveUserId();
                        if (userId) {
                            const { error: rpcError } = await supabase.rpc('decrement_tasks_created', {
                                p_user_id: userId
                            });
                            if (rpcError) {
                                console.error("Erreur lors de la décrémentation de total_tasks_created :", rpcError.message);
                            }
                        }

                        if (typeof onDataChangeCallback === 'function') onDataChangeCallback();
                    } catch (err) {
                        console.error("Erreur lors de la suppression :", err.message);
                    }
                }
            }

            // Modifier
            if (e.target.closest('.edit-task-btn')) {
                try {
                    const { data: taskData, error } = await supabase.from('tasks').select('*').eq('id', taskId).single();
                    if (error) throw error;
                    if (!taskData) return;

                    editingTaskId = taskId;
                    if (modalTitle) modalTitle.textContent = "Modifier la tâche";
                    if (submitBtn) submitBtn.textContent = "Enregistrer les modifications";

                    if (titleInput) titleInput.value = taskData.title || '';
                    if (dateInput) dateInput.value = taskData.due_date || '';

                    await loadUserCategories(taskData.category || 'École');

                    resetFormUI(
                        taskData.task_type || 'dated',
                        taskData.category || 'École',
                        taskData.recurrence_type || 'daily',
                        taskData.recurrence_days || []
                    );

                    if (modal) modal.style.display = 'flex';
                } catch (err) {
                    console.error("Erreur lors de la modification :", err.message);
                }
            }
        });
    }
}