// Translation system
const translations = {
    no: {
        title: "🎬 TG26 Frivilligpleie Kino",
        voteSubtitle: "Stem på hvilken film du vil se!",
        adminPanel: "Admin Panel",
        scheduleLink: "📅 Vis Kinotider",
        updateInfo: "Oppdateres hver dag, ca klokken 22:00",
        searchPlaceholder: "Søk etter film...",
        noResults: "Ingen filmer funnet",
        alreadyAdded: "Denne filmen er allerede i listen!",
        voteSuccess: "Stem registrert!",
        alreadyVoted: "Du har allerede stemt på denne filmen!",
        movieAdded: "filmen ble lagt til!",
        errorAddingMovie: "Feil ved tillegg av film. Prøv igjen.",
        noMoviesToExport: "Ingen filmer å eksportere",
        openingExport: "Åpner Google Sheets eksport...",
        dataCopied: "Data kopiert! Lim inn i Google Sheets.",
        exportInstructions: "Instruksjoner:",
        exportStep1: "Klikk &quot;Kopier Data&quot; knappen nedenfor",
        exportStep2: "Åpne Google Sheets",
        exportStep3: "Velg celle A1",
        exportStep4: "Trykk Ctrl+V (eller Cmd+V på Mac) for å lime inn",
        exportTitle: "Eksporter til Google Sheets",
        copyData: "Kopier Data",
        loadingVotes: "Laster inn stemmer...",
        currentRanking: "Nåværende rangering",
        votes: "stemmer",
        vote: "stem",
        upvote: "Stem opp",
        movieInfo: "Filminfo",
        director: "Regissør",
        runtime: "Varighet",
        genre: "Sjanger",
        rating: "Vurdering",
        releaseYear: "Utgivelsesår",
        overview: "Oversikt",
        addToVoting: "Legg til i avstemning",
        searchForMovies: "Søk etter filmer å legge til"
    },
    en: {
        title: "🎬 TG26 Volunteer Cinema",
        voteSubtitle: "Vote for the movie you want to watch!",
        adminPanel: "Admin Panel",
        scheduleLink: "📅 View Schedule",
        updateInfo: "Updated daily around 22:00",
        searchPlaceholder: "Search for movies...",
        noResults: "No movies found",
        alreadyAdded: "This movie is already in the voting list!",
        voteSuccess: "Vote recorded!",
        alreadyVoted: "You have already voted for this movie!",
        movieAdded: "movie added successfully!",
        errorAddingMovie: "Error adding movie. Please try again.",
        noMoviesToExport: "No movies to export",
        openingExport: "Opening Google Sheets export...",
        dataCopied: "Data copied! Paste into Google Sheets.",
        exportInstructions: "Instructions:",
        exportStep1: "Click &quot;Copy Data&quot; button below",
        exportStep2: "Open Google Sheets",
        exportStep3: "Select cell A1",
        exportStep4: "Press Ctrl+V (or Cmd+V on Mac) to paste",
        exportTitle: "Export to Google Sheets",
        copyData: "Copy Data",
        loadingVotes: "Loading votes...",
        currentRanking: "Current Ranking",
        votes: "votes",
        vote: "vote",
        upvote: "Vote",
        movieInfo: "Movie Info",
        director: "Director",
        runtime: "Runtime",
        genre: "Genre",
        rating: "Rating",
        releaseYear: "Release Year",
        overview: "Overview",
        addToVoting: "Add to Voting",
        searchForMovies: "Search for movies to add"
    }
};

let currentLang = localStorage.getItem("language") || "no";

// Language switching
function switchLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("language", lang);

    // Update button states
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    // Update all elements with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    // Update placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
        const key = element.getAttribute("data-i18n-placeholder");
        if (translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    // Update page title
    document.title = translations[lang].title;

    // Refresh movies to update dynamic content
    if (typeof displayMovies === "function") {
        displayMovies();
    }
}

// Configuration (loaded from external config file)
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAcDy87-Xy7xUS6LrIUjC6Nq5UONNQNYLs",
  authDomain: "tg-movie.firebaseapp.com",
  projectId: "tg-movie",
  storageBucket: "tg-movie.firebasestorage.app",
  messagingSenderId: "94015823676",
  appId: "1:94015823676:web:3770d5bf1e565809a14839",
  measurementId: "G-BL2N03211Z"
};

// Get config from external file
let TMDB_API_KEY = '65d522ce451d6a137a804b350eac8894';
let DEFAULT_ADMIN_PASSWORD = '1234qwer';

// State Management
let movies = [];
let adminPassword = DEFAULT_ADMIN_PASSWORD;
let searchTimeout = null;
let isAdminLoggedIn = false;
let db = null;
let unsubscribe = null;
let userVotes = {}; // Track which movies the user has voted on
let userId = null; // Unique user identifier

// Load admin password from localStorage
function loadAdminPassword() {
    // First try to get from config
    adminPassword = window.configLoader ? window.configLoader.getAdminPassword() : DEFAULT_ADMIN_PASSWORD;
    
    // Then check if user has changed it locally
    const savedPassword = localStorage.getItem('adminPassword');
    if (savedPassword) {
        adminPassword = savedPassword;
    }
}

// Save admin password to localStorage
function saveAdminPassword() {
    localStorage.setItem('adminPassword', adminPassword);
}

// Generate or retrieve unique user ID
function getUserId() {
    let id = localStorage.getItem('userId');
    if (!id) {
        // Generate a unique ID based on browser fingerprint
        id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', id);
    }
    return id;
}

// Load user votes from Firebase
async function loadUserVotes() {
    try {
        const { collection, query, where, getDocs } = window.firestoreFunctions;
        const votesRef = collection(db, 'votes');
        const q = query(votesRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);
        
        userVotes = {};
        snapshot.forEach((doc) => {
            const data = doc.data();
            userVotes[data.movieId] = true;
        });
    } catch (error) {
        console.error('Error loading user votes:', error);
    }
}

// Check if user has already voted on a movie
function hasUserVoted(movieId) {
    return userVotes[movieId] === true;
}

// Mark movie as voted in Firebase
async function markAsVoted(movieId) {
    try {
        const { collection, addDoc } = window.firestoreFunctions;
        await addDoc(collection(db, 'votes'), {
            userId: userId,
            movieId: movieId,
            timestamp: new Date().toISOString()
        });
        userVotes[movieId] = true;
    } catch (error) {
        console.error('Error marking as voted:', error);
    }
}

// Initialize Firebase
async function initializeFirebase() {
    try {
        // Import Firebase modules from CDN
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        // Store Firestore functions globally for easy access
        window.firestoreFunctions = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where };
        
        console.log('Firebase initialized successfully');
        
        // Get or create user ID
        userId = getUserId();
        
        // Load user's votes from Firebase
        await loadUserVotes();
        
        // Start listening to real-time updates
        startRealtimeListener();
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        alert('Error connecting to database. Please refresh the page.');
    }
}

// Start real-time listener for movies
function startRealtimeListener() {
    const { collection, onSnapshot, query, orderBy } = window.firestoreFunctions;
    
    const moviesRef = collection(db, 'movies');
    const q = query(moviesRef, orderBy('votes', 'desc'));
    
    unsubscribe = onSnapshot(q, (snapshot) => {
        movies = [];
        snapshot.forEach((doc) => {
            movies.push({
                firestoreId: doc.id,
                ...doc.data()
            });
        });
        renderMovies();
        if (isAdminLoggedIn) {
            renderAdminMoviesList();
        }
    }, (error) => {
        console.error('Error listening to movies:', error);
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Load configuration first
    if (window.configLoader) {
        await window.configLoader.loadConfig();
    }
    
    loadAdminPassword();
    initializeEventListeners();
    await initializeFirebase();
       
       // Initialize language system
       switchLanguage(currentLang);
       
       // Add language switcher event listeners
       document.querySelectorAll('.lang-btn').forEach(btn => {
           btn.addEventListener('click', () => {
               switchLanguage(btn.dataset.lang);
           });
       });
});

// Initialize event listeners
function initializeEventListeners() {
    // Movie search
    const searchInput = document.getElementById('movieSearch');
    searchInput.addEventListener('input', handleSearch);
    
    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            document.getElementById('searchResults').classList.remove('active');
        }
    });
    
    // Admin modal
    const adminBtn = document.getElementById('adminBtn');
    const modal = document.getElementById('adminModal');
    const closeBtn = document.querySelector('.close');
    
    adminBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        isAdminLoggedIn = false;
        document.getElementById('adminLogin').style.display = 'block';
        document.getElementById('adminPanel').style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            isAdminLoggedIn = false;
            document.getElementById('adminLogin').style.display = 'block';
            document.getElementById('adminPanel').style.display = 'none';
        }
    });
    
    // Admin login
    document.getElementById('loginBtn').addEventListener('click', handleAdminLogin);
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAdminLogin();
    });
    
    // Admin actions
    document.getElementById('resetVotesBtn').addEventListener('click', resetAllVotes);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllMovies);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('exportSheetsBtn').addEventListener('click', exportToGoogleSheets);
    document.getElementById('changePasswordBtn').addEventListener('click', () => {
        const section = document.getElementById('changePasswordSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('savePasswordBtn').addEventListener('click', changePassword);
}

// Handle movie search
async function handleSearch(e) {
    const query = e.target.value.trim();
    const resultsContainer = document.getElementById('searchResults');
    
    if (query.length < 2) {
        resultsContainer.classList.remove('active');
        return;
    }
    
    // Get API key from config
    const apiKey = window.configLoader ? window.configLoader.getTmdbApiKey() : TMDB_API_KEY;
    
    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch movies');
            }
            
            const data = await response.json();
            displaySearchResults(data.results.slice(0, 5));
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = '<div style="padding: 15px; color: #f44336;">Error searching movies. Please check your API key.</div>';
            resultsContainer.classList.add('active');
        }
    }, 300);
}

// Display search results
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 15px; color: #999;">No movies found</div>';
        resultsContainer.classList.add('active');
        return;
    }
    
    resultsContainer.innerHTML = results.map(movie => {
        const posterPath = movie.poster_path 
            ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
            : 'https://via.placeholder.com/50x75?text=No+Image';
        
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
        
        return `
            <div class="search-result-item" data-movie-id="${movie.id}">
                <img src="${posterPath}" alt="${movie.title}">
                <div class="search-result-info">
                    <div class="search-result-title">${movie.title}</div>
                    <div class="search-result-year">${year}</div>
                </div>
            </div>
        `;
    }).join('');
    
    resultsContainer.classList.add('active');
    
    // Add click listeners to search results
    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const movieId = parseInt(item.getAttribute('data-movie-id'));
            addMovie(movieId);
        });
    });
}

// Add movie to Firebase
async function addMovie(movieId) {
    // Check if movie already exists
    if (movies.some(m => m.id === movieId)) {
        alert('This movie is already in the voting list!');
        document.getElementById('searchResults').classList.remove('active');
        document.getElementById('movieSearch').value = '';
        return;
    }
    
    // Get API key from config
    const apiKey = window.configLoader ? window.configLoader.getTmdbApiKey() : TMDB_API_KEY;
    
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${movieId}?api_key=${apiKey}&language=en-US`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch movie details');
        }
        
        const movieData = await response.json();
        
        const movie = {
            id: movieData.id,
            title: movieData.title,
            year: movieData.release_date ? new Date(movieData.release_date).getFullYear() : 'N/A',
            overview: movieData.overview || 'No overview available.',
            posterPath: movieData.poster_path 
                ? `${TMDB_IMAGE_BASE}${movieData.poster_path}`
                : 'https://via.placeholder.com/300x450?text=No+Poster',
            rating: movieData.vote_average ? movieData.vote_average.toFixed(1) : 'N/A',
            runtime: movieData.runtime || null,
            votes: 0,
            addedAt: new Date().toISOString()
        };
        
        // Add to Firebase
        const { collection, addDoc } = window.firestoreFunctions;
        await addDoc(collection(db, 'movies'), movie);
        
        // Clear search
        document.getElementById('searchResults').classList.remove('active');
        document.getElementById('movieSearch').value = '';
        
        showNotification(`"${movie.title}" lagt til!`);
    } catch (error) {
        console.error('Error adding movie:', error);
        alert('Noe gikk feil, prøv igjen.');
    }
}

// Vote for a movie
async function voteForMovie(movieId, buttonElement) {
    // Check if user has already voted on this movie
    if (hasUserVoted(movieId)) {
        showNotification('Du har allerede stemt på denne filmen!');
        return;
    }
    
    const movie = movies.find(m => m.id === movieId);
    if (movie && movie.firestoreId) {
        try {
            const { doc, updateDoc } = window.firestoreFunctions;
            const movieRef = doc(db, 'movies', movie.firestoreId);
            await updateDoc(movieRef, {
                votes: movie.votes + 1
            });
            
            // Mark as voted
            markAsVoted(movieId);
            
            // Update button appearance
            if (buttonElement) {
                buttonElement.disabled = true;
                buttonElement.textContent = '✓ Voted';
                buttonElement.style.background = '#666';
                buttonElement.style.cursor = 'not-allowed';
                
                // Animate vote button
                buttonElement.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    buttonElement.style.transform = 'scale(1)';
                }, 200);
            }
            
            showNotification('Stemme registrert!');
        } catch (error) {
            console.error('Error voting:', error);
            alert('Error recording vote. Please try again.');
        }
    }
}

// Render movies list
function renderMovies() {
    const moviesList = document.getElementById('moviesList');
    const movieCount = document.getElementById('movieCount');
    
    // Sort by votes (descending) - already sorted by Firebase query
    const sortedMovies = [...movies];
    
    const voteText = translations[currentLang].votes;
       movieCount.textContent = `${movies.length} film${movies.length !== 1 ? 'er' : ''}`;
    
    if (sortedMovies.length === 0) {
        moviesList.innerHTML = `<p class="empty-state">${translations[currentLang].noResults ? translations[currentLang].noResults : 'Ingen filmer er lagt til enda, legg til en film for å stemme!'}</p>`;
        return;
    }
    
    moviesList.innerHTML = sortedMovies.map(movie => {
        const hasVoted = hasUserVoted(movie.id);
        const buttonText = hasVoted ? '✓ Stemt' : '👍 Stem opp';
        const buttonStyle = hasVoted ? 'background: #666; cursor: not-allowed;' : '';
        const buttonDisabled = hasVoted ? 'disabled' : '';
        
        return `
            <div class="movie-card">
                <img src="${movie.posterPath}" alt="${movie.title}" class="movie-poster">
                <div class="movie-info">
                    <div class="movie-title">${movie.title}</div>
                    <div class="movie-year">${movie.year}</div>
                    <div class="movie-overview">${movie.overview}</div>
                    <div class="movie-rating">⭐ ${movie.rating}/10</div>
                    <div class="vote-section">
                        <button class="vote-btn" data-movie-id="${movie.id}" ${buttonDisabled} style="${buttonStyle}">
                            ${buttonText}
                        </button>
                        <span class="vote-count">${movie.votes} vote${movie.votes !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click listeners to vote buttons (only for non-disabled buttons)
    moviesList.querySelectorAll('.vote-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const movieId = parseInt(btn.getAttribute('data-movie-id'));
            voteForMovie(movieId, e.target);
        });
    });
}

// Admin login
function handleAdminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (password === adminPassword) {
        isAdminLoggedIn = true;
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('adminPassword').value = '';
        renderAdminMoviesList();
    } else {
        alert('Incorrect password!');
    }
}

// Render admin movies list
function renderAdminMoviesList() {
    const adminMoviesList = document.getElementById('adminMoviesList');
    
    if (movies.length === 0) {
        adminMoviesList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No movies to manage</p>';
        return;
    }
    
    const sortedMovies = [...movies];
    
    adminMoviesList.innerHTML = sortedMovies.map(movie => `
        <div class="admin-movie-item">
            <div class="admin-movie-info">
                <div class="admin-movie-title">${movie.title} (${movie.year})</div>
                <div class="admin-movie-votes">${movie.votes} votes</div>
            </div>
            <div class="admin-movie-actions">
                <button data-firestore-id="${movie.firestoreId}">Delete</button>
            </div>
        </div>
    `).join('');
    
    // Add click listeners to delete buttons
    adminMoviesList.querySelectorAll('.admin-movie-actions button').forEach(btn => {
        btn.addEventListener('click', () => {
            const firestoreId = btn.getAttribute('data-firestore-id');
            deleteMovie(firestoreId);
        });
    });
}

// Delete a movie
async function deleteMovie(firestoreId) {
    if (confirm('Are you sure you want to delete this movie?')) {
        try {
            const { doc, deleteDoc } = window.firestoreFunctions;
            await deleteDoc(doc(db, 'movies', firestoreId));
            showNotification('Movie deleted successfully!');
        } catch (error) {
            console.error('Error deleting movie:', error);
            alert('Error deleting movie. Please try again.');
        }
    }
}

// Reset all votes
async function resetAllVotes() {
    if (confirm('Are you sure you want to reset all votes to 0? This will also clear all users\' vote history.')) {
        try {
            const { doc, updateDoc, collection, getDocs, deleteDoc } = window.firestoreFunctions;
            
            // Reset movie vote counts
            for (const movie of movies) {
                if (movie.firestoreId) {
                    const movieRef = doc(db, 'movies', movie.firestoreId);
                    await updateDoc(movieRef, { votes: 0 });
                }
            }
            
            // Delete all vote records from Firebase
            const votesRef = collection(db, 'votes');
            const snapshot = await getDocs(votesRef);
            const deletePromises = [];
            snapshot.forEach((docSnapshot) => {
                deletePromises.push(deleteDoc(doc(db, 'votes', docSnapshot.id)));
            });
            await Promise.all(deletePromises);
            
            // Clear local user votes
            userVotes = {};
            
            showNotification('All votes reset to 0!');
        } catch (error) {
            console.error('Error resetting votes:', error);
            alert('Error resetting votes. Please try again.');
        }
    }
}

// Clear all movies
async function clearAllMovies() {
    if (confirm('Are you sure you want to delete ALL movies? This cannot be undone!')) {
        if (confirm('Really? This will delete everything including all votes!')) {
            try {
                const { doc, deleteDoc, collection, getDocs } = window.firestoreFunctions;
                
                // Delete all movies
                for (const movie of movies) {
                    if (movie.firestoreId) {
                        await deleteDoc(doc(db, 'movies', movie.firestoreId));
                    }
                }
                
                // Delete all vote records
                const votesRef = collection(db, 'votes');
                const snapshot = await getDocs(votesRef);
                const deletePromises = [];
                snapshot.forEach((docSnapshot) => {
                    deletePromises.push(deleteDoc(doc(db, 'votes', docSnapshot.id)));
                });
                await Promise.all(deletePromises);
                
                // Clear local user votes
                userVotes = {};
                
                showNotification('All movies and votes cleared!');
            } catch (error) {
                console.error('Error clearing movies:', error);
                alert('Error clearing movies. Please try again.');
            }
        }
    }
}

// Export to CSV
function exportToCSV() {
    if (movies.length === 0) {
        alert('No movies to export!');
        return;
    }
    
    const sortedMovies = [...movies];
    
    // Create CSV content
    let csv = 'Rank,Title,Year,Votes,Rating,Overview\n';
    sortedMovies.forEach((movie, index) => {
        const overview = movie.overview.replace(/"/g, '""');
        csv += `${index + 1},"${movie.title}",${movie.year},${movie.votes},${movie.rating},"${overview}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movie-votes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('CSV exported successfully!');
}

// Export to Google Sheets
async function exportToGoogleSheets() {
    if (movies.length === 0) {
        alert('Ingen filmer å eksportere');
        return;
    }
    
    const sortedMovies = [...movies];
    
    // Fetch runtime for movies that don't have it
    const apiKey = window.configLoader ? window.configLoader.getTmdbApiKey() : TMDB_API_KEY;
    const moviesWithRuntime = await Promise.all(sortedMovies.map(async (movie) => {
        if (!movie.runtime) {
            try {
                const response = await fetch(`${TMDB_BASE_URL}/movie/${movie.id}?api_key=${apiKey}&language=en-US`);
                const data = await response.json();
                movie.runtime = data.runtime || null;
            } catch (error) {
                console.error('Error fetching runtime for movie:', movie.title, error);
            }
        }
        return movie;
    }));
    
    // Create TSV content with headers
    let tsv = 'Rank\tTitle\tYear\tVotes\tDuration\tTMDB Link\n';
    moviesWithRuntime.forEach((movie, index) => {
        const rank = index + 1;
        const title = movie.title || 'N/A';
        const year = movie.year || 'N/A';
        const votes = movie.votes || 0;
        const duration = movie.runtime ? `${movie.runtime} min` : 'N/A';
        const tmdbLink = `https://www.themoviedb.org/movie/${movie.id}`;
        
        tsv += `${rank}\t${title}\t${year}\t${votes}\t${duration}\t${tmdbLink}\n`;
    });
    
    // Create a popup window with instructions
    const popup = window.open('', 'Export to Google Sheets', 'width=600,height=400');
    popup.document.write(`
        <html>
        <head>
            <title>Eksporter til Google Sheets</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                h2 {
                    color: #333;
                    margin-top: 0;
                }
                .instructions {
                    background: #e3f2fd;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 15px 0;
                }
                .instructions ol {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                textarea {
                    width: 100%;
                    height: 200px;
                    font-family: monospace;
                    font-size: 12px;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                button {
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 10px;
                }
                button:hover {
                    background: #45a049;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Eksporter til Google Sheets</h2>
                <div class="instructions">
                    <strong>Instruksjoner:</strong>
                    <ol>
                        <li>Klikk "Kopier Data" knappen nedenfor</li>
                        <li>Åpne Google Sheets</li>
                        <li>Velg celle A1</li>
                        <li>Trykk Ctrl+V (eller Cmd+V på Mac) for å lime inn</li>
                    </ol>
                </div>
                <textarea id="tsvData" readonly>${tsv}</textarea>
                <button onclick="copyToClipboard()">Kopier Data</button>
            </div>
            <script>
                function copyToClipboard() {
                    const textarea = document.getElementById('tsvData');
                    textarea.select();
                    document.execCommand('copy');
                    alert('Data kopiert! Lim inn i Google Sheets.');
                }
            </script>
        </body>
        </html>
    `);
    
    showNotification('Åpner Google Sheets eksport...');
}

// Change admin password
function changePassword() {
    const newPassword = document.getElementById('newPassword').value;
    
    if (!newPassword || newPassword.length < 4) {
        alert('Password must be at least 4 characters long!');
        return;
    }
    
    adminPassword = newPassword;
    saveAdminPassword();
    document.getElementById('newPassword').value = '';
    document.getElementById('changePasswordSection').style.display = 'none';
    showNotification('Password changed successfully!');
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize language system when DOM is ready
