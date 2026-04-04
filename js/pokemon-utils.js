import {
  KANTO_MAX_ID,
  fetchAbilityData,
  fetchEvolutionChain,
  fetchSpeciesData,
  fetchSpeciesDataByUrl,
  fetchTypeData,
} from './data.js';

export const toTitleCase = (value) =>
  value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const calculateDamageProfile = async (pokemon) => {
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

export const getAbilityDescription = (abilityData) => {
  const englishEntry = abilityData.effect_entries?.find((entry) => entry.language.name === 'en');
  if (!englishEntry) {
    return 'Description unavailable.';
  }

  return englishEntry.short_effect.replace(/\n|\f/g, ' ').replace(/\s+/g, ' ').trim();
};

export const getAbilityDetails = async (pokemon) => {
  return Promise.all(
    pokemon.abilities.map(async (entry) => {
      const abilityData = await fetchAbilityData(entry.ability.url);
      return {
        name: toTitleCase(entry.ability.name),
        description: getAbilityDescription(abilityData),
        isHidden: entry.is_hidden,
      };
    })
  );
};

export const formatTriggerDetails = (details) => {
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

export const isKantoSpecies = async (speciesUrl) => {
  const speciesData = await fetchSpeciesDataByUrl(speciesUrl);
  return speciesData.id <= KANTO_MAX_ID;
};

export const findEvolutionInfo = async (chainNode, pokemonName) => {
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

export const getEvolutionInfo = async (pokemon) => {
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
