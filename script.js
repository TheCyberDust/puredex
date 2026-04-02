const POKE_API_LIST_URL = 'https://pokeapi.co/api/v2/pokemon?limit=151';
const TYPE_API_URL = 'https://pokeapi.co/api/v2/type/';
const KANTO_MAX_ID = 151;
const FALLBACK_SPRITE = 'assets/missingno.png';

const pokemonGrid = document.getElementById('pokemon-grid');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search-input');
const searchFeedback = document.getElementById('search-feedback');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalCloseButton = document.getElementById('modal-close');
const backToTopButton = document.getElementById('back-to-top');
const pokedexEntriesSection = document.getElementById('pokedex-entries');

let allPokemon = [];
const typeCache = new Map();
const speciesCache = new Map();
const evolutionChainCache = new Map();

const toTitleCase = (value) =>
  value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const fetchPokemonList = async () => {
  const listResponse = await fetch(POKE_API_LIST_URL);
  if (!listResponse.ok) {
    throw new Error('Could not fetch Pokémon list.');
  }

  const listData = await listResponse.json();

  const detailPromises = listData.results.map(async (pokemon) => {
    const detailResponse = await fetch(pokemon.url);
    if (!detailResponse.ok) {
      throw new Error(`Could not fetch details for ${pokemon.name}.`);
    }
    return detailResponse.json();
  });

  return Promise.all(detailPromises);
};

const fetchTypeData = async (typeName) => {
  if (typeCache.has(typeName)) {
    return typeCache.get(typeName);
  }

  const response = await fetch(`${TYPE_API_URL}${typeName}`);
  if (!response.ok) {
    throw new Error(`Could not fetch type data for ${typeName}.`);
  }

  const data = await response.json();
  typeCache.set(typeName, data);
  return data;
};

const fetchSpeciesDataByUrl = async (url, label = 'species') => {
  if (speciesCache.has(url)) {
    return speciesCache.get(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${label} data.`);
  }

  const data = await response.json();
  speciesCache.set(url, data);
  return data;
};

const fetchSpeciesData = async (pokemon) => fetchSpeciesDataByUrl(pokemon.species.url, pokemon.name);

const fetchEvolutionChain = async (chainUrl) => {
  if (evolutionChainCache.has(chainUrl)) {
    return evolutionChainCache.get(chainUrl);
  }

  const response = await fetch(chainUrl);
  if (!response.ok) {
    throw new Error('Could not fetch evolution chain data.');
  }

  const data = await response.json();
  evolutionChainCache.set(chainUrl, data);
  return data;
};

const getSpriteUrl = (pokemon) => {
  return (
    pokemon.sprites.other?.['official-artwork']?.front_default ||
    pokemon.sprites.front_default ||
    pokemon.sprites.other?.dream_world?.front_default ||
    FALLBACK_SPRITE
  );
};

const createTypeChip = (typeName) => {
  const chip = document.createElement('span');
  chip.className = `type-chip ${typeName}`;
  chip.textContent = typeName;
  return chip;
};

const createPokemonCard = (pokemon) => {
  const card = document.createElement('article');
  card.className = 'pokemon-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open details for ${pokemon.name}`);

  const dexNumber = String(pokemon.id).padStart(3, '0');
  const sprite = getSpriteUrl(pokemon);
  const isFallback = sprite === FALLBACK_SPRITE;

  card.innerHTML = `
    <span class="dex-number">#${dexNumber}</span>
    <div class="sprite-shell ${isFallback ? 'fallback-shell' : ''}">
      <img src="${sprite}" alt="${pokemon.name} sprite" loading="lazy" />
    </div>
    <h3>${pokemon.name}</h3>
    <div class="type-row"></div>
  `;

  const typeRow = card.querySelector('.type-row');
  pokemon.types.forEach((entry) => {
    typeRow.appendChild(createTypeChip(entry.type.name));
  });

  card.addEventListener('click', () => openModal(pokemon));
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModal(pokemon);
    }
  });

  return card;
};

const renderPokemon = (pokemonList) => {
  pokemonGrid.innerHTML = '';

  if (!pokemonList.length) {
    pokemonGrid.innerHTML = '<p class="empty-state">No Pokémon matched your search.</p>';
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

const calculateDamageProfile = async (pokemon) => {
  const allKnownTypes = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
    'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
    'steel', 'fairy'
  ];

  const defensiveMultipliers = {};
  const offensiveMultipliers = {};

  allKnownTypes.forEach((type) => {
    defensiveMultipliers[type] = 1;
    offensiveMultipliers[type] = 1;
  });

  for (const entry of pokemon.types) {
    const typeData = await fetchTypeData(entry.type.name);
    const relations = typeData.damage_relations;

    relations.double_damage_from.forEach((type) => {
      defensiveMultipliers[type.name] *= 2;
    });

    relations.half_damage_from.forEach((type) => {
      defensiveMultipliers[type.name] *= 0.5;
    });

    relations.no_damage_from.forEach((type) => {
      defensiveMultipliers[type.name] *= 0;
    });

    relations.double_damage_to.forEach((type) => {
      offensiveMultipliers[type.name] *= 2;
    });

    relations.half_damage_to.forEach((type) => {
      offensiveMultipliers[type.name] *= 0.5;
    });

    relations.no_damage_to.forEach((type) => {
      offensiveMultipliers[type.name] *= 0;
    });
  }

  const weaknesses = Object.entries(defensiveMultipliers)
    .filter(([, multiplier]) => multiplier > 1)
    .sort((a, b) => b[1] - a[1]);

  const strengths = Object.entries(offensiveMultipliers)
    .filter(([, multiplier]) => multiplier > 1)
    .sort((a, b) => b[1] - a[1]);

  return { weaknesses, strengths };
};

const formatAbilities = (pokemon) =>
  pokemon.abilities.map((entry) => entry.ability.name.replace('-', ' ')).join(', ');

const renderDamageChips = (entries, emptyMessage) => {
  if (!entries.length) {
    return `<p class="modal-empty">${emptyMessage}</p>`;
  }

  return entries
    .map(
      ([type, multiplier]) =>
        `<span class="weakness-chip ${type}">${toTitleCase(type)} ×${multiplier}</span>`
    )
    .join('');
};

const formatTriggerDetails = (details) => {
  if (!details || !details.length) {
    return 'Special Condition';
  }

  const detail = details[0];

  if (detail.min_level) {
    return `Level ${detail.min_level}`;
  }

  if (detail.item?.name) {
    return `Use ${toTitleCase(detail.item.name)}`;
  }

  if (detail.trigger?.name === 'trade') {
    return 'Trade';
  }

  if (detail.min_happiness) {
    return 'High Friendship';
  }

  if (detail.held_item?.name) {
    return `Level Up While Holding ${toTitleCase(detail.held_item.name)}`;
  }

  if (detail.known_move?.name) {
    return `Learns ${toTitleCase(detail.known_move.name)}`;
  }

  if (detail.time_of_day) {
    return `Evolves During ${toTitleCase(detail.time_of_day)}`;
  }

  if (detail.location?.name) {
    return `At ${toTitleCase(detail.location.name)}`;
  }

  return 'Special Condition';
};

const isKantoSpecies = async (speciesUrl) => {
  const speciesData = await fetchSpeciesDataByUrl(speciesUrl);
  return speciesData.id <= KANTO_MAX_ID;
};

const findEvolutionInfo = async (chainNode, pokemonName) => {
  if (chainNode.species.name === pokemonName) {
    const nextEvolutions = [];

    for (const evolution of chainNode.evolves_to) {
      if (await isKantoSpecies(evolution.species.url)) {
        nextEvolutions.push({
          name: toTitleCase(evolution.species.name),
          method: formatTriggerDetails(evolution.evolution_details),
        });
      }
    }

    if (!nextEvolutions.length) {
      return {
        current: pokemonName,
        status: 'No Further Gen 1 Evolutions',
      };
    }

    return {
      current: pokemonName,
      status: 'Can Evolve',
      nextEvolutions,
    };
  }

  for (const evolution of chainNode.evolves_to) {
    const match = await findEvolutionInfo(evolution, pokemonName);
    if (match) {
      return match;
    }
  }

  return null;
};

const getEvolutionInfo = async (pokemon) => {
  const speciesData = await fetchSpeciesData(pokemon);
  const evolutionChainUrl = speciesData.evolution_chain?.url;

  if (!evolutionChainUrl) {
    return {
      current: pokemon.name,
      status: 'Does Not Evolve',
    };
  }

  const evolutionChainData = await fetchEvolutionChain(evolutionChainUrl);
  const info = await findEvolutionInfo(evolutionChainData.chain, pokemon.name);

  if (info) {
    return info;
  }

  return {
    current: pokemon.name,
    status: 'Evolution Data Unavailable',
  };
};

const renderEvolutionSection = (evolutionInfo) => {
  if (evolutionInfo.nextEvolutions?.length) {
    const rows = evolutionInfo.nextEvolutions
      .map(
        (entry) => `
          <div class="evolution-row">
            <span class="evolution-name">${entry.name}</span>
            <span class="evolution-method">${entry.method}</span>
          </div>
        `
      )
      .join('');

    return `
      <div class="evolution-block">
        <p class="evolution-status">${evolutionInfo.status}</p>
        ${rows}
      </div>
    `;
  }

  return `
    <div class="evolution-block">
      <p class="evolution-status">${evolutionInfo.status}</p>
    </div>
  `;
};

const openModal = async (pokemon) => {
  modalOverlay.classList.remove('hidden');
  modalOverlay.setAttribute('aria-hidden', 'false');
  modalContent.innerHTML = '<p class="modal-loading">Analyzing Pokédex Data…</p>';

  const dexNumber = String(pokemon.id).padStart(3, '0');
  const sprite = getSpriteUrl(pokemon);

  const [{ weaknesses, strengths }, evolutionInfo] = await Promise.all([
    calculateDamageProfile(pokemon),
    getEvolutionInfo(pokemon),
  ]);

  modalContent.innerHTML = `
    <div class="modal-top">
      <div class="modal-sprite-shell ${sprite === FALLBACK_SPRITE ? 'fallback-shell' : ''}">
        <img src="${sprite}" alt="${pokemon.name} sprite" />
      </div>
      <div class="modal-identity">
        <p class="eyebrow">Pokédex Entry</p>
        <h2 id="modal-title">${pokemon.name}</h2>
        <p class="modal-number">#${dexNumber}</p>
        <div class="type-row modal-type-row">
          ${pokemon.types
            .map((entry) => `<span class="type-chip ${entry.type.name}">${entry.type.name}</span>`)
            .join('')}
        </div>
      </div>
    </div>

    <section class="modal-section">
      <h3>Weak To</h3>
      <div class="weakness-row">
        ${renderDamageChips(weaknesses, 'No Direct Weaknesses Found.')}
      </div>
    </section>

    <section class="modal-section">
      <h3>Super Effective Against</h3>
      <div class="weakness-row">
        ${renderDamageChips(strengths, 'No Boosted Matchups Found.')}
      </div>
    </section>

    <section class="modal-section">
      <h3>Evolution</h3>
      ${renderEvolutionSection(evolutionInfo)}
    </section>

    <section class="modal-section modal-facts">
      <div class="fact-card">
        <span class="fact-label">Abilities</span>
        <span class="fact-value">${formatAbilities(pokemon)}</span>
      </div>
      <div class="fact-card">
        <span class="fact-label">Height</span>
        <span class="fact-value">${pokemon.height / 10} m</span>
      </div>
      <div class="fact-card">
        <span class="fact-label">Weight</span>
        <span class="fact-value">${pokemon.weight / 10} kg</span>
      </div>
    </section>
  `;
};

const closeModal = () => {
  modalOverlay.classList.add('hidden');
  modalOverlay.setAttribute('aria-hidden', 'true');
  modalContent.innerHTML = '';
};

const handleSearch = (event) => {
  const query = event.target.value.trim().toLowerCase();

  const filteredPokemon = allPokemon.filter((pokemon) => {
    const normalizedNumber = String(pokemon.id);
    const paddedNumber = String(pokemon.id).padStart(3, '0');

    return (
      pokemon.name.toLowerCase().includes(query) ||
      normalizedNumber.includes(query) ||
      paddedNumber.includes(query)
    );
  });

  renderPokemon(filteredPokemon);

  if (!query) {
    setStatus(`Loaded ${allPokemon.length} Pokémon from the original Kanto Pokédex.`);
    setSearchFeedback(`Showing all ${allPokemon.length} Pokémon.`);
    return;
  }

  setStatus(`Found ${filteredPokemon.length} Pokémon matching "${query}".`);
  setSearchFeedback(`Showing ${filteredPokemon.length} match${filteredPokemon.length === 1 ? '' : 'es'} for "${query}".`);
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
    setStatus('Loading Pokémon data…');
    allPokemon = await fetchPokemonList();
    renderPokemon(allPokemon);
    setStatus(`Loaded ${allPokemon.length} Pokémon from the original Kanto Pokédex.`);
    setSearchFeedback(`Showing all ${allPokemon.length} Pokémon.`);
    searchInput.addEventListener('input', handleSearch);
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
  if (event.key === 'Enter' && pokedexEntriesSection) {
    event.preventDefault();
    pokedexEntriesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

if (backToTopButton) {
  backToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', handleBackToTopVisibility, { passive: true });
}

init();
