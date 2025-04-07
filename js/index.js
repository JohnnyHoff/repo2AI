import { displayDirectoryStructure, getSelectedFiles, formatRepoContents } from './utils.js';

let currentRepoName = ''; // Variable to store the repo name

// Load saved token on page load
document.addEventListener('DOMContentLoaded', function() {
    lucide.createIcons();
    setupShowMoreInfoButton();
    loadSavedToken();
});

// Load saved token from local storage
function loadSavedToken() {
    const savedToken = localStorage.getItem('githubAccessToken');
    if (savedToken) {
        document.getElementById('accessToken').value = savedToken;
    }
}

// Save token to local storage
function saveToken(token) {
    if (token) {
        localStorage.setItem('githubAccessToken', token);
    } else {
        localStorage.removeItem('githubAccessToken');
    }
}

// Event listener for form submission
document.getElementById('repoForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const repoUrl = document.getElementById('repoUrl').value;
    const accessToken = document.getElementById('accessToken').value;

    // Save token automatically
    saveToken(accessToken);

    const outputText = document.getElementById('outputText');
    outputText.value = '';

    try {
        // Parse repository URL and fetch repository contents
        const { owner, repo, lastString } = parseRepoUrl(repoUrl);
        let refFromUrl = '';
        currentRepoName = repo; // Store the repo name

        let pathFromUrl = '';

        if (lastString) {
            const references = await getReferences(owner, repo, accessToken);
            const allRefs = [...references.branches, ...references.tags];
            
            const matchingRef = allRefs.find(ref => lastString.startsWith(ref));
            if (matchingRef) {
                refFromUrl = matchingRef;
                pathFromUrl = lastString.slice(matchingRef.length + 1);
            } else {
                refFromUrl = lastString;
            }
        }

        const sha = await fetchRepoSha(owner, repo, refFromUrl, pathFromUrl, accessToken);
        const tree = await fetchRepoTree(owner, repo, sha, accessToken);

        displayDirectoryStructure(tree);
        document.getElementById('generateTextButton').style.display = 'flex';
        document.getElementById('downloadZipButton').style.display = 'flex';
        // --- NEW: Asynchronously fetch/calculate/display token counts ---
        const fileItems = tree.filter(item => item.type === 'blob');
        fileItems.forEach(async (item) => {
            // Clear previous count/error for this specific span before fetching
            const spanId = `token-count-${item.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const tokenSpan = document.getElementById(spanId);
            if (tokenSpan) {
                tokenSpan.textContent = ' (Loading...)'; // Indicate loading
                tokenSpan.style.color = 'grey'; // Optional: style for loading
            }

            try {
                const content = await fetchSingleFileContent(item.url, accessToken);
                // Ensure tokenizer is loaded (it should be by now, but check is safe)
                if (typeof GPTTokenizer_cl100k_base !== 'undefined') {
                    const { encode } = GPTTokenizer_cl100k_base;
                    const tokenCount = encode(content).length;
                    // Find the span again (it might have been created dynamically)
                    const currentTokenSpan = document.getElementById(spanId);
                    if (currentTokenSpan) {
                        currentTokenSpan.textContent = ` (Tokens: ${tokenCount})`;
                        currentTokenSpan.style.color = ''; // Reset color
                    }
                } else {
                    console.warn('GPT Tokenizer not loaded when trying to count tokens for', item.path);
                     const currentTokenSpan = document.getElementById(spanId);
                     if (currentTokenSpan) {
                         currentTokenSpan.textContent = ` (Tokenizer Error)`;
                         currentTokenSpan.style.color = 'orange';
                     }
                }
            } catch (error) {
                console.error(`Failed to fetch/process token count for ${item.path}:`, error);
                const currentTokenSpan = document.getElementById(spanId);
                if (currentTokenSpan) {
                    currentTokenSpan.textContent = ` (Fetch Error)`; // Indicate error
                    currentTokenSpan.style.color = 'red';
                }
            }
        });
        // --- END NEW ---

    } catch (error) {
        outputText.value = `Error fetching repository contents: ${error.message}\n\n` +
            "Please ensure:\n" +
            "1. The repository URL is correct and accessible.\n" +
            "2. You have the necessary permissions to access the repository.\n" +
            "3. If it's a private repository, you've provided a valid access token.\n" +
            "4. The specified branch/tag and path (if any) exist in the repository.";
    }
});
// --- NEW Helper function to fetch single file content ---
async function fetchSingleFileContent(url, token) {
    const headers = {
        'Accept': 'application/vnd.github.v3.raw'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
        // Throw a specific error to be caught by the caller
        throw new Error(`Failed to fetch file content. Status: ${response.status}`);
    }
    const text = await response.text();
    return text;
}
// --- END NEW ---

// Event listener for generating text file
document.getElementById('generateTextButton').addEventListener('click', async function () {
    const accessToken = document.getElementById('accessToken').value;
    const outputText = document.getElementById('outputText');
    outputText.value = '';

    // Save token automatically
    saveToken(accessToken);

    try {
        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length === 0) {
            throw new Error('No files selected');
        }
        const fileContents = await fetchFileContents(selectedFiles, accessToken);
        // Token counts are now updated asynchronously after tree display.
        // The logic previously here (lines 93-103) has been removed.
        const formattedText = formatRepoContents(fileContents);
        outputText.value = formattedText;

        document.getElementById('copyButton').style.display = 'flex';
        document.getElementById('downloadButton').style.display = 'flex';
    } catch (error) {
        outputText.value = `Error generating text file: ${error.message}\n\n` +
            "Please ensure:\n" +
            "1. You have selected at least one file from the directory structure.\n" +
            "2. Your access token (if provided) is valid and has the necessary permissions.\n" +
            "3. You have a stable internet connection.\n" +
            "4. The GitHub API is accessible and functioning normally.";
    }
});

// Event listener for downloading zip file
document.getElementById('downloadZipButton').addEventListener('click', async function () {
    const accessToken = document.getElementById('accessToken').value;

    try {
        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length === 0) {
            throw new Error('No files selected');
        }
        const fileContents = await fetchFileContents(selectedFiles, accessToken);
        await createAndDownloadZip(fileContents);
    } catch (error) {
        const outputText = document.getElementById('outputText');
        outputText.value = `Error generating zip file: ${error.message}\n\n` +
            "Please ensure:\n" +
            "1. You have selected at least one file from the directory structure.\n" +
            "2. Your access token (if provided) is valid and has the necessary permissions.\n" +
            "3. You have a stable internet connection.\n" +
            "4. The GitHub API is accessible and functioning normally.";
    }
});

// Event listener for copying text to clipboard
document.getElementById('copyButton').addEventListener('click', function () {
    const outputText = document.getElementById('outputText');
    outputText.select();
    navigator.clipboard.writeText(outputText.value)
        .then(() => console.log('Text copied to clipboard'))
        .catch(err => console.error('Failed to copy text: ', err));
});

// Event listener for downloading text file
document.getElementById('downloadButton').addEventListener('click', function () {
    const outputText = document.getElementById('outputText').value;
    if (!outputText.trim()) {
        document.getElementById('outputText').value = 'Error: No content to download. Please generate the text file first.';
        return;
    }
    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentRepoName || 'repo'}_prompt.txt`; // New filename using repo name
    a.click();
    URL.revokeObjectURL(url);
});

// Parse GitHub repository URL
function parseRepoUrl(url) {
    url = url.replace(/\/$/, '');
    const urlPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(\/tree\/(.+))?$/;
    const match = url.match(urlPattern);
    if (!match) {
        throw new Error('Invalid GitHub repository URL. Please ensure the URL is in the correct format: ' +
            'https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/path');
    }
    return {
        owner: match[1],
        repo: match[2],
        lastString: match[4] || ''
    };
}

// Fetch repository references
async function getReferences(owner, repo, token) {
    const headers = {
        'Accept': 'application/vnd.github+json'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    const [branchesResponse, tagsResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}/git/matching-refs/heads/`, { headers }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/git/matching-refs/tags/`, { headers })
    ]);

    if (!branchesResponse.ok || !tagsResponse.ok) {
        throw new Error('Failed to fetch references');
    }

    const branches = await branchesResponse.json();
    const tags = await tagsResponse.json();

    return {
        branches: branches.map(b => b.ref.split("/").slice(2).join("/")),
        tags: tags.map(t => t.ref.split("/").slice(2).join("/"))
    };
}

// Fetch repository SHA
async function fetchRepoSha(owner, repo, ref, path, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path ? `${path}` : ''}${ref ? `?ref=${ref}` : ''}`;
    const headers = {
        'Accept': 'application/vnd.github.object+json'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
        handleFetchError(response);
    }
    const data = await response.json();
    return data.sha;
}

// Fetch repository tree
async function fetchRepoTree(owner, repo, sha, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
    const headers = {
        'Accept': 'application/vnd.github+json'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
        handleFetchError(response);
    }
    const data = await response.json();
    return data.tree;
}

// Handle fetch errors
function handleFetchError(response) {
    if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
        throw new Error('GitHub API rate limit exceeded. Please try again later or provide a valid access token to increase your rate limit.');
    }
    if (response.status === 404) {
        throw new Error(`Repository, branch, or path not found. Please check that the URL, branch/tag, and path are correct and accessible.`);
    }
    throw new Error(`Failed to fetch repository data. Status: ${response.status}. Please check your input and try again.`);
}

// Fetch contents of selected files (Simplified: No longer calculates tokens here)
async function fetchFileContents(files, token) {
    const headers = {
        'Accept': 'application/vnd.github.v3.raw'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }
    const contents = await Promise.all(files.map(async file => {
        try {
            const response = await fetch(file.url, { headers });
            if (!response.ok) {
                // Throw error specific to this file to allow others to proceed if needed,
                // but we'll catch it and return an error object.
                throw new Error(`Failed to fetch ${file.path}: Status ${response.status}`);
            }
            const text = await response.text();
            // Return only necessary info for formatRepoContents and createAndDownloadZip
            return { path: file.path, text: text }; // No tokenCount needed here anymore
        } catch (error) {
            console.error(`Error fetching content for ${file.path}:`, error);
            // Return an object indicating failure for this file
            // Downstream functions (formatRepoContents, createAndDownloadZip) need to handle this.
            return { path: file.path, text: `Error fetching content: ${error.message}`, error: true };
        }
    }));
    // Return all results, including potential errors.
    return contents;
}
function setupShowMoreInfoButton() {
    const showMoreInfoButton = document.getElementById('showMoreInfo');
    const tokenInfo = document.getElementById('tokenInfo');

    showMoreInfoButton.addEventListener('click', function() {
        tokenInfo.classList.toggle('hidden');
        updateInfoIcon(this, tokenInfo);
    });
}

function updateInfoIcon(button, tokenInfo) {
    const icon = button.querySelector('[data-lucide]');
    if (icon) {
        icon.setAttribute('data-lucide', tokenInfo.classList.contains('hidden') ? 'info' : 'x');
        lucide.createIcons();
    }
}

// Create and download zip file
async function createAndDownloadZip(fileContents) {
    const zip = new JSZip();

    fileContents.forEach(file => {
        // Remove leading slash if present
        const filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        zip.file(filePath, file.text);
    });

    const content = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'partial_repo.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
