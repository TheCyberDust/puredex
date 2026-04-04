export const POKE_API_LIST_URL = 'https://pokeapi.co/api/v2/pokemon?limit=151';
export const TYPE_API_URL = 'https://pokeapi.co/api/v2/type/';
export const KANTO_MAX_ID = 151;
export const FALLBACK_SPRITE = 'assets/missingno.png';

const typeCache = new Map();
const speciesCache = new Map();
const evolutionChainCache = new Map();
const abilityCache = new Map();

export const fetchPokemonList = async () => {
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

export const fetchTypeData = async (typeName) => {
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

export const fetchSpeciesDataByUrl = async (url, label = 'species') => {
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

export const fetchSpeciesData = async (pokemon) =>
  fetchSpeciesDataByUrl(pokemon.species.url, pokemon.name);

export const fetchEvolutionChain = async (chainUrl) => {
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

export const fetchAbilityData = async (abilityUrl) => {
  if (abilityCache.has(abilityUrl)) {
    return abilityCache.get(abilityUrl);
  }

  const response = await fetch(abilityUrl);
  if (!response.ok) {
    throw new Error('Could not fetch ability data.');
  }

  const data = await response.json();
  abilityCache.set(abilityUrl, data);
  return data;
};

export const getSpriteUrl = (pokemon, mode = 'normal') => {
  const officialArtwork = pokemon.sprites.other?.['official-artwork'];
  const artworkNormal = officialArtwork?.front_default;
  const artworkShiny = officialArtwork?.front_shiny;
  const normalSprite =
    artworkNormal ||
    pokemon.sprites.front_default ||
    pokemon.sprites.other?.dream_world?.front_default ||
    FALLBACK_SPRITE;

  if (mode === 'shiny') {
    return artworkShiny || pokemon.sprites.front_shiny || normalSprite;
  }

  return normalSprite;
};
