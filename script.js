// Configuration
const TMDB_API_KEY = '65d522ce451d6a137a804b350eac8894'; // User will need to replace this
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

// Google Sheets Configuration
const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbwwQT2Pa2iu4HTQ43NUcjNabiN4013HqnCiwu6To04KxZYBHsNtYuRaKDC2xiJyTOKDnA/exec';

// State Management
let movies = [];
let adminPassword = DEFAULT_ADMIN_PASSWORD;
let searchTimeout = null;
let isAdminLoggedIn = false;
let dataRefreshInterval = null;

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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadAdminPassword();
    initializeEventListeners();
    loadMovies();
    startDataRefresh();
});

// Load data from Google Sheets
async function loadMovies() {
    try {
        const response = await fetch(`${GOOGLE_SHEETS_API_URL}?method=GET`);
        if (!response.ok) {
            throw new Error('Failed to load movies');
        }
        movies = await response.json();
        renderMovies();
    } catch (error) {
        console.error('Error loading movies:', error);
        // Fallback to localStorage for offline use
        const savedMovies = localStorage.getItem('movies');
        if (savedMovies) {
            movies = JSON.parse(savedMovies);
            renderMovies();
        }
    }
}

// Save data to Google Sheets
async function saveMovies() {
    try {
        // Save each movie to Google Sheets
        for (const movie of movies) {
            const response = await fetch(GOOGLE_SHEETS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(movie)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save movie');
            }
        }
        
        // Also save to localStorage as backup
        localStorage.setItem('movies', JSON.stringify(movies));
        
    } catch (error) {
        console.error('Error saving movies:', error);
        // Fallback to localStorage
        localStorage.setItem('movies', JSON.stringify(movies));
    }
}

// Save a single movie to Google Sheets
async function saveMovie(movie) {
    try {
        const response = await fetch(GOOGLE_SHEETS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(movie)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save movie');
        }
        
        // Refresh data after save
        setTimeout(loadMovies, 500);
        
    } catch (error) {
        console.error('Error saving movie:', error);
        // Fallback to localStorage
        localStorage.setItem('movies', JSON.stringify(movies));
    }
}

// Start auto-refresh to sync data across devices
function startDataRefresh() {
    // Stop existing refresh if running
    stopDataRefresh();
    
    // Refresh every 5 seconds, but not when modal is open
    dataRefreshInterval = setInterval(() => {
        const modal = document.getElementById('adminModal');
        if (!modal.classList.contains('active')) {
            loadMovies();
        }
    }, 5000);
}

// Stop auto-refresh
function stopDataRefresh() {
    if (dataRefreshInterval) {
        clearInterval(dataRefreshInterval);
        dataRefreshInterval = null;
    }
}

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
        // Resume auto-refresh when modal closes
        startDataRefresh();
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            isAdminLoggedIn = false;
            document.getElementById('adminLogin').style.display = 'block';
            document.getElementById('adminPanel').style.display = 'none';
            // Resume auto-refresh when modal closes
            startDataRefresh();
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
            displaySearchResults(data.results.slice(0, 5)); // Show top 5 results
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

// Add movie to voting list
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
        
        // Add to local array first
        movies.push(movie);
        
        // Save to Google Sheets
        await saveMovie(movie);
        
        // Clear search
        document.getElementById('searchResults').classList.remove('active');
        document.getElementById('movieSearch').value = '';
        
        // Show success message
        showNotification(`"${movie.title}" added successfully!`);
    } catch (error) {
        console.error('Error adding movie:', error);
        alert('Error adding movie. Please try again.');
        // Remove from local array if save failed
        movies = movies.filter(m => m.id !== movieId);
    }
}

// Vote for a movie
async function voteForMovie(movieId) {
    const movie = movies.find(m => m.id === movieId);
    if (movie) {
        movie.votes++;
        
        // Save to Google Sheets
        await saveMovie(movie);
        
        // Animate vote button
        const voteBtn = event.target.closest('.vote-btn');
        voteBtn.style.transform = 'scale(1.2)';
        setTimeout(() => {
            voteBtn.style.transform = 'scale(1)';
        }, 200);
    }
}

// Render movies list
function renderMovies() {
    const moviesList = document.getElementById('moviesList');
    const movieCount = document.getElementById('movieCount');
    
    // Sort by votes (descending)
    const sortedMovies = [...movies].sort((a, b) => b.votes - a.votes);
    
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
        // Refresh data when admin logs in to show current state
        loadMovies();
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
    
    const sortedMovies = [...movies].sort((a, b) => b.votes - a.votes);
    
    adminMoviesList.innerHTML = sortedMovies.map(movie => `
        <div class="admin-movie-item">
            <div class="admin-movie-info">
                <div class="admin-movie-title">${movie.title} (${movie.year})</div>
                <div class="admin-movie-votes">${movie.votes} votes</div>
            </div>
            <div class="admin-movie-actions">
                <button onclick="deleteMovie(${movie.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Delete a movie from Google Sheets
async function deleteMovie(movieId) {
    if (confirm('Are you sure you want to delete this movie?')) {
        try {
            const response = await fetch(`${GOOGLE_SHEETS_API_URL}?method=DELETE&id=${movieId}`);
            if (!response.ok) {
                throw new Error('Failed to delete movie');
            }
            
            // Remove from local array and refresh
            movies = movies.filter(m => m.id !== movieId);
            renderMovies();
            renderAdminMoviesList();
            showNotification('Movie deleted successfully!');
            
            // Refresh data to ensure sync
            setTimeout(loadMovies, 500);
        } catch (error) {
            console.error('Error deleting movie:', error);
            alert('Error deleting movie. Please try again.');
        }
    }
}

// Reset all votes in Google Sheets
async function resetAllVotes() {
    if (confirm('Are you sure you want to reset all votes to 0?')) {
        try {
            // Reset all votes locally
            movies.forEach(movie => movie.votes = 0);
            
            // Save each movie to Google Sheets
            for (const movie of movies) {
                await saveMovie(movie);
            }
            
            showNotification('All votes reset to 0!');
            renderMovies();
            renderAdminMoviesList();
            
            // Refresh data
            setTimeout(loadMovies, 500);
        } catch (error) {
            console.error('Error resetting votes:', error);
            alert('Error resetting votes. Please try again.');
        }
    }
}

// Clear all movies from Google Sheets
async function clearAllMovies() {
    if (confirm('Are you sure you want to delete ALL movies? This cannot be undone!')) {
        if (confirm('Really? This will delete everything!')) {
            try {
                const response = await fetch(`${GOOGLE_SHEETS_API_URL}?method=CLEAR`);
                if (!response.ok) {
                    throw new Error('Failed to clear movies');
                }
                
                movies = [];
                renderMovies();
                renderAdminMoviesList();
                showNotification('All movies cleared!');
                
                // Refresh data
                setTimeout(loadMovies, 500);
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
    
    const sortedMovies = [...movies].sort((a, b) => b.votes - a.votes);
    
    // Create CSV content
    let csv = 'Rank,Title,Year,Votes,Rating,Overview\n';
    sortedMovies.forEach((movie, index) => {
        const overview = movie.overview.replace(/"/g, '""'); // Escape quotes
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
    // Create notification element
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
    
    // Remove after 3 seconds
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
