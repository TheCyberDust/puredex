import { fetchPokemonList, FALLBACK_SPRITE, getSpriteUrl } from './js/data.js';
import { calculateDamageProfile, getAbilityDetails, getEvolutionInfo, toTitleCase } from './js/pokemon-utils.js';
import { attachModalInteractions, renderModalContent } from './js/modal.js';

const pokemonGrid = document.getElementById('pokemon-grid');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search-input');
const searchFeedback = document.getElementById('search-feedback');
const typeFilter = document.getElementById('type-filter');
const sortSelect = document.getElementById('sort-select');
const resetViewButton = document.getElementById('reset-view');
const favoritesToggleButton = document.getElementById('favorites-toggle');
const controlsToggleButton = document.getElementById('controls-toggle');
const controlsBody = document.getElementById('advanced-controls');
const compareStatusBar = document.getElementById('compare-status-bar');
const compareStatusText = document.getElementById('compare-status-text');
const compareStartOverButton = document.getElementById('compare-start-over');
const compareExitButton = document.getElementById('compare-exit');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalCloseButton = document.getElementById('modal-close');
const backToTopButton = document.getElementById('back-to-top');
const pokedexEntriesSection = document.getElementById('pokedex-entries');

let allPokemon = [];
let currentModalPokemon = null;
let currentSpriteMode = 'normal';
let currentTypeFilter = 'all';
let currentSortMode = 'dex-asc';
let currentVisiblePokemon = [];
let compareSourcePokemon = null;
let showFavoritesOnly = false;
const FAVORITES_STORAGE_KEY = 'puredex-favorites';
const favoritePokemonIds = new Set();

const formatPokemonName = (pokemon) => toTitleCase(pokemon.name);

const loadFavorites = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((id) => favoritePokemonIds.add(id));
    }
  } catch (error) {
    console.warn('Could not load favorites.', error);
  }
};

const persistFavorites = () => {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoritePokemonIds]));
};

const isFavorite = (pokemonId) => favoritePokemonIds.has(pokemonId);

const toggleFavorite = (pokemonId) => {
  if (favoritePokemonIds.has(pokemonId)) {
    favoritePokemonIds.delete(pokemonId);
  } else {
    favoritePokemonIds.add(pokemonId);
  }

  persistFavorites();
};

const updateControlsToggle = () => {
  if (!controlsToggleButton || !controlsBody) {
    return;
  }

  const isMobile = window.matchMedia('(max-width: 640px)').matches;

  if (!isMobile) {
    controlsBody.classList.remove('collapsed');
    controlsToggleButton.hidden = true;
    controlsToggleButton.setAttribute('aria-expanded', 'true');
    return;
  }

  controlsToggleButton.hidden = false;
  const isHidden = controlsBody.classList.contains('collapsed');
  controlsToggleButton.textContent = isHidden ? 'Show Tools' : 'Hide Tools';
  controlsToggleButton.setAttribute('aria-expanded', String(!isHidden));
};

const getPokemonModalMeta = async (pokemon) => {
  if (pokemon._modalMeta) {
    return pokemon._modalMeta;
  }

  const [{ weaknesses, strengths }, evolutionInfo, abilityDetails, { fetchSpeciesData }] = await Promise.all([
    calculateDamageProfile(pokemon),
    getEvolutionInfo(pokemon),
    getAbilityDetails(pokemon),
    import('./js/data.js'),
  ]);

  const speciesData = await fetchSpeciesData(pokemon);
  pokemon._modalMeta = { weaknesses, strengths, evolutionInfo, abilityDetails, speciesData };
  return pokemon._modalMeta;
};

const openCompareView = async (sourcePokemon, targetPokemon) => {
  const [{ renderCompareContent }, sourceMeta, targetMeta] = await Promise.all([
    import('./js/modal.js'),
    getPokemonModalMeta(sourcePokemon),
    getPokemonModalMeta(targetPokemon),
  ]);

  currentModalPokemon = null;
  currentSpriteMode = 'normal';
  modalOverlay.classList.remove('hidden');
  modalOverlay.setAttribute('aria-hidden', 'false');
  modalContent.innerHTML = renderCompareContent({
    leftPokemon: sourcePokemon,
    rightPokemon: targetPokemon,
    leftMeta: sourceMeta,
    rightMeta: targetMeta,
  });
  compareSourcePokemon = null;
  updateCompareUI();
  const compareAgainButton = modalContent.querySelector('[data-compare-again]');
  if (compareAgainButton) {
    compareAgainButton.addEventListener('click', () => {
      enterComparePickMode(sourcePokemon);
    });
  }

  const compareDoneButton = modalContent.querySelector('[data-compare-done]');
  if (compareDoneButton) {
    compareDoneButton.addEventListener('click', () => {
      closeModal();
    });
  }

  setStatus(`Comparing ${toTitleCase(sourcePokemon.name)} and ${toTitleCase(targetPokemon.name)}.`);
};

const createTypeChip = (typeName) => {
  const chip = document.createElement('span');
  chip.className = `type-chip ${typeName}`;
  chip.textContent = typeName;
  return chip;
};

const createPokemonCard = (pokemon) => {
  const card = document.createElement('article');
  const isCompareSource = compareSourcePokemon?.id === pokemon.id;
  card.className = `pokemon-card ${isCompareSource ? 'compare-source-card' : ''} ${compareSourcePokemon && !isCompareSource ? 'compare-target-card' : ''}`;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', compareSourcePokemon ? `${isCompareSource ? `${formatPokemonName(pokemon)} selected for compare` : `Compare ${formatPokemonName(compareSourcePokemon)} with ${formatPokemonName(pokemon)}`}` : `Open details for ${pokemon.name}`);

  const dexNumber = String(pokemon.id).padStart(3, '0');
  const sprite = getSpriteUrl(pokemon);
  const isFallback = sprite === FALLBACK_SPRITE;
  const compareHint = isCompareSource
    ? '<p class="compare-card-hint">First pick selected</p>'
    : compareSourcePokemon
      ? '<p class="compare-card-hint">Tap to compare</p>'
      : '';

  card.innerHTML = `
    ${isFavorite(pokemon.id) ? '<span class="favorite-badge" aria-hidden="true">★</span>' : ''}
    <span class="dex-number">#${dexNumber}</span>
    <div class="sprite-shell ${isFallback ? 'fallback-shell' : ''}">
      <img src="${sprite}" alt="${pokemon.name} sprite" loading="lazy" />
    </div>
    <h3>${pokemon.name}</h3>
    <div class="type-row"></div>
    ${compareHint}
  `;

  const typeRow = card.querySelector('.type-row');
  pokemon.types.forEach((entry) => {
    typeRow.appendChild(createTypeChip(entry.type.name));
  });

  card.addEventListener('click', () => {
    if (compareSourcePokemon) {
      if (compareSourcePokemon.id === pokemon.id) {
        setStatus(`${formatPokemonName(pokemon)} is already selected for compare. Pick a different Pokémon.`);
        return;
      }

      openCompareView(compareSourcePokemon, pokemon);
      return;
    }

    openModal(pokemon);
  });
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (compareSourcePokemon) {
        if (compareSourcePokemon.id === pokemon.id) {
          setStatus(`${formatPokemonName(pokemon)} is already selected for compare. Pick a different Pokémon.`);
          return;
        }

        openCompareView(compareSourcePokemon, pokemon);
        return;
      }

      openModal(pokemon);
    }
  });

  return card;
};

const renderPokemon = (pokemonList) => {
  currentVisiblePokemon = pokemonList;
  pokemonGrid.innerHTML = '';

  if (!pokemonList.length) {
    pokemonGrid.innerHTML = '<p class="empty-state">No Pokémon matched your current search/filter combo.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  pokemonList.forEach((pokemon) => {
    fragment.appendChild(createPokemonCard(pokemon));
  });

  pokemonGrid.appendChild(fragment);
};

const setStatus = (message) => {
  statusMessage.textContent = message;
};

const setSearchFeedback = (message) => {
  searchFeedback.textContent = message;
};

const updateCompareUI = () => {
  if (!compareStatusBar || !compareStatusText) {
    return;
  }

  if (!compareSourcePokemon) {
    compareStatusBar.classList.add('hidden');
    compareStatusText.textContent = '';
    renderPokemon(currentVisiblePokemon);
    return;
  }

  compareStatusBar.classList.remove('hidden');
  compareStatusText.textContent = `${formatPokemonName(compareSourcePokemon)} selected. Tap a different Pokémon card to compare.`;
  renderPokemon(currentVisiblePokemon);
};

const populateTypeFilter = (pokemonList) => {
  const types = new Set();
  pokemonList.forEach((pokemon) => {
    pokemon.types.forEach((entry) => types.add(entry.type.name));
  });

  [...types]
    .sort((a, b) => a.localeCompare(b))
    .forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = toTitleCase(type);
      typeFilter.appendChild(option);
    });
};

const applyControls = () => {
  const query = searchInput.value.trim().toLowerCase();

  let filteredPokemon = allPokemon.filter((pokemon) => {
    const normalizedNumber = String(pokemon.id);
    const paddedNumber = String(pokemon.id).padStart(3, '0');
    const matchesSearch =
      !query ||
      pokemon.name.toLowerCase().includes(query) ||
      normalizedNumber.includes(query) ||
      paddedNumber.includes(query);

    const matchesType =
      currentTypeFilter === 'all' ||
      pokemon.types.some((entry) => entry.type.name === currentTypeFilter);

    const matchesFavorite = !showFavoritesOnly || isFavorite(pokemon.id);

    return matchesSearch && matchesType && matchesFavorite;
  });

  filteredPokemon = [...filteredPokemon].sort((left, right) => {
    switch (currentSortMode) {
      case 'dex-desc':
        return right.id - left.id;
      case 'name-asc':
        return left.name.localeCompare(right.name);
      case 'name-desc':
        return right.name.localeCompare(left.name);
      case 'dex-asc':
      default:
        return left.id - right.id;
    }
  });

  renderPokemon(filteredPokemon);

  const filterLabel = currentTypeFilter === 'all' ? 'all types' : `${toTitleCase(currentTypeFilter)} type`;
  const favoriteLabel = showFavoritesOnly ? ' • Favorites only' : '';
  const queryLabel = query ? ` matching "${query}"` : '';
  setStatus(`Showing ${filteredPokemon.length} Pokémon for ${filterLabel}${favoriteLabel}${queryLabel}.`);
  setSearchFeedback(`Filter: ${filterLabel}${favoriteLabel} • Sort: ${sortSelect.options[sortSelect.selectedIndex].text}`);

  if (favoritesToggleButton) {
    favoritesToggleButton.textContent = showFavoritesOnly ? '★ Favorites Only' : '☆ Favorites Only';
    favoritesToggleButton.classList.toggle('active', showFavoritesOnly);
    favoritesToggleButton.setAttribute('aria-pressed', String(showFavoritesOnly));
  }
};

const findExactSearchMatch = (query) => {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return null;
  }

  const exactNameMatch = currentVisiblePokemon.find((pokemon) => pokemon.name.toLowerCase() === trimmedQuery);
  if (exactNameMatch) {
    return exactNameMatch;
  }

  const exactNumberMatch = currentVisiblePokemon.find((pokemon) => {
    const id = String(pokemon.id);
    const padded = String(pokemon.id).padStart(3, '0');
    return trimmedQuery === id || trimmedQuery === padded;
  });

  if (exactNumberMatch) {
    return exactNumberMatch;
  }

  if (currentVisiblePokemon.length === 1) {
    return currentVisiblePokemon[0];
  }

  return null;
};

const refreshModal = () => {
  if (!currentModalPokemon || !currentModalPokemon._modalMeta) {
    return;
  }

  modalContent.innerHTML = renderModalContent({
    pokemon: currentModalPokemon,
    modalMeta: currentModalPokemon._modalMeta,
    currentSpriteMode,
    isFavorite: isFavorite(currentModalPokemon.id),
  });

  attachModalInteractions({
    modalContent,
    onVariantChange: (variant) => {
      currentSpriteMode = variant;
      refreshModal();
    },
    onFavoriteToggle: () => {
      if (!currentModalPokemon) return;
      toggleFavorite(currentModalPokemon.id);
      refreshModal();
      applyControls();
    },
    onCompare: () => {
      if (!currentModalPokemon) return;
      enterComparePickMode(currentModalPokemon);
    },
  });
};

const openModal = async (pokemon) => {
  currentModalPokemon = pokemon;
  currentSpriteMode = 'normal';

  modalOverlay.classList.remove('hidden');
  modalOverlay.setAttribute('aria-hidden', 'false');
  modalContent.innerHTML = '<p class="modal-loading">Analyzing Pokédex Data…</p>';

  await getPokemonModalMeta(pokemon);
  refreshModal();
};

const closeModal = ({ preserveCompare = false } = {}) => {
  modalOverlay.classList.add('hidden');
  modalOverlay.setAttribute('aria-hidden', 'true');
  modalContent.innerHTML = '';
  currentModalPokemon = null;
  currentSpriteMode = 'normal';
  if (!preserveCompare) {
    compareSourcePokemon = null;
    if (allPokemon.length) {
      applyControls();
      return;
    }
  }
  updateCompareUI();
};

const enterComparePickMode = (pokemon) => {
  compareSourcePokemon = pokemon;
  closeModal({ preserveCompare: true });
  setStatus(`Compare mode active. ${formatPokemonName(pokemon)} is selected as the first Pokémon.`);

  if (pokedexEntriesSection) {
    pokedexEntriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const handleBackToTopVisibility = () => {
  if (!backToTopButton) {
    return;
  }

  const shouldShow = window.scrollY > 320;
  backToTopButton.classList.toggle('hidden', !shouldShow);
};

const init = async () => {
  try {
    loadFavorites();
    setStatus('Loading Pokémon data…');
    allPokemon = await fetchPokemonList();
    populateTypeFilter(allPokemon);
    applyControls();

    searchInput.addEventListener('input', applyControls);
    typeFilter.addEventListener('change', (event) => {
      currentTypeFilter = event.target.value;
      applyControls();
    });
    sortSelect.addEventListener('change', (event) => {
      currentSortMode = event.target.value;
      applyControls();
    });
  } catch (error) {
    console.error(error);
    setStatus('Something went wrong while loading Pokémon data.');
    setSearchFeedback('Search unavailable until Pokémon data loads correctly.');
  }
};

modalCloseButton.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
    closeModal();
  }
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();

    const matchedPokemon = findExactSearchMatch(searchInput.value);
    if (matchedPokemon) {
      openModal(matchedPokemon);
      return;
    }

    if (searchInput.value.trim() && currentVisiblePokemon.length > 1) {
      setStatus('Multiple matches found — refine your search or choose a Pokémon card.');
      setSearchFeedback(`Filter: ${currentTypeFilter === 'all' ? 'all types' : `${toTitleCase(currentTypeFilter)} type`} • Sort: ${sortSelect.options[sortSelect.selectedIndex].text}`);
    }

    if (pokedexEntriesSection) {
      pokedexEntriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

if (favoritesToggleButton) {
  favoritesToggleButton.addEventListener('click', () => {
    showFavoritesOnly = !showFavoritesOnly;
    applyControls();
  });
}

if (resetViewButton) {
  resetViewButton.addEventListener('click', () => {
    currentTypeFilter = 'all';
    currentSortMode = 'dex-asc';
    showFavoritesOnly = false;
    typeFilter.value = 'all';
    sortSelect.value = 'dex-asc';
    searchInput.value = '';
    applyControls();
  });
}

if (controlsToggleButton && controlsBody) {
  if (window.matchMedia('(max-width: 640px)').matches) {
    controlsBody.classList.add('collapsed');
  }

  controlsToggleButton.addEventListener('click', () => {
    controlsBody.classList.toggle('collapsed');
    updateControlsToggle();
  });

  window.addEventListener('resize', updateControlsToggle);
  updateControlsToggle();
}

if (compareStartOverButton) {
  compareStartOverButton.addEventListener('click', () => {
    compareSourcePokemon = null;
    updateCompareUI();
    setStatus('Compare reset. Open any Pokémon and tap Compare to choose a new first pick.');
  });
}

if (compareExitButton) {
  compareExitButton.addEventListener('click', () => {
    compareSourcePokemon = null;
    updateCompareUI();
    applyControls();
  });
}

if (backToTopButton) {
  backToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', handleBackToTopVisibility, { passive: true });
}

init();
