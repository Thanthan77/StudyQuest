import { initTasksModule } from './taskManager.js';
import { loadAccueilData } from './session.js';
import { startMidnightCountdown } from './countdown.js';

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        startMidnightCountdown();
        
        // On mémorise l'onglet actif globalement ici
        let currentActiveTab = 'today';
        let currentCategoryFilter = 'all'; // Valeur par défaut du filtre de catégorie

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

            loadAccueilData(currentActiveTab,currentCategoryFilter);
        };


        // Gestion des boutons de filtre : Toutes | École | Personnel
        const filterBtns = document.querySelectorAll('.category-filter-bar .filter-chip');

        const resetCategoryFilter = () => {
            currentCategoryFilter = 'all';
            filterBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === 'all');
            });
        };

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedFilter = btn.dataset.filter || 'all';
                if (selectedFilter === currentCategoryFilter) return;

                currentCategoryFilter = selectedFilter;
                filterBtns.forEach(b => b.classList.toggle('active', b === btn));

                reloadCurrentTab();
            });
        });

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