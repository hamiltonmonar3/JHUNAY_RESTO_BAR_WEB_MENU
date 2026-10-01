const menuIcons = [
  ['parrill', 'fa-fire-flame-curved'],
  ['menestra', 'fa-bowl-food'],
  ['pincho', 'fa-skewer'],
  ['picadita', 'fa-plate-wheat'],
  ['salchipapa', 'fa-hotdog'],
  ['hamburguesa', 'fa-burger'],
  ['alita', 'fa-drumstick-bite'],
  ['combo', 'fa-percent'],
  ['guarnici', 'fa-utensils'],
  ['pasta', 'fa-bowl-food'],
  ['ensalada', 'fa-leaf'],
  ['bebida', 'fa-glass-water'],
  ['malteada', 'fa-glass-water'],
  ['cóctel', 'fa-martini-glass-citrus'],
  ['coctel', 'fa-martini-glass-citrus'],
  ['cerveza', 'fa-beer-mug-empty'],
  ['pecera', 'fa-champagne-glasses'],
  ['vino', 'fa-wine-glass'],
  ['postre', 'fa-ice-cream'],
  ['corte', 'fa-fire-flame-curved']
];
const menuGroups = [
  { name: 'Parrilladas Especiales', sources: ['PARRILLADAS'] },
  { name: 'Cortes al Carbón', sources: ['CORTES ESPECIALES'] },
  { name: 'Pastas & Lasañas', sources: ['Pastas y Lazañas'] },
  { name: 'Pinchos & Menestras', sources: ['MENESTRAS Y PINCHOS'] },
  { name: 'Picaditas para Compartir', sources: ['PICADITAS'] },
  { name: 'Hamburguesas Artesanales', sources: ['HAMBURGUESAS'] },
  { name: 'Salchipapas', sources: ['SALCHIPAPAS'] },
  { name: 'Alitas Crujientes', sources: ['ALITAS (SALSAS VARIAS)'] },
  { name: 'Combos Especiales', sources: ['COMBOS'] },
  { name: 'Guarniciones & Ensaladas', sources: ['Guarniciones', 'Ensaladas'] },
  { name: 'Bebidas, Coctelería & Vinos', sources: ['BEBIDAS Y MALTEADAS', 'MICHELADAS Y CÓCTELES', 'CERVEZAS', 'PECERAS Y ESPECIALES', 'VINOS'] },
  { name: 'Postres', sources: ['POSTRES'] }
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value.trim());
    if (row.some(cell => cell !== '')) rows.push(row);
  }
  return rows;
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function parseMenu(text) {
  const categories = [];
  let currentCategory = null;
  let lastProduct = null;

  parseCsv(text.replace(/^\uFEFF/, '')).forEach((row, rowIndex) => {
    const [first = '', description = '', presentation = '', rawPrice = ''] = row;
    const name = first.trim();

    if (!name && !description && !presentation && !rawPrice) return;
    if (name.toLowerCase() === 'producto') return;

    if (name && !description && !presentation && !rawPrice) {
      if (name.toLowerCase().includes('menú por categorías')) return;
      currentCategory = { name, id: slugify(name), products: [] };
      categories.push(currentCategory);
      lastProduct = null;
      return;
    }

    if (!currentCategory) return;

    const productName = name || lastProduct?.name;
    if (!productName) throw new Error(`Producto sin nombre en la fila ${rowIndex + 1}.`);

    const price = Number(rawPrice.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(price)) throw new Error(`Precio inválido para ${productName} en la fila ${rowIndex + 1}.`);

    const productDescription = description || lastProduct?.description || '';
    const previousProduct = currentCategory.products[currentCategory.products.length - 1];
    const product = !name
      ? lastProduct
      : previousProduct?.name === productName && previousProduct.description === productDescription
        ? previousProduct
        : { name: productName, description: productDescription, variants: [] };

    if (product !== previousProduct) currentCategory.products.push(product);
    product.variants.push({ presentation: presentation || 'Estándar', price });
    lastProduct = product;
  });

  return categories.filter(category => category.products.length > 0);
}

function categoryIcon(name) {
  const normalizedName = name.toLocaleLowerCase('es');
  const match = menuIcons.find(([keyword]) => normalizedName.includes(keyword));
  return match ? match[1] : 'fa-utensils';
}

function createSideProduct(name, description, itemNames, sourceProducts) {
  const productsByName = new Map(sourceProducts.map(product => [product.name.toLocaleLowerCase('es'), product]));
  const variants = itemNames.flatMap(itemName => {
    const product = productsByName.get(itemName.toLocaleLowerCase('es'));
    if (!product) throw new Error(`No se encontró el acompañamiento ${itemName}.`);
    return product.variants.map(variant => ({
      presentation: itemName,
      itemName,
      price: variant.price
    }));
  });

  return { name, description, variants };
}

function organizeMenu(categories) {
  const categoriesByName = new Map(categories.map(category => [category.name.toLocaleLowerCase('es'), category]));

  return menuGroups.map(group => {
    let products = group.sources.flatMap(source => categoriesByName.get(source.toLocaleLowerCase('es'))?.products || []);

    if (group.sources.includes('ALITAS (SALSAS VARIAS)')) {
      const sauces = products.map(product => product.name.replace(/^Alitas\s*/i, ''));
      const portions = products[0]?.variants || [];
      products = [{
        name: 'Alitas Crujientes',
        description: `Salsas disponibles: ${sauces.join(', ')}. Incluye papas y ensalada.`,
        choices: sauces,
        variants: portions.map(variant => ({
          ...variant,
          presentation: variant.presentation.replace(/Unidades/i, 'Alitas')
        }))
      }];
    }

    if (group.sources.includes('Guarniciones')) {
      const sideProducts = products;
      products = [
        createSideProduct('Papas Fritas / Al Horno / Salteadas', 'Clásicas crujientes, al horno con salsa de queso o salteadas a la mantequilla.', ['Papas Fritas', 'Papas al horno', 'Papas Salteadas'], sideProducts),
        createSideProduct('Arroz con Menestra / Moros', 'Arroz tradicional con menestra casera o moros sazonados de la casa.', ['Arroz con Menestra', 'Moro Lenteja', 'Moro Choclo', 'Moro Champiñones'], sideProducts),
        createSideProduct('Arroz Blanco / Verduras Salteadas', 'Grano largo suelto o vegetales frescos de temporada salteados al dente.', ['Arroz Blanco', 'Verduras salteadas'], sideProducts),
        createSideProduct('Ensalada del Huerto / César con Pollo', 'Mix de lechugas, aguacate y vinagreta cítrica / Clásica César con crutones y parmesano.', ['Ensalada del Huerto', 'Ensalada Cesar'], categoriesByName.get('ensaladas')?.products || [])
      ];
    }

    if (group.sources.includes('HAMBURGUESAS')) {
      const baseBurger = products.find(product => product.name === 'Hamburguesa Opciones Base');
      const cheesIndex = baseBurger?.variants.findIndex(variant => variant.presentation.toLowerCase() === 'chees');
      if (baseBurger && cheesIndex >= 0) {
        const [cheesPrice] = baseBurger.variants.splice(cheesIndex, 1);
        baseBurger.name = 'Hamburguesa Base';
        baseBurger.description = 'Carne 100% res a la parrilla, vegetales frescos y salsas de la casa.';
        products.push({
          name: 'Hamburguesa Cheeseburger',
          description: 'Carne artesanal, abundante queso cheddar derretido y vegetales frescos.',
          variants: [{ presentation: 'Estándar', price: cheesPrice.price }]
        });
      }
    }

    if (group.sources.includes('BEBIDAS Y MALTEADAS')) {
      const lemonadeProducts = products.filter(product => product.name.toLocaleLowerCase('es').startsWith('limonadas y jugos'));
      if (lemonadeProducts.length > 0) {
        const firstIndex = products.indexOf(lemonadeProducts[0]);
        const combinedProduct = {
          name: 'Limonadas y Jugos de Temporada',
          description: lemonadeProducts[0].description,
          variants: lemonadeProducts.flatMap(product => product.variants)
        };
        products = products.filter(product => !lemonadeProducts.includes(product));
        products.splice(firstIndex, 0, combinedProduct);
      }
    }

    if (group.sources.includes('PECERAS Y ESPECIALES')) {
      products.unshift({
        name: 'Pecera Grande',
        description: 'Cóctel para compartir servido en pecera grande.',
        variants: [{ presentation: 'Estándar', price: 14.99 }]
      });
    }

    return { name: group.name, id: slugify(group.name), products };
  });
}

function renderCategoryButton(category, index) {
  const active = index === -1;
  const categoryId = index === -1 ? 'all' : category.id;
  const label = index === -1 ? 'Todo' : category.name;
  const compactLabels = {
    'Parrilladas Especiales': 'Parrilladas',
    'Cortes al Carbón': 'Cortes',
    'Pastas & Lasañas': 'Pastas',
    'Pinchos & Menestras': 'Pinchos',
    'Picaditas para Compartir': 'Picaditas',
    'Hamburguesas Artesanales': 'Hamburguesas',
    'Alitas Crujientes': 'Alitas',
    'Combos Especiales': 'Combos',
    'Guarniciones & Ensaladas': 'Guarniciones',
    'Bebidas, Coctelería & Vinos': 'Bebidas y bar'
  };
  const compactLabel = compactLabels[label] || label;
  const icon = index === -1 ? 'fa-utensils' : categoryIcon(category.name);
  const activeClasses = active ? 'bg-grillRed text-white shadow-md' : 'bg-grillCard text-gray-300 border border-grillBorder';
  return `<button type="button" title="${escapeHtml(label)}" onclick="filterCategory('${categoryId}', this)" class="cat-btn w-full md:w-auto px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold ${activeClasses} hover:bg-grillBorder transition-all"><i class="fa-solid ${icon} mr-1 sm:mr-2"></i><span class="hidden sm:inline">${escapeHtml(label)}</span><span class="sm:hidden">${escapeHtml(compactLabel)}</span></button>`;
}

function imageForProduct(name) {
  const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const imageRules = [
    ['parrillada personal', 'images/parillada_personal.png'],
    ['parrillada familiar', 'images/parillada_familiar.png'],
    ['ribeye', 'images/ribaye.png'],
    ['picaña gourmet', 'images/picania.png'],
    ['picaña jumbo', 'images/picania_jumbo.png'],
    ['picaña', 'images/picania.png'],
    ['borrego', 'images/borrego.png'],
    ['lomicheese', 'images/Lomo.png'],
    ['lomichees', 'images/Lomo.png'],
    ['matambre de cerdo al limon', 'images/matambre_limon.png'],
    ['matambre de cerdo a la pizza', 'images/matambre_pizza.png'],
    ['matambre', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800'],
    ['solominio', 'images/solominio.png'],
    ['file miño', 'images/filete_mino.png'],
    ['bife de chorizo', 'images/bife_chorizo.png'],
    ['picadita manaba', 'images/picada_manaba.png'],
    ['picadita andina', 'images/picadita_andina.png'],
    ['tuetano', 'images/tuetano.png'],
    ['nachos', 'images/chees_nachos.png'],
    ['alitas', 'images/alitas-x9.png'],
    ['combo 1', 'images/combo1.png'],
    ['combo 2', 'images/combo2.png'],
    ['combo 3', 'images/combo5.png'],
    ['pinchos de camaron', 'images/pincho_camaron.png'],
    ['pinchos de chorizo paisa', 'images/pincho_chorizo.png'],
    ['pinchos de lomo', 'images/pincho_lomo.png'],
    ['pinchos mixto', 'images/pincho_lomo.png'],
    ['pinchos de pollo', 'images/pincho_pollo.png'],
    ['pincho', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800'],
    ['chicharron', 'images/chicharron.png'],
    ['lomichees', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800'],
    ['costilla', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800'],
    ['picaña', 'images/picania.png'],
    ['solomillo', 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?auto=format&fit=crop&q=80&w=800'],
    ['filet mignon', 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?auto=format&fit=crop&q=80&w=800'],
    ['bife', 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?auto=format&fit=crop&q=80&w=800'],
    ['hamburguesa', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800'],
    ['salchipapa monster', 'images/salchi_monster.png'],
    ['salchi-simple', 'images/Salchi-Simple.png'],
    ['salchi-doble', 'images/salchi_doble.png'],
    ['salchicompleta', 'images/Salchicompleta.png'],
    ['salchi', 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&q=80&w=800'],
    ['papipollo', 'images/Papipollo.png'],
    ['papas', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=800'],
    ['arroz blanco / verduras salteadas', 'images/vegetales_salteados.png'],
    ['arroz con menestra / moros', 'images/moro.png'],
    ['arroz', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800'],
    ['spagetty de camaron', 'images/Spagetty_Camaron.png'],
    ['spagetty de pollo', 'images/Spagetty_Pollo.png'],
    ['spaget', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=800'],
    ['lazaña mixta carne y pollo', 'images/lazaña_mixta.png'],
    ['laza', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&q=80&w=800'],
    ['chicharron', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800'],
    ['verduras salteadas', 'images/vegetales_salteados.png'],
    ['verduras', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800'],
    ['ensalada', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800'],
    ['spaghetti', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=800'],
    ['lasana', 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&q=80&w=800'],
    ['milkshake', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=800'],
    ['batido', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=800'],
    ['limonada', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800'],
    ['jugo', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&q=80&w=800'],
    ['gaseosa', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&q=80&w=800'],
    ['cerveza', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&q=80&w=800'],
    ['tinto verano', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800'],
    ['sangria', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800'],
    ['vino', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800'],
    ['pecera', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=800'],
    ['ruleta', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=800'],
    ['michelada', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['coctel', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['mojito', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['margarita', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['destornillador', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['cuba libre', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['tequila sunrise', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['gin tonic', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['daiquiri', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['sexo en la playa', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['blue lagoon', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['herbal', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['martini', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800'],
    ['cheesecake', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800'],
    ['crepe', 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&q=80&w=800'],
    ['helado', 'https://images.unsplash.com/photo-1501446529957-6226bd447c46?auto=format&fit=crop&q=80&w=800']
  ];
  const match = imageRules.find(([keyword]) => normalizedName.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()));
  return match ? match[1] : 'images/parillada_personal.png';
}

function renderProduct(product) {
  const image = imageForProduct(product.name);
  const variants = product.variants.map(variant => `
    <button type="button" data-add-product data-product="${escapeHtml(product.name)}" data-item-name="${escapeHtml(variant.itemName || '')}" data-image="${escapeHtml(image)}" data-presentation="${escapeHtml(variant.presentation)}" data-price="${variant.price}" class="w-full bg-grillRed/10 hover:bg-grillRed text-grillRed hover:text-white border border-grillRed/30 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-between gap-2">
      <span class="text-left"><i class="fa-solid fa-plus mr-2"></i>${escapeHtml(variant.presentation)}</span>
      <span class="shrink-0 font-bold">$${variant.price.toFixed(2)}</span>
    </button>`).join('');
  const choices = product.choices ? `<label class="block text-sm text-gray-300">Salsa
    <select data-product-choice aria-label="Salsa para las alitas" class="mt-1 w-full bg-grillDark border border-grillBorder rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-grillGold">
      ${product.choices.map(choice => `<option value="${escapeHtml(choice)}">${escapeHtml(choice)}</option>`).join('')}
    </select>
  </label>` : '';

  return `<article class="bg-grillCard border border-grillBorder rounded-xl overflow-hidden shadow-lg flex flex-col gap-4 hover:border-grillRed/50 transition-all">
    <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" class="w-full h-44 object-cover bg-gray-800" onerror="this.onerror=null;this.src='images/parillada_personal.png'">
    <div class="px-5 space-y-2">
      <h3 class="font-heading text-lg font-bold text-white">${escapeHtml(product.name)}</h3>
      ${product.description ? `<p class="text-gray-400 text-sm leading-relaxed">${escapeHtml(product.description)}</p>` : ''}
    </div>
    <div class="px-5 pb-5 mt-auto space-y-3">${choices}${variants}</div>
  </article>`;
}

function renderMenu(categories) {
  const buttons = document.getElementById('menu-category-buttons');
  const main = document.getElementById('menu-content');
  const primaryNames = new Set([
    'Parrilladas Especiales',
    'Cortes al Carbón',
    'Hamburguesas Artesanales',
    'Alitas Crujientes',
    'Picaditas para Compartir',
    'Combos Especiales',
    'Bebidas, Coctelería & Vinos'
  ]);
  const primaryCategories = categories.filter(category => primaryNames.has(category.name));
  const secondaryCategories = categories.filter(category => !primaryNames.has(category.name));
  const moreButton = `<details id="more-category-menu" class="relative w-full md:w-auto">
    <summary title="Más categorías" class="cat-btn list-none cursor-pointer w-full md:w-auto px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-grillCard text-gray-300 border border-grillBorder hover:bg-grillBorder transition-all text-center">
      <i class="fa-solid fa-ellipsis mr-1 sm:mr-2"></i>Más
    </summary>
    <div class="absolute right-0 top-full z-50 mt-2 flex min-w-48 flex-col gap-1 rounded-xl border border-grillBorder bg-grillCard p-2 shadow-xl">
      ${secondaryCategories.map(category => renderCategoryButton(category, categories.indexOf(category))).join('')}
    </div>
  </details>`;
  buttons.innerHTML = [renderCategoryButton(null, -1), ...primaryCategories.map(category => renderCategoryButton(category, categories.indexOf(category))), moreButton].join('');
  main.innerHTML = categories.map(category => `
    <section id="section-${category.id}" data-category="${category.id}" class="menu-section space-y-6">
      <div class="border-l-4 border-grillRed pl-4">
        <h2 class="font-heading text-2xl sm:text-3xl font-extrabold text-white">${escapeHtml(category.name)}</h2>
        <p class="text-gray-400 text-sm">${category.products.length} ${category.products.length === 1 ? 'producto' : 'productos'}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">${category.products.map(product => renderProduct(product, category.name)).join('')}</div>
    </section>`).join('');
  main.setAttribute('aria-busy', 'false');
  main.classList.remove('hidden');
  filterCategory('all', buttons.querySelector('.cat-btn'));

  main.addEventListener('click', event => {
    const button = event.target.closest('[data-add-product]');
    if (!button) return;
    const presentation = button.dataset.presentation;
    const choice = button.closest('article').querySelector('[data-product-choice]')?.value;
    const itemName = button.dataset.itemName || (choice
      ? `${button.dataset.product} - ${choice} (${presentation})`
      : presentation === 'Estándar'
      ? button.dataset.product
      : `${button.dataset.product} (${presentation})`);
    addToCart(itemName, Number(button.dataset.price), button.dataset.image);
  });
}

async function loadMenu() {
  const main = document.getElementById('menu-content');
  const buttons = document.getElementById('menu-category-buttons');

  try {
    const categories = organizeMenu(parseMenu(window.JHUNAY_MENU_CSV));
    if (categories.length === 0) throw new Error('El archivo del menú no contiene productos.');
    renderMenu(categories);
  } catch (error) {
    main.classList.remove('hidden');
    main.setAttribute('aria-busy', 'false');
    main.innerHTML = `<p role="alert" class="text-center text-red-300">No se pudo cargar el menú. ${escapeHtml(error.message)}</p>`;
    buttons.innerHTML = '';
    console.error(error);
  }
}

loadMenu();
