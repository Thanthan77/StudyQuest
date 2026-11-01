import { initTasksModule } from './taskManager.js';
import{ loadAccueilData } from './session.js';
import { startMidnightCountdown } from './countdown.js';

// Lancer le chargement au chargement du DOM si on est sur la page d'accueil
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        startMidnightCountdown();
        loadAccueilData();
        initTasksModule(loadAccueilData); 
    }
});