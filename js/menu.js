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
  { name: 'Bebidas', sources: ['BEBIDAS Y MALTEADAS', 'CERVEZAS', 'VINOS'] },
  { name: 'Coctelería', sources: ['MICHELADAS Y CÓCTELES', 'PECERAS Y ESPECIALES'] },
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
  const wingSauces = categoriesByName.get('alitas (salsas varias)')?.products.map(product => product.name.replace(/^Alitas\s*/i, '')) || [];

  return menuGroups.map(group => {
    let products = group.sources.flatMap(source => categoriesByName.get(source.toLocaleLowerCase('es'))?.products || []);

    if (group.sources.includes('ALITAS (SALSAS VARIAS)')) {
      const portions = products[0]?.variants || [];
      products = [{
        name: 'Alitas Crujientes',
        description: `Salsas disponibles: ${wingSauces.join(', ')}. Incluye papas y ensalada.`,
        choices: wingSauces,
        variants: portions.map(variant => ({
          ...variant,
          presentation: variant.presentation.replace(/Unidades/i, 'Alitas')
        }))
      }];
    }

    if (group.sources.includes('CORTES ESPECIALES')) {
      products = products.map(product => product.name === 'Costilla de Cerdo'
        ? { ...product, choices: wingSauces }
        : product);
    }

    if (group.sources.includes('COMBOS')) {
      products = products.map(product => {
        if (product.name === 'Combo 1') return { ...product, choices: wingSauces };
        if (product.name === 'Combo 2') return { ...product, choices: wingSauces, choiceCount: 2 };
        return product;
      });
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
  const categoryColors = {
    all: 'text-amber-300',
    'parrilladas-especiales': 'text-orange-400',
    'cortes-al-carbon': 'text-rose-400',
    'pastas-lasanas': 'text-amber-300',
    'pinchos-menestras': 'text-lime-400',
    'picaditas-para-compartir': 'text-yellow-300',
    'hamburguesas-artesanales': 'text-orange-300',
    salchipapas: 'text-yellow-400',
    'alitas-crujientes': 'text-red-400',
    'combos-especiales': 'text-emerald-400',
    'guarniciones-ensaladas': 'text-green-400',
    bebidas: 'text-cyan-300',
    cocteleria: 'text-fuchsia-300',
    postres: 'text-pink-300'
  };
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
  };
  const displayLabels = {
    'Parrilladas Especiales': 'Parrilladas',
    'Picaditas para Compartir': 'Picaditas',
    'Hamburguesas Artesanales': 'Hamburguesas',
    'Alitas Crujientes': 'Alitas',
    'Combos Especiales': 'Combos'
  };
  const compactLabel = compactLabels[label] || label;
  const displayLabel = displayLabels[label] || label;
  const icon = index === -1 ? 'fa-utensils' : categoryIcon(category.name);
  const iconColor = categoryColors[categoryId] || 'text-gray-300';
  const activeClasses = active ? 'bg-grillRed text-white shadow-md' : 'bg-grillCard text-gray-300 border border-grillBorder';
  return `<button type="button" title="${escapeHtml(label)}" onclick="filterCategory('${categoryId}', this)" class="cat-btn w-full md:w-auto px-2 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-start gap-1 sm:gap-2 text-left ${activeClasses} hover:bg-grillBorder transition-all"><i class="fa-solid ${icon} ${iconColor} w-4 shrink-0 text-center"></i><span class="hidden sm:inline">${escapeHtml(displayLabel)}</span><span class="sm:hidden">${escapeHtml(compactLabel)}</span></button>`;
}

function imageForProduct(name) {
  const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const imageRules = [
    ['parrillada personal', 'images/parrillada_personal.png'],
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
    ['picadita manaba', 'images/picada_manabita.png'],
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
    ['hamburguesa hawaiana', 'images/Hamburguesa_Hawaiana.png'],
    ['hamburguesa jack daniels', 'images/Hamburguesa_Jack_Daniels.png'],
    ['hamburguesa champinones', 'images/Hamburguesa_Champiñones.png'],
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
    ['batidos de frutas', 'images/Batido_Fresa.png'],
    ['milkshake', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=800'],
    ['batido', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=800'],
    ['limonada', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800'],
    ['jugo', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&q=80&w=800'],
    ['gaseosa', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&q=80&w=800'],
    ['pilsener', 'images/PILSENER.png'],
    ['club', 'images/Cerveza_CLub.png'],
    ['corona', 'images/Cerveza_Corona.png'],
    ['cerveza', 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&q=80&w=800'],
    ['tinto verano', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800'],
    ['sangria', 'images/Sangria.png'],
    ['vino hervido', 'images/vino_hervido.png'],
    ['vino', 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=800'],
    ['pecera grande', 'images/Pecera_Grande.png'],
    ['ruleta de shot', 'images/Ruleta_Shot.png'],
    ['micheladas', 'images/michelada.png'],
    ['mojito', 'images/mojito.png'],
    ['margarita', 'images/Margarita.png'],
    ['destornillador', 'images/destornillador.png'],
    ['cuba libre', 'images/Cuba_Libre.png'],
    ['tequila sunrise', 'images/Tequila_Sunrise.png'],
    ['gin tonic', 'images/Gin_Tonic.png'],
    ['daiquiri de fresa', 'images/Daiquirí_Fresa.png'],
    ['sexo en la playa', 'images/Sexo_Playa.png'],
    ['blue lagoon', 'Blue_Lagoon.png'],
    ['coctel de messi', 'images/Coctel_Messi.png'],
    ['martini', 'images/Martini.png'],
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
    ['cheesecake de frutos rojos', 'images/Cheesecake_Frutos_Rojos.png'],
    ['cheesecake de maracuya', 'images/Cheesecake_Maracuya.png'],
    ['crepe de nutella', 'images/Crepe_Nutella.png'],
    ['crepe de fresa', 'images/Crepe_Fresa.png'],
    ['helado', 'images/Helado.png']
  ];
  const match = imageRules.find(([keyword]) => normalizedName.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()));
  return match ? match[1] : 'images/parillada_personal.png';
}

function renderProduct(product, categoryName = '') {
  const image = imageForProduct(product.name);
  const compactImage = ['Bebidas', 'Coctelería'].includes(categoryName);
  const imageFrameClass = compactImage ? 'relative flex h-24 items-center justify-center overflow-hidden rounded-[20px] bg-gray-800' : 'relative';
  const imageClass = compactImage ? 'h-24 w-24 shrink-0 rounded-[20px] object-contain' : 'w-full h-40 object-cover bg-gray-800';
  const singlePrice = product.variants.length === 1
    ? product.variants[0].price
    : null;
  const lowestPrice = Math.min(...product.variants.map(variant => variant.price));
  const imagePriceLabel = singlePrice === null ? `Desde $${lowestPrice.toFixed(2)}` : `$${lowestPrice.toFixed(2)}`;
  const hasMultipleVariants = product.variants.length > 1;
  const variantOptionsId = `variant-options-${slugify(product.name)}`;
  const sauceOptionsId = `sauce-options-${slugify(product.name)}`;
  const variantButtons = product.variants.map(variant => {
    const actionLabel = singlePrice !== null ? 'Agregar' : variant.presentation;
    const priceLabel = singlePrice === null ? `<span class="shrink-0 font-bold">$${variant.price.toFixed(2)}</span>` : '';
    const buttonLayout = singlePrice === null ? 'py-2.5 text-sm justify-between' : 'py-3 text-base justify-center';
    const textAlignment = singlePrice === null ? 'text-left' : 'text-center';
    return `
    <button type="button" data-add-product data-product="${escapeHtml(product.name)}" data-item-name="${escapeHtml(variant.itemName || '')}" data-image="${escapeHtml(image)}" data-presentation="${escapeHtml(variant.presentation)}" data-price="${variant.price}" class="w-full bg-grillRed/10 hover:bg-grillRed text-grillRed hover:text-white border border-grillRed/30 px-3 ${buttonLayout} rounded-xl font-semibold transition-all flex items-center gap-2">
      <span class="${textAlignment}"><i class="fa-solid fa-plus mr-2"></i>${escapeHtml(actionLabel)}</span>
      ${priceLabel}
    </button>`;
  }).join('');
  const choices = product.choices?.length
    ? product.choiceCount > 1
      ? `<fieldset data-choice-group data-choice-limit="${product.choiceCount}" data-choice-required="${product.choiceCount}" class="space-y-2">
          <button type="button" data-toggle-sauce-options aria-expanded="false" aria-controls="${sauceOptionsId}" class="w-full rounded-xl border border-grillBorder bg-grillDark px-3 py-3 text-left text-sm font-semibold text-gray-200 transition-colors hover:border-grillGold flex items-center justify-between gap-2">
            <span data-sauce-toggle-label>Tipo de salsa</span>
            <i data-sauce-toggle-icon class="fa-solid fa-chevron-down text-xs text-grillGold"></i>
          </button>
          <div id="${sauceOptionsId}" data-sauce-options class="hidden rounded-xl border border-grillBorder bg-grillDark/60 p-3">
            <p class="mb-2 text-xs text-gray-400">Elige 2 sabores</p>
            <div class="grid grid-cols-2 gap-2">
              ${product.choices.map(choice => `<label class="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-grillBorder px-2 text-xs text-gray-300 has-[:checked]:border-grillRed has-[:checked]:bg-grillRed/10 has-[:checked]:text-white">
                <input type="checkbox" data-product-choice value="${escapeHtml(choice)}" class="h-4 w-4 shrink-0 accent-red-500">
                <span>${escapeHtml(choice)}</span>
              </label>`).join('')}
            </div>
            <p data-choice-count class="mt-2 text-xs text-gray-400" aria-live="polite">0 de ${product.choiceCount} seleccionados</p>
          </div>
        </fieldset>`
      : `<label class="block text-sm text-gray-300">Tipo de salsa
          <select data-product-choice aria-label="Tipo de salsa para ${escapeHtml(product.name)}" class="mt-1 w-full bg-grillDark border border-grillBorder rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-grillGold">
            ${product.choices.map(choice => `<option value="${escapeHtml(choice)}">${escapeHtml(choice)}</option>`).join('')}
          </select>
        </label>`
    : '';
  const variants = hasMultipleVariants
    ? `<button type="button" data-toggle-variants aria-expanded="false" aria-controls="${variantOptionsId}" class="w-full bg-grillRed/10 hover:bg-grillRed text-grillRed hover:text-white border border-grillRed/30 px-3 py-3 rounded-xl font-semibold text-base transition-all flex items-center justify-between gap-2"><span><i class="fa-solid fa-plus mr-2"></i>Agregar</span><i data-toggle-icon class="fa-solid fa-chevron-down text-xs"></i></button>
      <div id="${variantOptionsId}" data-variant-options class="hidden space-y-2">${variantButtons}</div>`
    : variantButtons;

  return `<article class="bg-grillCard border border-grillBorder rounded-xl overflow-hidden shadow-lg flex flex-col gap-4 hover:border-grillRed/50 transition-all">
    <div class="${imageFrameClass}">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" class="${imageClass}" onerror="this.onerror=null;this.src='images/parillada_personal.png'">
      <span class="absolute top-3 right-3 rounded-full border border-red-300 bg-grillRed px-3 py-1 text-sm font-bold text-white shadow-lg shadow-red-950/40">${imagePriceLabel}</span>
    </div>
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
  const sectionTitles = {
    'Parrilladas Especiales': 'Parrilladas',
    'Picaditas para Compartir': 'Picaditas',
    'Hamburguesas Artesanales': 'Hamburguesas',
    'Alitas Crujientes': 'Alitas',
    'Combos Especiales': 'Combos'
  };
  buttons.innerHTML = [renderCategoryButton(null, -1), ...categories.map((category, index) => renderCategoryButton(category, index))].join('');
  main.innerHTML = categories.map(category => `
    <section id="section-${category.id}" data-category="${category.id}" class="menu-section space-y-6">
      <div class="border-l-4 border-grillRed pl-4">
        <h2 class="font-heading text-2xl sm:text-3xl font-extrabold text-white">${escapeHtml(sectionTitles[category.name] || category.name)}</h2>
        <p class="text-gray-400 text-sm">${category.products.length} ${category.products.length === 1 ? 'producto' : 'productos'}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">${category.products.map(product => renderProduct(product, category.name)).join('')}</div>
    </section>`).join('');
  main.setAttribute('aria-busy', 'false');
  main.classList.remove('hidden');
  filterCategory('all', buttons.querySelector('.cat-btn'));

  main.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-product-choice][type="checkbox"]');
    if (!checkbox) return;

    const group = checkbox.closest('[data-choice-group]');
    const limit = Number(group.dataset.choiceLimit);
    let selected = [...group.querySelectorAll('[data-product-choice]:checked')];
    if (selected.length > limit) {
      checkbox.checked = false;
      selected = [...group.querySelectorAll('[data-product-choice]:checked')];
    }

    group.querySelectorAll('[data-product-choice]').forEach(option => {
      option.disabled = !option.checked && selected.length >= limit;
    });
    group.querySelector('[data-choice-count]').textContent = `${selected.length} de ${limit} seleccionados`;
    group.querySelector('[data-sauce-toggle-label]').textContent = selected.length
      ? selected.map(option => option.value).join(' + ')
      : 'Tipo de salsa';
  });

  main.addEventListener('click', event => {
    const sauceToggle = event.target.closest('[data-toggle-sauce-options]');
    if (sauceToggle) {
      const expanded = sauceToggle.getAttribute('aria-expanded') === 'true';
      const options = document.getElementById(sauceToggle.getAttribute('aria-controls'));
      sauceToggle.setAttribute('aria-expanded', String(!expanded));
      options?.classList.toggle('hidden', expanded);
      sauceToggle.querySelector('[data-sauce-toggle-icon]')?.classList.toggle('fa-chevron-down', expanded);
      sauceToggle.querySelector('[data-sauce-toggle-icon]')?.classList.toggle('fa-chevron-up', !expanded);
      return;
    }

    const toggleButton = event.target.closest('[data-toggle-variants]');
    if (toggleButton) {
      const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
      const options = document.getElementById(toggleButton.getAttribute('aria-controls'));
      toggleButton.setAttribute('aria-expanded', String(!expanded));
      options?.classList.toggle('hidden', expanded);
      toggleButton.querySelector('[data-toggle-icon]')?.classList.toggle('fa-chevron-down', expanded);
      toggleButton.querySelector('[data-toggle-icon]')?.classList.toggle('fa-chevron-up', !expanded);
      return;
    }

    const button = event.target.closest('[data-add-product]');
    if (!button) return;
    const presentation = button.dataset.presentation;
    const card = button.closest('article');
    const selectedSauces = [...card.querySelectorAll('[data-product-choice]')]
      .filter(option => option.type !== 'checkbox' || option.checked)
      .map(option => option.value);
    const choiceGroup = card.querySelector('[data-choice-group]');
    const requiredChoices = Number(choiceGroup?.dataset.choiceRequired || 0);
    if (selectedSauces.length < requiredChoices) {
      choiceGroup.querySelector('[data-choice-count]').textContent = `Selecciona ${requiredChoices} sabores para continuar`;
      const sauceToggle = choiceGroup.querySelector('[data-toggle-sauce-options]');
      sauceToggle?.setAttribute('aria-expanded', 'true');
      document.getElementById(sauceToggle?.getAttribute('aria-controls'))?.classList.remove('hidden');
      sauceToggle?.querySelector('[data-sauce-toggle-icon]')?.classList.replace('fa-chevron-down', 'fa-chevron-up');
      return;
    }

    const itemName = button.dataset.itemName || (selectedSauces.length
      ? `${button.dataset.product} - ${selectedSauces.join(' + ')} (${presentation})`
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
