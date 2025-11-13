// Configuration
const TMDB_API_KEY = 'YOUR_API_KEY_HERE'; // User will need to replace this
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

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

// State Management
let movies = [];
let adminPassword = DEFAULT_ADMIN_PASSWORD;
let searchTimeout = null;
let isAdminLoggedIn = false;
let db = null;
let unsubscribe = null;

// Load admin password from localStorage
function loadAdminPassword() {
    const savedPassword = localStorage.getItem('adminPassword');
    if (savedPassword) {
        adminPassword = savedPassword;
    }
}

// Save admin password to localStorage
function saveAdminPassword() {
    localStorage.setItem('adminPassword', adminPassword);
}

// Initialize Firebase
async function initializeFirebase() {
    try {
        // Import Firebase modules from CDN
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        // Store Firestore functions globally for easy access
        window.firestoreFunctions = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy };
        
        console.log('Firebase initialized successfully');
        
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
    loadAdminPassword();
    initializeEventListeners();
    await initializeFirebase();
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
    
    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`
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
            <div class="search-result-item" onclick="addMovie(${movie.id})">
                <img src="${posterPath}" alt="${movie.title}">
                <div class="search-result-info">
                    <div class="search-result-title">${movie.title}</div>
                    <div class="search-result-year">${year}</div>
                </div>
            </div>
        `;
    }).join('');
    
    resultsContainer.classList.add('active');
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
    
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
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
            votes: 0,
            addedAt: new Date().toISOString()
        };
        
        // Add to Firebase
        const { collection, addDoc } = window.firestoreFunctions;
        await addDoc(collection(db, 'movies'), movie);
        
        // Clear search
        document.getElementById('searchResults').classList.remove('active');
        document.getElementById('movieSearch').value = '';
        
        showNotification(`"${movie.title}" added successfully!`);
    } catch (error) {
        console.error('Error adding movie:', error);
        alert('Error adding movie. Please try again.');
    }
}

// Vote for a movie
async function voteForMovie(movieId) {
    const movie = movies.find(m => m.id === movieId);
    if (movie && movie.firestoreId) {
        try {
            const { doc, updateDoc } = window.firestoreFunctions;
            const movieRef = doc(db, 'movies', movie.firestoreId);
            await updateDoc(movieRef, {
                votes: movie.votes + 1
            });
            
            // Animate vote button
            const voteBtn = event.target.closest('.vote-btn');
            voteBtn.style.transform = 'scale(1.2)';
            setTimeout(() => {
                voteBtn.style.transform = 'scale(1)';
            }, 200);
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
    
    movieCount.textContent = `${movies.length} movie${movies.length !== 1 ? 's' : ''}`;
    
    if (sortedMovies.length === 0) {
        moviesList.innerHTML = '<p class="empty-state">No movies added yet. Be the first to suggest one!</p>';
        return;
    }
    
    moviesList.innerHTML = sortedMovies.map(movie => `
        <div class="movie-card">
            <img src="${movie.posterPath}" alt="${movie.title}" class="movie-poster">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-year">${movie.year}</div>
                <div class="movie-overview">${movie.overview}</div>
                <div class="movie-rating">⭐ ${movie.rating}/10</div>
                <div class="vote-section">
                    <button class="vote-btn" onclick="voteForMovie(${movie.id})">
                        👍 Upvote
                    </button>
                    <span class="vote-count">${movie.votes} vote${movie.votes !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    `).join('');
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
                <button onclick="deleteMovie('${movie.firestoreId}')">Delete</button>
            </div>
        </div>
    `).join('');
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
    if (confirm('Are you sure you want to reset all votes to 0?')) {
        try {
            const { doc, updateDoc } = window.firestoreFunctions;
            
            for (const movie of movies) {
                if (movie.firestoreId) {
                    const movieRef = doc(db, 'movies', movie.firestoreId);
                    await updateDoc(movieRef, { votes: 0 });
                }
            }
            
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
        if (confirm('Really? This will delete everything!')) {
            try {
                const { doc, deleteDoc } = window.firestoreFunctions;
                
                for (const movie of movies) {
                    if (movie.firestoreId) {
                        await deleteDoc(doc(db, 'movies', movie.firestoreId));
                    }
                }
                
                showNotification('All movies cleared!');
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