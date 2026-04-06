import { FALLBACK_SPRITE, getSpriteUrl } from './data.js';
import { toTitleCase } from './pokemon-utils.js';

export const renderDamageChips = (entries, emptyMessage) => {
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

export const renderEvolutionSection = (evolutionInfo) => {
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

const renderStatsSection = (stats) => {
  const statNameMap = {
    hp: 'HP',
    attack: 'Attack',
    defense: 'Defense',
    'special-attack': 'Sp. Attack',
    'special-defense': 'Sp. Defense',
    speed: 'Speed',
  };

  const maxStatValue = 255;
  const total = stats.reduce((sum, stat) => sum + stat.base_stat, 0);

  const rows = stats
    .map((stat) => {
      const label = statNameMap[stat.stat.name] || stat.stat.name;
      const width = Math.max(8, (stat.base_stat / maxStatValue) * 100);
      const toneClass = stat.base_stat < 60 ? 'low' : stat.base_stat < 100 ? 'mid' : 'high';
      return `
        <div class="stat-row">
          <div class="stat-heading-row">
            <span class="stat-name">${label}</span>
            <span class="stat-value">${stat.base_stat}</span>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill ${toneClass}" style="width: ${width}%"></div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="stats-block">
      ${rows}
      <div class="stat-total-card">
        <span class="fact-label">Base Stat Total</span>
        <span class="stat-total-value">${total}</span>
      </div>
    </div>
  `;
};

const getFlavorText = (speciesData) => {
  const englishEntry = speciesData.flavor_text_entries?.find((entry) => entry.language.name === 'en');
  if (!englishEntry) {
    return 'No Pokédex entry available.';
  }

  return englishEntry.flavor_text.replace(/\n|\f/g, ' ').replace(/\s+/g, ' ').trim();
};

const renderVariantControls = (currentSpriteMode) => `
  <div class="variant-panel">
    <div class="variant-header-row">
      <p class="variant-label">Sprite View</p>
      <button class="variant-hint-toggle" type="button" aria-expanded="false" aria-controls="variant-hint-panel">
        <span class="variant-hint-arrow">▾</span>
        Hint
      </button>
    </div>
    <div id="variant-hint-panel" class="variant-hint-panel hidden">
      <p class="variant-helper">Switch between normal and shiny artwork. Regional forms are planned for later.</p>
    </div>
    <div class="variant-controls" role="group" aria-label="Sprite variant controls">
      <button
        class="variant-button ${currentSpriteMode === 'normal' ? 'active' : ''}"
        type="button"
        data-variant="normal"
        aria-pressed="${currentSpriteMode === 'normal'}"
      >
        Normal
      </button>
      <button
        class="variant-button ${currentSpriteMode === 'shiny' ? 'active' : ''}"
        type="button"
        data-variant="shiny"
        aria-pressed="${currentSpriteMode === 'shiny'}"
      >
        Shiny
      </button>
      <button
        class="variant-button placeholder"
        type="button"
        disabled
        title="Regional forms are planned for later."
      >
        Regional Forms
      </button>
    </div>
  </div>
`;

export const renderModalContent = ({ pokemon, modalMeta, currentSpriteMode, isFavorite }) => {
  const dexNumber = String(pokemon.id).padStart(3, '0');
  const sprite = getSpriteUrl(pokemon, currentSpriteMode);

  return `
    <div class="modal-top">
      <div class="modal-sprite-shell ${sprite === FALLBACK_SPRITE ? 'fallback-shell' : ''}">
        <img src="${sprite}" alt="${pokemon.name} ${currentSpriteMode} sprite" />
      </div>
      <div class="modal-identity">
        <p class="eyebrow">Pokédex Entry</p>
        <h2 id="modal-title">${toTitleCase(pokemon.name)}</h2>
        <p class="modal-number">#${dexNumber}</p>
        <div class="type-row modal-type-row">
          ${pokemon.types
            .map((entry) => `<span class="type-chip ${entry.type.name}">${entry.type.name}</span>`)
            .join('')}
        </div>
        <div class="modal-action-row">
          <button class="favorite-toggle ${isFavorite ? 'active' : ''}" type="button" data-favorite-toggle aria-pressed="${isFavorite}">${isFavorite ? '★ Favorited' : '☆ Favorite'}</button>
          <button class="compare-toggle" type="button" data-compare-toggle>⇄ Compare</button>
        </div>
        ${renderVariantControls(currentSpriteMode)}
      </div>
    </div>

    <section class="modal-section">
      <h3>Weak To</h3>
      <div class="weakness-row">
        ${renderDamageChips(modalMeta.weaknesses, 'No Direct Weaknesses Found.')}
      </div>
    </section>

    <section class="modal-section">
      <h3>Super Effective Against</h3>
      <div class="weakness-row">
        ${renderDamageChips(modalMeta.strengths, 'No Boosted Matchups Found.')}
      </div>
    </section>

    <section class="modal-section">
      <h3>Evolution</h3>
      ${renderEvolutionSection(modalMeta.evolutionInfo)}
    </section>

    <section class="modal-section">
      <h3>Stats</h3>
      ${renderStatsSection(pokemon.stats)}
    </section>

    <section class="modal-section">
      <h3>Pokédex Entry</h3>
      <p class="flavor-entry">${getFlavorText(modalMeta.speciesData)}</p>
    </section>

    <section class="modal-section">
      <h3>Abilities</h3>
      <div class="ability-list">
        ${modalMeta.abilityDetails
          .map(
            (ability) => `
              <article class="ability-card">
                <div class="ability-heading-row">
                  <span class="ability-name">${ability.name}</span>
                  ${ability.isHidden ? '<span class="ability-tag">Hidden</span>' : ''}
                </div>
                <p class="ability-description">${ability.description}</p>
              </article>
            `
          )
          .join('')}
      </div>
    </section>
  `;
};

export const attachModalInteractions = ({ modalContent, onVariantChange, onFavoriteToggle, onCompare }) => {
  const variantButtons = modalContent.querySelectorAll('[data-variant]');
  variantButtons.forEach((button) => {
    button.addEventListener('click', () => {
      onVariantChange(button.dataset.variant);
    });
  });

  const favoriteToggle = modalContent.querySelector('[data-favorite-toggle]');
  if (favoriteToggle && onFavoriteToggle) {
    favoriteToggle.addEventListener('click', onFavoriteToggle);
  }

  const compareToggle = modalContent.querySelector('[data-compare-toggle]');
  if (compareToggle && onCompare) {
    compareToggle.addEventListener('click', onCompare);
  }

  const hintToggle = modalContent.querySelector('.variant-hint-toggle');
  const hintPanel = modalContent.querySelector('.variant-hint-panel');
  if (hintToggle && hintPanel) {
    hintToggle.addEventListener('click', () => {
      const isHidden = hintPanel.classList.toggle('hidden');
      hintToggle.setAttribute('aria-expanded', String(!isHidden));
      hintToggle.classList.toggle('open', !isHidden);
    });
  }
};

const renderCompareHeader = ({ pokemon }) => {
  const sprite = getSpriteUrl(pokemon);
  return `
    <div class="compare-header-card">
      <div class="compare-header-sprite modal-sprite-shell ${sprite === FALLBACK_SPRITE ? 'fallback-shell' : ''}">
        <img src="${sprite}" alt="${pokemon.name} sprite" />
      </div>
      <p class="eyebrow">Compare</p>
      <h3>${toTitleCase(pokemon.name)}</h3>
      <p class="modal-number">#${String(pokemon.id).padStart(3, '0')}</p>
      <div class="compare-type-row">
        ${pokemon.types.map((entry) => `<span class="compare-type-chip type-chip ${entry.type.name}">${entry.type.name}</span>`).join('')}
      </div>
    </div>
  `;
};

const renderCompareSection = ({ title, leftContent, rightContent }) => `
  <section class="compare-section">
    <h3>${title}</h3>
    <div class="compare-section-grid">
      <div class="compare-pane">${leftContent}</div>
      <div class="compare-pane">${rightContent}</div>
    </div>
  </section>
`;

export const renderCompareContent = ({ leftPokemon, rightPokemon, leftMeta, rightMeta }) => `
  <div class="compare-shell">
    <div class="compare-heading">
      <p class="eyebrow">Compare Mode</p>
      <h2>Side-by-side comparison</h2>
      <p class="compare-copy">A cleaner way to compare stats, matchups, and evolution details at a glance.</p>
    </div>

    ${renderCompareSection({
      title: 'Pokémon',
      leftContent: renderCompareHeader({ pokemon: leftPokemon }),
      rightContent: renderCompareHeader({ pokemon: rightPokemon }),
    })}

    ${renderCompareSection({
      title: 'Weak To',
      leftContent: `<div class="weakness-row">${renderDamageChips(leftMeta.weaknesses, 'No Direct Weaknesses Found.')}</div>`,
      rightContent: `<div class="weakness-row">${renderDamageChips(rightMeta.weaknesses, 'No Direct Weaknesses Found.')}</div>`,
    })}

    ${renderCompareSection({
      title: 'Super Effective Against',
      leftContent: `<div class="weakness-row compare-strength-row">${renderDamageChips(leftMeta.strengths, 'No Boosted Matchups Found.')}</div>`,
      rightContent: `<div class="weakness-row compare-strength-row">${renderDamageChips(rightMeta.strengths, 'No Boosted Matchups Found.')}</div>`,
    })}

    ${renderCompareSection({
      title: 'Stats',
      leftContent: renderStatsSection(leftPokemon.stats),
      rightContent: renderStatsSection(rightPokemon.stats),
    })}

    ${renderCompareSection({
      title: 'Evolution',
      leftContent: renderEvolutionSection(leftMeta.evolutionInfo),
      rightContent: renderEvolutionSection(rightMeta.evolutionInfo),
    })}

    ${renderCompareSection({
      title: 'Abilities',
      leftContent: `<div class="ability-list">${leftMeta.abilityDetails.map((ability) => `
        <article class="ability-card">
          <div class="ability-heading-row">
            <span class="ability-name">${ability.name}</span>
            ${ability.isHidden ? '<span class="ability-tag">Hidden</span>' : ''}
          </div>
          <p class="ability-description">${ability.description}</p>
        </article>
      `).join('')}</div>`,
      rightContent: `<div class="ability-list">${rightMeta.abilityDetails.map((ability) => `
        <article class="ability-card">
          <div class="ability-heading-row">
            <span class="ability-name">${ability.name}</span>
            ${ability.isHidden ? '<span class="ability-tag">Hidden</span>' : ''}
          </div>
          <p class="ability-description">${ability.description}</p>
        </article>
      `).join('')}</div>`,
    })}
  </div>
`;
