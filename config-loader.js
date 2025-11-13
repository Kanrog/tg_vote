// Load configuration from external JSON file
let appConfig = {
    adminPassword: 'admin123', // fallback
    tmdbApiKey: 'YOUR_API_KEY_HERE' // fallback
};

// Load configuration
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (response.ok) {
            appConfig = await response.json();
            console.log('Configuration loaded successfully');
        } else {
            console.warn('Config file not found, using defaults');
        }
    } catch (error) {
        console.warn('Error loading config, using defaults:', error);
    }
}

// Get configuration values
function getAdminPassword() {
    return appConfig.adminPassword;
}

function getTmdbApiKey() {
    return appConfig.tmdbApiKey;
}

// Export functions for use in main script
window.configLoader = {
    loadConfig,
    getAdminPassword,
    getTmdbApiKey
};
