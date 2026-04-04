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
    <section class="modal-section">
      <h3>Stats</h3>
      <div class="stats-block">
        ${rows}
        <div class="stat-total-card">
          <span class="fact-label">Base Stat Total</span>
          <span class="stat-total-value">${total}</span>
        </div>
      </div>
    </section>
  `;
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

export const renderModalContent = ({ pokemon, modalMeta, currentSpriteMode }) => {
  const dexNumber = String(pokemon.id).padStart(3, '0');
  const sprite = getSpriteUrl(pokemon, currentSpriteMode);

  return `
    <div class="modal-top">
      <div class="modal-sprite-shell ${sprite === FALLBACK_SPRITE ? 'fallback-shell' : ''}">
        <img src="${sprite}" alt="${pokemon.name} ${currentSpriteMode} sprite" />
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

    ${renderStatsSection(pokemon.stats)}

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

    <section class="modal-section modal-facts">
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

export const attachModalInteractions = ({ modalContent, onVariantChange }) => {
  const variantButtons = modalContent.querySelectorAll('[data-variant]');
  variantButtons.forEach((button) => {
    button.addEventListener('click', () => {
      onVariantChange(button.dataset.variant);
    });
  });

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
