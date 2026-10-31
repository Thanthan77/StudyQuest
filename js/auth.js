import { supabase } from './supabaseClient.js';

//Fonction pour hacher le code PIN en clair dans les champs de saisie

/*
La fonction hashPin combine le pseudo et le code PIN pour les transformer en une empreinte 
cryptographique sécurisée (via SHA-256), évitant ainsi de stocker le code en clair dans la base de données.
*/

async function hashPin(username, pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(username + "_" + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Gestion de la connexion 
async function handleLogin(e, errorMessage) {
    e.preventDefault();
    const usernameInput = document.getElementById('username-input');
    const pinInputs = document.querySelectorAll('.pin-input');
    
    const username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
    const pin = Array.from(pinInputs).map(input => input.value).join('');

    if (!username || pin.length !== 4) {
        if (errorMessage) errorMessage.textContent = "Entre ton pseudo et ton code PIN à 4 chiffres.";
        return;
    }

    try {
        let { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !profile) {
            throw new Error("Ce pseudo n'existe pas. Inscris-toi d'abord.");
        }

        // Hacher le PIN entré avec le même pseudo pour comparer avec la base
        const hashedPin = await hashPin(username, pin);

        if (profile.pin !== hashedPin) {
            throw new Error("Code PIN incorrect.");
        }

        localStorage.setItem('studyquest_user', JSON.stringify(profile));
        window.location.href = 'pages/accueil.html';

    } catch (err) {
        console.error('Erreur de connexion :', err.message);
        if (errorMessage) errorMessage.textContent = err.message;
    }
}

// Gestion de l'inscription
async function handleSignup(e, errorMessage) {
    e.preventDefault();
    const usernameInput = document.getElementById('username-input');
    const pinInputs = document.querySelectorAll('.pin-input');

    const username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
    const pin = Array.from(pinInputs).map(input => input.value).join('');

    if (!username || pin.length !== 4) {
        if (errorMessage) errorMessage.textContent = "Veuillez remplir tous les champs et un PIN à 4 chiffres.";
        return;
    }

    try {
        let { data: existingUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single();

        if (existingUser) {
            throw new Error("Ce pseudo est déjà pris. Choisis-en un autre.");
        }

        // Hacher le PIN avant de l'envoyer dans Supabase
        const hashedPin = await hashPin(username, pin);

        const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([{ username: username, pin: hashedPin }])
            .select()
            .single();

        if (insertError) throw insertError;

        localStorage.setItem('studyquest_user', JSON.stringify(newProfile));
        window.location.href = 'pages/accueil.html';

    } catch (err) {
        console.error("Erreur d'inscription :", err.message);
        if (errorMessage) errorMessage.textContent = err.message;
    }
}

// Profile utilisateur et gestion de la session
function checkUserSession() {
    const usernameDisplay = document.getElementById('username-display');
    const storedUser = localStorage.getItem('studyquest_user');
    
    if (storedUser && usernameDisplay) {
        const localUser = JSON.parse(storedUser);
        usernameDisplay.textContent = localUser.username;
    }
}

// Gestion de la déconnexion
function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('studyquest_user');
    sessionStorage.clear();
    window.location.href = '../index.html';
}

// Initialisation des événements après le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    const errorMessage = document.getElementById('error-message');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => handleLogin(e, errorMessage));
    }

    if (signupForm) {
        signupForm.addEventListener('submit', (e) => handleSignup(e, errorMessage));
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    checkUserSession();
});