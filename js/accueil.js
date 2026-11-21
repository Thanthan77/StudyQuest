import { initTasksModule } from './taskManager.js';
import { loadAccueilData } from './session.js';
import { startMidnightCountdown } from './countdown.js';

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        startMidnightCountdown();

        let currentActiveTab = 'today';
        let currentCategoryFilter = 'all';

        const reloadCurrentTab = (forcedTab = null) => {
            if (forcedTab) {
                currentActiveTab = forcedTab;
            }

            const tabBtns = document.querySelectorAll('.tasks-tabs .tab-btn');
            tabBtns.forEach(btn => {
                const text = btn.textContent.trim().toLowerCase();
                btn.classList.remove('active');
                if (currentActiveTab === 'today' && text.includes("aujourd'hui")) btn.classList.add('active');
                if (currentActiveTab === 'upcoming' && text.includes("venir")) btn.classList.add('active');
                if (currentActiveTab === 'flexible' && text.includes("flexible")) btn.classList.add('active');
                if (currentActiveTab === 'completed' && text.includes("complété")) btn.classList.add('active');
                if (currentActiveTab === 'overdue' && text.includes("en retard")) btn.classList.add('active');
            });

            loadAccueilData(currentActiveTab, currentCategoryFilter);
        };

        const resetCategoryFilter = () => {
            currentCategoryFilter = 'all';
            const chips = document.querySelectorAll('.category-filter-bar .filter-chip');
            chips.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === 'all');
            });
        };

        // Délégation d'événement pour supporter les catégories générées dynamiquement
        const filterBar = document.getElementById('category-filter-bar') || document.querySelector('.category-filter-bar');
        if (filterBar) {
            filterBar.addEventListener('click', (e) => {
                const chip = e.target.closest('.filter-chip');
                if (!chip) return;

                const selectedFilter = chip.dataset.filter || 'all';
                if (selectedFilter.toLowerCase() === currentCategoryFilter.toLowerCase()) return;

                currentCategoryFilter = selectedFilter;

                filterBar.querySelectorAll('.filter-chip').forEach(b => {
                    b.classList.toggle('active', b === chip);
                });

                reloadCurrentTab();
            });
        }

        reloadCurrentTab('today');
        initTasksModule(reloadCurrentTab);

        const tabBtns = document.querySelectorAll('.tasks-tabs .tab-btn');
        tabBtns.forEach((btn, index) => {
            if (btn.classList.contains('add-task-btn')) return;
            btn.addEventListener('click', () => {
                resetCategoryFilter();
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (index === 0) reloadCurrentTab('today');
                else if (index === 1) reloadCurrentTab('overdue');
                else if (index === 2) reloadCurrentTab('upcoming');
                else if (index === 3) reloadCurrentTab('flexible');
                else if (index === 4) reloadCurrentTab('completed');
            });
        });
    }
});