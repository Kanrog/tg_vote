// Configuration
const TMDB_API_KEY = '65d522ce451d6a137a804b350eac8894'; // User will need to replace this
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

// State Management
let movies = [];
let adminPassword = DEFAULT_ADMIN_PASSWORD;
let searchTimeout = null;
let isAdminLoggedIn = false;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeEventListeners();
    renderMovies();
});

// Load data from localStorage
function loadData() {
    const savedMovies = localStorage.getItem('movies');
    const savedPassword = localStorage.getItem('adminPassword');
    
    if (savedMovies) {
        movies = JSON.parse(savedMovies);
    }
    
    if (savedPassword) {
        adminPassword = savedPassword;
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('movies', JSON.stringify(movies));
    localStorage.setItem('adminPassword', adminPassword);
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
        
        movies.push(movie);
        saveData();
        renderMovies();
        
        // Clear search
        document.getElementById('searchResults').classList.remove('active');
        document.getElementById('movieSearch').value = '';
        
        // Show success message
        showNotification(`"${movie.title}" added successfully!`);
    } catch (error) {
        console.error('Error adding movie:', error);
        alert('Error adding movie. Please try again.');
    }
}

// Vote for a movie
function voteForMovie(movieId) {
    const movie = movies.find(m => m.id === movieId);
    if (movie) {
        movie.votes++;
        saveData();
        renderMovies();
        
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

// Delete a movie
function deleteMovie(movieId) {
    if (confirm('Are you sure you want to delete this movie?')) {
        movies = movies.filter(m => m.id !== movieId);
        saveData();
        renderMovies();
        renderAdminMoviesList();
        showNotification('Movie deleted successfully!');
    }
}

// Reset all votes
function resetAllVotes() {
    if (confirm('Are you sure you want to reset all votes to 0?')) {
        movies.forEach(movie => movie.votes = 0);
        saveData();
        renderMovies();
        renderAdminMoviesList();
        showNotification('All votes reset to 0!');
    }
}

// Clear all movies
function clearAllMovies() {
    if (confirm('Are you sure you want to delete ALL movies? This cannot be undone!')) {
        if (confirm('Really? This will delete everything!')) {
            movies = [];
            saveData();
            renderMovies();
            renderAdminMoviesList();
            showNotification('All movies cleared!');
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
    saveData();
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
