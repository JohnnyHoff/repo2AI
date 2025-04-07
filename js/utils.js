// Display directory structure
function displayDirectoryStructure(tree) {
	tree = tree.filter((item) => item.type === "blob").sort(sortContents);
	const container = document.getElementById("directoryStructure");
	container.innerHTML = "";
	const rootUl = document.createElement("ul");
	container.appendChild(rootUl);

	const commonExtensions = [
		".js",
		".py",
		".java",
		".cpp",
		".html",
		".css",
		".ts",
		".jsx",
		".tsx",
	];
	const directoryStructure = {};
	const extensionCheckboxes = {};

	// Build directory structure
	tree.forEach((item) => {
		item.path = item.path.startsWith("/") ? item.path : "/" + item.path;
		const pathParts = item.path.split("/");
		let currentLevel = directoryStructure;

		pathParts.forEach((part, index) => {
			part = part === "" ? "./" : part;
			if (!currentLevel[part]) {
				currentLevel[part] = index === pathParts.length - 1 ? item : {};
			}
			currentLevel = currentLevel[part];
		});
	});

	function createTreeNode(name, item, parentUl) {
		const li = document.createElement("li");
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = "mr-2";

		if (
			typeof item === "object" &&
			(!item.type || typeof item.type !== "string")
		) {
			// Directory node
			createDirectoryNode(li, checkbox, name, item, parentUl);
		} else {
			// File node
			createFileNode(li, checkbox, name, item);
		}

		li.className = "my-2";
		parentUl.appendChild(li);
		updateParentCheckbox(checkbox);
		updateExtensionCheckboxes();
	}

	function createDirectoryNode(li, checkbox, name, item, parentUl) {
		checkbox.classList.add("directory-checkbox");
		li.appendChild(checkbox);

		const collapseButton = createCollapseButton();
		li.appendChild(collapseButton);

		appendIcon(li, "folder");
		li.appendChild(document.createTextNode(name));
		// Add token count span for directories
		const tokenSpan = document.createElement("span");
		tokenSpan.className = "folder-token-count ml-2 text-xs text-gray-500";
		tokenSpan.textContent = " (Calculating...)"; // Initial display state
		li.appendChild(tokenSpan);
		// Initialize token state on the list item itself
		li.dataset.tokenState = "Loading"; // Start folders in Loading state too

		const ul = document.createElement("ul");
		ul.className = "ml-6 mt-2";
		li.appendChild(ul);

		for (const [childName, childItem] of Object.entries(item)) {
			createTreeNode(childName, childItem, ul);
		}

		addDirectoryCheckboxListener(checkbox, li);
		addCollapseButtonListener(collapseButton, ul);
	}

	function createFileNode(li, checkbox, name, item) {
		checkbox.value = JSON.stringify({
			url: item.url,
			path: item.path,
			urlType: item.urlType,
		});

		const extension = name.split(".").pop().toLowerCase();
		const isCommonFile = commonExtensions.includes("." + extension);
		checkbox.checked = isCommonFile;

		if (!(extension in extensionCheckboxes)) {
			extensionCheckboxes[extension] = {
				checkbox: createExtensionCheckbox(extension),
				children: [],
			};
		}
		extensionCheckboxes[extension].children.push(checkbox);

		li.appendChild(checkbox);
		appendIcon(li, "file");
		li.appendChild(document.createTextNode(name));
		const tokenSpan = document.createElement("span");
		// Sanitize path for ID: replace non-alphanumeric chars with hyphens
		const sanitizedPath = item.path.replace(/[^a-zA-Z0-9]/g, "-");
		tokenSpan.id = `token-count-${sanitizedPath}`;
		tokenSpan.className = "ml-2 text-xs text-gray-500"; // Added styling
		li.appendChild(tokenSpan);
	}

	function createCollapseButton() {
		const collapseButton = document.createElement("button");
		collapseButton.innerHTML =
			'<i data-lucide="chevron-down" class="w-4 h-4"></i>';
		collapseButton.className = "mr-1 focus:outline-none";
		return collapseButton;
	}

	function appendIcon(element, iconName) {
		const icon = document.createElement("i");
		icon.setAttribute("data-lucide", iconName);
		icon.className = "inline-block w-4 h-4 mr-1";
		element.appendChild(icon);
	}

	function addDirectoryCheckboxListener(checkbox, li) {
		checkbox.addEventListener("change", function () {
			const childCheckboxes = li.querySelectorAll(
				'input[type="checkbox"]',
			);
			childCheckboxes.forEach((childBox) => {
				childBox.checked = this.checked;
				childBox.indeterminate = false;
			});
		});
	}

	function addCollapseButtonListener(collapseButton, ul) {
		collapseButton.addEventListener("click", function () {
			ul.classList.toggle("hidden");
			const icon = this.querySelector("[data-lucide]");
			if (ul.classList.contains("hidden")) {
				icon.setAttribute("data-lucide", "chevron-right");
			} else {
				icon.setAttribute("data-lucide", "chevron-down");
			}
			lucide.createIcons();
		});
	}

	function createExtensionCheckbox(extension) {
		const extCheckbox = document.createElement("input");
		extCheckbox.type = "checkbox";
		extCheckbox.className = "mr-1";
		extCheckbox.value = extension;
		return extCheckbox;
	}

	for (const [name, item] of Object.entries(directoryStructure)) {
		createTreeNode(name, item, rootUl);
	}

	createExtensionCheckboxesContainer();

	// Add event listener to container for checkbox changes
	// Add event listener to container for checkbox changes
	container.addEventListener("change", function (event) {
		if (event.target.type === "checkbox") {
			const changedCheckbox = event.target;
			const changedLi = changedCheckbox.closest("li");

			if (!changedLi) return;

			// First, update visual states of parent/extension checkboxes
			updateParentCheckbox(changedCheckbox);
			updateExtensionCheckboxes();

			// Find all affected folder LIs that need updating, starting from the immediate parent
			// up to the root folder
			const affectedFolders = [];
			let currentLi = changedLi;

			// If the changed checkbox is a file checkbox, start with its parent folder
			// If it's a directory checkbox, start with itself
			if (!changedCheckbox.classList.contains("directory-checkbox")) {
				currentLi = changedLi.parentElement?.closest("li");
			}

			// Collect all parent folders up to the root
			while (currentLi) {
				if (
					currentLi.querySelector(":scope > input.directory-checkbox")
				) {
					affectedFolders.push(currentLi);
				}
				currentLi = currentLi.parentElement?.closest("li");
			}

			// Update token counts for all affected folders, starting from the deepest level
			affectedFolders.forEach((folderLi) => {
				updateFolderTokenCounts(folderLi);
			});
		}
	});

	function updateParentCheckbox(checkbox) {
		if (!checkbox) return;
		const li = checkbox.closest("li");
		if (!li) return;
		if (!li.parentElement) return;
		const parentLi = li.parentElement.closest("li");
		if (!parentLi) return;

		const parentCheckbox = parentLi.querySelector(
			':scope > input[type="checkbox"]',
		);
		const siblingCheckboxes = parentLi.querySelectorAll(
			':scope > ul > li > input[type="checkbox"]',
		);

		const checkedCount = Array.from(siblingCheckboxes).filter(
			(cb) => cb.checked,
		).length;
		const indeterminateCount = Array.from(siblingCheckboxes).filter(
			(cb) => cb.indeterminate,
		).length;

		if (indeterminateCount !== 0) {
			parentCheckbox.checked = false;
			parentCheckbox.indeterminate = true;
		} else if (checkedCount === 0) {
			parentCheckbox.checked = false;
			parentCheckbox.indeterminate = false;
		} else if (checkedCount === siblingCheckboxes.length) {
			parentCheckbox.checked = true;
			parentCheckbox.indeterminate = false;
		} else {
			parentCheckbox.checked = false;
			parentCheckbox.indeterminate = true;
		}

		// Recursively update parent checkboxes
		updateParentCheckbox(parentCheckbox);
	}

	function updateExtensionCheckboxes() {
		for (const [extension, checkbox] of Object.entries(
			extensionCheckboxes,
		)) {
			const children = checkbox.children;
			const checkedCount = Array.from(children).filter(
				(cb) => cb.checked,
			).length;

			if (checkedCount === 0) {
				checkbox.checkbox.checked = false;
				checkbox.checkbox.indeterminate = false;
			} else if (checkedCount === children.length) {
				checkbox.checkbox.checked = true;
				checkbox.checkbox.indeterminate = false;
			} else {
				checkbox.checkbox.checked = false;
				checkbox.checkbox.indeterminate = true;
			}
		}
	}

	function createExtensionCheckboxesContainer() {
		const extentionCheckboxesContainer = document.getElementById(
			"extentionCheckboxes",
		);
		extentionCheckboxesContainer.innerHTML = "";
		extentionCheckboxesContainer.className = "mt-4";
		const extentionCheckboxesContainerLabel =
			document.createElement("label");
		extentionCheckboxesContainerLabel.innerHTML =
			"Filter by file extensions:";
		extentionCheckboxesContainerLabel.className =
			"block text-sm font-medium text-gray-600";
		extentionCheckboxesContainer.appendChild(
			extentionCheckboxesContainerLabel,
		);
		const extentionCheckboxesContainerUl = document.createElement("ul");
		extentionCheckboxesContainer.appendChild(
			extentionCheckboxesContainerUl,
		);
		extentionCheckboxesContainerUl.className = "mt-1";
		const sortedExtensions = Object.entries(extensionCheckboxes).sort(
			(a, b) => b[1].children.length - a[1].children.length,
		);
		for (const [extension, checkbox] of sortedExtensions) {
			const extCheckbox = checkbox.checkbox;
			const extCheckboxLi = document.createElement("li");
			extCheckboxLi.className = "inline-block mr-4";
			extCheckboxLi.appendChild(extCheckbox);
			extCheckboxLi.appendChild(document.createTextNode("." + extension));
			extentionCheckboxesContainerUl.appendChild(extCheckboxLi);
			extCheckbox.addEventListener("change", function () {
				const children = checkbox.children;
				const affectedParentFolders = new Set(); // Use a Set to avoid redundant updates

				children.forEach((fileCheckbox) => {
					fileCheckbox.checked = this.checked;
					fileCheckbox.indeterminate = false;
					updateParentCheckbox(fileCheckbox);

					// Find the parent folder LI for this file and add to set
					const fileLi = fileCheckbox.closest("li");
					if (fileLi) {
						const parentFolderLi =
							fileLi.parentElement?.closest("li");
						if (parentFolderLi) {
							affectedParentFolders.add(parentFolderLi);
						}
					}
				});

				// Trigger token count updates for all unique affected parent folders
				affectedParentFolders.forEach((folderLi) => {
					updateFolderTokenCounts(folderLi);
				});
			});
		}
	}

	lucide.createIcons();
}

// Sort contents alphabetically and by directory/file
function sortContents(a, b) {
	if (!a || !b || !a.path || !b.path) return 0;

	const aPath = a.path.split("/");
	const bPath = b.path.split("/");
	const minLength = Math.min(aPath.length, bPath.length);

	for (let i = 0; i < minLength; i++) {
		if (aPath[i] !== bPath[i]) {
			if (i === aPath.length - 1 && i < bPath.length - 1) return 1; // a is a directory, b is a file or subdirectory
			if (i === bPath.length - 1 && i < aPath.length - 1) return -1; // b is a directory, a is a file or subdirectory
			return aPath[i].localeCompare(bPath[i]);
		}
	}

	return aPath.length - bPath.length;
}

// Get selected files from the directory structure
function getSelectedFiles() {
	const checkboxes = document.querySelectorAll(
		'#directoryStructure input[type="checkbox"]:checked:not(.directory-checkbox)',
	);
	return Array.from(checkboxes).map((checkbox) => JSON.parse(checkbox.value));
}

// Format repository contents into a single text
function formatRepoContents(contents) {
	let text = "";
	let index = "";

	// Ensure contents is an array before sorting
	contents = Array.isArray(contents)
		? contents.sort(sortContents)
		: [contents];

	// Create a directory tree structure
	const tree = {};
	contents.forEach((item) => {
		const parts = item.path.split("/");
		let currentLevel = tree;
		parts.forEach((part, i) => {
			if (!currentLevel[part]) {
				currentLevel[part] = i === parts.length - 1 ? null : {};
			}
			currentLevel = currentLevel[part];
		});
	});

	// Build the index recursively
	function buildIndex(node, prefix = "") {
		let result = "";
		const entries = Object.entries(node);
		entries.forEach(([name, subNode], index) => {
			const isLastItem = index === entries.length - 1;
			const linePrefix = isLastItem ? "└── " : "├── ";
			const childPrefix = isLastItem ? "    " : "│   ";

			name = name === "" ? "./" : name;

			result += `${prefix}${linePrefix}${name}\n`;
			if (subNode) {
				result += buildIndex(subNode, `${prefix}${childPrefix}`);
			}
		});
		return result;
	}

	index = buildIndex(tree);

	contents.forEach((item) => {
		text += `\n\n---\nFile: ${item.path}\n---\n\n${item.text}\n`;
	});

	const formattedText = `Directory Structure:\n\n${index}\n${text}`;
	try {
		const { encode, decode } = GPTTokenizer_cl100k_base;
		const tokensCount = encode(formattedText).length;
		document.getElementById("tokenCount").innerHTML =
			`Approximate Token Count: ${tokensCount} <a href="https://github.com/niieani/gpt-tokenizer" target="_blank" class="text-blue-500 hover:text-blue-700 underline">(Using cl100k_base tokenizer)</a>`;
	} catch (error) {
		document.getElementById("tokenCount").innerHTML = "";
		console.log(error);
	}
	return formattedText;
}

function updateFolderTokenCounts(folderLiElement) {
	if (!folderLiElement || !folderLiElement.matches("li")) return;

	const folderCheckbox = folderLiElement.querySelector(
		":scope > input.directory-checkbox",
	);
	// Only proceed if it's actually a folder li
	if (!folderCheckbox) return;

	const folderTokenSpan = folderLiElement.querySelector(
		":scope > span.folder-token-count",
	);
	if (!folderTokenSpan) return;

	let calculatedTokens = 0;
	let containsErrors = false;
	let containsLoading = false;
	let newState = 0;

	// Find ALL descendant files (not just direct children)
	const allFileCheckboxes = folderLiElement.querySelectorAll(
		'input[type="checkbox"]:not(.directory-checkbox)',
	);

	allFileCheckboxes.forEach((fileCheckbox) => {
		// Only consider checked files
		if (!fileCheckbox.checked) {
			return;
		}

		const fileLi = fileCheckbox.closest("li");
		const fileState = fileLi.dataset.tokenState;

		if (fileState === "Loading") {
			containsLoading = true;
		} else if (fileState === "Error") {
			containsErrors = true;
		} else {
			const tokenValue = parseInt(fileState, 10);
			if (!isNaN(tokenValue)) {
				calculatedTokens += tokenValue;
			} else {
				containsLoading = true;
			}
		}
	});

	// Determine the folder's aggregate state and update its display span
	if (containsLoading) {
		folderTokenSpan.textContent = ` (Calculating...)`;
		folderTokenSpan.style.color = "grey";
		newState = "Loading";
	} else if (containsErrors) {
		folderTokenSpan.textContent = ` (Contains Errors)`;
		folderTokenSpan.style.color = "orange";
		newState = "Error";
	} else {
		folderTokenSpan.textContent = ` (Tokens: ${calculatedTokens})`;
		folderTokenSpan.style.color = ""; // Reset color
		newState = calculatedTokens;
	}

	// Store the calculated state on the folder's li element
	folderLiElement.dataset.tokenState = newState;

	// Recursively update parent folders
	const parentLi = folderLiElement.parentElement?.closest("li");
	if (parentLi) {
		updateFolderTokenCounts(parentLi);
	}
}

export {
	displayDirectoryStructure,
	sortContents,
	getSelectedFiles,
	formatRepoContents,
	updateFolderTokenCounts,
};
