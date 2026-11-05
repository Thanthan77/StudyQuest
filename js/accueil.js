import { initTasksModule } from './taskManager.js';
import { loadAccueilData } from './session.js';
import { startMidnightCountdown } from './countdown.js';

// Lancer le chargement au chargement du DOM si on est sur la page d'accueil
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        startMidnightCountdown();
        
        // Accepte un onglet forcé (ex: après un ajout de tâche), sinon détecte l'onglet actif
        const reloadCurrentTab = (forcedTab = null) => {
            let tabName = forcedTab;

            if (!tabName) {
                const activeBtn = document.querySelector('.tasks-tabs .tab-btn.active');
                tabName = 'today';
                
                if (activeBtn) {
                    const text = activeBtn.textContent.trim().toLowerCase();
                    if (text.includes('venir')) tabName = 'upcoming';
                    else if (text.includes('flexible')) tabName = 'flexible';
                    else if (text.includes('complété')) tabName = 'completed';
                }
            }

            // Met à jour visuellement la classe .active sur les boutons d'onglets
            const tabBtns = document.querySelectorAll('.tasks-tabs .tab-btn');
            tabBtns.forEach(btn => {
                const text = btn.textContent.trim().toLowerCase();
                btn.classList.remove('active');
                if (tabName === 'today' && text.includes("aujourd'hui")) btn.classList.add('active');
                if (tabName === 'upcoming' && text.includes("venir")) btn.classList.add('active');
                if (tabName === 'flexible' && text.includes("flexible")) btn.classList.add('active');
                if (tabName === 'completed' && text.includes("complété")) btn.classList.add('active');
            });

            loadAccueilData(tabName);
        };

        reloadCurrentTab();
        initTasksModule(reloadCurrentTab); 
    }
});