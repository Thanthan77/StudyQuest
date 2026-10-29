// auth.js
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username-input');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = usernameInput.value.trim();

            if (!username) return;

            try {
                // Vérifie si le profil existe déjà dans la table profiles
                let { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', username)
                    .single();

                if (error && error.code === 'PGRST116') {
                    // Si le profil n'existe pas, on le crée
                    const { data: newProfile, error: insertError } = await supabase
                        .from('profiles')
                        .insert([{ username: username }])
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    profile = newProfile;
                } else if (error) {
                    throw error;
                }

                // Stocke l'utilisateur dans le localStorage pour les autres pages
                localStorage.setItem('studyquest_user', JSON.stringify(profile));

                // Redirige vers la page d'accueil principale
                window.location.href = 'pages/accueil.html';

            } catch (err) {
                console.error('Erreur de connexion :', err.message);
                if (errorMessage) {
                    errorMessage.textContent = `Erreur : ${err.message}`;
                }
            }
        });
    }

    // Gestion du bouton de déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Nettoie le stockage local de la session
            localStorage.removeItem('studyquest_user');
            sessionStorage.clear();

            // Redirige vers la page de connexion à la racine
            // (Ajuste '../index.html' si ton script est dans un sous-dossier comme 'js/')
            window.location.href = '../index.html';
        });
    }


});